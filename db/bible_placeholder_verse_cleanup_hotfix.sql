-- Bible Placeholder Verse Cleanup Hotfix (web/mobile)
-- Date: 2026-02-18
-- Purpose:
-- 1) Clean placeholder verse text like [MISSING_VERSE][AUTO] from bible_verses.
-- 2) Keep script compatible with schema variants (text/content columns).
-- 3) Prevent placeholder rows from leaking into search/read flows.

begin;

do $do$
declare
  has_table boolean := to_regclass('public.bible_verses') is not null;
  has_text boolean;
  has_content boolean;
  affected_text integer := 0;
  affected_content integer := 0;
begin
  if not has_table then
    raise notice 'Skipping bible_placeholder_verse_cleanup_hotfix: table public.bible_verses not found.';
    return;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bible_verses' and column_name = 'text'
  ) into has_text;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bible_verses' and column_name = 'content'
  ) into has_content;

  if has_text then
    execute $sql$
      update public.bible_verses
      set text = ''
      where text is not null
        and (
          lower(text) like '%[missing_verse]%'
          or lower(text) like '%[auto] ayat belum tersedia%'
          or lower(text) like '%[auto]ayat belum tersedia%'
          or lower(text) like '%ayat belum tersedia. mohon verifikasi dan lengkapi.%'
        )
    $sql$;
    get diagnostics affected_text = row_count;
  end if;

  if has_content then
    execute $sql$
      update public.bible_verses
      set content = ''
      where content is not null
        and (
          lower(content) like '%[missing_verse]%'
          or lower(content) like '%[auto] ayat belum tersedia%'
          or lower(content) like '%[auto]ayat belum tersedia%'
          or lower(content) like '%ayat belum tersedia. mohon verifikasi dan lengkapi.%'
        )
    $sql$;
    get diagnostics affected_content = row_count;
  end if;

  raise notice 'Placeholder cleanup complete. affected_text=%, affected_content=%',
    affected_text, affected_content;

  execute 'analyze public.bible_verses';
end;
$do$;

commit;

