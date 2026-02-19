-- Feed/User Blocks Final Canonical SQL
-- Date: 2026-02-19
-- Run this script once in Supabase SQL Editor.
-- This replaces iterative hotfix/cleanup scripts with one canonical setup.

create extension if not exists pgcrypto;

-- 1) Canonical table shape
create table if not exists public.user_blocks (
  id uuid default gen_random_uuid(),
  blocker_id uuid,
  blocked_user_id uuid,
  reason text,
  created_at timestamptz not null default now()
);

alter table if exists public.user_blocks
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists blocker_id uuid,
  add column if not exists blocked_user_id uuid,
  add column if not exists reason text,
  add column if not exists created_at timestamptz default now();

-- 2) Data normalization from legacy columns + integrity cleanup
do $$
begin
  if to_regclass('public.user_blocks') is null then
    raise exception 'public.user_blocks not found';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_blocks'
      and column_name = 'user_id'
  ) then
    execute $sql$
      update public.user_blocks
      set blocker_id = coalesce(blocker_id, user_id)
      where blocker_id is null
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_blocks'
      and column_name = 'blocked_id'
  ) then
    execute $sql$
      update public.user_blocks
      set blocked_user_id = coalesce(blocked_user_id, blocked_id)
      where blocked_user_id is null
    $sql$;
  end if;

  update public.user_blocks
  set created_at = now()
  where created_at is null;

  -- Remove broken rows (legacy residue)
  delete from public.user_blocks
  where blocker_id is null
     or blocked_user_id is null
     or blocker_id = blocked_user_id;

  -- Remove rows that point to missing profiles
  delete from public.user_blocks ub
  where not exists (select 1 from public.profiles p where p.id = ub.blocker_id)
     or not exists (select 1 from public.profiles p where p.id = ub.blocked_user_id);

  -- Deduplicate canonical pairs, keep latest row
  with ranked as (
    select
      ctid,
      row_number() over (
        partition by blocker_id, blocked_user_id
        order by created_at desc, ctid desc
      ) as rn
    from public.user_blocks
  )
  delete from public.user_blocks ub
  using ranked r
  where ub.ctid = r.ctid
    and r.rn > 1;

  if exists (
    select 1
    from public.user_blocks
    where blocker_id is null
       or blocked_user_id is null
       or blocker_id = blocked_user_id
  ) then
    raise exception 'user_blocks normalization failed';
  end if;
end;
$$;

-- 3) Constraints + indexes
alter table if exists public.user_blocks
  alter column blocker_id set not null,
  alter column blocked_user_id set not null,
  alter column created_at set not null,
  alter column created_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_blocks'::regclass
      and conname = 'user_blocks_no_self_block'
  ) then
    alter table public.user_blocks
      add constraint user_blocks_no_self_block check (blocker_id <> blocked_user_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_blocks'::regclass
      and conname = 'user_blocks_blocker_fk'
  ) then
    alter table public.user_blocks
      add constraint user_blocks_blocker_fk
      foreign key (blocker_id) references public.profiles(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_blocks'::regclass
      and conname = 'user_blocks_blocked_fk'
  ) then
    alter table public.user_blocks
      add constraint user_blocks_blocked_fk
      foreign key (blocked_user_id) references public.profiles(id) on delete cascade;
  end if;
end;
$$;

create index if not exists idx_user_blocks_blocker_id on public.user_blocks(blocker_id);
create index if not exists idx_user_blocks_blocked_user_id on public.user_blocks(blocked_user_id);
create unique index if not exists idx_user_blocks_unique_pair
  on public.user_blocks(blocker_id, blocked_user_id);

-- 4) User-blocks RLS (canonical)
do $$
declare
  pol record;
begin
  alter table public.user_blocks enable row level security;
  grant select, insert, delete on table public.user_blocks to authenticated;

  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_blocks'
  loop
    execute format('drop policy if exists %I on public.user_blocks', pol.policyname);
  end loop;

  create policy user_blocks_select_own_relations
  on public.user_blocks
  for select
  to authenticated
  using (
    blocker_id = auth.uid()
    or blocked_user_id = auth.uid()
  );

  create policy user_blocks_insert_self
  on public.user_blocks
  for insert
  to authenticated
  with check (
    blocker_id = auth.uid()
    and blocked_user_id <> auth.uid()
  );

  create policy user_blocks_delete_self
  on public.user_blocks
  for delete
  to authenticated
  using (blocker_id = auth.uid());
