-- Bible Missing Verses Fill Template (TB1)
-- Date: 2026-02-18
-- Source: Supabase Snippet Untitled query.csv
-- Total unique missing refs (TB1): 33
-- How to use:
-- 1) Isi kolom new_text pada semua baris yang masih ''.
-- 2) Jalankan script ini di Supabase SQL editor (opsional, jika tidak isi manual dari dashboard admin).
-- 3) Setelah selesai, jalankan db/bible_content_quality_audit.sql (query D) lagi.

begin;

create temp table if not exists _bible_tb1_missing_fix (
  book_name text not null,
  chapter_number integer not null,
  verse_number integer not null,
  new_text text not null
);

truncate table _bible_tb1_missing_fix;

insert into _bible_tb1_missing_fix (book_name, chapter_number, verse_number, new_text)
values
  ('Barukh', 1, 15, ''),
  ('Kejadian', 1, 4, ''),
  ('Kejadian', 2, 2, ''),
  ('Kejadian', 2, 3, ''),
  ('Kejadian', 2, 4, ''),
  ('Kejadian', 2, 5, ''),
  ('Kejadian', 2, 6, ''),
  ('Kejadian', 7, 2, ''),
  ('Kejadian', 7, 3, ''),
  ('Keluaran', 7, 2, ''),
  ('Keluaran', 7, 3, ''),
  ('Keluaran', 7, 4, ''),
  ('Keluaran', 7, 5, ''),
  ('Keluaran', 7, 6, ''),
  ('Keluaran', 7, 7, ''),
  ('Keluaran', 7, 8, ''),
  ('Keluaran', 7, 9, ''),
  ('Matius', 5, 2, ''),
  ('Sirakh', 1, 5, ''),
  ('Sirakh', 1, 7, ''),
  ('Sirakh', 1, 21, ''),
  ('Sirakh', 11, 15, ''),
  ('Sirakh', 11, 16, ''),
  ('Sirakh', 17, 5, ''),
  ('Sirakh', 18, 3, ''),
  ('Sirakh', 23, 26, ''),
  ('Sirakh', 24, 18, ''),
  ('Sirakh', 25, 12, ''),
  ('Sirakh', 37, 32, ''),
  ('Sirakh', 37, 33, ''),
  ('Sirakh', 37, 34, ''),
  ('Sirakh', 37, 35, ''),
  ('Tobit', 9, 3, '');

-- Update TB1 only when new_text is filled.
update public.bible_verses v
set text = f.new_text
from _bible_tb1_missing_fix f
join public.bible_books b
  on b.name = f.book_name
 and coalesce(nullif(lower(trim(b.language_code)), ''), 'id') = 'id'
 and coalesce(nullif(upper(trim(b.version_code)), ''), 'TB1') = 'TB1'
join public.bible_chapters c
  on c.book_id = b.id
 and c.chapter_number = f.chapter_number
where v.chapter_id = c.id
  and v.verse_number = f.verse_number
  and trim(f.new_text) <> '';

-- Optional: mirror TB1 into TB (legacy alias) only if TB text is still empty.
update public.bible_verses v_tb
set text = v_tb1.text
from _bible_tb1_missing_fix f
join public.bible_books b_tb
  on b_tb.name = f.book_name
 and coalesce(nullif(lower(trim(b_tb.language_code)), ''), 'id') = 'id'
 and coalesce(nullif(upper(trim(b_tb.version_code)), ''), 'TB') = 'TB'
join public.bible_chapters c_tb
  on c_tb.book_id = b_tb.id
 and c_tb.chapter_number = f.chapter_number
join public.bible_books b_tb1
  on b_tb1.name = f.book_name
 and coalesce(nullif(lower(trim(b_tb1.language_code)), ''), 'id') = 'id'
 and coalesce(nullif(upper(trim(b_tb1.version_code)), ''), 'TB1') = 'TB1'
join public.bible_chapters c_tb1
  on c_tb1.book_id = b_tb1.id
 and c_tb1.chapter_number = f.chapter_number
join public.bible_verses v_tb1
  on v_tb1.chapter_id = c_tb1.id
where v_tb.chapter_id = c_tb.id
  and v_tb.verse_number = f.verse_number
  and v_tb1.verse_number = f.verse_number
  and trim(coalesce(v_tb.text, '')) = ''
  and trim(f.new_text) <> ''
  and trim(coalesce(v_tb1.text, '')) <> '';

analyze public.bible_verses;

commit;
