-- Stories RLS + grants hotfix for web/mobile/admin parity.
-- Run this in Supabase SQL Editor using a privileged role.
-- Safe to run multiple times.

grant usage on schema public to authenticated;

do $$
declare
  v_story_views_actor_col text;
  v_story_reactions_actor_col text;
  v_story_replies_actor_col text;
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'stories'
  ) then
    grant select, insert, update, delete on table public.stories to authenticated;
    alter table public.stories enable row level security;

    drop policy if exists stories_select_active_or_owner on public.stories;
    create policy stories_select_active_or_owner
    on public.stories
    for select
    to authenticated
    using (
      user_id = auth.uid()
      or expires_at is null
      or expires_at > now()
    );

    drop policy if exists stories_insert_self on public.stories;
    create policy stories_insert_self
    on public.stories
    for insert
    to authenticated
    with check (user_id = auth.uid());

    drop policy if exists stories_update_self on public.stories;
    create policy stories_update_self
    on public.stories
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

    drop policy if exists stories_delete_self on public.stories;
    create policy stories_delete_self
    on public.stories
    for delete
    to authenticated
    using (user_id = auth.uid());
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'story_views'
  ) then
    grant select, insert, update, delete on table public.story_views to authenticated;
    alter table public.story_views enable row level security;

    select
      case
        when exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'story_views'
            and column_name = 'viewer_id'
        ) then 'viewer_id'
        when exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'story_views'
            and column_name = 'user_id'
        ) then 'user_id'
        else null
      end
    into v_story_views_actor_col;

    if v_story_views_actor_col is not null then
      execute 'drop policy if exists story_views_select_scope on public.story_views';
      execute format(
        'create policy story_views_select_scope
         on public.story_views
         for select
         to authenticated
         using (
           (%1$I = auth.uid())
           or exists (
             select 1
             from public.stories s
             where s.id = story_views.story_id
               and s.user_id = auth.uid()
           )
         )',
        v_story_views_actor_col
      );

      execute 'drop policy if exists story_views_insert_self on public.story_views';
      execute format(
        'create policy story_views_insert_self
         on public.story_views
         for insert
         to authenticated
         with check (%1$I = auth.uid())',
        v_story_views_actor_col
      );

      execute 'drop policy if exists story_views_delete_self on public.story_views';
      execute format(
        'create policy story_views_delete_self
         on public.story_views
         for delete
         to authenticated
         using (%1$I = auth.uid())',
        v_story_views_actor_col
      );
    end if;
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'story_reactions'
  ) then
    grant select, insert, update, delete on table public.story_reactions to authenticated;
    alter table public.story_reactions enable row level security;

    select
      case
        when exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'story_reactions'
            and column_name = 'user_id'
        ) then 'user_id'
        when exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'story_reactions'
            and column_name = 'viewer_id'
        ) then 'viewer_id'
        else null
      end
    into v_story_reactions_actor_col;

    if v_story_reactions_actor_col is not null then
      execute 'drop policy if exists story_reactions_select_scope on public.story_reactions';
      execute format(
        'create policy story_reactions_select_scope
         on public.story_reactions
         for select
         to authenticated
         using (
           (%1$I = auth.uid())
           or exists (
             select 1
             from public.stories s
             where s.id = story_reactions.story_id
               and s.user_id = auth.uid()
           )
         )',
        v_story_reactions_actor_col
      );

      execute 'drop policy if exists story_reactions_insert_self on public.story_reactions';
      execute format(
        'create policy story_reactions_insert_self
         on public.story_reactions
         for insert
         to authenticated
         with check (%1$I = auth.uid())',
        v_story_reactions_actor_col
      );

      execute 'drop policy if exists story_reactions_update_self on public.story_reactions';
      execute format(
        'create policy story_reactions_update_self
         on public.story_reactions
         for update
         to authenticated
         using (%1$I = auth.uid())
         with check (%1$I = auth.uid())',
        v_story_reactions_actor_col
      );

      execute 'drop policy if exists story_reactions_delete_self on public.story_reactions';
      execute format(
        'create policy story_reactions_delete_self
         on public.story_reactions
         for delete
         to authenticated
         using (%1$I = auth.uid())',
        v_story_reactions_actor_col
      );
    end if;
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'story_replies'
  ) then
    grant select, insert, update, delete on table public.story_replies to authenticated;
    alter table public.story_replies enable row level security;

    select
      case
        when exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'story_replies'
            and column_name = 'sender_id'
        ) then 'sender_id'
        when exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'story_replies'
            and column_name = 'user_id'
        ) then 'user_id'
        else null
      end
    into v_story_replies_actor_col;

    if v_story_replies_actor_col is not null then
      execute 'drop policy if exists story_replies_select_scope on public.story_replies';
      execute format(
        'create policy story_replies_select_scope
         on public.story_replies
         for select
         to authenticated
         using (
           (%1$I = auth.uid())
           or exists (
             select 1
             from public.stories s
             where s.id = story_replies.story_id
               and s.user_id = auth.uid()
           )
         )',
        v_story_replies_actor_col
      );

      execute 'drop policy if exists story_replies_insert_self on public.story_replies';
      execute format(
        'create policy story_replies_insert_self
         on public.story_replies
         for insert
         to authenticated
         with check (%1$I = auth.uid())',
        v_story_replies_actor_col
      );

      execute 'drop policy if exists story_replies_update_self on public.story_replies';
      execute format(
        'create policy story_replies_update_self
         on public.story_replies
         for update
         to authenticated
         using (%1$I = auth.uid())
         with check (%1$I = auth.uid())',
        v_story_replies_actor_col
      );

      execute 'drop policy if exists story_replies_delete_self on public.story_replies';
      execute format(
        'create policy story_replies_delete_self
         on public.story_replies
         for delete
         to authenticated
         using (%1$I = auth.uid())',
        v_story_replies_actor_col
      );
    end if;
  end if;
end;
$$;
