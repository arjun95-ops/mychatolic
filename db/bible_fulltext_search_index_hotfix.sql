-- Bible Full-Text Search Index Hotfix (web/mobile)
-- Date: 2026-02-18
-- Purpose:
-- 1) Improve verse keyword search performance on large bible_verses datasets.
-- 2) Stay compatible with schema variants (text/content, chapter/chapter_number).

begin;

create extension if not exists pg_trgm;

do $do$
declare
  has_table boolean := to_regclass('public.bible_verses') is not null;
  has_text boolean;
  has_content boolean;
  has_book_id boolean;
  has_chapter boolean;
  has_chapter_number boolean;
  has_chapter_id boolean;
  has_language_code boolean;
  has_version_code boolean;
begin
  if not has_table then
    raise notice 'Skipping bible_fulltext_search_index_hotfix: table public.bible_verses not found.';
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

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bible_verses' and column_name = 'book_id'
  ) into has_book_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bible_verses' and column_name = 'chapter'
  ) into has_chapter;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bible_verses' and column_name = 'chapter_number'
  ) into has_chapter_number;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bible_verses' and column_name = 'chapter_id'
  ) into has_chapter_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bible_verses' and column_name = 'language_code'
  ) into has_language_code;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bible_verses' and column_name = 'version_code'
  ) into has_version_code;

  if has_text and has_content then
    execute $$
      create index if not exists bible_verses_text_content_trgm_idx
      on public.bible_verses
      using gin (lower(coalesce(text, '') || ' ' || coalesce(content, '')) gin_trgm_ops)
    $$;

    execute $$
      create index if not exists bible_verses_text_content_tsv_simple_idx
      on public.bible_verses
      using gin (to_tsvector('simple', lower(coalesce(text, '') || ' ' || coalesce(content, ''))))
    $$;
  elsif has_text then
    execute $$
      create index if not exists bible_verses_text_trgm_idx
      on public.bible_verses
      using gin (lower(text) gin_trgm_ops)
    $$;

    execute $$
      create index if not exists bible_verses_text_tsv_simple_idx
      on public.bible_verses
      using gin (to_tsvector('simple', lower(coalesce(text, ''))))
    $$;
  elsif has_content then
    execute $$
      create index if not exists bible_verses_content_trgm_idx
      on public.bible_verses
      using gin (lower(content) gin_trgm_ops)
    $$;

    execute $$
      create index if not exists bible_verses_content_tsv_simple_idx
      on public.bible_verses
      using gin (to_tsvector('simple', lower(coalesce(content, ''))))
    $$;
  else
    raise notice 'Skipping text indexes: neither text nor content column found on public.bible_verses.';
  end if;

  if has_book_id and has_chapter then
    execute $$
      create index if not exists bible_verses_book_id_chapter_idx
      on public.bible_verses (book_id, chapter)
    $$;
  end if;

  if has_book_id and has_chapter_number then
    execute $$
      create index if not exists bible_verses_book_id_chapter_number_idx
      on public.bible_verses (book_id, chapter_number)
    $$;
  end if;

  if has_book_id then
    execute $$
      create index if not exists bible_verses_book_id_idx
      on public.bible_verses (book_id)
    $$;
  end if;

  if has_chapter_id then
    execute $$
      create index if not exists bible_verses_chapter_id_idx
      on public.bible_verses (chapter_id)
    $$;
  end if;

  if has_language_code and has_version_code then
    execute $$
      create index if not exists bible_verses_lang_ver_idx
      on public.bible_verses (language_code, version_code)
    $$;
  elsif has_language_code then
    execute $$
      create index if not exists bible_verses_language_code_idx
      on public.bible_verses (language_code)
    $$;
  elsif has_version_code then
    execute $$
      create index if not exists bible_verses_version_code_idx
      on public.bible_verses (version_code)
    $$;
  end if;

  execute 'analyze public.bible_verses';
end;
$do$;

commit;
