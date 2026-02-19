-- Feed/User Block Hotfix
-- Date: 2026-02-19
-- Purpose:
-- 1) Provide user block contract for web+mobile feed parity.
-- 2) Ensure blocked users are hidden in feed/comment flows.

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_user_id)
);

alter table if exists public.user_blocks
  add column if not exists blocker_id uuid references public.profiles(id) on delete cascade,
  add column if not exists blocked_user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists reason text,
  add column if not exists created_at timestamptz default now();

-- Normalize legacy schema/data so web+mobile always use blocker_id + blocked_user_id.
do $$
begin
  if to_regclass('public.user_blocks') is null then
    return;
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

    if not exists (
      select 1
      from pg_index i
      join pg_class c on c.oid = i.indrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum = any (i.indkey)
      where n.nspname = 'public'
        and c.relname = 'user_blocks'
        and i.indisprimary
        and a.attname = 'user_id'
    ) then
      begin
        execute 'alter table public.user_blocks alter column user_id drop not null';
      exception
        when others then
          null;
      end;
    end if;
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

    if not exists (
      select 1
      from pg_index i
      join pg_class c on c.oid = i.indrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum = any (i.indkey)
      where n.nspname = 'public'
        and c.relname = 'user_blocks'
        and i.indisprimary
        and a.attname = 'blocked_id'
    ) then
      begin
        execute 'alter table public.user_blocks alter column blocked_id drop not null';
      exception
        when others then
          null;
      end;
    end if;
  end if;
end;
$$;

-- Refresh PostgREST schema cache after DDL changes (safe no-op if channel unavailable).
do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception
  when others then
    null;
end;
$$;

create index if not exists idx_user_blocks_blocker_id on public.user_blocks(blocker_id);
create index if not exists idx_user_blocks_blocked_user_id on public.user_blocks(blocked_user_id);
create unique index if not exists idx_user_blocks_unique_pair on public.user_blocks(blocker_id, blocked_user_id);

-- Prevent self-blocking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_blocks_no_self_block'
      AND conrelid = 'public.user_blocks'::regclass
  ) THEN
    ALTER TABLE public.user_blocks
      ADD CONSTRAINT user_blocks_no_self_block CHECK (blocker_id <> blocked_user_id);
  END IF;
END;
$$;

grant select, insert, delete on table public.user_blocks to authenticated;

alter table if exists public.user_blocks enable row level security;

drop policy if exists user_blocks_select_own_relations on public.user_blocks;
create policy user_blocks_select_own_relations
on public.user_blocks
for select
to authenticated
using (
  blocker_id = auth.uid()
  or blocked_user_id = auth.uid()
);

drop policy if exists user_blocks_insert_self on public.user_blocks;
create policy user_blocks_insert_self
on public.user_blocks
for insert
to authenticated
with check (
  blocker_id = auth.uid()
  and blocked_user_id <> auth.uid()
);

drop policy if exists user_blocks_delete_self on public.user_blocks;
create policy user_blocks_delete_self
on public.user_blocks
for delete
to authenticated
using (blocker_id = auth.uid());

-- Helper: true when current authenticated user has a block relation with target user.
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
        (
          coalesce(
            nullif(to_jsonb(ub) ->> 'blocker_id', '')::uuid,
            nullif(to_jsonb(ub) ->> 'user_id', '')::uuid
          ) = auth.uid()
          and coalesce(
            nullif(to_jsonb(ub) ->> 'blocked_user_id', '')::uuid,
            nullif(to_jsonb(ub) ->> 'blocked_id', '')::uuid
          ) = target_user_id
        )
        or (
          coalesce(
            nullif(to_jsonb(ub) ->> 'blocker_id', '')::uuid,
            nullif(to_jsonb(ub) ->> 'user_id', '')::uuid
          ) = target_user_id
          and coalesce(
            nullif(to_jsonb(ub) ->> 'blocked_user_id', '')::uuid,
            nullif(to_jsonb(ub) ->> 'blocked_id', '')::uuid
          ) = auth.uid()
        )
    );
$$;

revoke all on function public.has_block_relation_with_auth(uuid) from public;
grant execute on function public.has_block_relation_with_auth(uuid) to authenticated;

