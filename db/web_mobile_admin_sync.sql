-- Web + Mobile + Admin compatibility baseline for MyChatolic
-- Safe to run multiple times on Supabase/PostgreSQL.

-- 1) Profiles: status fields and verification assets used by mobile + admin dashboard.
alter table if exists public.profiles
  add column if not exists account_status text default 'unverified',
  add column if not exists faith_status text default 'baptized',
  add column if not exists faith_verification_consent_at timestamptz,
  add column if not exists verification_submitted_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists country text,
  add column if not exists diocese text,
  add column if not exists parish text,
  add column if not exists ktp_url text,
  add column if not exists baptism_cert_url text,
  add column if not exists chrism_cert_url text,
  add column if not exists assignment_letter_url text,
  add column if not exists selfie_url text;

update public.profiles
set account_status = coalesce(
  nullif(account_status::text, ''),
  verification_status::text,
  'unverified'
)
where account_status is null or account_status::text = '';

update public.profiles
set faith_status = case
  when coalesce(is_catechumen, false) then 'catechumen'
  else coalesce(nullif(faith_status::text, ''), 'baptized')
end
where faith_status is null or faith_status::text = '';

create index if not exists idx_profiles_account_status on public.profiles(account_status);
create index if not exists idx_profiles_verification_status on public.profiles(verification_status);
create index if not exists idx_profiles_role on public.profiles(role);

-- 1b) Master location read contract for register flow (web + mobile).
-- Keep register dropdown usable under RLS.
grant usage on schema public to anon, authenticated;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'countries'
  ) then
    grant select on table public.countries to anon, authenticated;

    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'countries' and c.relrowsecurity
    ) then
      drop policy if exists countries_public_read on public.countries;
      create policy countries_public_read
      on public.countries
      for select
      to anon, authenticated
      using (true);
    end if;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'dioceses'
  ) then
    grant select on table public.dioceses to anon, authenticated;

    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'dioceses' and c.relrowsecurity
    ) then
      drop policy if exists dioceses_public_read on public.dioceses;
      create policy dioceses_public_read
      on public.dioceses
      for select
      to anon, authenticated
      using (true);
    end if;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'churches'
  ) then
    grant select on table public.churches to anon, authenticated;

    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'churches' and c.relrowsecurity
    ) then
      drop policy if exists churches_public_read on public.churches;
      create policy churches_public_read
      on public.churches
      for select
      to anon, authenticated
      using (true);
    end if;
  end if;
end;
$$;

-- 2) Saved posts contract (mobile + web shared).
create table if not exists public.saved_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

create index if not exists idx_saved_posts_user_id on public.saved_posts(user_id);
create index if not exists idx_saved_posts_post_id on public.saved_posts(post_id);

-- 3) social_chats metadata expected by web + mobile.
alter table if exists public.social_chats
  add column if not exists is_group boolean default false,
  add column if not exists group_name text,
  add column if not exists group_avatar_url text,
  add column if not exists admin_id uuid references public.profiles(id),
  add column if not exists creator_id uuid references public.profiles(id),
  add column if not exists invite_mode text default 'open',
  add column if not exists invite_code text,
  add column if not exists invite_link_enabled boolean default false,
  add column if not exists invite_link_expires_at timestamptz,
  add column if not exists allow_member_invite boolean default true;

-- 4) chat_members metadata expected by inbox and chat settings.
alter table if exists public.chat_members
  add column if not exists role text default 'member',
  add column if not exists status text default 'JOINED',
  add column if not exists joined_at timestamptz default now(),
  add column if not exists unread_count integer default 0,
  add column if not exists pinned_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists muted_until timestamptz,
  add column if not exists last_read_at timestamptz;

create index if not exists idx_chat_members_user on public.chat_members(user_id);
create index if not exists idx_chat_members_chat on public.chat_members(chat_id);

-- 5) notifications contract used by web/mobile/admin.
alter table if exists public.notifications
  add column if not exists title text,
  add column if not exists message text,
  add column if not exists data jsonb default '{}'::jsonb,
  add column if not exists is_read boolean default false,
  add column if not exists read_at timestamptz,
  add column if not exists sender_id uuid,
  add column if not exists actor_id uuid;

do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'notifications') then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'notifications_sender_id_fkey'
        and conrelid = 'public.notifications'::regclass
    ) then
      alter table public.notifications
        add constraint notifications_sender_id_fkey
        foreign key (sender_id) references public.profiles(id) on delete set null;
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'notifications_actor_id_fkey'
        and conrelid = 'public.notifications'::regclass
    ) then
      alter table public.notifications
        add constraint notifications_actor_id_fkey
        foreign key (actor_id) references public.profiles(id) on delete set null;
    end if;
  end if;
