import { supabase } from '@/lib/supabase/client';
import type { BibleBook, BibleVerse } from '@/lib/types';
import { createRandomUUID } from '@/lib/utils';

function normalizeTestament(value: string | undefined): BibleBook['testament'] {
  const normalized = value?.toLowerCase() || '';
  if (normalized.includes('deutero')) return 'deutero';
  if (normalized.includes('new') || normalized.includes('pb') || normalized.includes('baru')) return 'new';
  return 'old';
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapBookRow(row: Record<string, unknown>): BibleBook {
  return {
    id: row.id?.toString() ?? createRandomUUID(),
    name: row.name?.toString() || row.book_name?.toString() || 'Kitab',
    abbreviation: row.abbreviation?.toString() || row.abbr?.toString() || '',
    testament: normalizeTestament(
      row.testament?.toString() || row.grouping?.toString()
    ),
    total_chapters: normalizeNumber(row.total_chapters ?? row.chapter_count, 0),
    book_order: normalizeNumber(row.book_order ?? row.order_no ?? row.order_index, 9999),
    language_code: row.language_code?.toString() || 'id',
  };
}

function mapVerseRow(row: Record<string, unknown>): BibleVerse {
  return {
    verse_number: normalizeNumber(row.verse_number ?? row.verse, 0),
    text: row.text?.toString() || row.content?.toString() || '',
    type: row.type?.toString(),
    pericope: row.pericope?.toString(),
  };
}

function deduplicateBooks(books: BibleBook[]) {
  const preferredLanguage = books.some((book) => book.language_code === 'id')
    ? 'id'
    : books[0]?.language_code;

  const byLanguage = preferredLanguage
    ? books.filter((book) => book.language_code === preferredLanguage)
    : books;

  const deduped = new Map<string, BibleBook>();
  for (const book of byLanguage) {
    const key = `${book.testament}:${book.book_order}:${book.name.toLowerCase()}`;
    if (!deduped.has(key)) {
      deduped.set(key, book);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => a.book_order - b.book_order);
}

function isCompatibilityError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes('does not exist') ||
    lower.includes('could not find') ||
    lower.includes('42703') ||
    lower.includes('42p01') ||
    lower.includes('pgrst200') ||
    lower.includes('pgrst205')
  );
}

function getBookIdCandidates(bookId: string): Array<string | number> {
  const trimmed = bookId.trim();
  const candidates: Array<string | number> = [trimmed];
  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber)) {
    candidates.push(asNumber);
  }
  return candidates;
}

function uniqueSortedNumbers(values: number[]) {
  return [...new Set(values.filter((value) => Number.isFinite(value) && value > 0))].sort(
    (a, b) => a - b
  );
}

export class BibleService {
  static async getBooks(): Promise<BibleBook[]> {
    const primary = await supabase
      .from('bible_books')
      .select('*')
      .order('book_order', { ascending: true });

    if (!primary.error) {
      return deduplicateBooks(
        ((primary.data ?? []) as Record<string, unknown>[]).map(mapBookRow)
      );
    }

    const fallback = await supabase
      .from('bible_books')
      .select('*')
      .order('order_index', { ascending: true });

    if (!fallback.error) {
      return deduplicateBooks(
        ((fallback.data ?? []) as Record<string, unknown>[]).map(mapBookRow)
      );
    }

    const noOrder = await supabase.from('bible_books').select('*');
    if (noOrder.error) {
      console.error('Error fetching bible books:', noOrder.error);
      return [];
    }

    return deduplicateBooks(
      ((noOrder.data ?? []) as Record<string, unknown>[]).map(mapBookRow)
    );
  }

  static async getChapters(bookId: string): Promise<number[]> {
    if (!bookId.trim()) return [];

    const bookIdCandidates = getBookIdCandidates(bookId);

    for (const candidate of bookIdCandidates) {
      const chapterResult = await supabase
        .from('bible_chapters')
        .select('chapter_number')
        .eq('book_id', candidate)
        .order('chapter_number', { ascending: true });

      if (!chapterResult.error) {
        const chapters = ((chapterResult.data ?? []) as Record<string, unknown>[])
          .map((row) => normalizeNumber(row.chapter_number, 0));
        const normalized = uniqueSortedNumbers(chapters);
        if (normalized.length > 0) {
          return normalized;
        }
      } else if (!isCompatibilityError(chapterResult.error.message)) {
        console.error('Error fetching bible chapters:', chapterResult.error);
      }
    }

    for (const candidate of bookIdCandidates) {
      const fallback = await supabase
        .from('bible_verses')
        .select('chapter')
        .eq('book_id', candidate)
        .order('chapter', { ascending: true });

      if (!fallback.error) {
        const chapters = ((fallback.data ?? []) as Record<string, unknown>[])
          .map((row) => normalizeNumber(row.chapter, 0));
        return uniqueSortedNumbers(chapters);
      }

      if (!isCompatibilityError(fallback.error.message)) {
        console.error('Error fetching bible chapters fallback:', fallback.error);
      }
    }

    return [];
  }

  static async getVerses(bookId: string, chapter: number): Promise<BibleVerse[]> {
    if (!bookId.trim() || chapter <= 0) return [];

    const bookIdCandidates = getBookIdCandidates(bookId);

    for (const candidate of bookIdCandidates) {
      const chapterRow = await supabase
        .from('bible_chapters')
        .select('id')
        .eq('book_id', candidate)
        .eq('chapter_number', chapter)
        .maybeSingle();

      if (chapterRow.error) {
        if (!isCompatibilityError(chapterRow.error.message)) {
          console.error('Error fetching bible chapter row:', chapterRow.error);
        }
        continue;
      }

      const chapterId = chapterRow.data?.id?.toString();
      if (!chapterId) {
        continue;
      }

      const versesByChapterId = await supabase
        .from('bible_verses')
        .select('verse_number, verse, text, content, type, pericope')
        .eq('chapter_id', chapterId)
        .order('verse_number', { ascending: true });

      if (!versesByChapterId.error) {
        return ((versesByChapterId.data ?? []) as Record<string, unknown>[])
          .map(mapVerseRow)
          .filter((row) => row.text.trim().length > 0);
      }

      if (!isCompatibilityError(versesByChapterId.error.message)) {
        console.error('Error fetching bible verses by chapter_id:', versesByChapterId.error);
      }
    }

    for (const candidate of bookIdCandidates) {
      const legacy = await supabase
        .from('bible_verses')
        .select('verse_number, verse, text, content, type, pericope')
        .eq('book_id', candidate)
        .eq('chapter', chapter)
        .order('verse_number', { ascending: true });

      if (!legacy.error) {
        return ((legacy.data ?? []) as Record<string, unknown>[])
          .map(mapVerseRow)
          .filter((row) => row.text.trim().length > 0);
      }

      if (!isCompatibilityError(legacy.error.message)) {
        console.error('Error fetching bible verses fallback:', legacy.error);
      }
    }

    return [];
  }
}
