-- Feed + Chat Schema Sync Hotfix
-- Tujuan:
-- 1) Samakan schema chat agar kolom social_messages.updated_at tersedia.
-- 2) Samakan schema feed agar posts.saves_count + posts.shares_count tersedia.
-- 3) Sediakan RPC increment_shares yang dipakai web feed.
--
-- Jalankan di Supabase SQL Editor (idempotent).

begin;

-- ---------------------------------------------------------------------------
-- CHAT: social_messages.updated_at
-- ---------------------------------------------------------------------------
alter table if exists public.social_messages
  add column if not exists updated_at timestamptz;

update public.social_messages
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table if exists public.social_messages
  alter column updated_at set default now();

alter table if exists public.social_messages
  alter column updated_at set not null;

create or replace function public.touch_social_messages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_social_messages_touch_updated_at on public.social_messages;

create trigger trg_social_messages_touch_updated_at
before update on public.social_messages
for each row
execute function public.touch_social_messages_updated_at();

-- ---------------------------------------------------------------------------
-- FEED: posts denormalized counters
-- ---------------------------------------------------------------------------
alter table if exists public.posts
  add column if not exists saves_count integer not null default 0;

alter table if exists public.posts
  add column if not exists shares_count integer not null default 0;

update public.posts p
set saves_count = x.cnt
from (
  select post_id, count(*)::integer as cnt
  from public.saved_posts
  group by post_id
) x
where p.id = x.post_id;

update public.posts p
set shares_count = x.cnt
from (
  select post_id, count(*)::integer as cnt
  from public.post_shares
  group by post_id
) x
where p.id = x.post_id;

-- ---------------------------------------------------------------------------
-- FEED: RPC increment_shares
-- ---------------------------------------------------------------------------
create or replace function public.increment_shares(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  begin
    insert into public.post_shares(post_id, user_id, created_at)
    values (p_post_id, v_user_id, now());
  exception
    when undefined_column then
      insert into public.post_shares(post_id, created_at)
      values (p_post_id, now());
  end;

  update public.posts
  set shares_count = coalesce(shares_count, 0) + 1
  where id = p_post_id;
end;
$$;

grant execute on function public.increment_shares(uuid) to anon, authenticated, service_role;

commit;
