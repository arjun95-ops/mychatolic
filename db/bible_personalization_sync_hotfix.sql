-- Bible personalization sync hotfix (web/mobile)
-- Date: 2026-02-18
-- Purpose:
-- 1) Persist bookmarks, highlights, notes, and reading-plan progress per user.
-- 2) Keep privacy with strict RLS (owner-only access).

begin;

create table if not exists public.bible_user_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  book_id text not null,
  chapter integer not null,
  verse_start integer not null,
  verse_end integer not null,
  reference_label text not null,
  excerpt text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.bible_user_bookmarks
  add column if not exists language_code text,
  add column if not exists version_code text;

update public.bible_user_bookmarks
set language_code = coalesce(nullif(lower(trim(language_code)), ''), 'id')
where language_code is null or trim(language_code) = '';

update public.bible_user_bookmarks
set version_code = case
  when coalesce(nullif(upper(trim(version_code)), ''), '') = '' then
    case
      when coalesce(nullif(lower(trim(language_code)), ''), 'id') = 'en' then 'EN1'
      else 'TB1'
    end
  else upper(trim(version_code))
end
where version_code is null or trim(version_code) = '';

alter table public.bible_user_bookmarks
  alter column language_code set default 'id',
  alter column language_code set not null,
  alter column version_code set default 'TB1',
  alter column version_code set not null;

create table if not exists public.bible_user_highlights (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  book_id text not null,
  chapter integer not null,
  verse_start integer not null,
  verse_end integer not null,
  color text not null,
  reference_label text not null,
  excerpt text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.bible_user_highlights
  add column if not exists language_code text,
  add column if not exists version_code text;

update public.bible_user_highlights
set language_code = coalesce(nullif(lower(trim(language_code)), ''), 'id')
where language_code is null or trim(language_code) = '';

update public.bible_user_highlights
set version_code = case
  when coalesce(nullif(upper(trim(version_code)), ''), '') = '' then
    case
      when coalesce(nullif(lower(trim(language_code)), ''), 'id') = 'en' then 'EN1'
      else 'TB1'
    end
  else upper(trim(version_code))
end
where version_code is null or trim(version_code) = '';

alter table public.bible_user_highlights
  alter column language_code set default 'id',
  alter column language_code set not null,
  alter column version_code set default 'TB1',
  alter column version_code set not null;

create table if not exists public.bible_user_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  book_id text not null,
  chapter integer not null,
  verse_start integer not null,
  verse_end integer not null,
  reference_label text not null,
  excerpt text not null default '',
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.bible_user_notes
  add column if not exists language_code text,
  add column if not exists version_code text;

update public.bible_user_notes
set language_code = coalesce(nullif(lower(trim(language_code)), ''), 'id')
where language_code is null or trim(language_code) = '';

update public.bible_user_notes
set version_code = case
  when coalesce(nullif(upper(trim(version_code)), ''), '') = '' then
    case
      when coalesce(nullif(lower(trim(language_code)), ''), 'id') = 'en' then 'EN1'
      else 'TB1'
    end
  else upper(trim(version_code))
end
where version_code is null or trim(version_code) = '';

alter table public.bible_user_notes
  alter column language_code set default 'id',
  alter column language_code set not null,
  alter column version_code set default 'TB1',
  alter column version_code set not null;

create table if not exists public.bible_user_plan_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  completed_dates text[] not null default '{}',
  last_completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, plan_id)
);

do $$
declare
  has_bookmarks_chapter boolean;
  has_bookmarks_chapter_number boolean;
  has_highlights_chapter boolean;
  has_highlights_chapter_number boolean;
  has_notes_chapter boolean;
  has_notes_chapter_number boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bible_user_bookmarks' and column_name = 'chapter'
  ) into has_bookmarks_chapter;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bible_user_bookmarks' and column_name = 'chapter_number'
  ) into has_bookmarks_chapter_number;

  if has_bookmarks_chapter then
    execute 'create index if not exists bible_user_bookmarks_lookup_idx on public.bible_user_bookmarks (user_id, book_id, chapter)';
    execute 'create index if not exists bible_user_bookmarks_scope_lookup_idx on public.bible_user_bookmarks (user_id, language_code, version_code, book_id, chapter)';
  elsif has_bookmarks_chapter_number then
    execute 'create index if not exists bible_user_bookmarks_lookup_chapter_number_idx on public.bible_user_bookmarks (user_id, book_id, chapter_number)';
    execute 'create index if not exists bible_user_bookmarks_scope_lookup_chapter_number_idx on public.bible_user_bookmarks (user_id, language_code, version_code, book_id, chapter_number)';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bible_user_highlights' and column_name = 'chapter'
  ) into has_highlights_chapter;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bible_user_highlights' and column_name = 'chapter_number'
  ) into has_highlights_chapter_number;

  if has_highlights_chapter then
    execute 'create index if not exists bible_user_highlights_lookup_idx on public.bible_user_highlights (user_id, book_id, chapter)';
    execute 'create index if not exists bible_user_highlights_scope_lookup_idx on public.bible_user_highlights (user_id, language_code, version_code, book_id, chapter)';
  elsif has_highlights_chapter_number then
    execute 'create index if not exists bible_user_highlights_lookup_chapter_number_idx on public.bible_user_highlights (user_id, book_id, chapter_number)';
    execute 'create index if not exists bible_user_highlights_scope_lookup_chapter_number_idx on public.bible_user_highlights (user_id, language_code, version_code, book_id, chapter_number)';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bible_user_notes' and column_name = 'chapter'
  ) into has_notes_chapter;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bible_user_notes' and column_name = 'chapter_number'
  ) into has_notes_chapter_number;

  if has_notes_chapter then
    execute 'create index if not exists bible_user_notes_lookup_idx on public.bible_user_notes (user_id, book_id, chapter)';
    execute 'create index if not exists bible_user_notes_scope_lookup_idx on public.bible_user_notes (user_id, language_code, version_code, book_id, chapter)';
  elsif has_notes_chapter_number then
    execute 'create index if not exists bible_user_notes_lookup_chapter_number_idx on public.bible_user_notes (user_id, book_id, chapter_number)';
    execute 'create index if not exists bible_user_notes_scope_lookup_chapter_number_idx on public.bible_user_notes (user_id, language_code, version_code, book_id, chapter_number)';
  end if;
