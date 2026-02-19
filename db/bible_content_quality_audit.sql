-- Bible Content Quality Audit
-- Date: 2026-02-18
-- Purpose:
-- 1) Detect missing chapter sequences per book/version/language.
-- 2) Detect chapters with no verses.
-- 3) Detect placeholder verses like [MISSING_VERSE].
-- 4) Detect duplicate verse numbers in the same chapter.

-- A. Book-level chapter coverage summary
with chapter_stats as (
  select
    c.book_id,
    min(c.chapter_number) as min_chapter,
    max(c.chapter_number) as max_chapter,
    count(*) as chapter_rows
  from public.bible_chapters c
  group by c.book_id
),
book_scope as (
  select
    b.id as book_id,
    b.name,
    coalesce(nullif(lower(trim(b.language_code)), ''), 'id') as language_code,
    case
      when coalesce(nullif(lower(trim(b.language_code)), ''), 'id') = 'en'
        then coalesce(nullif(upper(trim(b.version_code)), ''), 'EN1')
      else coalesce(nullif(upper(trim(b.version_code)), ''), 'TB1')
    end as version_code,
    coalesce(b.total_chapters, 0) as total_chapters,
    coalesce(cs.min_chapter, 0) as min_chapter,
    coalesce(cs.max_chapter, 0) as max_chapter,
    coalesce(cs.chapter_rows, 0) as chapter_rows
  from public.bible_books b
  left join chapter_stats cs on cs.book_id = b.id
)
select
  language_code,
  version_code,
  name,
  total_chapters,
  chapter_rows,
  min_chapter,
  max_chapter,
  case
    when chapter_rows = 0 then 'NO_CHAPTER_ROWS'
    when total_chapters > 0 and chapter_rows < total_chapters then 'CHAPTER_ROWS_LT_TOTAL'
    when min_chapter > 1 then 'CHAPTER_START_GT_1'
    when total_chapters > 0 and max_chapter < total_chapters then 'MAX_CHAPTER_LT_TOTAL'
    else 'OK'
  end as status
from book_scope
where
  chapter_rows = 0
  or (total_chapters > 0 and chapter_rows < total_chapters)
  or min_chapter > 1
  or (total_chapters > 0 and max_chapter < total_chapters)
order by language_code, version_code, name;

-- B. Missing chapter numbers per book
with expected as (
  select
    b.id as book_id,
    b.name,
    coalesce(nullif(lower(trim(b.language_code)), ''), 'id') as language_code,
    case
      when coalesce(nullif(lower(trim(b.language_code)), ''), 'id') = 'en'
        then coalesce(nullif(upper(trim(b.version_code)), ''), 'EN1')
      else coalesce(nullif(upper(trim(b.version_code)), ''), 'TB1')
    end as version_code,
    gs.chapter_number
  from public.bible_books b
  cross join lateral generate_series(1, greatest(coalesce(b.total_chapters, 0), 1)) as gs(chapter_number)
),
actual as (
  select c.book_id, c.chapter_number
  from public.bible_chapters c
)
select
  e.language_code,
  e.version_code,
  e.name,
  e.chapter_number as missing_chapter
from expected e
left join actual a
  on a.book_id = e.book_id
 and a.chapter_number = e.chapter_number
where a.book_id is null
order by e.language_code, e.version_code, e.name, e.chapter_number;

-- C. Chapters without verse rows
select
  b.name,
  coalesce(nullif(lower(trim(b.language_code)), ''), 'id') as language_code,
  case
    when coalesce(nullif(lower(trim(b.language_code)), ''), 'id') = 'en'
      then coalesce(nullif(upper(trim(b.version_code)), ''), 'EN1')
    else coalesce(nullif(upper(trim(b.version_code)), ''), 'TB1')
  end as version_code,
  c.chapter_number
from public.bible_chapters c
join public.bible_books b on b.id = c.book_id
left join public.bible_verses v on v.chapter_id = c.id
group by b.name, b.language_code, b.version_code, c.chapter_number
having count(v.*) = 0
order by language_code, version_code, b.name, c.chapter_number;

-- D. Placeholder/invalid verse texts
select
  b.name,
  coalesce(nullif(lower(trim(b.language_code)), ''), 'id') as language_code,
  case
    when coalesce(nullif(lower(trim(b.language_code)), ''), 'id') = 'en'
      then coalesce(nullif(upper(trim(b.version_code)), ''), 'EN1')
    else coalesce(nullif(upper(trim(b.version_code)), ''), 'TB1')
  end as version_code,
  c.chapter_number,
  v.verse_number,
  case
    when lower(coalesce(v.text, '')) like '%[missing_verse]%'
      or lower(coalesce(v.text, '')) like '%ayat belum tersedia%'
      then 'PLACEHOLDER_TEXT'
    when trim(coalesce(v.text, '')) = ''
      then 'EMPTY_TEXT'
    else 'OTHER'
  end as issue_type,
  left(v.text, 120) as sample_text
from public.bible_verses v
join public.bible_chapters c on c.id = v.chapter_id
join public.bible_books b on b.id = c.book_id
where
  trim(coalesce(v.text, '')) = ''
  or lower(coalesce(v.text, '')) like '%[missing_verse]%'
  or lower(coalesce(v.text, '')) like '%ayat belum tersedia%'
order by language_code, version_code, b.name, c.chapter_number, v.verse_number;

-- E. Duplicate verse numbers in same chapter
select
  b.name,
  coalesce(nullif(lower(trim(b.language_code)), ''), 'id') as language_code,
  case
    when coalesce(nullif(lower(trim(b.language_code)), ''), 'id') = 'en'
      then coalesce(nullif(upper(trim(b.version_code)), ''), 'EN1')
    else coalesce(nullif(upper(trim(b.version_code)), ''), 'TB1')
  end as version_code,
  c.chapter_number,
  v.verse_number,
  count(*) as duplicate_count
from public.bible_verses v
join public.bible_chapters c on c.id = v.chapter_id
join public.bible_books b on b.id = c.book_id
group by b.name, b.language_code, b.version_code, c.chapter_number, v.verse_number
having count(*) > 1
order by duplicate_count desc, language_code, version_code, b.name, c.chapter_number, v.verse_number;
