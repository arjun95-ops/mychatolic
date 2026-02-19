'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BookMarked,
  BookOpen,
  BookText,
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Languages,
  Loader2,
  NotebookPen,
  Search,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  useBibleBooks,
  useBibleChapters,
  useBibleVerseSearch,
  useBibleVerses,
} from '@/lib/features/bible/use-bible';
import { useAuth } from '@/lib/features/auth/use-auth';
import {
  loadBiblePersonalStoreFromCloud,
  syncBiblePersonalStoreToCloud,
  upsertBiblePlanProgressToCloud,
} from '@/lib/features/bible/personalization-cloud';
import {
  createEmptyBiblePersonalStore,
  getBiblePersonalStoreOwnerId,
  getBibleLocalDateKey,
  loadBiblePersonalStore,
  markBiblePlanDayCompleted,
  mergeBiblePersonalStore,
  resolveBibleAnnotationScope,
  saveBiblePersonalStore,
  setBiblePersonalStoreOwnerId,
  type BibleBookmarkEntry,
  type BibleHighlightEntry,
  type BibleNoteEntry,
  type BiblePersonalStore,
} from '@/lib/features/bible/personalization';
import type { BibleBook } from '@/lib/types';
import { cn } from '@/lib/utils';

type MainTab = 'baca' | 'rencana' | 'cari' | 'catatan';
type CanonFilter = 'all' | 'proto' | 'deutero';

interface ReadingPlan {
  id: string;
  title: string;
  durationDays: number;
  description: string;
  prompt: string;
  startReference: string;
}

interface ThemePack {
  id: string;
  label: string;
  description: string;
  references: string[];
}

interface ReferenceMatch {
  book: BibleBook;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}

interface CatatanItem {
  id: string;
  type: 'bookmark' | 'highlight' | 'note';
  bookId: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  referenceLabel: string;
  excerpt: string;
  note?: string;
  color?: string;
  dateIso: string;
}

const MAIN_TAB_CONFIG: Array<{ key: MainTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'baca', label: 'Baca', icon: BookOpen },
  { key: 'rencana', label: 'Rencana', icon: CalendarCheck2 },
  { key: 'cari', label: 'Cari', icon: Search },
  { key: 'catatan', label: 'Catatan', icon: NotebookPen },
];

const TESTAMENT_CONFIG: Array<{
  key: BibleBook['testament'];
  shortLabel: string;
  fullLabel: string;
}> = [
  { key: 'old', shortLabel: 'PL', fullLabel: 'Perjanjian Lama' },
  { key: 'new', shortLabel: 'PB', fullLabel: 'Perjanjian Baru' },
  { key: 'deutero', shortLabel: 'Deutero', fullLabel: 'Deuterokanonika' },
];

const CANON_FILTER_CONFIG: Array<{ key: CanonFilter; label: string }> = [
  { key: 'all', label: 'Semua' },
  { key: 'proto', label: 'Protokanonika' },
  { key: 'deutero', label: 'Deuterokanonika' },
];

const LANGUAGE_OPTIONS = [
  { code: 'id', label: 'Indonesia' },
  { code: 'en', label: 'English' },
] as const;

const VERSION_OPTIONS_BY_LANGUAGE: Record<'id' | 'en', string[]> = {
  id: ['TB1', 'TB2'],
  en: ['EN1'],
};

const REFERENCE_PATTERN = /^([1-3]\s*)?([A-Za-zÀ-ÿ.]+(?:\s+[A-Za-zÀ-ÿ.]+)*)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/i;

const BIBLE_READING_PLANS: ReadingPlan[] = [
  {
    id: 'injil-markus-7',
    title: '7 Hari Bersama Injil Markus',
    durationDays: 7,
    description: 'Rencana singkat untuk mulai membangun ritme membaca harian.',
    prompt: 'Ayat mana yang paling menegur hari ini?',
    startReference: 'Mrk 1:1-20',
  },
  {
    id: 'mazmur-30',
    title: '30 Hari Mazmur Penguatan',
    durationDays: 30,
    description: 'Pendamping doa saat cemas, lelah, dan butuh pengharapan.',
    prompt: 'Apa yang ingin kamu bawa dalam doa malam ini?',
    startReference: 'Mzm 1:1-6',
  },
  {
    id: 'prapaskah-40',
    title: '40 Hari Prapaskah',
    durationDays: 40,
    description: 'Fokus pertobatan, pembaruan diri, dan kesiapan menyambut Paskah.',
    prompt: 'Di bagian mana Tuhan mengajakmu bertobat hari ini?',
    startReference: 'Mat 4:1-11',
  },
  {
    id: 'empat-injil-90',
    title: '90 Hari 4 Injil',
    durationDays: 90,
    description: 'Membaca keseluruhan kisah Yesus secara bertahap dan konsisten.',
    prompt: 'Sikap Yesus mana yang ingin kamu teladani besok?',
    startReference: 'Yoh 1:1-18',
  },
];

