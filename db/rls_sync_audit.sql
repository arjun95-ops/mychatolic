-- RLS + schema audit for web/mobile/admin sync
-- Run this in Supabase SQL Editor using a privileged role.

-- 1) Target table list (contract surface between web/mobile/admin)
with target_tables as (
  select unnest(array[
    'profiles',
    'posts',
    'saved_posts',
    'follows',
    'social_chats',
    'chat_members',
    'social_messages',
    'message_reactions',
    'group_join_requests',
    'notifications',
    'stories',
    'story_views',
    'story_reactions',
    'story_replies',
    'countries',
    'dioceses',
    'churches',
    'mass_schedules',
    'mass_checkins',
    'mass_checkins_v2',
    'radar_events',
    'radar_events_v2',
    'radar_participants',
    'radar_participants_v2',
    'radar_invites',
    'bible_books'
  ]) as table_name
)
select
  tt.table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from target_tables tt
left join pg_class c on c.relname = tt.table_name
left join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
order by tt.table_name;

-- 2) Policy inventory
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
  and tablename in (
    'profiles','posts','saved_posts','follows','social_chats','chat_members','social_messages',
    'message_reactions','group_join_requests',
    'notifications','stories','story_views','story_reactions','story_replies',
    'countries','dioceses','churches','mass_schedules','mass_checkins','mass_checkins_v2',
    'radar_events','radar_events_v2','radar_participants','radar_participants_v2','radar_invites','bible_books'
  )
order by tablename, command, policyname;

-- 3) Privilege matrix for anon/authenticated
with target_tables as (
  select unnest(array[
    'profiles','posts','saved_posts','follows','social_chats','chat_members','social_messages',
    'message_reactions','group_join_requests',
    'notifications','stories','story_views','story_reactions','story_replies',
    'countries','dioceses','churches','mass_schedules','mass_checkins','mass_checkins_v2',
    'radar_events','radar_events_v2','radar_participants','radar_participants_v2','radar_invites','bible_books'
  ]) as table_name
)
select
  tt.table_name,
  has_table_privilege('anon', 'public.' || tt.table_name, 'select') as anon_select,
  has_table_privilege('anon', 'public.' || tt.table_name, 'insert') as anon_insert,
  has_table_privilege('anon', 'public.' || tt.table_name, 'update') as anon_update,
  has_table_privilege('anon', 'public.' || tt.table_name, 'delete') as anon_delete,
  has_table_privilege('authenticated', 'public.' || tt.table_name, 'select') as auth_select,
  has_table_privilege('authenticated', 'public.' || tt.table_name, 'insert') as auth_insert,
  has_table_privilege('authenticated', 'public.' || tt.table_name, 'update') as auth_update,
  has_table_privilege('authenticated', 'public.' || tt.table_name, 'delete') as auth_delete
from target_tables tt
order by tt.table_name;

-- 4) Column contract audit (focus on schema drift)
with expected_columns as (
  select * from (values
    ('notifications', 'title'),
    ('notifications', 'message'),
    ('notifications', 'data'),
    ('notifications', 'is_read'),
    ('notifications', 'read_at'),
    ('notifications', 'sender_id'),
    ('notifications', 'actor_id'),
    ('notifications', 'created_at'),
    ('social_chats', 'invite_mode'),
    ('social_chats', 'invite_code'),
    ('social_chats', 'invite_link_enabled'),
    ('social_chats', 'allow_member_invite'),
    ('chat_members', 'pinned_at'),
    ('chat_members', 'archived_at'),
    ('chat_members', 'muted_until'),
    ('chat_members', 'last_read_at'),
    ('chat_members', 'unread_count'),
    ('social_messages', 'message_type'),
    ('social_messages', 'media_url'),
    ('social_messages', 'file_name'),
    ('social_messages', 'file_size'),
    ('social_messages', 'reply_to_id'),
    ('social_messages', 'is_read'),
    ('social_messages', 'read_at'),
    ('social_messages', 'reactions'),
    ('message_reactions', 'message_id'),
    ('message_reactions', 'user_id'),
    ('message_reactions', 'reaction'),
    ('group_join_requests', 'chat_id'),
    ('group_join_requests', 'user_id'),
    ('group_join_requests', 'status'),
    ('group_join_requests', 'invited_by'),
    ('group_join_requests', 'created_at'),
    ('radar_invites', 'inviter_id'),
    ('radar_invites', 'invitee_id'),
    ('radar_invites', 'radar_id'),
    ('radar_invites', 'source'),
    ('radar_invites', 'status'),
    ('radar_invites', 'note'),
    ('radar_invites', 'expires_at'),
    ('radar_invites', 'responded_at'),
    ('radar_invites', 'created_at'),
    ('radar_invites', 'updated_at'),
    ('story_views', 'story_id'),
    ('story_views', 'viewer_id'),
    ('story_reactions', 'story_id'),
    ('story_reactions', 'user_id'),
    ('story_reactions', 'reaction'),
    ('story_replies', 'story_id'),
    ('story_replies', 'sender_id'),
    ('story_replies', 'content'),
    ('countries', 'name'),
    ('countries', 'code'),
    ('dioceses', 'name'),
    ('dioceses', 'country_id'),
    ('mass_schedules', 'day_number'),
    ('mass_schedules', 'day_of_week'),
    ('mass_schedules', 'start_time'),
    ('mass_schedules', 'time_start'),
    ('mass_schedules', 'mass_time'),
    ('bible_books', 'name'),
    ('bible_books', 'book_name'),
    ('bible_books', 'grouping'),
    ('bible_books', 'testament'),
    ('bible_books', 'order_index'),
    ('bible_books', 'book_order')
  ) as t(table_name, column_name)
)
select
  e.table_name,
  e.column_name,
  (c.column_name is not null) as exists_in_db
from expected_columns e
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = e.table_name
 and c.column_name = e.column_name
order by e.table_name, e.column_name;

-- 5) RPC availability used by web/mobile parity
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'update_chat_metadata',
    'get_chat_inbox',
    'is_chat_member',
    'mark_messages_as_read',
    'join_chat',
    'join_group_by_invite',
    'join_group_by_link',
    'respond_radar_invite'
  )
order by p.proname;
