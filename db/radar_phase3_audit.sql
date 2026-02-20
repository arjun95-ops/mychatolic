-- Radar Phase-3 Audit Checklist
-- Date: 2026-02-20
-- Purpose:
-- 1) Verify radar invite schema and integrity.
-- 2) Verify radar comments + likes readiness.
-- 3) Verify RPC, RLS, and policy canonical state for radar invite/comments modules.

-- A. Table presence
select
  to_regclass('public.radar_events') as radar_events_table,
  to_regclass('public.radar_participants') as radar_participants_table,
  to_regclass('public.radar_invites') as radar_invites_table,
  to_regclass('public.radar_comments') as radar_comments_table,
  to_regclass('public.radar_comment_likes') as radar_comment_likes_table;

-- B. Canonical column presence
select
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in ('radar_invites', 'radar_comments', 'radar_comment_likes')
  and (
    (c.table_name = 'radar_invites' and c.column_name in (
      'id', 'inviter_id', 'invitee_id', 'radar_id', 'source', 'status', 'note',
      'expires_at', 'responded_at', 'created_at', 'updated_at'
    ))
    or
    (c.table_name = 'radar_comments' and c.column_name in (
      'id', 'user_id', 'radar_id', 'parent_id', 'content', 'image_url', 'created_at', 'updated_at'
    ))
    or
    (c.table_name = 'radar_comment_likes' and c.column_name in (
      'id', 'user_id', 'radar_comment_id', 'radar_id', 'created_at'
    ))
  )
order by c.table_name, c.column_name;

-- C. Radar invites integrity checks
select
  count(*) filter (where ri.inviter_id is null) as null_inviter_id,
  count(*) filter (where ri.invitee_id is null) as null_invitee_id,
  count(*) filter (where ri.inviter_id = ri.invitee_id) as self_invite_rows,
  count(*) filter (where p_inviter.id is null) as orphan_inviter_rows,
  count(*) filter (where p_invitee.id is null) as orphan_invitee_rows,
  count(*) filter (
    where coalesce(upper(ri.status), '') not in (
      'PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED',
      'JOINED', 'APPROVED', 'REJECTED', 'REQUESTED', 'INVITED'
    )
  ) as invalid_status_rows
from public.radar_invites ri
left join public.profiles p_inviter on p_inviter.id = ri.inviter_id
left join public.profiles p_invitee on p_invitee.id = ri.invitee_id;

select
  inviter_id,
  invitee_id,
  coalesce(radar_id::text, '00000000-0000-0000-0000-000000000000') as radar_scope,
  count(*) as duplicate_count
from public.radar_invites
group by inviter_id, invitee_id, coalesce(radar_id::text, '00000000-0000-0000-0000-000000000000')
having count(*) > 1
order by duplicate_count desc;

-- D. Radar comments integrity checks
select
  count(*) filter (where user_id is null) as null_user_id,
  count(*) filter (where radar_id is null) as null_radar_id,
  count(*) filter (where nullif(trim(content), '') is null) as blank_content_rows,
  count(*) filter (where parent_id is not null and parent_id = id) as self_parent_rows,
  count(*) filter (
    where parent_id is not null
      and not exists (
        select 1
        from public.radar_comments p
        where p.id = c.parent_id
      )
  ) as orphan_parent_rows,
  count(*) filter (
    where parent_id is not null
      and exists (
        select 1
        from public.radar_comments p
        where p.id = c.parent_id
          and p.radar_id is distinct from c.radar_id
      )
  ) as cross_radar_parent_rows
from public.radar_comments c;

-- E. Radar comment likes integrity checks
select
  count(*) filter (where rcl.user_id is null) as null_user_id,
  count(*) filter (where rcl.radar_comment_id is null) as null_comment_id,
  count(*) filter (where rcl.radar_id is null) as null_radar_id,
  count(*) filter (where rc.id is null) as orphan_comment_like_rows,
  count(*) filter (where p.id is null) as orphan_user_like_rows,
  count(*) filter (where rc.id is not null and rc.radar_id is distinct from rcl.radar_id) as mismatched_radar_rows
from public.radar_comment_likes rcl
left join public.radar_comments rc on rc.id = rcl.radar_comment_id
left join public.profiles p on p.id = rcl.user_id;

select
  user_id,
  radar_comment_id,
  count(*) as duplicate_count
from public.radar_comment_likes
group by user_id, radar_comment_id
having count(*) > 1
order by duplicate_count desc;

