-- Feed Policy Dedupe (Optional)
-- Date: 2026-02-19
-- Purpose:
-- 1) Remove noisy legacy/duplicate feed policies.
-- 2) Keep canonical block-aware policies from hotfix.
-- 3) Preserve one public-read policy where it already existed.

-- POSTS
do $$
begin
  if to_regclass('public.posts') is null then
    return;
  end if;

  alter table public.posts enable row level security;

  -- Legacy duplicates
  drop policy if exists "Users can manage own posts" on public.posts;
  drop policy if exists "Users can delete their own posts" on public.posts;
  drop policy if exists "User create posts" on public.posts;
  drop policy if exists "Users can insert own posts" on public.posts;
  drop policy if exists "Users can insert their own posts" on public.posts;
  drop policy if exists "policy_insert_posts_owner" on public.posts;
  drop policy if exists "policy_tulis_posts_member" on public.posts;
  drop policy if exists "Public can view all posts" on public.posts;
  drop policy if exists "Public posts are viewable by everyone" on public.posts;
  drop policy if exists "policy_baca_semua_posts" on public.posts;
  drop policy if exists posts_insert_self on public.posts;
  drop policy if exists posts_update_self on public.posts;
  drop policy if exists posts_delete_self on public.posts;
  drop policy if exists posts_select_authenticated on public.posts;

  -- Keep one public-read policy for compatibility.
  drop policy if exists "Public read" on public.posts;
  create policy "Public read"
  on public.posts
  for select
  to public
  using (true);

  -- Canonical authenticated policies.
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
  using (not public.has_block_relation_with_auth(user_id));
end;
$$;

-- COMMENTS
do $$
begin
  if to_regclass('public.comments') is null then
    return;
  end if;

  alter table public.comments enable row level security;

  drop policy if exists "User delete own comments" on public.comments;
  drop policy if exists "Users can delete their own comments" on public.comments;
  drop policy if exists "User insert comments" on public.comments;
  drop policy if exists "User write comments" on public.comments;
  drop policy if exists "Users can insert their own comments" on public.comments;
  drop policy if exists "Public comments are viewable by everyone" on public.comments;
  drop policy if exists "Public view comments" on public.comments;

  drop policy if exists "Public read comments" on public.comments;
  create policy "Public read comments"
  on public.comments
  for select
  to public
  using (true);

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
end;
$$;

-- LIKES
do $$
begin
  if to_regclass('public.likes') is null then
    return;
  end if;

  alter table public.likes enable row level security;

  drop policy if exists "User delete likes" on public.likes;
  drop policy if exists "User remove likes" on public.likes;
  drop policy if exists "Users can delete their own likes" on public.likes;
  drop policy if exists "policy_delete_likes_owner" on public.likes;
  drop policy if exists "policy_hapus_likes_member" on public.likes;
  drop policy if exists "User insert likes" on public.likes;
  drop policy if exists "User like posts" on public.likes;
  drop policy if exists "User toggle likes" on public.likes;
  drop policy if exists "Users can insert their own likes" on public.likes;
  drop policy if exists "policy_insert_likes_owner" on public.likes;
  drop policy if exists "policy_tulis_likes_member" on public.likes;
  drop policy if exists "Public likes are viewable by everyone" on public.likes;
  drop policy if exists "Public view likes" on public.likes;
  drop policy if exists "policy_baca_semua_likes" on public.likes;

  drop policy if exists "Public read likes" on public.likes;
  create policy "Public read likes"
  on public.likes
  for select
  to public
  using (true);

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
end;
$$;

-- POST_SHARES
do $$
begin
  if to_regclass('public.post_shares') is null then
    return;
  end if;

  alter table public.post_shares enable row level security;

  drop policy if exists "Users can unshare posts" on public.post_shares;
  drop policy if exists "Users can share posts" on public.post_shares;

  drop policy if exists "Post shares are viewable by everyone" on public.post_shares;
  create policy "Post shares are viewable by everyone"
  on public.post_shares
  for select
  to public
  using (true);

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
end;
$$;

-- SAVED_POSTS
do $$
begin
  if to_regclass('public.saved_posts') is null then
    return;
  end if;

  alter table public.saved_posts enable row level security;

  drop policy if exists "Users can manage own saved posts" on public.saved_posts;
  drop policy if exists "Enable delete for users based on user_id" on public.saved_posts;
  drop policy if exists "Users can delete own saved posts" on public.saved_posts;
  drop policy if exists "Enable insert for users based on user_id" on public.saved_posts;
  drop policy if exists "Users can insert own saved posts" on public.saved_posts;
  drop policy if exists "Enable read for users based on user_id" on public.saved_posts;
  drop policy if exists "Users can view own saved posts" on public.saved_posts;

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
end;
$$;

-- USER_BLOCKS (safety re-canonicalization)
do $$
begin
  if to_regclass('public.user_blocks') is null then
    return;
  end if;

  drop policy if exists user_blocks_select_own on public.user_blocks;
  drop policy if exists user_blocks_insert_own on public.user_blocks;
  drop policy if exists user_blocks_delete_own on public.user_blocks;

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
end;
$$;

-- Refresh PostgREST schema cache.
do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception
  when others then
    null;
end;
$$;
