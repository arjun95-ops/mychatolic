import { supabase } from '@/lib/supabase/client';
import type { BibleBook, BibleVerse, BibleVerseSearchHit } from '@/lib/types';
import { createRandomUUID } from '@/lib/utils';

const VERSE_SELECT_CANDIDATES = [
  'verse_number, verse, text, content, type, pericope',
  'verse_number, text, content, type, pericope',
  'verse, text, content, type, pericope',
] as const;

const VERSE_ORDER_CANDIDATES = ['verse_number', 'verse'] as const;
const SEARCH_VERSE_NUMBER_CANDIDATES = [
  'verse_number',
  'verse',
  'verse_no',
  'verse_num',
  'number',
  'ayat',
] as const;
const SEARCH_CHAPTER_CANDIDATES = ['chapter', 'chapter_number', 'pasal', 'bab'] as const;

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

const DEUTEROCANONICAL_ORDER_INDEXES = new Set([17, 18, 20, 21, 27, 28, 32]);

function isLikelyDeuterocanonical(bookName: string, bookOrder: number) {
  if (DEUTEROCANONICAL_ORDER_INDEXES.has(bookOrder)) {
    return true;
  }

  const normalizedName = bookName.trim().toLowerCase();
  if (!normalizedName) return false;

  return (
    normalizedName.includes('tobit') ||
    normalizedName.includes('tobias') ||
    normalizedName.includes('yudit') ||
    normalizedName.includes('judith') ||
    normalizedName.includes('makabe') ||
    normalizedName.includes('maccabe') ||
    normalizedName.includes('kebijaksanaan') ||
    normalizedName.includes('wisdom') ||
    normalizedName.includes('sirakh') ||
    normalizedName.includes('sirach') ||
    normalizedName.includes('barukh') ||
    normalizedName.includes('baruch') ||
    normalizedName.includes('tambahan ester') ||
    normalizedName.includes('tambahan daniel') ||
    normalizedName.includes('additions to esther') ||
    normalizedName.includes('additions to daniel')
  );
}

function normalizeTestament(
  value: string | undefined,
  bookName: string,
  bookOrder: number
): BibleBook['testament'] {
  const normalized = value?.toLowerCase() || '';
  if (normalized.includes('deutero')) return 'deutero';
  if (isLikelyDeuterocanonical(bookName, bookOrder)) return 'deutero';
  if (normalized.includes('new') || normalized.includes('pb') || normalized.includes('baru')) return 'new';
  if (bookOrder >= 47 && bookOrder < 9999) return 'new';
  return 'old';
}

function normalizeLanguageCode(value: unknown): string {
  const normalized = value?.toString().trim().toLowerCase();
  return normalized || 'id';
}

function normalizeScopeLanguageCode(value: unknown): 'id' | 'en' {
  const normalized = value?.toString().trim().toLowerCase();
  return normalized === 'en' ? 'en' : 'id';
}

function normalizeVersionCode(value: unknown, languageCode?: string): string {
  const normalized = value?.toString().trim().toUpperCase();
  if (normalized) return normalized;
  return normalizeScopeLanguageCode(languageCode) === 'en' ? 'EN1' : 'TB1';
}

function normalizeRequestedVersionByLanguage(
  languageCode: 'id' | 'en',
  requestedVersion: unknown
) {
  const normalized = requestedVersion?.toString().trim().toUpperCase() || '';
  if (languageCode === 'id') {
    if (normalized === 'TB2') return 'TB2';
    return 'TB1';
  }
  return 'EN1';
}