const BIBLE_THEMES: ThemePack[] = [
  {
    id: 'pertobatan',
    label: 'Pertobatan',
    description: 'Ayat-ayat untuk kembali pada kasih Tuhan.',
    references: ['Luk 15:7', 'Kis 3:19', 'Yl 2:13'],
  },
  {
    id: 'doa',
    label: 'Doa',
    description: 'Pegangan saat ingin membangun kehidupan doa.',
    references: ['Mat 6:6', 'Flp 4:6', 'Yak 5:16'],
  },
  {
    id: 'pengharapan',
    label: 'Pengharapan',
    description: 'Penguatan saat hati sedang berat.',
    references: ['Rm 15:13', 'Mzm 27:14', 'Yes 41:10'],
  },
  {
    id: 'ekaristi',
    label: 'Ekaristi',
    description: 'Ayat kunci seputar Tubuh dan Darah Kristus.',
    references: ['Yoh 6:51', '1Kor 11:24', 'Luk 22:19'],
  },
  {
    id: 'maria',
    label: 'Maria',
    description: 'Renungan seputar ketaatan dan devosi Maria.',
    references: ['Luk 1:38', 'Yoh 2:5', 'Luk 1:46-48'],
  },
  {
    id: 'deutero',
    label: 'Deuterokanonika',
    description: 'Ayat pilihan dari kitab Deuterokanonika.',
    references: ['Tob 12:8', 'Sir 2:1', 'Keb 3:1'],
  },
];

const INLINE_VERSE_SEARCH_PREVIEW_COUNT = 7;

function fallbackChapterList(book?: BibleBook | null) {
  const total = Number(book?.total_chapters ?? 0);
  if (!Number.isFinite(total) || total <= 0) return [1];
  return Array.from({ length: total }, (_, index) => index + 1);
}

function buildContiguousChapterList(chapters: number[], book?: BibleBook | null) {
  const normalized = uniqueSortedNumbers(chapters);
  const fallback = fallbackChapterList(book);
  const fallbackMax = fallback[fallback.length - 1] || 1;
  const detectedMax = normalized[normalized.length - 1] || 0;
  const upperBound = Math.max(fallbackMax, detectedMax, 1);
  return Array.from({ length: upperBound }, (_, index) => index + 1);
}

function parseMainTab(value: string | null): MainTab {
  if (value === 'baca' || value === 'rencana' || value === 'cari' || value === 'catatan') {
    return value;
  }
  return 'baca';
}

function parseTestament(value: string | null): BibleBook['testament'] {
  if (value === 'old' || value === 'new' || value === 'deutero') return value;
  return 'old';
}

function uniqueSortedNumbers(values: number[]) {
  return [...new Set(values.filter((value) => Number.isFinite(value) && value > 0))].sort(
    (a, b) => a - b
  );
}

function normalizeScopeLanguageCode(value: string | null | undefined): 'id' | 'en' {
  return value?.trim().toLowerCase() === 'en' ? 'en' : 'id';
}

function normalizeVersionCode(value: string | null | undefined) {
  return value?.trim().toUpperCase() || '';
}

