-- Stories schema compatibility hotfix (web + mobile parity)
-- Jalankan di Supabase SQL Editor. Aman di-run berulang.

begin;

alter table if exists public.stories
  add column if not exists audience text;

alter table if exists public.stories
  alter column audience set default 'followers';

update public.stories
set audience = coalesce(nullif(audience, ''), 'followers')
where audience is null or audience = '';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stories'
      and column_name = 'audience'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'stories_audience_check'
  ) then
    alter table public.stories
      add constraint stories_audience_check
      check (audience in ('followers', 'close_friends', 'everyone', 'public'));
  end if;
end;
$$;

alter table if exists public.stories
  add column if not exists overlays jsonb;

commit;