-- F. Constraint inventory (invites + comments + likes)
select
  cls.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cls on cls.oid = con.conrelid
join pg_namespace nsp on nsp.oid = cls.relnamespace
where nsp.nspname = 'public'
  and cls.relname in ('radar_invites', 'radar_comments', 'radar_comment_likes')
order by cls.relname, con.contype, con.conname;

-- G. RPC availability snapshot
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'join_radar_event',
    'respond_radar_invite',
    'get_radar_comment_likes_summary'
  )
order by p.proname;

-- H. Policy inventory
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
  and tablename in ('radar_invites', 'radar_comments', 'radar_comment_likes')
order by tablename, command, policyname;

-- H2. Non-canonical policies (expect: 0 rows unless intentionally customized)
select
  tablename,
  policyname,
  cmd as command,
  permissive
from pg_policies
where schemaname = 'public'
  and tablename in ('radar_invites', 'radar_comments', 'radar_comment_likes')
  and (
    (tablename = 'radar_invites' and policyname not in (
      'radar_invites_select_own',
      'radar_invites_insert_self_inviter',
      'radar_invites_update_scope',
      'radar_invites_delete_scope'
    ))
    or
    (tablename = 'radar_comments' and policyname not in (
      'radar_comments_public_select',
      'radar_comments_auth_insert_self',
      'radar_comments_auth_update_self',
      'radar_comments_auth_delete_self'
    ))
    or
    (tablename = 'radar_comment_likes' and policyname not in (
      'radar_comment_likes_public_select',
      'radar_comment_likes_auth_insert_self',
      'radar_comment_likes_auth_delete_self'
    ))
  )
order by tablename, command, policyname;

-- I. RLS status
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('radar_invites', 'radar_comments', 'radar_comment_likes')
order by c.relname;

-- J. Index inventory
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('radar_invites', 'radar_comments', 'radar_comment_likes')
order by tablename, indexname;

-- K. Runtime smoke queries under current session user
-- Expect: zero or more rows, no error.
select id, inviter_id, invitee_id, radar_id, source, status, created_at
from public.radar_invites
order by created_at desc
limit 20;

select id, radar_id, parent_id, content, image_url, created_at
from public.radar_comments
order by created_at desc
limit 20;

select id, radar_comment_id, radar_id, created_at
from public.radar_comment_likes
order by created_at desc
limit 20;