function versionCandidatesByLanguage(languageCode: 'id' | 'en', versionCode: string) {
  if (languageCode === 'id') {
    if (versionCode === 'TB2') return ['TB2'];
    return ['TB1', 'TB'];
  }
  return ['EN1'];
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeString(value: unknown): string {
  return value?.toString().trim() || '';
}

function mapBookRow(row: Record<string, unknown>): BibleBook {
  const name = row.name?.toString() || row.book_name?.toString() || 'Kitab';
  const bookOrder = normalizeNumber(row.book_order ?? row.order_no ?? row.order_index, 9999);
  const languageCode = normalizeLanguageCode(row.language_code);
  const versionCode = normalizeVersionCode(row.version_code, languageCode);

  return {
    id: row.id?.toString() ?? createRandomUUID(),
    name,
    abbreviation: row.abbreviation?.toString() || row.abbr?.toString() || '',
    testament: normalizeTestament(row.testament?.toString() || row.grouping?.toString(), name, bookOrder),
    total_chapters: normalizeNumber(row.total_chapters ?? row.chapter_count, 0),
    book_order: bookOrder,
    language_code: languageCode,
    version_code: versionCode,
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
  const deduped = new Map<string, BibleBook>();
  for (const book of books) {
    const key = [
      book.testament,
      book.book_order,
      book.name.toLowerCase(),
      book.language_code.toLowerCase(),
      book.version_code.toUpperCase(),
    ].join(':');
    if (!deduped.has(key)) {
      deduped.set(key, book);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => {
    if (a.book_order !== b.book_order) return a.book_order - b.book_order;
    return a.name.localeCompare(b.name);
  });
}

async function applyChapterCountFallback(books: BibleBook[]) {
  if (books.length === 0) return books;
  const needsFallback = books.some((book) => !Number.isFinite(book.total_chapters) || book.total_chapters <= 0);
  if (!needsFallback) return books;

  const chapterResult = await supabase
    .from('bible_chapters')
    .select('book_id, chapter_number');

  if (chapterResult.error) {
    if (!isCompatibilityError(chapterResult.error.message ?? '')) {
      console.error('Error fetching bible chapter counts fallback:', chapterResult.error);
    }
    return books;
  }

  const chapterSetByBook = new Map<string, Set<number>>();
  for (const row of toRecordRows(chapterResult.data)) {
    const bookId = normalizeString(row.book_id);
    const chapterNumber = normalizeNumber(row.chapter_number, 0);
    if (!bookId || chapterNumber <= 0) continue;

    const current = chapterSetByBook.get(bookId) ?? new Set<number>();
    current.add(chapterNumber);
    chapterSetByBook.set(bookId, current);
  }

  return books.map((book) => {
    if (Number.isFinite(book.total_chapters) && book.total_chapters > 0) {
      return book;
    }
    const chapterCount = chapterSetByBook.get(normalizeString(book.id))?.size ?? 0;
    if (chapterCount <= 0) {
      return book;
    }
    return {
      ...book,
      total_chapters: chapterCount,
    };
  });
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

function isColumnTypeMismatch(error: SupabaseErrorLike | null | undefined) {
  const code = error?.code?.toString().trim().toLowerCase() || '';
  const message = error?.message?.toString().toLowerCase() || '';
  return (
    code === '22p02' ||
    message.includes('22p02') ||
    message.includes('invalid input syntax for type')
  );
}

function isMissingColumnError(
  error: SupabaseErrorLike | null | undefined,
  column: string
) {
  const code = error?.code?.toString().trim().toLowerCase() || '';
  const message = error?.message?.toString().toLowerCase() || '';
  return (
    code === '42703' ||
    (message.includes('column') && message.includes(column.toLowerCase()))
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

function isPlaceholderVerseText(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('[missing_verse]') ||
    normalized.includes('[auto]ayat belum tersedia') ||
    normalized.includes('ayat belum tersedia. mohon verifikasi dan lengkapi.')
  );
}

function normalizeVerses(rows: Record<string, unknown>[]) {
  return rows
    .map(mapVerseRow)
    .filter((row) => row.text.trim().length > 0)
    .filter((row) => !isPlaceholderVerseText(row.text));
}

function toRecordRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => {
    return typeof item === 'object' && item !== null && !Array.isArray(item);
  });
}

function extractFirstNumber(
  row: Record<string, unknown>,
  candidates: readonly string[],
  fallback = 0
) {
  for (const candidate of candidates) {
    const value = normalizeNumber(row[candidate], 0);
    if (value > 0) {
      return value;
    }
  }
  return fallback;
}

function extractVerseNumberForSearch(row: Record<string, unknown>) {
  return extractFirstNumber(row, SEARCH_VERSE_NUMBER_CANDIDATES, 0);
}

function extractChapterNumberForSearch(row: Record<string, unknown>) {
  return extractFirstNumber(row, SEARCH_CHAPTER_CANDIDATES, 0);
}

async function queryVerseRowsByBookIdsWithKeyword(params: {
  bookIds: Array<string | number>;
  keywordPattern: string;
  limit: number;
}) {
  const { bookIds, keywordPattern, limit } = params;
  if (bookIds.length === 0) {
    return { rows: [] as Record<string, unknown>[], typeMismatch: false };
  }

  const textResult = await supabase
    .from('bible_verses')
    .select('*')
    .in('book_id', bookIds)
    .ilike('text', keywordPattern)
    .limit(limit);

  if (!textResult.error) {
    return { rows: toRecordRows(textResult.data), typeMismatch: false };
  }
  if (isColumnTypeMismatch(textResult.error)) {
    return { rows: [] as Record<string, unknown>[], typeMismatch: true };
  }

  const contentResult = await supabase
    .from('bible_verses')
    .select('*')
    .in('book_id', bookIds)
    .ilike('content', keywordPattern)
    .limit(limit);

  if (!contentResult.error) {
    return { rows: toRecordRows(contentResult.data), typeMismatch: false };
  }
  if (isColumnTypeMismatch(contentResult.error)) {
    return { rows: [] as Record<string, unknown>[], typeMismatch: true };
  }

  const canFallbackLocally =
    isMissingColumnError(textResult.error, 'text') &&
    isMissingColumnError(contentResult.error, 'content');
  if (!canFallbackLocally) {
    const firstError = textResult.error?.message ?? contentResult.error?.message ?? '';
    if (!isCompatibilityError(firstError)) {
      console.error('Error searching verse rows by book_id:', textResult.error ?? contentResult.error);
    }
    return { rows: [] as Record<string, unknown>[], typeMismatch: false };
  }

  const fallbackResult = await supabase
    .from('bible_verses')
    .select('*')
    .in('book_id', bookIds)
    .limit(Math.max(limit * 8, 120));

  if (fallbackResult.error) {
    if (!isCompatibilityError(fallbackResult.error.message ?? '')) {
      console.error('Error searching verse rows by local fallback:', fallbackResult.error);
    }
    return { rows: [] as Record<string, unknown>[], typeMismatch: false };
  }

  const normalizedKeyword = keywordPattern.replaceAll('%', '').trim().toLowerCase();
  const filtered = toRecordRows(fallbackResult.data).filter((row) => {
    const text = normalizeString(row.text) || normalizeString(row.content);
    return text.toLowerCase().includes(normalizedKeyword);
  });

  return {
    rows: filtered.slice(0, limit),
    typeMismatch: false,
  };
}

async function queryVerseRowsByKeywordGlobal(keywordPattern: string, limit: number) {
  const textResult = await supabase
    .from('bible_verses')
    .select('*')
    .ilike('text', keywordPattern)
    .limit(limit);

  if (!textResult.error) {
    return toRecordRows(textResult.data);
  }

  const contentResult = await supabase
    .from('bible_verses')
    .select('*')
    .ilike('content', keywordPattern)
    .limit(limit);

  if (!contentResult.error) {
    return toRecordRows(contentResult.data);
  }

  const canFallbackLocally =
    isMissingColumnError(textResult.error, 'text') &&
    isMissingColumnError(contentResult.error, 'content');
  if (!canFallbackLocally) {
    const firstError = textResult.error?.message ?? contentResult.error?.message ?? '';
    if (!isCompatibilityError(firstError)) {
      console.error('Error searching verse rows globally:', textResult.error ?? contentResult.error);
    }
    return [] as Record<string, unknown>[];
  }

  const fallbackResult = await supabase
    .from('bible_verses')
    .select('*')
    .limit(Math.max(limit * 8, 160));

  if (fallbackResult.error) {
    if (!isCompatibilityError(fallbackResult.error.message ?? '')) {
      console.error('Error searching verse rows globally by local fallback:', fallbackResult.error);
    }
    return [] as Record<string, unknown>[];
  }

  const normalizedKeyword = keywordPattern.replaceAll('%', '').trim().toLowerCase();
  const filtered = toRecordRows(fallbackResult.data).filter((row) => {
    const text = normalizeString(row.text) || normalizeString(row.content);
    return text.toLowerCase().includes(normalizedKeyword);
  });

  return filtered.slice(0, limit);
}

async function enrichRowsWithChapterInfo(rows: Record<string, unknown>[]) {
  const chapterIds = [...new Set(
    rows
      .map((row) => normalizeString(row.chapter_id))
      .filter((value) => value.length > 0)
  )];

  if (chapterIds.length === 0) {
    return rows;
  }

  const chapterResult = await supabase
    .from('bible_chapters')
    .select('id, book_id, chapter_number')
    .in('id', chapterIds);

  if (chapterResult.error) {
    if (!isCompatibilityError(chapterResult.error.message ?? '')) {
      console.error('Error enriching verse rows with chapter info:', chapterResult.error);
    }
    return rows;
  }

  const chapterMap = new Map<string, Record<string, unknown>>();
  for (const row of toRecordRows(chapterResult.data)) {
    const id = normalizeString(row.id);
    if (!id) continue;
    chapterMap.set(id, row);
  }

  return rows.map((row) => {
    const chapterId = normalizeString(row.chapter_id);
    if (!chapterId) return row;
    const chapterInfo = chapterMap.get(chapterId);
    if (!chapterInfo) return row;

    const bookId = normalizeString(row.book_id) || normalizeString(chapterInfo.book_id);
    const chapter = extractChapterNumberForSearch(row) || normalizeNumber(chapterInfo.chapter_number, 0);

    return {
      ...row,
      book_id: bookId,
      chapter,
    };
  });
}

async function fetchVersesByChapterId(chapterId: string): Promise<BibleVerse[] | null> {
  for (const selectColumns of VERSE_SELECT_CANDIDATES) {
    for (const orderColumn of VERSE_ORDER_CANDIDATES) {
      const result = await supabase
        .from('bible_verses')
        .select(selectColumns)
        .eq('chapter_id', chapterId)
        .order(orderColumn, { ascending: true });

      if (!result.error) {
        return normalizeVerses(toRecordRows(result.data));
      }

      if (!isCompatibilityError(result.error.message ?? '')) {
        console.error('Error fetching bible verses by chapter_id:', result.error);
        return null;
      }
    }
  }

  return null;
}

async function fetchLegacyVerses(bookId: string | number, chapter: number): Promise<BibleVerse[] | null> {
  for (const selectColumns of VERSE_SELECT_CANDIDATES) {
    for (const orderColumn of VERSE_ORDER_CANDIDATES) {
      const result = await supabase
        .from('bible_verses')
        .select(selectColumns)
        .eq('book_id', bookId)
        .eq('chapter', chapter)
        .order(orderColumn, { ascending: true });

      if (!result.error) {
        return normalizeVerses(toRecordRows(result.data));
      }

      if (!isCompatibilityError(result.error.message ?? '')) {
        console.error('Error fetching bible verses fallback:', result.error);
        return null;
      }
    }
  }

  return null;
}

export class BibleService {
  static async getBooks(): Promise<BibleBook[]> {
    const primary = await supabase
      .from('bible_books')
      .select('*')
      .order('book_order', { ascending: true });

    if (!primary.error) {
      return applyChapterCountFallback(deduplicateBooks(
        toRecordRows(primary.data).map(mapBookRow)
      ));
    }

    const fallback = await supabase
      .from('bible_books')
      .select('*')
      .order('order_index', { ascending: true });

    if (!fallback.error) {
      return applyChapterCountFallback(deduplicateBooks(
        toRecordRows(fallback.data).map(mapBookRow)
      ));
    }

    const noOrder = await supabase.from('bible_books').select('*');
    if (noOrder.error) {
      console.error('Error fetching bible books:', noOrder.error);
      return [];
    }

    return applyChapterCountFallback(deduplicateBooks(
      toRecordRows(noOrder.data).map(mapBookRow)
    ));
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
        const chapters = toRecordRows(chapterResult.data)
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
        const chapters = toRecordRows(fallback.data)
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

      const versesByChapterId = await fetchVersesByChapterId(chapterId);
      if (versesByChapterId && versesByChapterId.length > 0) {
        return versesByChapterId;
      }
    }

    for (const candidate of bookIdCandidates) {
      const legacy = await fetchLegacyVerses(candidate, chapter);
      if (legacy) {
        return legacy;
      }
    }

    return [];
  }

  static async searchVerses(params: {
    query: string;
    languageCode?: string;
    versionCode?: string;
    limit?: number;
  }): Promise<BibleVerseSearchHit[]> {
    const normalizedQuery = normalizeString(params.query);
    if (normalizedQuery.length < 2) return [];

    const normalizedLanguageCode = normalizeScopeLanguageCode(params.languageCode ?? 'id');
    const normalizedVersionCode = normalizeRequestedVersionByLanguage(
      normalizedLanguageCode,
      params.versionCode ?? ''
    );
    const normalizedLimit = Math.min(Math.max(Math.floor(params.limit ?? 40), 10), 120);

    const books = await BibleService.getBooks();
    if (books.length === 0) return [];

    const booksByLanguage = books.filter(
      (book) => normalizeScopeLanguageCode(book.language_code) === normalizedLanguageCode
    );
    if (booksByLanguage.length === 0) return [];

    let scopedBooks: BibleBook[] = [];
    const candidates = versionCandidatesByLanguage(
      normalizedLanguageCode,
      normalizedVersionCode
    );
    for (const candidate of candidates) {
      const byVersion = booksByLanguage.filter(
        (book) => normalizeVersionCode(book.version_code) === candidate
      );
      if (byVersion.length > 0) {
        scopedBooks = byVersion;
        break;
      }
    }

    if (scopedBooks.length === 0) return [];

    const booksById = new Map<string, BibleBook>();
    const bookOrderById = new Map<string, number>();
    const numericAliasToBookId = new Map<string, string>();
    const uuidBookIds: string[] = [];
    const numericBookIds: number[] = [];

    for (const book of scopedBooks) {
      const bookId = normalizeString(book.id);
      if (!bookId) continue;

      booksById.set(bookId, book);
      bookOrderById.set(bookId, normalizeNumber(book.book_order, 9999));
      uuidBookIds.push(bookId);

      const parsedBookId = Number(bookId);
      if (Number.isFinite(parsedBookId)) {
        const numericId = Math.floor(parsedBookId);
        numericBookIds.push(numericId);
        if (!numericAliasToBookId.has(numericId.toString())) {
          numericAliasToBookId.set(numericId.toString(), bookId);
        }
      }

      if (book.book_order > 0 && !numericAliasToBookId.has(book.book_order.toString())) {
        numericAliasToBookId.set(book.book_order.toString(), bookId);
      }
    }

    const uniqueUuidBookIds = [...new Set(uuidBookIds)];
    const uniqueNumericBookIds = [...new Set(numericBookIds)];
    const keywordPattern = `%${normalizedQuery}%`;
    const mergedRows: Record<string, unknown>[] = [];
    const seenRows = new Set<string>();

    const addRows = (rows: Record<string, unknown>[]) => {
      for (const row of rows) {
        const bookId = normalizeString(row.book_id);
        const chapter = extractChapterNumberForSearch(row);
        const verseNumber = extractVerseNumberForSearch(row);
        const chapterId = normalizeString(row.chapter_id);
        const marker = `${bookId}:${chapter}:${verseNumber}:${chapterId}`;
        if (seenRows.has(marker)) continue;
        seenRows.add(marker);
        mergedRows.push(row);
      }
    };

    if (uniqueUuidBookIds.length > 0) {
      const uuidResult = await queryVerseRowsByBookIdsWithKeyword({
        bookIds: uniqueUuidBookIds,
        keywordPattern,
        limit: normalizedLimit * 2,
      });
      addRows(uuidResult.rows);
    }

    if (uniqueNumericBookIds.length > 0 && mergedRows.length < normalizedLimit * 2) {
      const numericResult = await queryVerseRowsByBookIdsWithKeyword({
        bookIds: uniqueNumericBookIds,
        keywordPattern,
        limit: normalizedLimit * 2,
      });
      addRows(numericResult.rows);
    }

    if (mergedRows.length === 0) {
      const fallbackRows = await queryVerseRowsByKeywordGlobal(keywordPattern, normalizedLimit * 4);
      addRows(fallbackRows);
    }

    if (mergedRows.length === 0) {
      return [];
    }

    const normalizedRows = await enrichRowsWithChapterInfo(mergedRows);
    const mappedHits: Array<BibleVerseSearchHit & { order: number }> = [];
    const seenHits = new Set<string>();

    for (const row of normalizedRows) {
      const rawBookId = normalizeString(row.book_id);
      if (!rawBookId) continue;

      const resolvedBookId =
        booksById.get(rawBookId)?.id ||
        numericAliasToBookId.get(rawBookId) ||
        numericAliasToBookId.get(normalizeNumber(rawBookId, 0).toString());
      if (!resolvedBookId) continue;

      const chapter = extractChapterNumberForSearch(row);
      const verseNumber = extractVerseNumberForSearch(row);
      const text = normalizeString(row.text) || normalizeString(row.content);
      if (chapter <= 0 || verseNumber <= 0 || text.length === 0) continue;
      if (isPlaceholderVerseText(text)) continue;

      const hitKey = `${resolvedBookId}:${chapter}:${verseNumber}`;
      if (seenHits.has(hitKey)) continue;
      seenHits.add(hitKey);

      mappedHits.push({
        book_id: resolvedBookId,
        chapter,
        verse_number: verseNumber,
        text,
        order: bookOrderById.get(resolvedBookId) ?? 9999,
      });
    }

    mappedHits.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      if (a.chapter !== b.chapter) return a.chapter - b.chapter;
      return a.verse_number - b.verse_number;
    });

    return mappedHits.slice(0, normalizedLimit).map(({ order: _order, ...hit }) => hit);
  }
}