end;
$$;

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_created_at on public.notifications(created_at);
create index if not exists idx_notifications_sender_id on public.notifications(sender_id);
create index if not exists idx_notifications_actor_id on public.notifications(actor_id);

-- 6) stories interaction contract (views/reactions/replies) for web/mobile parity.
do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'stories'
  ) then
    execute $sql$
      create table if not exists public.story_views (
        id uuid primary key default gen_random_uuid(),
        story_id uuid not null references public.stories(id) on delete cascade,
        viewer_id uuid not null references public.profiles(id) on delete cascade,
        viewed_at timestamptz not null default now(),
        created_at timestamptz not null default now(),
        unique (story_id, viewer_id)
      )
    $sql$;

    execute $sql$
      create table if not exists public.story_reactions (
        id uuid primary key default gen_random_uuid(),
        story_id uuid not null references public.stories(id) on delete cascade,
        user_id uuid not null references public.profiles(id) on delete cascade,
        reaction text not null,
        created_at timestamptz not null default now(),
        unique (story_id, user_id)
      )
    $sql$;

    execute $sql$
      create table if not exists public.story_replies (
        id uuid primary key default gen_random_uuid(),
        story_id uuid not null references public.stories(id) on delete cascade,
        sender_id uuid not null references public.profiles(id) on delete cascade,
        content text not null,
        created_at timestamptz not null default now()
      )
    $sql$;

    execute 'create index if not exists idx_story_views_story_id on public.story_views(story_id)';
    execute 'create index if not exists idx_story_views_viewer_id on public.story_views(viewer_id)';
    execute 'create index if not exists idx_story_reactions_story_id on public.story_reactions(story_id)';
    execute 'create index if not exists idx_story_reactions_user_id on public.story_reactions(user_id)';
    execute 'create index if not exists idx_story_replies_story_id on public.story_replies(story_id)';
    execute 'create index if not exists idx_story_replies_sender_id on public.story_replies(sender_id)';
  end if;
end;
$$;

-- 7) RPC for metadata update used by web and mobile chat flows.
create or replace function public.update_chat_metadata(
  p_chat_id uuid,
  p_last_message text,
  p_last_message_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.social_chats
  set
    last_message = p_last_message,
    last_message_at = p_last_message_at,
    updated_at = now()
  where id = p_chat_id;
end;
$$;

grant execute on function public.update_chat_metadata(uuid, text, timestamptz) to authenticated;

create or replace function public.mark_messages_as_read(
  p_chat_id uuid,
  p_message_ids uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_members
  set
    last_read_at = now(),
    unread_count = 0
  where chat_id = p_chat_id
    and user_id = auth.uid();

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'social_messages'
      and column_name = 'is_read'
  ) then
    if p_message_ids is null or array_length(p_message_ids, 1) is null then
      update public.social_messages
      set is_read = true
      where chat_id = p_chat_id
        and sender_id <> auth.uid();
    else
      update public.social_messages
      set is_read = true
      where chat_id = p_chat_id
        and id = any(p_message_ids)
        and sender_id <> auth.uid();
    end if;
  end if;
end;
$$;

grant execute on function public.mark_messages_as_read(uuid, uuid[]) to authenticated;

create or replace function public.respond_radar_invite(
  p_invite_id uuid,
  p_accept boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.radar_invites
  set
    status = case when p_accept then 'ACCEPTED' else 'DECLINED' end,
    responded_at = now(),
    updated_at = now()
  where id = p_invite_id
    and invitee_id = v_uid;
end;
$$;

revoke all on function public.respond_radar_invite(uuid, boolean) from public;
grant execute on function public.respond_radar_invite(uuid, boolean) to authenticated;

-- 8) Advanced chat message contract (reply/file/media) + supporting tables.
alter table if exists public.social_messages
  add column if not exists message_type text default 'text',
  add column if not exists media_url text,
  add column if not exists file_name text,
  add column if not exists file_size bigint,
  add column if not exists reply_to_id uuid,
  add column if not exists is_read boolean default false,
  add column if not exists read_at timestamptz,
  add column if not exists reactions jsonb default '{}'::jsonb;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'social_messages'
  ) then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'social_messages_reply_to_id_fkey'
        and conrelid = 'public.social_messages'::regclass
    ) then
      alter table public.social_messages
        add constraint social_messages_reply_to_id_fkey
        foreign key (reply_to_id) references public.social_messages(id) on delete set null;
    end if;
  end if;
end;
$$;

create index if not exists idx_social_messages_chat_created
  on public.social_messages(chat_id, created_at desc);
create index if not exists idx_social_messages_reply_to_id
  on public.social_messages(reply_to_id);