-- Reliable blocked-users list for UI (bypass profile RLS safely using auth.uid()).
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
  with relations as (
    select
      coalesce(
        nullif(to_jsonb(ub) ->> 'blocker_id', '')::uuid,
        nullif(to_jsonb(ub) ->> 'user_id', '')::uuid
      ) as blocker,
      coalesce(
        nullif(to_jsonb(ub) ->> 'blocked_user_id', '')::uuid,
        nullif(to_jsonb(ub) ->> 'blocked_id', '')::uuid
      ) as blocked,
      ub.created_at
    from public.user_blocks ub
  ),
  ranked as (
    select
      r.blocked as blocked_user_id,
      max(r.created_at) as blocked_at
    from relations r
    where
      auth.uid() is not null
      and r.blocker = auth.uid()
      and r.blocked is not null
    group by r.blocked
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

-- Hard enforce RLS: posts
do $$
begin
  if to_regclass('public.posts') is not null then
    alter table public.posts enable row level security;

    drop policy if exists posts_auth_select on public.posts;
    create policy posts_auth_select
    on public.posts
    for select
    to authenticated
    using (true);

    drop policy if exists posts_auth_insert_self on public.posts;
    create policy posts_auth_insert_self
    on public.posts
    for insert
    to authenticated
    with check (user_id = auth.uid());

    drop policy if exists posts_auth_update_self on public.posts;
    create policy posts_auth_update_self
    on public.posts
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

    drop policy if exists posts_auth_delete_self on public.posts;
    create policy posts_auth_delete_self
    on public.posts
    for delete
    to authenticated
    using (user_id = auth.uid());

    drop policy if exists posts_block_restrict_select on public.posts;
    create policy posts_block_restrict_select
    on public.posts
    as restrictive
    for select
    to authenticated
    using (
      not public.has_block_relation_with_auth(user_id)
    );
  end if;
end;
$$;

-- Hard enforce RLS: comments
do $$
begin
  if to_regclass('public.comments') is not null then
    alter table public.comments enable row level security;

    drop policy if exists comments_auth_select on public.comments;
    create policy comments_auth_select
    on public.comments
    for select
    to authenticated
    using (true);

    drop policy if exists comments_auth_insert_self on public.comments;
    create policy comments_auth_insert_self
    on public.comments
    for insert
    to authenticated
    with check (user_id = auth.uid());

    drop policy if exists comments_auth_update_self on public.comments;
    create policy comments_auth_update_self
    on public.comments
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

    drop policy if exists comments_auth_delete_self on public.comments;
    create policy comments_auth_delete_self
    on public.comments
    for delete
    to authenticated
    using (user_id = auth.uid());

    drop policy if exists comments_block_restrict_select on public.comments;
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

    drop policy if exists comments_block_restrict_insert on public.comments;
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
  end if;
end;
$$;

-- Hard enforce RLS: likes
do $$
begin
  if to_regclass('public.likes') is not null then
    alter table public.likes enable row level security;

    drop policy if exists likes_auth_select on public.likes;
    create policy likes_auth_select
    on public.likes
    for select
    to authenticated
    using (true);

    drop policy if exists likes_auth_insert_self on public.likes;
    create policy likes_auth_insert_self
    on public.likes
    for insert
    to authenticated
    with check (user_id = auth.uid());

    drop policy if exists likes_auth_delete_self on public.likes;
    create policy likes_auth_delete_self
    on public.likes
    for delete
    to authenticated
    using (user_id = auth.uid());

    drop policy if exists likes_block_restrict_select on public.likes;
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

    drop policy if exists likes_block_restrict_insert on public.likes;
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
  end if;
end;
$$;

-- Hard enforce RLS: post_shares
do $$
begin
  if to_regclass('public.post_shares') is not null then
    alter table public.post_shares enable row level security;

    drop policy if exists post_shares_auth_select on public.post_shares;
    create policy post_shares_auth_select
    on public.post_shares
    for select
    to authenticated
    using (true);

    drop policy if exists post_shares_auth_insert_self on public.post_shares;
    create policy post_shares_auth_insert_self
    on public.post_shares
    for insert
    to authenticated
    with check (user_id = auth.uid());

    drop policy if exists post_shares_auth_delete_self on public.post_shares;
    create policy post_shares_auth_delete_self
    on public.post_shares
    for delete
    to authenticated
    using (user_id = auth.uid());

    drop policy if exists post_shares_block_restrict_select on public.post_shares;
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

    drop policy if exists post_shares_block_restrict_insert on public.post_shares;
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
  end if;
end;
$$;

-- Hard enforce RLS: saved_posts
do $$
begin
  if to_regclass('public.saved_posts') is not null then
    alter table public.saved_posts enable row level security;

    drop policy if exists saved_posts_auth_select_self on public.saved_posts;
    create policy saved_posts_auth_select_self
    on public.saved_posts
    for select
    to authenticated
    using (user_id = auth.uid());

    drop policy if exists saved_posts_auth_insert_self on public.saved_posts;
    create policy saved_posts_auth_insert_self
    on public.saved_posts
    for insert
    to authenticated
    with check (user_id = auth.uid());

    drop policy if exists saved_posts_auth_delete_self on public.saved_posts;
    create policy saved_posts_auth_delete_self
    on public.saved_posts
    for delete
    to authenticated
    using (user_id = auth.uid());

    drop policy if exists saved_posts_block_restrict_select on public.saved_posts;
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

    drop policy if exists saved_posts_block_restrict_insert on public.saved_posts;
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
  end if;
end;
$$;