function normalizeRequestedVersionByLanguage(
  languageCode: 'id' | 'en',
  requestedVersion: string | null | undefined
) {
  const normalized = normalizeVersionCode(requestedVersion);
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

function normalizeBookToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchBookFromToken(token: string, books: BibleBook[]) {
  const needle = normalizeBookToken(token);
  if (!needle) return null;

  const exact = books.find((book) => {
    const name = normalizeBookToken(book.name);
    const abbr = normalizeBookToken(book.abbreviation);
    return name === needle || abbr === needle;
  });
  if (exact) return exact;

  return (
    books.find((book) => {
      const name = normalizeBookToken(book.name);
      const abbr = normalizeBookToken(book.abbreviation);
      return name.startsWith(needle) || abbr.startsWith(needle) || name.includes(needle);
    }) || null
  );
}

function parseReference(input: string, books: BibleBook[]): ReferenceMatch | null {
  const normalizedInput = input.trim().replace(/\s+/g, ' ');
  const match = normalizedInput.match(REFERENCE_PATTERN);
  if (!match) return null;

  const numericPrefix = (match[1] || '').trim();
  const rawBook = (match[2] || '').trim();
  const chapter = Number(match[3] || 0);
  const verseStart = Number(match[4] || 0);
  const verseEnd = Number(match[5] || 0);

  if (!chapter || chapter <= 0) return null;

  const bookToken = numericPrefix ? `${numericPrefix} ${rawBook}` : rawBook;
  const matchedBook = matchBookFromToken(bookToken, books);
  if (!matchedBook) return null;

  return {
    book: matchedBook,
    chapter,
    verseStart: verseStart > 0 ? verseStart : undefined,
    verseEnd: verseEnd > 0 ? verseEnd : undefined,
  };
}

function referenceLabel({
  book,
  chapter,
  verseStart,
  verseEnd,
}: ReferenceMatch) {
  if (!verseStart) return `${book.name} ${chapter}`;
  if (!verseEnd || verseEnd === verseStart) return `${book.name} ${chapter}:${verseStart}`;
  return `${book.name} ${chapter}:${verseStart}-${verseEnd}`;
}

function mapBookmarkToItem(entry: BibleBookmarkEntry): CatatanItem {
  const fallbackLabel =
    entry.verse_start === entry.verse_end
      ? `${entry.chapter}:${entry.verse_start}`
      : `${entry.chapter}:${entry.verse_start}-${entry.verse_end}`;
  return {
    id: entry.id,
    type: 'bookmark',
    bookId: entry.book_id,
    chapter: entry.chapter,
    verseStart: entry.verse_start,
    verseEnd: entry.verse_end,
    referenceLabel: entry.reference_label || fallbackLabel,
    excerpt: entry.excerpt,
    dateIso: entry.created_at,
  };
}

function mapHighlightToItem(entry: BibleHighlightEntry): CatatanItem {
  const fallbackLabel =
    entry.verse_start === entry.verse_end
      ? `${entry.chapter}:${entry.verse_start}`
      : `${entry.chapter}:${entry.verse_start}-${entry.verse_end}`;
  return {
    id: entry.id,
    type: 'highlight',
    bookId: entry.book_id,
    chapter: entry.chapter,
    verseStart: entry.verse_start,
    verseEnd: entry.verse_end,
    referenceLabel: entry.reference_label || fallbackLabel,
    excerpt: entry.excerpt,
    color: entry.color,
    dateIso: entry.created_at,
  };
}

function mapNoteToItem(entry: BibleNoteEntry): CatatanItem {
  const fallbackLabel =
    entry.verse_start === entry.verse_end
      ? `${entry.chapter}:${entry.verse_start}`
      : `${entry.chapter}:${entry.verse_start}-${entry.verse_end}`;
  return {
    id: entry.id,
    type: 'note',
    bookId: entry.book_id,
    chapter: entry.chapter,
    verseStart: entry.verse_start,
    verseEnd: entry.verse_end,
    referenceLabel: entry.reference_label || fallbackLabel,
    excerpt: entry.excerpt,
    note: entry.note,
    dateIso: entry.updated_at || entry.created_at,
  };
}

function toValidChapter(book: BibleBook, chapter: number) {
  if (chapter <= 0) return 1;
  if (!book.total_chapters || book.total_chapters <= 0) return chapter;
  return Math.min(chapter, book.total_chapters);
}

function isSameScopeAnnotation(
  entry: { language_code?: string; version_code?: string },
  languageCode: 'id' | 'en',
  versionCode: string
) {
  const scope = resolveBibleAnnotationScope(entry);
  return scope.language_code === languageCode && scope.version_code === versionCode;
}

function buildVerseSearchExcerpt(text: string, query: string) {
  const trimmedText = text.trim();
  if (trimmedText.length <= 220) return trimmedText;

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return `${trimmedText.slice(0, 217)}...`;

  const index = trimmedText.toLowerCase().indexOf(normalizedQuery);
  if (index < 0) return `${trimmedText.slice(0, 217)}...`;

  const start = Math.max(0, index - 70);
  const end = Math.min(trimmedText.length, index + normalizedQuery.length + 90);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < trimmedText.length ? '...' : '';
  return `${prefix}${trimmedText.slice(start, end)}${suffix}`;
}

function escapeRegexPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenizeSearchTerms(query: string) {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
  return [...new Set(terms)];
}

function renderHighlightedExcerpt(text: string, query: string) {
  const terms = tokenizeSearchTerms(query);
  if (terms.length === 0) return text;

  const pattern = new RegExp(`(${terms.map(escapeRegexPattern).join('|')})`, 'ig');
  const parts = text.split(pattern);
  if (parts.length <= 1) return text;

  return parts.map((part, index) => {
    const normalizedPart = part.toLowerCase();
    if (terms.includes(normalizedPart)) {
      return (
        <mark
          key={`hit-${index}`}
          className="rounded bg-amber-200/85 px-0.5 text-foreground dark:bg-amber-500/30"
        >
          {part}
        </mark>
      );
    }
    return <span key={`txt-${index}`}>{part}</span>;
  });
}

export default function BiblePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [mainTab, setMainTab] = useState<MainTab>(() => parseMainTab(searchParams.get('tab')));
  const [keyword, setKeyword] = useState('');
  const [activeTestament, setActiveTestament] = useState<BibleBook['testament']>(() =>
    parseTestament(searchParams.get('scope'))
  );
  const [canonFilter, setCanonFilter] = useState<CanonFilter>('all');
  const [languageCode, setLanguageCode] = useState<'id' | 'en'>(() =>
    normalizeScopeLanguageCode(searchParams.get('lang'))
  );
  const [versionCode, setVersionCode] = useState(() =>
    normalizeVersionCode(searchParams.get('ver'))
  );

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorBook, setSelectorBook] = useState<BibleBook | null>(null);
  const [selectorChapter, setSelectorChapter] = useState<number | null>(null);

  const [referenceInput, setReferenceInput] = useState('');
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [verseSearchLimit, setVerseSearchLimit] = useState(30);
  const [activeTheme, setActiveTheme] = useState<string>('');

  const [personalStore, setPersonalStore] = useState<BiblePersonalStore>(() =>
    loadBiblePersonalStore()
  );

  const { data: books = [], isLoading: isLoadingBooks } = useBibleBooks();

  useEffect(() => {
    let active = true;

    if (!user?.id) return undefined;

    const run = async () => {
      const ownerId = getBiblePersonalStoreOwnerId();
      if (ownerId && ownerId !== user.id) {
        saveBiblePersonalStore(createEmptyBiblePersonalStore());
      }

      const local = loadBiblePersonalStore();
      if (!active) return;
      setPersonalStore(local);
      setBiblePersonalStoreOwnerId(user.id);
      const cloud = await loadBiblePersonalStoreFromCloud(user.id);
      if (!active) return;
      if (!cloud.supported) return;

      const merged = mergeBiblePersonalStore(local, cloud.store);
      saveBiblePersonalStore(merged);
      setBiblePersonalStoreOwnerId(user.id);

      setPersonalStore(merged);
      void syncBiblePersonalStoreToCloud(user.id, merged);
    };

    void run();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const effectiveLanguageCode = useMemo(
    () => normalizeScopeLanguageCode(languageCode),
    [languageCode]
  );

  const versionOptions = useMemo(
    () => VERSION_OPTIONS_BY_LANGUAGE[effectiveLanguageCode],
    [effectiveLanguageCode]
  );

  const effectiveVersionCode = useMemo(
    () => normalizeRequestedVersionByLanguage(effectiveLanguageCode, versionCode),
    [effectiveLanguageCode, versionCode]
  );

  useEffect(() => {
    const nextQuery = new URLSearchParams(searchParams.toString());
    nextQuery.set('tab', mainTab);
    nextQuery.set('scope', activeTestament);
    nextQuery.set('lang', effectiveLanguageCode);
    nextQuery.set('ver', effectiveVersionCode);

    const current = searchParams.toString();
    const next = nextQuery.toString();
    if (current === next) return;

    router.replace(`/bible?${next}`);
  }, [
    mainTab,
    activeTestament,
    effectiveLanguageCode,
    effectiveVersionCode,
    router,
    searchParams,
  ]);

  const booksByLanguage = useMemo(() => {
    return books.filter(
      (book) => normalizeScopeLanguageCode(book.language_code) === effectiveLanguageCode
    );
  }, [books, effectiveLanguageCode]);

  const scopedBooks = useMemo(() => {
    const candidates = versionCandidatesByLanguage(
      effectiveLanguageCode,
      effectiveVersionCode
    );

    for (const candidate of candidates) {
      const byVersion = booksByLanguage.filter(
        (book) => normalizeVersionCode(book.version_code) === candidate
      );
      if (byVersion.length > 0) {
        return byVersion;
      }
    }

    return [] as BibleBook[];
  }, [booksByLanguage, effectiveLanguageCode, effectiveVersionCode]);

  const testamentCounts = useMemo(() => {
    return TESTAMENT_CONFIG.reduce<Record<BibleBook['testament'], number>>(
      (acc, config) => {
        acc[config.key] = scopedBooks.filter((book) => book.testament === config.key).length;
        return acc;
      },
      { old: 0, new: 0, deutero: 0 }
    );
  }, [scopedBooks]);

  const normalizedBookQuery = useMemo(() => keyword.trim(), [keyword]);
  const inlineReferenceResult = useMemo(
    () => parseReference(normalizedBookQuery, scopedBooks),
    [normalizedBookQuery, scopedBooks]
  );
  const shouldRunInlineVerseTextSearch =
    mainTab === 'baca' && normalizedBookQuery.length >= 3 && !inlineReferenceResult;

  const filteredBooks = useMemo(() => {
    const query = normalizedBookQuery.toLowerCase();
    return scopedBooks
      .filter((book) => book.testament === activeTestament)
      .filter((book) => {
        if (canonFilter === 'deutero') return book.testament === 'deutero';
        if (canonFilter === 'proto') return book.testament !== 'deutero';
        return true;
      })
      .filter((book) => {
        if (shouldRunInlineVerseTextSearch) return true;
        if (!query) return true;
        return (
          book.name.toLowerCase().includes(query) ||
          book.abbreviation.toLowerCase().includes(query)
        );
      });
  }, [
    scopedBooks,
    activeTestament,
    canonFilter,
    normalizedBookQuery,
    shouldRunInlineVerseTextSearch,
  ]);

  const { data: selectorChapters = [], isLoading: isLoadingSelectorChapters } = useBibleChapters(
    selectorBook?.id
  );

  const availableSelectorChapters = useMemo(() => {
    if (!selectorBook) return [];
    return buildContiguousChapterList(selectorChapters, selectorBook);
  }, [selectorBook, selectorChapters]);

  const { data: selectorVerses = [], isLoading: isLoadingSelectorVerses } = useBibleVerses(
    selectorBook?.id,
    selectorChapter ?? undefined
  );

  const selectorVerseNumbers = useMemo(() => {
    return uniqueSortedNumbers(selectorVerses.map((verse) => verse.verse_number));
  }, [selectorVerses]);

  const scopedBookmarks = useMemo(() => {
    return personalStore.bookmarks.filter((entry) =>
      isSameScopeAnnotation(entry, effectiveLanguageCode, effectiveVersionCode)
    );
  }, [personalStore.bookmarks, effectiveLanguageCode, effectiveVersionCode]);

  const scopedHighlights = useMemo(() => {
    return personalStore.highlights.filter((entry) =>
      isSameScopeAnnotation(entry, effectiveLanguageCode, effectiveVersionCode)
    );
  }, [personalStore.highlights, effectiveLanguageCode, effectiveVersionCode]);

  const scopedNotes = useMemo(() => {
    return personalStore.notes.filter((entry) =>
      isSameScopeAnnotation(entry, effectiveLanguageCode, effectiveVersionCode)
    );
  }, [personalStore.notes, effectiveLanguageCode, effectiveVersionCode]);

  const combinedCatatan = useMemo(() => {
    const items = [
      ...scopedBookmarks.map(mapBookmarkToItem),
      ...scopedHighlights.map(mapHighlightToItem),
      ...scopedNotes.map(mapNoteToItem),
    ];
    return items.sort((a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime());
  }, [scopedBookmarks, scopedHighlights, scopedNotes]);

  const todayKey = getBibleLocalDateKey();
  const normalizedSearchInput = useMemo(() => referenceInput.trim(), [referenceInput]);
  const parsedSearchReference = useMemo(
    () => parseReference(normalizedSearchInput, scopedBooks),
    [normalizedSearchInput, scopedBooks]
  );
  const shouldRunVerseTextSearch =
    mainTab === 'cari' && normalizedSearchInput.length >= 3 && !parsedSearchReference;
  const themeResults = useMemo(() => {
    if (!activeTheme) return [];
    const theme = BIBLE_THEMES.find((entry) => entry.id === activeTheme);
    if (!theme) return [];
    return theme.references
      .map((reference) => parseReference(reference, scopedBooks))
      .filter((entry): entry is ReferenceMatch => Boolean(entry));
  }, [activeTheme, scopedBooks]);
  const {
    data: verseSearchResults = [],
    isLoading: isLoadingVerseSearch,
    isFetching: isFetchingVerseSearch,
  } = useBibleVerseSearch({
    query: normalizedSearchInput,
    languageCode: effectiveLanguageCode,
    versionCode: effectiveVersionCode,
    limit: verseSearchLimit,
    enabled: shouldRunVerseTextSearch,
  });
  const canLoadMoreVerseResults =
    shouldRunVerseTextSearch && verseSearchResults.length >= verseSearchLimit && verseSearchLimit < 120;
  const {
    data: inlineVerseSearchResults = [],
    isLoading: isLoadingInlineVerseSearch,
  } = useBibleVerseSearch({
    query: normalizedBookQuery,
    languageCode: effectiveLanguageCode,
    versionCode: effectiveVersionCode,
    limit: 30,
    enabled: shouldRunInlineVerseTextSearch,
  });
  const inlineVersePreviewResults = useMemo(
    () => inlineVerseSearchResults.slice(0, INLINE_VERSE_SEARCH_PREVIEW_COUNT),
    [inlineVerseSearchResults]
  );

  function openBookSelector(book: BibleBook) {
    setSelectorBook(book);
    setSelectorChapter(null);
    setSelectorOpen(true);
  }

  function closeBookSelector(open: boolean) {
    setSelectorOpen(open);
    if (!open) {
      setSelectorChapter(null);
    }
  }

  function pushReader(match: ReferenceMatch) {
    const query = new URLSearchParams();
    query.set('lang', effectiveLanguageCode);
    query.set('ver', effectiveVersionCode);
    query.set('scope', match.book.testament);
    if (match.verseStart && match.verseStart > 0) {
      query.set('verse', match.verseStart.toString());
    }

    const chapter = toValidChapter(match.book, match.chapter);
    router.push(`/bible/${encodeURIComponent(match.book.id)}/${chapter}?${query.toString()}`);
  }

  function goToReader(chapter: number, verse?: number) {
    if (!selectorBook) return;
    pushReader({
      book: selectorBook,
      chapter,
      verseStart: verse,
    });
    setSelectorOpen(false);
    setSelectorChapter(null);
  }

  function runReferenceSearch(rawInput: string): ReferenceMatch | null {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      setReferenceError(null);
      return null;
    }

    const parsed = parseReference(trimmed, scopedBooks);
    if (!parsed) {
      const likelyReference = /\d/.test(trimmed) || trimmed.includes(':');
      if (likelyReference) {
        setReferenceError(
          'Format referensi belum dikenali. Contoh: Yoh 3:16, Tob 12:8, atau 1Kor 13:4-7.'
        );
      } else {
        setReferenceError(null);
      }
      return null;
    }

    setReferenceError(null);
    return parsed;
  }

  function applyTheme(themeId: string) {
    setActiveTheme(themeId);
  }

  function markPlanDone(planId: string) {
    const nextStore = markBiblePlanDayCompleted(planId);
    setPersonalStore(nextStore);
    const progress = nextStore.plan_progress[planId];
    if (user?.id && progress) {
      void upsertBiblePlanProgressToCloud(user.id, planId, progress);
    }
    toast.success('Hari ini berhasil ditandai selesai');
  }

  function openCatatanItem(item: CatatanItem) {
    const book =
      scopedBooks.find((entry) => entry.id === item.bookId) ||
      booksByLanguage.find((entry) => entry.id === item.bookId) ||
      books.find((entry) => entry.id === item.bookId);
    if (!book) {
      toast.error('Kitab untuk catatan ini tidak ditemukan di versi aktif');
      return;
    }

    pushReader({
      book,
      chapter: item.chapter,
      verseStart: item.verseStart,
      verseEnd: item.verseEnd,
    });
  }

  function openVerseSearchResult(payload: {
    book_id: string;
    chapter: number;
    verse_number: number;
  }) {
    const book =
      scopedBooks.find((entry) => entry.id === payload.book_id) ||
      booksByLanguage.find((entry) => entry.id === payload.book_id) ||
      books.find((entry) => entry.id === payload.book_id);
    if (!book) {
      toast.error('Kitab untuk hasil pencarian ini tidak ditemukan di versi aktif');
      return;
    }

    pushReader({
      book,
      chapter: payload.chapter,
      verseStart: payload.verse_number,
    });
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-sky-100/80 via-card to-cyan-100/50 p-4 shadow-sm sm:p-6 dark:from-sky-950/30 dark:to-cyan-950/20">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-10 h-44 w-44 rounded-full bg-cyan-400/15 blur-3xl" />

        <div className="relative space-y-5">
          <div className="space-y-2">
            <Badge className="bg-primary/90 px-3 py-1 text-primary-foreground">
              Alkitab Katolik (73 Kitab)
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Menu Alkitab</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Ruang rohani untuk membaca, merencanakan, mencari, merenungkan, dan mengingat kembali
              firman Tuhan secara praktis.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari kitab atau singkatan..."
                className="h-11 rounded-2xl border-border/60 bg-background/90 pl-9"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </div>

            <div className="flex w-full items-center gap-2 overflow-x-auto rounded-2xl border border-border/60 bg-background/80 p-1 sm:w-auto">
              <Languages className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
              {LANGUAGE_OPTIONS.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  onClick={() => {
                    setLanguageCode(language.code);
                    setVersionCode((current) =>
                      normalizeRequestedVersionByLanguage(language.code, current)
                    );
                  }}
                  className={cn(
                    'shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition',
                    effectiveLanguageCode === language.code
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  {language.label}
                </button>
              ))}
            </div>

            <div className="flex w-full items-center gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-background/80 p-1 sm:w-auto">
              {versionOptions.map((version) => (
                <button
                  key={version}
                  type="button"
                  onClick={() => setVersionCode(version)}
                  className={cn(
                    'shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition',
                    effectiveVersionCode === version
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  {version}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MAIN_TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setMainTab(tab.key)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition',
                    mainTab === tab.key
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border/70 bg-background hover:bg-muted/50'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {mainTab === 'baca' && (
        <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="gap-4 border-b border-border/50 bg-muted/20">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Daftar Kitab</CardTitle>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px]">
                {filteredBooks.length} kitab
              </Badge>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {TESTAMENT_CONFIG.map((testament) => (
                <button
                  key={testament.key}
                  type="button"
                  onClick={() => {
                    setActiveTestament(testament.key);
                    if (testament.key !== 'deutero' && canonFilter === 'deutero') {
                      setCanonFilter('all');
                    }
                    if (testament.key === 'deutero' && canonFilter === 'proto') {
                      setCanonFilter('all');
                    }
                  }}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left transition',
                    activeTestament === testament.key
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border/70 bg-background hover:bg-muted/50'
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide">{testament.shortLabel}</p>
                  <p className="mt-1 text-sm font-medium">{testament.fullLabel}</p>
                  <p
                    className={cn(
                      'mt-1 text-xs',
                      activeTestament === testament.key
                        ? 'text-primary-foreground/85'
                        : 'text-muted-foreground'
                    )}
                  >
                    {testamentCounts[testament.key]} kitab
                  </p>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {CANON_FILTER_CONFIG.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => {
                    setCanonFilter(filter.key);
                    if (filter.key === 'deutero') {
                      setActiveTestament('deutero');
                      return;
                    }
                    if (filter.key === 'proto' && activeTestament === 'deutero') {
                      setActiveTestament('old');
                    }
                  }}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                    canonFilter === filter.key
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border/70 bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="space-y-4 p-4 sm:p-5">
            {inlineReferenceResult ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Referensi Terdeteksi
                  </p>
                  <p className="text-sm font-semibold">{referenceLabel(inlineReferenceResult)}</p>
                </div>
                <Button size="sm" onClick={() => pushReader(inlineReferenceResult)}>
                  Buka
                </Button>
              </div>
            ) : null}

            {shouldRunInlineVerseTextSearch ? (
              <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/15 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Hasil Ayat
                  </p>
                  <Badge variant="outline" className="rounded-full">
                    {isLoadingInlineVerseSearch ? 'Memuat...' : `${inlineVerseSearchResults.length} hasil`}
                  </Badge>
                </div>

                {isLoadingInlineVerseSearch ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                    Mencari ayat...
                  </div>
                ) : inlineVersePreviewResults.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">
                    Tidak ada ayat yang cocok untuk kata kunci ini.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {inlineVersePreviewResults.map((hit) => {
                      const hitBook =
                        scopedBooks.find((book) => book.id === hit.book_id) ||
                        booksByLanguage.find((book) => book.id === hit.book_id) ||
                        books.find((book) => book.id === hit.book_id);
                      const reference = hitBook
                        ? `${hitBook.name} ${hit.chapter}:${hit.verse_number}`
                        : `${hit.chapter}:${hit.verse_number}`;

                      return (
                        <button
                          key={`inline-${hit.book_id}:${hit.chapter}:${hit.verse_number}`}
                          type="button"
                          onClick={() => openVerseSearchResult(hit)}
                          className="w-full rounded-xl border border-border/70 bg-background px-3 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                        >
                          <p className="text-sm font-semibold">{reference}</p>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {renderHighlightedExcerpt(
                              buildVerseSearchExcerpt(hit.text, normalizedBookQuery),
                              normalizedBookQuery
                            )}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {(inlineVerseSearchResults.length > INLINE_VERSE_SEARCH_PREVIEW_COUNT ||
                  inlineVerseSearchResults.length > 0) && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setMainTab('cari');
                      setReferenceInput(normalizedBookQuery);
                      setVerseSearchLimit(30);
                      runReferenceSearch(normalizedBookQuery);
                    }}
                  >
                    Lihat lebih banyak hasil
                  </Button>
                )}
              </div>
            ) : null}

            {isLoadingBooks ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                Memuat daftar kitab...
              </div>
            ) : filteredBooks.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <BookText className="mx-auto mb-3 h-9 w-9" />
                Tidak ada kitab yang cocok dengan filter saat ini.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {filteredBooks.map((book) => (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => openBookSelector(book)}
                    className="group rounded-2xl border border-border/70 bg-gradient-to-br from-background to-sky-50/40 p-4 text-left transition hover:border-primary/40 hover:shadow-sm dark:to-sky-950/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold">{book.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {book.abbreviation || 'Tanpa singkatan'}
                          {book.total_chapters > 0
                            ? ` • ${book.total_chapters} bab`
                            : ' • Bab belum terstruktur'}
                        </p>
                        {book.testament === 'deutero' ? (
                          <Badge className="mt-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] text-white">
                            Deuterokanonika
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="mt-2 rounded-full px-2 py-0.5 text-[10px]">
                            Protokanonika
                          </Badge>
                        )}
                      </div>
                      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 px-2 text-xs font-semibold text-primary">
                        {book.abbreviation || 'BK'}
                      </span>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      Pilih bab dan ayat
                      <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mainTab === 'rencana' && (
        <div className="grid gap-4 lg:grid-cols-2">
          {BIBLE_READING_PLANS.map((plan) => {
            const progress = personalStore.plan_progress[plan.id];
            const completedCount = progress?.completed_dates.length || 0;
            const doneToday = Boolean(progress?.completed_dates.includes(todayKey));
            const startMatch = parseReference(plan.startReference, scopedBooks);

            return (
              <Card key={plan.id} className="border-border/70 bg-card/95 shadow-sm">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{plan.title}</CardTitle>
                    <Badge variant="outline">{plan.durationDays} hari</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Prompt Renungan
                    </p>
                    <p className="mt-1 text-sm">{plan.prompt}</p>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold">
                      {completedCount}/{plan.durationDays}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="default"
                      className="gap-2"
                      onClick={() => {
                        if (!startMatch) {
                          toast.error('Referensi awal rencana belum tersedia di versi aktif.');
                          return;
                        }
                        pushReader(startMatch);
                      }}
                    >
                      <Sparkles className="h-4 w-4" />
                      Baca sekarang
                    </Button>
                    <Button
                      type="button"
                      variant={doneToday ? 'secondary' : 'outline'}
                      className="gap-2"
                      onClick={() => markPlanDone(plan.id)}
                      disabled={doneToday}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {doneToday ? 'Selesai hari ini' : 'Tandai selesai'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {mainTab === 'cari' && (
        <div className="space-y-4">
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="text-base">Cari Referensi atau Kata Kunci</CardTitle>
              <p className="text-sm text-muted-foreground">
                Anda bisa mencari langsung lewat referensi ayat atau kata kunci isi ayat.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Contoh: Yoh 3:16 atau kata kunci seperti pengharapan"
                  value={referenceInput}
                  onChange={(event) => {
                    const value = event.target.value;
                    setReferenceInput(value);
                    setVerseSearchLimit(30);
                    runReferenceSearch(value);
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    const parsed = runReferenceSearch(referenceInput);
                    if (parsed) {
                      pushReader(parsed);
                    }
                  }}
                >
                  Buka
                </Button>
              </div>

              {referenceError ? (
                <p className="text-sm text-destructive">{referenceError}</p>
              ) : parsedSearchReference ? (
                <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
                  <p className="text-sm">{referenceLabel(parsedSearchReference)}</p>
                  <Button size="sm" variant="outline" onClick={() => pushReader(parsedSearchReference)}>
                    Buka ayat
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ketik referensi untuk membuka ayat, atau lanjutkan mengetik untuk pencarian teks.
                </p>
              )}

              {shouldRunVerseTextSearch ? (
                <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/15 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Hasil Pencarian Teks
                    </p>
                    <Badge variant="outline" className="rounded-full">
                      {isLoadingVerseSearch ? 'Memuat...' : `${verseSearchResults.length} hasil`}
                    </Badge>
                  </div>

                  {isLoadingVerseSearch ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                      Mencari ayat...
                    </div>
                  ) : verseSearchResults.length === 0 ? (
                    <p className="py-3 text-sm text-muted-foreground">
                      Tidak ada ayat yang cocok pada versi aktif.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {verseSearchResults.map((hit) => {
                        const hitBook =
                          scopedBooks.find((book) => book.id === hit.book_id) ||
                          books.find((book) => book.id === hit.book_id);
                        const reference = hitBook
                          ? `${hitBook.name} ${hit.chapter}:${hit.verse_number}`
                          : `${hit.chapter}:${hit.verse_number}`;

                        return (
                          <button
                            key={`${hit.book_id}:${hit.chapter}:${hit.verse_number}`}
                            type="button"
                            onClick={() => openVerseSearchResult(hit)}
                            className="w-full rounded-xl border border-border/70 bg-background px-3 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                          >
                            <p className="text-sm font-semibold">{reference}</p>
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {renderHighlightedExcerpt(
                                buildVerseSearchExcerpt(hit.text, normalizedSearchInput),
                                normalizedSearchInput
                              )}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {canLoadMoreVerseResults ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setVerseSearchLimit((current) => Math.min(current + 20, 120))}
                      disabled={isFetchingVerseSearch}
                    >
                      {isFetchingVerseSearch ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Memuat...
                        </>
                      ) : (
                        'Muat lebih banyak'
                      )}
                    </Button>
                  ) : null}
                </div>
              ) : normalizedSearchInput.length > 0 && normalizedSearchInput.length < 3 ? (
                <p className="text-xs text-muted-foreground">
                  Masukkan minimal 3 huruf untuk pencarian isi ayat.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Cari Berdasarkan Tema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {BIBLE_THEMES.map((theme) => (
                  <Button
                    key={theme.id}
                    type="button"
                    size="sm"
                    variant={activeTheme === theme.id ? 'default' : 'outline'}
                    className="gap-1.5"
                    onClick={() => applyTheme(theme.id)}
                  >
                    <WandSparkles className="h-3.5 w-3.5" />
                    {theme.label}
                  </Button>
                ))}
              </div>

              {activeTheme ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {BIBLE_THEMES.find((theme) => theme.id === activeTheme)?.description}
                  </p>
                  {themeResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Belum ada referensi tema yang cocok di versi aktif.
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {themeResults.map((result) => (
                        <button
                          key={`${result.book.id}:${result.chapter}:${result.verseStart || 0}`}
                          type="button"
                          onClick={() => pushReader(result)}
                          className="rounded-xl border border-border/70 bg-background px-3 py-2 text-left text-sm transition hover:border-primary/40 hover:bg-primary/5"
                        >
                          {referenceLabel(result)}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Pilih tema untuk menampilkan ayat terkurasi.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {mainTab === 'catatan' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-border/70 bg-card/95">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Bookmark</p>
                  <p className="text-2xl font-semibold">{scopedBookmarks.length}</p>
                </div>
                <BookMarked className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/95">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Highlight</p>
                  <p className="text-2xl font-semibold">{scopedHighlights.length}</p>
                </div>
                <Sparkles className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/95">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Catatan</p>
                  <p className="text-2xl font-semibold">{scopedNotes.length}</p>
                </div>
                <NotebookPen className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Arsip Perjalanan Iman</CardTitle>
            </CardHeader>
            <CardContent>
              {combinedCatatan.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Belum ada bookmark, highlight, atau catatan renungan.
                </div>
              ) : (
                <div className="space-y-3">
                  {combinedCatatan.map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="rounded-xl border border-border/70 bg-background px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={item.type === 'note' ? 'default' : 'outline'}
                            className="rounded-full text-[10px]"
                          >
                            {item.type === 'bookmark'
                              ? 'Bookmark'
                              : item.type === 'highlight'
                                ? 'Highlight'
                                : 'Catatan'}
                          </Badge>
                          <p className="text-sm font-semibold">{item.referenceLabel}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => openCatatanItem(item)}>
                          Buka ayat
                        </Button>
                      </div>

                      {item.note ? (
                        <p className="mt-2 text-sm text-muted-foreground">{item.note}</p>
                      ) : (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.excerpt}</p>
                      )}

                      {item.type === 'highlight' && item.color ? (
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: item.color }} />
                          Warna sorotan
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={selectorOpen} onOpenChange={closeBookSelector}>
        <DialogContent className="max-h-[88dvh] w-[calc(100vw-1rem)] max-w-[760px] overflow-hidden border-border/70 bg-card p-0">
          <DialogHeader className="border-b border-border/70 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="text-xl">{selectorBook?.name || 'Pilih Kitab'}</DialogTitle>
                <DialogDescription>
                  {selectorChapter === null
                    ? 'Langkah 1 dari 2: pilih bab terlebih dahulu'
                    : `Langkah 2 dari 2: pilih ayat dari Bab ${selectorChapter}`}
                </DialogDescription>
              </div>
              {selectorChapter !== null && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setSelectorChapter(null)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Kembali
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {selectorChapter === null ? (
              isLoadingSelectorChapters ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  Memuat daftar bab...
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 md:grid-cols-8">
                  {availableSelectorChapters.map((chapter) => (
                    <button
                      key={chapter}
                      type="button"
                      onClick={() => setSelectorChapter(chapter)}
                      className="h-10 rounded-lg border border-border/70 bg-background text-sm font-semibold transition hover:border-primary/40 hover:bg-primary/5"
                    >
                      {chapter}
                    </button>
                  ))}
                </div>
              )
            ) : isLoadingSelectorVerses ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                Memuat daftar ayat...
              </div>
            ) : selectorVerseNumbers.length === 0 ? (
              <div className="space-y-4 py-8 text-center">
                <BookOpen className="mx-auto h-9 w-9 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Belum ada ayat terstruktur untuk bab ini. Anda tetap bisa membuka reader bab.
                </p>
                <Button onClick={() => goToReader(selectorChapter)}>Buka Bab {selectorChapter}</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/25 px-4 py-3">
                  <p className="text-sm font-medium">
                    Pilih ayat untuk mulai membaca dari titik tertentu
                  </p>
                  <Button variant="outline" size="sm" onClick={() => goToReader(selectorChapter)}>
                    Buka dari awal bab
                  </Button>
                </div>

                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 md:grid-cols-8">
                  {selectorVerseNumbers.map((verse) => (
                    <button
                      key={verse}
                      type="button"
                      onClick={() => goToReader(selectorChapter, verse)}
                      className="h-10 rounded-lg border border-border/70 bg-background text-sm font-semibold transition hover:border-primary/40 hover:bg-primary/5"
                    >
                      {verse}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