end;
$$;

create index if not exists bible_user_plan_progress_lookup_idx
  on public.bible_user_plan_progress (user_id, plan_id);

alter table public.bible_user_bookmarks enable row level security;
alter table public.bible_user_highlights enable row level security;
alter table public.bible_user_notes enable row level security;
alter table public.bible_user_plan_progress enable row level security;

grant select, insert, update, delete on table public.bible_user_bookmarks to authenticated;
grant select, insert, update, delete on table public.bible_user_highlights to authenticated;
grant select, insert, update, delete on table public.bible_user_notes to authenticated;
grant select, insert, update, delete on table public.bible_user_plan_progress to authenticated;

drop policy if exists bible_user_bookmarks_select_own on public.bible_user_bookmarks;
create policy bible_user_bookmarks_select_own
  on public.bible_user_bookmarks
  for select
  using (auth.uid() = user_id);

drop policy if exists bible_user_bookmarks_insert_own on public.bible_user_bookmarks;
create policy bible_user_bookmarks_insert_own
  on public.bible_user_bookmarks
  for insert
  with check (auth.uid() = user_id);

drop policy if exists bible_user_bookmarks_update_own on public.bible_user_bookmarks;
create policy bible_user_bookmarks_update_own
  on public.bible_user_bookmarks
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists bible_user_bookmarks_delete_own on public.bible_user_bookmarks;
create policy bible_user_bookmarks_delete_own
  on public.bible_user_bookmarks
  for delete
  using (auth.uid() = user_id);

drop policy if exists bible_user_highlights_select_own on public.bible_user_highlights;
create policy bible_user_highlights_select_own
  on public.bible_user_highlights
  for select
  using (auth.uid() = user_id);

drop policy if exists bible_user_highlights_insert_own on public.bible_user_highlights;
create policy bible_user_highlights_insert_own
  on public.bible_user_highlights
  for insert
  with check (auth.uid() = user_id);

drop policy if exists bible_user_highlights_update_own on public.bible_user_highlights;
create policy bible_user_highlights_update_own
  on public.bible_user_highlights
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists bible_user_highlights_delete_own on public.bible_user_highlights;
create policy bible_user_highlights_delete_own
  on public.bible_user_highlights
  for delete
  using (auth.uid() = user_id);

drop policy if exists bible_user_notes_select_own on public.bible_user_notes;
create policy bible_user_notes_select_own
  on public.bible_user_notes
  for select
  using (auth.uid() = user_id);

drop policy if exists bible_user_notes_insert_own on public.bible_user_notes;
create policy bible_user_notes_insert_own
  on public.bible_user_notes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists bible_user_notes_update_own on public.bible_user_notes;
create policy bible_user_notes_update_own
  on public.bible_user_notes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists bible_user_notes_delete_own on public.bible_user_notes;
create policy bible_user_notes_delete_own
  on public.bible_user_notes
  for delete
  using (auth.uid() = user_id);

drop policy if exists bible_user_plan_progress_select_own on public.bible_user_plan_progress;
create policy bible_user_plan_progress_select_own
  on public.bible_user_plan_progress
  for select
  using (auth.uid() = user_id);

drop policy if exists bible_user_plan_progress_insert_own on public.bible_user_plan_progress;
create policy bible_user_plan_progress_insert_own
  on public.bible_user_plan_progress
  for insert
  with check (auth.uid() = user_id);

drop policy if exists bible_user_plan_progress_update_own on public.bible_user_plan_progress;
create policy bible_user_plan_progress_update_own
  on public.bible_user_plan_progress
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists bible_user_plan_progress_delete_own on public.bible_user_plan_progress;
create policy bible_user_plan_progress_delete_own
  on public.bible_user_plan_progress
  for delete
  using (auth.uid() = user_id);

commit;
