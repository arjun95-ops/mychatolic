-- Hotfix for chat_members RLS recursion issue in get_chat_inbox.
-- Safe to run multiple times in Supabase SQL Editor.

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

alter table if exists public.chat_members enable row level security;
alter table if exists public.social_messages enable row level security;
alter table if exists public.message_reactions enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'chat_members'
  ) then
    drop policy if exists chat_members_select_chat_scope on public.chat_members;
    create policy chat_members_select_chat_scope
    on public.chat_members
    for select
    to authenticated
    using (public.is_chat_member(chat_members.chat_id, auth.uid()));
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
    drop policy if exists social_messages_select_chat_scope on public.social_messages;
    create policy social_messages_select_chat_scope
    on public.social_messages
    for select
    to authenticated
    using (public.is_chat_member(social_messages.chat_id, auth.uid()));

    drop policy if exists social_messages_insert_sender_member on public.social_messages;
    create policy social_messages_insert_sender_member
    on public.social_messages
    for insert
    to authenticated
    with check (
      sender_id = auth.uid()
      and public.is_chat_member(social_messages.chat_id, auth.uid())
    );
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
    drop policy if exists message_reactions_select_chat_scope on public.message_reactions;
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

    drop policy if exists message_reactions_insert_self_member on public.message_reactions;
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

    drop policy if exists message_reactions_delete_self_member on public.message_reactions;
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
end;
$$;