create index if not exists idx_social_messages_message_type
  on public.social_messages(message_type);
create index if not exists idx_social_messages_chat_is_read
  on public.social_messages(chat_id, is_read);

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.social_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, reaction)
);

create index if not exists idx_message_reactions_message_id
  on public.message_reactions(message_id);
create index if not exists idx_message_reactions_user_id
  on public.message_reactions(user_id);

create table if not exists public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.social_chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (chat_id, user_id)
);

create index if not exists idx_group_join_requests_chat_id
  on public.group_join_requests(chat_id);
create index if not exists idx_group_join_requests_user_id
  on public.group_join_requests(user_id);

-- 9) Radar invites contract for web/mobile parity.
create table if not exists public.radar_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  radar_id uuid,
  source text not null default 'RADAR_GROUP',
  status text not null default 'PENDING',
  note text,
  expires_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.radar_invites
  add column if not exists inviter_id uuid references public.profiles(id) on delete cascade,
  add column if not exists invitee_id uuid references public.profiles(id) on delete cascade,
  add column if not exists radar_id uuid,
  add column if not exists source text default 'RADAR_GROUP',
  add column if not exists status text default 'PENDING',
  add column if not exists note text,
  add column if not exists expires_at timestamptz,
  add column if not exists responded_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.radar_invites
  drop constraint if exists radar_invites_radar_id_fkey;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'radar_invites'
  ) then
    begin
      alter table public.radar_invites
        add constraint radar_invites_unique_triplet
        unique (inviter_id, invitee_id, radar_id);
    exception
      when duplicate_object then
        null;
      when duplicate_table then
        null;
      when undefined_column then
        null;
    end;
  end if;
end;
$$;

create index if not exists idx_radar_invites_invitee_status_created
  on public.radar_invites(invitee_id, status, created_at desc);
create index if not exists idx_radar_invites_inviter_status_created
  on public.radar_invites(inviter_id, status, created_at desc);
create index if not exists idx_radar_invites_radar_id
  on public.radar_invites(radar_id);

-- 10) Grants needed by runtime authenticated key.
grant select, insert, update, delete on table public.chat_members to authenticated;
grant select, insert, update, delete on table public.social_messages to authenticated;
grant select, insert, update, delete on table public.message_reactions to authenticated;
grant select, insert, update, delete on table public.group_join_requests to authenticated;
grant select, insert, update, delete on table public.radar_invites to authenticated;

create or replace function public.is_chat_member(
  p_chat_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_members cm
    where cm.chat_id = p_chat_id
      and cm.user_id = p_user_id
  );
$$;

grant execute on function public.is_chat_member(uuid, uuid) to authenticated;

