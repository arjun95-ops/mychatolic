-- Feed/User Blocks Phase-2 Cleanup (Safe / Non-destructive)
-- Date: 2026-02-19
-- Purpose:
-- 1) Canonicalize to blocker_id + blocked_user_id without breaking legacy installs.
-- 2) Enforce core integrity checks for block relations.
-- 3) Recreate helper functions with canonical behavior.

-- Ensure canonical columns exist.
alter table if exists public.user_blocks
  add column if not exists blocker_id uuid references public.profiles(id) on delete cascade,
  add column if not exists blocked_user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists reason text,
  add column if not exists created_at timestamptz default now();

-- Backfill canonical columns from legacy columns when present.
do $$
begin
  if to_regclass('public.user_blocks') is null then
    raise notice 'public.user_blocks does not exist, skip phase-2 cleanup';
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
end;
$$;

-- Integrity guards: stop if canonical columns still invalid.
do $$
begin
  if to_regclass('public.user_blocks') is null then
    return;
  end if;

  if exists (
    select 1
    from public.user_blocks
    where blocker_id is null or blocked_user_id is null
  ) then
    raise exception 'Phase-2 cleanup aborted: blocker_id/blocked_user_id still NULL';
  end if;

  if exists (
    select 1
    from public.user_blocks
    where blocker_id = blocked_user_id
  ) then
    raise exception 'Phase-2 cleanup aborted: self-block rows still exist';
  end if;

  if exists (
    select 1
    from (
      select blocker_id, blocked_user_id, count(*) as row_count
      from public.user_blocks
      group by blocker_id, blocked_user_id
      having count(*) > 1
    ) d
  ) then
    raise exception 'Phase-2 cleanup aborted: duplicate blocker_id/blocked_user_id pairs exist';
  end if;
end;
$$;

-- Enforce canonical constraints/indexes.
alter table if exists public.user_blocks
  alter column blocker_id set not null,
  alter column blocked_user_id set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

create index if not exists idx_user_blocks_blocker_id on public.user_blocks(blocker_id);
create index if not exists idx_user_blocks_blocked_user_id on public.user_blocks(blocked_user_id);
create unique index if not exists idx_user_blocks_unique_pair on public.user_blocks(blocker_id, blocked_user_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_blocks_no_self_block'
      and conrelid = 'public.user_blocks'::regclass
  ) then
    alter table public.user_blocks
      add constraint user_blocks_no_self_block check (blocker_id <> blocked_user_id);
  end if;
end;
$$;

-- Canonicalize user_blocks policies (drop legacy duplicates first).
drop policy if exists user_blocks_select_own on public.user_blocks;
drop policy if exists user_blocks_select_own_relations on public.user_blocks;
create policy user_blocks_select_own_relations
on public.user_blocks
for select
to authenticated
using (
  blocker_id = auth.uid()
  or blocked_user_id = auth.uid()
);

drop policy if exists user_blocks_insert_own on public.user_blocks;
drop policy if exists user_blocks_insert_self on public.user_blocks;
create policy user_blocks_insert_self
on public.user_blocks
for insert
to authenticated
with check (
  blocker_id = auth.uid()
  and blocked_user_id <> auth.uid()
);

drop policy if exists user_blocks_delete_own on public.user_blocks;
drop policy if exists user_blocks_delete_self on public.user_blocks;
create policy user_blocks_delete_self
on public.user_blocks
for delete
to authenticated
using (blocker_id = auth.uid());

-- Canonical helper function for block checks.
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

-- Canonical RPC for blocked-users list.
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
    where
      auth.uid() is not null
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

-- Refresh PostgREST schema cache.
do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception
  when others then
    null;
end;
$$;

-- Readiness checks (manual review before dropping legacy columns):
-- 1) Check legacy columns still exist:
--    select column_name from information_schema.columns
--    where table_schema='public' and table_name='user_blocks'
--      and column_name in ('user_id','blocked_id');
-- 2) Check PK columns:
--    select a.attname as pk_column
--    from pg_index i
--    join pg_class c on c.oid = i.indrelid
--    join pg_namespace n on n.oid = c.relnamespace
--    join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
--    where n.nspname='public' and c.relname='user_blocks' and i.indisprimary
--    order by a.attname;
