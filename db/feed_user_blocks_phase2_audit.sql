-- Feed/User Blocks Phase-2 Audit Checklist
-- Date: 2026-02-19
-- Purpose:
-- 1) Verify canonical schema integrity after phase-2 cleanup.
-- 2) Verify helper RPC/function and policy readiness.
-- 3) Surface residual legacy risks before production rollout.

-- A. Canonical schema presence
select
  c.column_name,
  c.data_type,
  c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'user_blocks'
  and c.column_name in ('blocker_id', 'blocked_user_id', 'created_at', 'reason', 'user_id', 'blocked_id')
order by c.column_name;

-- B. Integrity checks
select
  count(*) filter (where blocker_id is null) as null_blocker_id,
  count(*) filter (where blocked_user_id is null) as null_blocked_user_id,
  count(*) filter (where blocker_id = blocked_user_id) as self_block_rows
from public.user_blocks;

select
  blocker_id,
  blocked_user_id,
  count(*) as duplicate_count
from public.user_blocks
group by blocker_id, blocked_user_id
having count(*) > 1
order by duplicate_count desc;

-- C. PK and unique index visibility
select
  con.conname as constraint_name,
  con.contype as constraint_type,
  array_agg(att.attname order by ord.ordinality) as columns
from pg_constraint con
join pg_class cls on cls.oid = con.conrelid
join pg_namespace nsp on nsp.oid = cls.relnamespace
join unnest(con.conkey) with ordinality as ord(attnum, ordinality) on true
join pg_attribute att on att.attrelid = cls.oid and att.attnum = ord.attnum
where nsp.nspname = 'public'
  and cls.relname = 'user_blocks'
  and con.contype in ('p', 'u', 'c')
group by con.conname, con.contype
order by con.contype, con.conname;

-- D. Helper function and RPC availability
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('has_block_relation_with_auth', 'get_blocked_users_for_auth')
order by p.proname;

-- E. Policy inventory for block-sensitive tables
select
  tablename,
  policyname,
  cmd as command,
  roles,
  permissive,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('user_blocks', 'posts', 'comments', 'likes', 'post_shares', 'saved_posts')
order by tablename, command, policyname;

-- E2. Legacy user_blocks policy residue (expect: 0 rows)
select
  tablename,
  policyname,
  cmd as command
from pg_policies
where schemaname = 'public'
  and tablename = 'user_blocks'
  and policyname in ('user_blocks_select_own', 'user_blocks_insert_own', 'user_blocks_delete_own')
order by policyname;

-- E3. Non-canonical feed policies (review manually; expect 0 rows unless you intentionally keep custom policies)
select
  tablename,
  policyname,
  cmd as command,
  permissive
from pg_policies
where schemaname = 'public'
  and tablename in ('user_blocks', 'posts', 'comments', 'likes', 'post_shares', 'saved_posts')
  and (
    (tablename = 'user_blocks' and policyname not in (
      'user_blocks_select_own_relations',
      'user_blocks_insert_self',
      'user_blocks_delete_self'
    ))
    or (tablename = 'posts' and policyname not in (
      'Public read',
      'posts_auth_select',
      'posts_auth_insert_self',
      'posts_auth_update_self',
      'posts_auth_delete_self',
      'posts_block_restrict_select',
      'posts_select_block_restrictive'
    ))
    or (tablename = 'comments' and policyname not in (
      'Public read comments',
      'comments_auth_select',
      'comments_auth_insert_self',
      'comments_auth_update_self',
      'comments_auth_delete_self',
      'comments_block_restrict_select',
      'comments_block_restrict_insert'
    ))
    or (tablename = 'likes' and policyname not in (
      'Public read likes',
      'likes_auth_select',
      'likes_auth_insert_self',
      'likes_auth_delete_self',
      'likes_block_restrict_select',
      'likes_block_restrict_insert'
    ))
    or (tablename = 'post_shares' and policyname not in (
      'Post shares are viewable by everyone',
      'post_shares_auth_select',
      'post_shares_auth_insert_self',
      'post_shares_auth_delete_self',
      'post_shares_block_restrict_select',
      'post_shares_block_restrict_insert'
    ))
    or (tablename = 'saved_posts' and policyname not in (
      'saved_posts_auth_select_self',
      'saved_posts_auth_insert_self',
      'saved_posts_auth_delete_self',
      'saved_posts_block_restrict_select',
      'saved_posts_block_restrict_insert'
    ))
  )
order by tablename, command, policyname;

-- E4. RLS status on block-sensitive tables (expect rls_enabled = true)
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('user_blocks', 'posts', 'comments', 'likes', 'post_shares', 'saved_posts')
order by c.relname;

-- F. Legacy table residue (expect null after full canonical migration)
select to_regclass('public.blocked_users') as blocked_users_table;

-- G. Runtime smoke query under current session user
-- Expect: zero or more rows, no error.
select * from public.get_blocked_users_for_auth() limit 20;