end;
$$;

-- 5) Canonical helper functions
create or replace function public.has_block_relation_with_auth(target_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    auth.uid() is not null
    and target_user_id is not null
    and exists (
      select 1
      from public.user_blocks ub
      where
        (ub.blocker_id = auth.uid() and ub.blocked_user_id = target_user_id)
        or (ub.blocker_id = target_user_id and ub.blocked_user_id = auth.uid())
    );
$$;

revoke all on function public.has_block_relation_with_auth(uuid) from public;
grant execute on function public.has_block_relation_with_auth(uuid) to authenticated;

create or replace function public.get_blocked_users_for_auth()
returns table (
  blocked_user_id uuid,
  full_name text,
  avatar_url text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select
      ub.blocked_user_id,
      max(ub.created_at) as blocked_at
    from public.user_blocks ub
    where auth.uid() is not null
      and ub.blocker_id = auth.uid()
    group by ub.blocked_user_id
  )
  select
    ranked.blocked_user_id,
    coalesce(
      nullif(trim(to_jsonb(p) ->> 'full_name'), ''),
      nullif(trim(to_jsonb(p) ->> 'display_name'), ''),
      nullif(trim(to_jsonb(p) ->> 'name'), ''),
      nullif(trim(to_jsonb(p) ->> 'username'), ''),
      'Umat'
    ) as full_name,
    (to_jsonb(p) ->> 'avatar_url') as avatar_url,
    ranked.blocked_at
  from ranked
  left join public.profiles p on p.id = ranked.blocked_user_id
  order by ranked.blocked_at desc;
$$;

revoke all on function public.get_blocked_users_for_auth() from public;
grant execute on function public.get_blocked_users_for_auth() to authenticated;

-- 6) Feed table policies (reset to canonical)

-- POSTS
do $$
declare
  pol record;
begin
  if to_regclass('public.posts') is null then
    return;
  end if;

  alter table public.posts enable row level security;
  grant select, insert, update, delete on table public.posts to authenticated;
  grant select on table public.posts to anon;

  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'posts'
  loop
    execute format('drop policy if exists %I on public.posts', pol.policyname);
  end loop;

  create policy "Public read"
  on public.posts
  for select
  to public
  using (true);

  create policy posts_auth_select
  on public.posts
  for select
  to authenticated
  using (true);

  create policy posts_auth_insert_self
  on public.posts
  for insert
  to authenticated
  with check (user_id = auth.uid());

  create policy posts_auth_update_self
  on public.posts
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

  create policy posts_auth_delete_self
  on public.posts
  for delete
  to authenticated
  using (user_id = auth.uid());

  create policy posts_block_restrict_select
  on public.posts
  as restrictive
  for select
  to authenticated
  using (not public.has_block_relation_with_auth(user_id));

  -- Keep existing private-profile concept if helper functions are present.
  if to_regprocedure('public.can_access_profile(uuid)') is not null
     and to_regprocedure('public.can_view_private_profile_content(uuid)') is not null then
    create policy posts_select_block_restrictive
    on public.posts
    as restrictive
    for select
    to authenticated
    using (
      can_access_profile(user_id)
      and can_view_private_profile_content(user_id)
    );
  end if;
end;
$$;

-- COMMENTS
do $$
declare
  pol record;
begin
  if to_regclass('public.comments') is null then
    return;
  end if;

  alter table public.comments enable row level security;
  grant select, insert, update, delete on table public.comments to authenticated;
  grant select on table public.comments to anon;

  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'comments'
  loop
    execute format('drop policy if exists %I on public.comments', pol.policyname);
  end loop;

  create policy "Public read comments"
  on public.comments
  for select
  to public
  using (true);

  create policy comments_auth_select
  on public.comments
  for select
  to authenticated
  using (true);

  create policy comments_auth_insert_self
  on public.comments
  for insert
  to authenticated
  with check (user_id = auth.uid());

  create policy comments_auth_update_self
  on public.comments
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

  create policy comments_auth_delete_self
  on public.comments
  for delete
  to authenticated
  using (user_id = auth.uid());

  create policy comments_block_restrict_select
  on public.comments
  as restrictive
  for select
  to authenticated
  using (
    not public.has_block_relation_with_auth(user_id)
    and exists (
      select 1
      from public.posts p
      where p.id = post_id
        and not public.has_block_relation_with_auth(p.user_id)
    )
  );

  create policy comments_block_restrict_insert
  on public.comments
  as restrictive
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.posts p
      where p.id = post_id
        and not public.has_block_relation_with_auth(p.user_id)
    )
  );