-- L. Production readiness summary (single-row verdict)
with invite_integrity as (
  select
    count(*) filter (where ri.inviter_id is null) as null_inviter_id,
    count(*) filter (where ri.invitee_id is null) as null_invitee_id,
    count(*) filter (where ri.inviter_id = ri.invitee_id) as self_invite_rows,
    count(*) filter (where p_inviter.id is null) as orphan_inviter_rows,
    count(*) filter (where p_invitee.id is null) as orphan_invitee_rows,
    count(*) filter (
      where coalesce(upper(ri.status), '') not in (
        'PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED',
        'JOINED', 'APPROVED', 'REJECTED', 'REQUESTED', 'INVITED'
      )
    ) as invalid_status_rows
  from public.radar_invites ri
  left join public.profiles p_inviter on p_inviter.id = ri.inviter_id
  left join public.profiles p_invitee on p_invitee.id = ri.invitee_id
),
invite_duplicates as (
  select count(*) as duplicate_triplets
  from (
    select inviter_id, invitee_id, coalesce(radar_id::text, '00000000-0000-0000-0000-000000000000') as radar_scope
    from public.radar_invites
    group by inviter_id, invitee_id, coalesce(radar_id::text, '00000000-0000-0000-0000-000000000000')
    having count(*) > 1
  ) d
),
comments_integrity as (
  select
    count(*) filter (where user_id is null) as null_user_id,
    count(*) filter (where radar_id is null) as null_radar_id,
    count(*) filter (where nullif(trim(content), '') is null) as blank_content_rows,
    count(*) filter (where parent_id is not null and parent_id = id) as self_parent_rows,
    count(*) filter (
      where parent_id is not null
        and not exists (
          select 1
          from public.radar_comments p
          where p.id = c.parent_id
        )
    ) as orphan_parent_rows,
    count(*) filter (
      where parent_id is not null
        and exists (
          select 1
          from public.radar_comments p
          where p.id = c.parent_id
            and p.radar_id is distinct from c.radar_id
        )
    ) as cross_radar_parent_rows
  from public.radar_comments c
),
likes_integrity as (
  select
    count(*) filter (where rcl.user_id is null) as null_user_id,
    count(*) filter (where rcl.radar_comment_id is null) as null_comment_id,
    count(*) filter (where rcl.radar_id is null) as null_radar_id,
    count(*) filter (where rc.id is null) as orphan_comment_like_rows,
    count(*) filter (where p.id is null) as orphan_user_like_rows,
    count(*) filter (where rc.id is not null and rc.radar_id is distinct from rcl.radar_id) as mismatched_radar_rows
  from public.radar_comment_likes rcl
  left join public.radar_comments rc on rc.id = rcl.radar_comment_id
  left join public.profiles p on p.id = rcl.user_id
),
likes_duplicates as (
  select count(*) as duplicate_pairs
  from (
    select user_id, radar_comment_id
    from public.radar_comment_likes
    group by user_id, radar_comment_id
    having count(*) > 1
  ) d
),
rpc_readiness as (
  select bool_and(flag) as all_rpc_available
  from (
    select exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'join_radar_event'
    ) as flag
    union all
    select exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'respond_radar_invite'
    )
    union all
    select exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'get_radar_comment_likes_summary'
    )
  ) t
),
non_canonical_policies as (
  select count(*) as non_canonical_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('radar_invites', 'radar_comments', 'radar_comment_likes')
    and (
      (tablename = 'radar_invites' and policyname not in (
        'radar_invites_select_own',
        'radar_invites_insert_self_inviter',
        'radar_invites_update_scope',
        'radar_invites_delete_scope'
      ))
      or
      (tablename = 'radar_comments' and policyname not in (
        'radar_comments_public_select',
        'radar_comments_auth_insert_self',
        'radar_comments_auth_update_self',
        'radar_comments_auth_delete_self'
      ))
      or
      (tablename = 'radar_comment_likes' and policyname not in (
        'radar_comment_likes_public_select',
        'radar_comment_likes_auth_insert_self',
        'radar_comment_likes_auth_delete_self'
      ))
    )
),
rls_state as (
  select coalesce(bool_and(c.relrowsecurity), false) as all_rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('radar_invites', 'radar_comments', 'radar_comment_likes')
)
select
  (ii.null_inviter_id = 0
    and ii.null_invitee_id = 0
    and ii.self_invite_rows = 0
    and ii.orphan_inviter_rows = 0
    and ii.orphan_invitee_rows = 0
    and ii.invalid_status_rows = 0
    and idu.duplicate_triplets = 0) as radar_invites_integrity_ok,
  (ci.null_user_id = 0
    and ci.null_radar_id = 0
    and ci.blank_content_rows = 0
    and ci.self_parent_rows = 0
    and ci.orphan_parent_rows = 0
    and ci.cross_radar_parent_rows = 0) as radar_comments_integrity_ok,
  (li.null_user_id = 0
    and li.null_comment_id = 0
    and li.null_radar_id = 0
    and li.orphan_comment_like_rows = 0
    and li.orphan_user_like_rows = 0
    and li.mismatched_radar_rows = 0
    and ld.duplicate_pairs = 0) as radar_comment_likes_integrity_ok,
  coalesce(rr.all_rpc_available, false) as radar_rpc_ok,
  (ncp.non_canonical_policy_count = 0) as radar_policies_ok,
  rs.all_rls_enabled as radar_rls_ok,
  (
    (ii.null_inviter_id = 0
      and ii.null_invitee_id = 0
      and ii.self_invite_rows = 0
      and ii.orphan_inviter_rows = 0
      and ii.orphan_invitee_rows = 0
      and ii.invalid_status_rows = 0
      and idu.duplicate_triplets = 0)
    and
    (ci.null_user_id = 0
      and ci.null_radar_id = 0
      and ci.blank_content_rows = 0
      and ci.self_parent_rows = 0
      and ci.orphan_parent_rows = 0
      and ci.cross_radar_parent_rows = 0)
    and
    (li.null_user_id = 0
      and li.null_comment_id = 0
      and li.null_radar_id = 0
      and li.orphan_comment_like_rows = 0
      and li.orphan_user_like_rows = 0
      and li.mismatched_radar_rows = 0
      and ld.duplicate_pairs = 0)
    and coalesce(rr.all_rpc_available, false)
    and ncp.non_canonical_policy_count = 0
    and rs.all_rls_enabled
  ) as production_ready
from invite_integrity ii
cross join invite_duplicates idu
cross join comments_integrity ci
cross join likes_integrity li
cross join likes_duplicates ld
cross join rpc_readiness rr
cross join non_canonical_policies ncp
cross join rls_state rs;