-- 10) RLS hardening for chat runtime (idempotent policy creation).
alter table if exists public.chat_members enable row level security;
alter table if exists public.social_messages enable row level security;
alter table if exists public.message_reactions enable row level security;
alter table if exists public.group_join_requests enable row level security;
alter table if exists public.radar_invites enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'chat_members'
  ) then
    if exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'chat_members'
        and policyname = 'chat_members_select_chat_scope'
    ) then
      drop policy chat_members_select_chat_scope on public.chat_members;
    end if;

    create policy chat_members_select_chat_scope
    on public.chat_members
    for select
    to authenticated
    using (
      public.is_chat_member(chat_members.chat_id, auth.uid())
    );

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'chat_members'
        and policyname = 'chat_members_insert_self_or_chat_admin'
    ) then
      create policy chat_members_insert_self_or_chat_admin
      on public.chat_members
      for insert
      to authenticated
      with check (
        user_id = auth.uid()
        or exists (
          select 1
          from public.social_chats sc
          where sc.id = chat_members.chat_id
            and sc.admin_id = auth.uid()
        )
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'chat_members'
        and policyname = 'chat_members_update_self_or_chat_admin'
    ) then
      create policy chat_members_update_self_or_chat_admin
      on public.chat_members
      for update
      to authenticated
      using (
        user_id = auth.uid()
        or exists (
          select 1
          from public.social_chats sc
          where sc.id = chat_members.chat_id
            and sc.admin_id = auth.uid()
        )
      )
      with check (
        user_id = auth.uid()
        or exists (
          select 1
          from public.social_chats sc
          where sc.id = chat_members.chat_id
            and sc.admin_id = auth.uid()
        )
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'chat_members'
        and policyname = 'chat_members_delete_chat_admin'
    ) then
      create policy chat_members_delete_chat_admin
      on public.chat_members
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.social_chats sc
          where sc.id = chat_members.chat_id
            and sc.admin_id = auth.uid()
        )
      );
    end if;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'social_messages'
  ) then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'social_messages'
        and policyname = 'social_messages_select_chat_scope'
    ) then
      create policy social_messages_select_chat_scope
      on public.social_messages
      for select
      to authenticated
      using (public.is_chat_member(social_messages.chat_id, auth.uid()));
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'social_messages'
        and policyname = 'social_messages_insert_sender_member'
    ) then
      create policy social_messages_insert_sender_member
      on public.social_messages
      for insert
      to authenticated
      with check (
        sender_id = auth.uid()
        and public.is_chat_member(social_messages.chat_id, auth.uid())
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'social_messages'
        and policyname = 'social_messages_update_sender_only'
    ) then
      create policy social_messages_update_sender_only
      on public.social_messages
      for update
      to authenticated
      using (sender_id = auth.uid())
      with check (sender_id = auth.uid());
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'social_messages'
        and policyname = 'social_messages_delete_sender_only'
    ) then
      create policy social_messages_delete_sender_only
      on public.social_messages
      for delete
      to authenticated
      using (sender_id = auth.uid());
    end if;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'message_reactions'
  ) then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'message_reactions'
        and policyname = 'message_reactions_select_chat_scope'
    ) then
      create policy message_reactions_select_chat_scope
      on public.message_reactions
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.social_messages sm
          where sm.id = message_reactions.message_id
            and public.is_chat_member(sm.chat_id, auth.uid())
        )
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'message_reactions'
        and policyname = 'message_reactions_insert_self_member'
    ) then
      create policy message_reactions_insert_self_member
      on public.message_reactions
      for insert
      to authenticated
      with check (
        user_id = auth.uid()
        and exists (
          select 1
          from public.social_messages sm
          where sm.id = message_reactions.message_id
            and public.is_chat_member(sm.chat_id, auth.uid())
        )
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'message_reactions'
        and policyname = 'message_reactions_delete_self_member'
    ) then
      create policy message_reactions_delete_self_member
      on public.message_reactions
      for delete
      to authenticated
      using (
        user_id = auth.uid()
        and exists (
          select 1
          from public.social_messages sm
          where sm.id = message_reactions.message_id
            and public.is_chat_member(sm.chat_id, auth.uid())
        )
      );
    end if;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'group_join_requests'
  ) then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'group_join_requests'
        and policyname = 'group_join_requests_select_scope'
    ) then
      create policy group_join_requests_select_scope
      on public.group_join_requests
      for select
      to authenticated
      using (
        user_id = auth.uid()
        or exists (
          select 1
          from public.social_chats sc
          where sc.id = group_join_requests.chat_id
            and sc.admin_id = auth.uid()
        )
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'group_join_requests'
        and policyname = 'group_join_requests_insert_self'
    ) then
      create policy group_join_requests_insert_self
      on public.group_join_requests
      for insert
      to authenticated
      with check (
        user_id = auth.uid()
        and exists (
          select 1
          from public.social_chats sc
          where sc.id = group_join_requests.chat_id
        )
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'group_join_requests'
        and policyname = 'group_join_requests_delete_scope'
    ) then
      create policy group_join_requests_delete_scope
      on public.group_join_requests
      for delete
      to authenticated
      using (
        user_id = auth.uid()
        or exists (
          select 1
          from public.social_chats sc
          where sc.id = group_join_requests.chat_id
            and sc.admin_id = auth.uid()
        )
      );
    end if;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'radar_invites'
  ) then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'radar_invites'
        and policyname = 'radar_invites_select_own'
    ) then
      create policy radar_invites_select_own
      on public.radar_invites
      for select
      to authenticated
      using (inviter_id = auth.uid() or invitee_id = auth.uid());
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'radar_invites'
        and policyname = 'radar_invites_insert_self_inviter'
    ) then
      create policy radar_invites_insert_self_inviter
      on public.radar_invites
      for insert
      to authenticated
      with check (
        inviter_id = auth.uid()
        and invitee_id is not null
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'radar_invites'
        and policyname = 'radar_invites_update_scope'
    ) then
      create policy radar_invites_update_scope
      on public.radar_invites
      for update
      to authenticated
      using (inviter_id = auth.uid() or invitee_id = auth.uid())
      with check (inviter_id = auth.uid() or invitee_id = auth.uid());
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'radar_invites'
        and policyname = 'radar_invites_delete_scope'
    ) then
      create policy radar_invites_delete_scope
      on public.radar_invites
      for delete
      to authenticated
      using (inviter_id = auth.uid() or invitee_id = auth.uid());
    end if;
  end if;
end;
$$;

-- NOTE:
-- - RPC `respond_radar_invite` is included here for radar invite parity.
-- - RPCs `get_chat_inbox` and `join_chat` must still exist from your core production migrations.
-- - Keep existing RLS policies from production migrations.