end;
$$;

-- LIKES
do $$
declare
  pol record;
begin
  if to_regclass('public.likes') is null then
    return;
  end if;

  alter table public.likes enable row level security;
  grant select, insert, delete on table public.likes to authenticated;
  grant select on table public.likes to anon;

  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'likes'
  loop
    execute format('drop policy if exists %I on public.likes', pol.policyname);
  end loop;

  create policy "Public read likes"
  on public.likes
  for select
  to public
  using (true);

  create policy likes_auth_select
  on public.likes
  for select
  to authenticated
  using (true);

  create policy likes_auth_insert_self
  on public.likes
  for insert
  to authenticated
  with check (user_id = auth.uid());

  create policy likes_auth_delete_self
  on public.likes
  for delete
  to authenticated
  using (user_id = auth.uid());

  create policy likes_block_restrict_select
  on public.likes
  as restrictive
  for select
  to authenticated
  using (
    not public.has_block_relation_with_auth(user_id)
    and exists (
      select 1
      from public.posts p
      where p.id = post_id
        and not public.has_block_relation_with_auth(p.user_id)
    )
  );

  create policy likes_block_restrict_insert
  on public.likes
  as restrictive
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.posts p
      where p.id = post_id
        and not public.has_block_relation_with_auth(p.user_id)
    )
  );
end;
$$;

-- POST_SHARES
do $$
declare
  pol record;
begin
  if to_regclass('public.post_shares') is null then
    return;
  end if;

  alter table public.post_shares enable row level security;
  grant select, insert, delete on table public.post_shares to authenticated;
  grant select on table public.post_shares to anon;

  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'post_shares'
  loop
    execute format('drop policy if exists %I on public.post_shares', pol.policyname);
  end loop;

  create policy "Post shares are viewable by everyone"
  on public.post_shares
  for select
  to public
  using (true);

  create policy post_shares_auth_select
  on public.post_shares
  for select
  to authenticated
  using (true);

  create policy post_shares_auth_insert_self
  on public.post_shares
  for insert
  to authenticated
  with check (user_id = auth.uid());

  create policy post_shares_auth_delete_self
  on public.post_shares
  for delete
  to authenticated
  using (user_id = auth.uid());

  create policy post_shares_block_restrict_select
  on public.post_shares
  as restrictive
  for select
  to authenticated
  using (
    not public.has_block_relation_with_auth(user_id)
    and exists (
      select 1
      from public.posts p
      where p.id = post_id
        and not public.has_block_relation_with_auth(p.user_id)
    )
  );

  create policy post_shares_block_restrict_insert
  on public.post_shares
  as restrictive
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.posts p
      where p.id = post_id
        and not public.has_block_relation_with_auth(p.user_id)
    )
  );
end;
$$;

-- SAVED_POSTS
do $$
declare
  pol record;
begin
  if to_regclass('public.saved_posts') is null then
    return;
  end if;

  alter table public.saved_posts enable row level security;
  grant select, insert, delete on table public.saved_posts to authenticated;

  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_posts'
  loop
    execute format('drop policy if exists %I on public.saved_posts', pol.policyname);
  end loop;

  create policy saved_posts_auth_select_self
  on public.saved_posts
  for select
  to authenticated
  using (user_id = auth.uid());

  create policy saved_posts_auth_insert_self
  on public.saved_posts
  for insert
  to authenticated
  with check (user_id = auth.uid());

  create policy saved_posts_auth_delete_self
  on public.saved_posts
  for delete
  to authenticated
  using (user_id = auth.uid());

  create policy saved_posts_block_restrict_select
  on public.saved_posts
  as restrictive
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.posts p
      where p.id = post_id
        and not public.has_block_relation_with_auth(p.user_id)
    )
  );

  create policy saved_posts_block_restrict_insert
  on public.saved_posts
  as restrictive
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.posts p
      where p.id = post_id
        and not public.has_block_relation_with_auth(p.user_id)
    )
  );
end;
$$;

-- 7) Refresh PostgREST schema cache
do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception
  when others then
    null;
end;
$$;

