'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Bookmark,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Copy,
  Highlighter,
  Loader2,
  NotebookPen,
  Share2,
  Type,
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
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { useBibleBooks, useBibleChapters, useBibleVerses } from '@/lib/features/bible/use-bible';
import { useAuth } from '@/lib/features/auth/use-auth';
import {
  loadBiblePersonalStoreFromCloud,
  removeBibleBookmarkFromCloud,
  removeBibleHighlightFromCloud,
  removeBibleNoteFromCloud,
  syncBiblePersonalStoreToCloud,
  upsertBibleBookmarkToCloud,
  upsertBibleHighlightToCloud,
  upsertBibleNoteToCloud,
} from '@/lib/features/bible/personalization-cloud';
import {
  buildBiblePersonalEntryId,
  createEmptyBiblePersonalStore,
  getBiblePersonalStoreOwnerId,
  loadBiblePersonalStore,
  mergeBiblePersonalStore,
  removeBibleBookmark,
  removeBibleHighlight,
  removeBibleNote,
  resolveBibleAnnotationScope,
  saveBiblePersonalStore,
  setBiblePersonalStoreOwnerId,
  upsertBibleBookmark,
  upsertBibleHighlight,
  upsertBibleNote,
  type BiblePersonalStore,
} from '@/lib/features/bible/personalization';
import type { BibleBook, BibleVerse } from '@/lib/types';
import { cn } from '@/lib/utils';

const HIGHLIGHT_COLORS = ['#FDE68A', '#BFDBFE', '#A7F3D0', '#FBCFE8', '#DDD6FE'] as const;

function fallbackChapterList(book?: BibleBook | null) {
  const total = Number(book?.total_chapters ?? 0);
  if (!Number.isFinite(total) || total <= 0) return [1];
  return Array.from({ length: total }, (_, index) => index + 1);
}

function uniqueSortedNumbers(values: number[]) {
  return [...new Set(values.filter((value) => Number.isFinite(value) && value > 0))].sort(
    (a, b) => a - b
  );
}

function buildContiguousChapterList(chapters: number[], book?: BibleBook | null) {
  const normalized = uniqueSortedNumbers(chapters);
  const fallback = fallbackChapterList(book);
  const fallbackMax = fallback[fallback.length - 1] || 1;
  const detectedMax = normalized[normalized.length - 1] || 0;
  const upperBound = Math.max(fallbackMax, detectedMax, 1);
  return Array.from({ length: upperBound }, (_, index) => index + 1);
}

function parsePositiveInt(value: string | null | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function buildReaderHref(bookId: string, chapter: number, queryString: string) {
  const encodedId = encodeURIComponent(bookId);
  return `/bible/${encodedId}/${chapter}${queryString ? `?${queryString}` : ''}`;
}

function testamentLabel(testament: BibleBook['testament']) {
  if (testament === 'new') return 'Perjanjian Baru';
  if (testament === 'deutero') return 'Deuterokanonika';
  return 'Perjanjian Lama';
}

function verseInRange(verseNumber: number, start: number, end: number) {
  return verseNumber >= start && verseNumber <= end;
}

function normalizePericopeTitle(value: string | undefined) {
  return value?.trim() || '';
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.trim().replace('#', '');
  const safeAlpha = Math.min(1, Math.max(0, alpha));

  if (/^[0-9a-fA-F]{3}$/.test(normalized)) {
    const r = Number.parseInt(`${normalized[0]}${normalized[0]}`, 16);
    const g = Number.parseInt(`${normalized[1]}${normalized[1]}`, 16);
    const b = Number.parseInt(`${normalized[2]}${normalized[2]}`, 16);
    return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
  }

  if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
  }

  return null;
}

function buildVerseHighlightStyle(highlightColor?: string): CSSProperties | undefined {
  const color = highlightColor?.trim();
  if (!color) return undefined;

  const tintedBackground = hexToRgba(color, 0.33);
  if (!tintedBackground) {
    return {
      boxShadow: `inset 4px 0 0 ${color}`,
    };
  }

  return {
    backgroundColor: tintedBackground,
    borderColor: color,
    boxShadow: `inset 4px 0 0 ${color}`,
  };
}

function normalizeScopeLanguageCode(value: string | null | undefined): 'id' | 'en' {
  return value?.trim().toLowerCase() === 'en' ? 'en' : 'id';
}

function normalizeRequestedVersionByLanguage(
  languageCode: 'id' | 'en',
  requestedVersion: string | null | undefined
) {
  const normalized = requestedVersion?.trim().toUpperCase() || '';
  if (languageCode === 'id') {
    if (normalized === 'TB2') return 'TB2';
    return 'TB1';
  }
  return 'EN1';
}

function normalizeVersionCode(value: string | null | undefined) {
  return value?.trim().toUpperCase() || '';
}

function versionCandidatesByLanguage(languageCode: 'id' | 'en', versionCode: string) {
  if (languageCode === 'id') {
    if (versionCode === 'TB2') return ['TB2'];
    return ['TB1', 'TB'];
  }
  return ['EN1'];
}

function isSameScopeAnnotation(
  entry: { language_code?: string; version_code?: string },
  languageCode: 'id' | 'en',
  versionCode: string
) {
  const scope = resolveBibleAnnotationScope(entry);
  return scope.language_code === languageCode && scope.version_code === versionCode;
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    const nextWidth = ctx.measureText(nextLine).width;
    if (nextWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      continue;
    }
    currentLine = nextLine;
  }

  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

function getBrowserNavigator() {
  if (typeof window === 'undefined') return null;
  return window.navigator;
}

async function createVerseImageBlob(reference: string, text: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1440;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context tidak tersedia');
  }

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#0f172a');
  gradient.addColorStop(0.5, '#1e3a8a');
  gradient.addColorStop(1, '#0369a1');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.arc(160, 200, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(920, 1260, 160, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#E2E8F0';
  ctx.font = '600 42px Georgia, Times New Roman, serif';
  ctx.fillText('MyCatholic Bible', 84, 120);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 52px Georgia, Times New Roman, serif';
  const quoteLines = wrapCanvasText(ctx, text, 860).slice(0, 18);

  let y = 280;
  for (const line of quoteLines) {
    ctx.fillText(line, 110, y);
    y += 72;
  }

  ctx.fillStyle = '#BAE6FD';
  ctx.font = '600 38px "Segoe UI", Arial, sans-serif';
  const referenceLines = wrapCanvasText(ctx, reference, 860).slice(0, 2);
  let refY = Math.max(y + 36, 1220);
  for (const line of referenceLines) {
    ctx.fillText(line, 110, refY);
    refY += 50;
  }

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '500 28px "Segoe UI", Arial, sans-serif';
  ctx.fillText('Firman Tuhan untuk dibaca, direnungkan, dan dibagikan.', 110, 1370);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((result) => resolve(result), 'image/png')
  );

  if (!blob) {
    throw new Error('Gagal membuat gambar ayat');
  }
  return blob;
}

export default function BibleReaderPage() {
  const params = useParams<{ bookId: string; chapter: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const rawBookId = Array.isArray(params.bookId) ? params.bookId[0] : params.bookId;
  const rawChapter = Array.isArray(params.chapter) ? params.chapter[0] : params.chapter;

  const bookId = decodeURIComponent(rawBookId || '');
  const requestedChapter = parsePositiveInt(rawChapter, 1);
  const highlightedVerse = parsePositiveInt(searchParams.get('verse'), 0);
  const requestedLanguage = normalizeScopeLanguageCode(searchParams.get('lang'));
  const requestedVersion = normalizeRequestedVersionByLanguage(
    requestedLanguage,
    searchParams.get('ver')
  );

  const [fontSizeRange, setFontSizeRange] = useState([18]);
  const [lineHeightRange, setLineHeightRange] = useState([1.9]);
  const [personalStore, setPersonalStore] = useState<BiblePersonalStore>(() =>
    loadBiblePersonalStore()
  );

  const [actionVerse, setActionVerse] = useState<BibleVerse | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedVerseNumbers, setSelectedVerseNumbers] = useState<number[]>([]);
  const [noteTarget, setNoteTarget] = useState<{
    verseStart: number;
    verseEnd: number;
    referenceLabel: string;
    excerpt: string;
  } | null>(null);

  const fontSize = fontSizeRange[0] ?? 18;
  const lineHeight = lineHeightRange[0] ?? 1.9;

  const { data: books = [], isLoading: isLoadingBooks } = useBibleBooks();
  const selectedBook = useMemo(() => {
    const byId = books.filter((book) => book.id === bookId);
    if (byId.length === 0) return null;

    const byLanguage = byId.filter(
      (book) => normalizeScopeLanguageCode(book.language_code) === requestedLanguage
    );
    const candidates = versionCandidatesByLanguage(requestedLanguage, requestedVersion);
    for (const candidate of candidates) {
      const matched = byLanguage.find(
        (book) => normalizeVersionCode(book.version_code) === candidate
      );
      if (matched) return matched;
    }

    if (byLanguage.length > 0) return byLanguage[0];
    return byId[0];
  }, [books, bookId, requestedLanguage, requestedVersion]);

  const { data: chapters = [], isLoading: isLoadingChapters } = useBibleChapters(selectedBook?.id);
  const availableChapters = useMemo(() => {
    if (!selectedBook) return [];
    return buildContiguousChapterList(chapters, selectedBook);
  }, [selectedBook, chapters]);

  const currentChapter = useMemo(() => {
    if (availableChapters.length === 0) return requestedChapter;
    if (availableChapters.includes(requestedChapter)) return requestedChapter;
    const nearest = availableChapters.find((chapter) => chapter >= requestedChapter);
    return nearest ?? availableChapters[availableChapters.length - 1];
  }, [availableChapters, requestedChapter]);

  const { data: verses = [], isLoading: isLoadingVerses } = useBibleVerses(
    selectedBook?.id,
    currentChapter
  );

  const versesWithPericopeTitle = useMemo(() => {
    return verses.reduce<{
      items: Array<{ verse: BibleVerse; pericopeTitle: string }>;
      lastPericope: string;
    }>(
      (acc, verse) => {
        const pericopeTitle = normalizePericopeTitle(verse.pericope);
        const showPericopeTitle = pericopeTitle.length > 0 && pericopeTitle !== acc.lastPericope;
        return {
          items: [
            ...acc.items,
            {
              verse,
              pericopeTitle: showPericopeTitle ? pericopeTitle : '',
            },
          ],
          lastPericope: pericopeTitle.length > 0 ? pericopeTitle : acc.lastPericope,
        };
      },
      { items: [], lastPericope: '' }
    ).items;
  }, [verses]);

  const baseQueryString = useMemo(() => {
    const nextQuery = new URLSearchParams(searchParams.toString());
    nextQuery.delete('verse');
    return nextQuery.toString();
  }, [searchParams]);

  const backHref = useMemo(() => {
    const backQuery = new URLSearchParams();
    const lang = searchParams.get('lang');
    const ver = searchParams.get('ver');
    const scope = searchParams.get('scope');

    if (lang) backQuery.set('lang', lang);
    if (ver) backQuery.set('ver', ver);
    if (scope) backQuery.set('scope', scope);
    backQuery.set('tab', 'baca');

    const query = backQuery.toString();
    return `/bible${query ? `?${query}` : ''}`;
  }, [searchParams]);

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

  useEffect(() => {
    if (!selectedBook) return;
    if (requestedChapter === currentChapter) return;
    router.replace(buildReaderHref(selectedBook.id, currentChapter, searchParams.toString()));
  }, [selectedBook, requestedChapter, currentChapter, router, searchParams]);

  useEffect(() => {
    if (!highlightedVerse || isLoadingVerses) return;
    const target = document.getElementById(`verse-${highlightedVerse}`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedVerse, isLoadingVerses, currentChapter]);

  const chapterIndex = availableChapters.indexOf(currentChapter);
  const canGoPrevious = chapterIndex > 0;
  const canGoNext = chapterIndex >= 0 && chapterIndex < availableChapters.length - 1;

  const chapterBookmarks = useMemo(() => {
    return personalStore.bookmarks.filter(
      (entry) =>
        entry.book_id === bookId &&
        entry.chapter === currentChapter &&
        isSameScopeAnnotation(entry, requestedLanguage, requestedVersion)
    );
  }, [personalStore, bookId, currentChapter, requestedLanguage, requestedVersion]);

  const chapterHighlights = useMemo(() => {
    return personalStore.highlights.filter(
      (entry) =>
        entry.book_id === bookId &&
        entry.chapter === currentChapter &&
        isSameScopeAnnotation(entry, requestedLanguage, requestedVersion)
    );
  }, [personalStore, bookId, currentChapter, requestedLanguage, requestedVersion]);

  const chapterNotes = useMemo(() => {
    return personalStore.notes.filter(
      (entry) =>
        entry.book_id === bookId &&
        entry.chapter === currentChapter &&
        isSameScopeAnnotation(entry, requestedLanguage, requestedVersion)
    );
  }, [personalStore, bookId, currentChapter, requestedLanguage, requestedVersion]);

  const selectedVerseRange = useMemo(() => {
    if (!selectedBook || selectedVerseNumbers.length === 0) return null;

    const sorted = [...selectedVerseNumbers].sort((a, b) => a - b);
    const start = sorted[0];
    const end = sorted[sorted.length - 1];

    const selectedVerses = verses.filter(
      (verse) => verse.verse_number > 0 && verseInRange(verse.verse_number, start, end)
    );
    const excerpt = selectedVerses
      .map((verse) => `${verse.verse_number}. ${verse.text}`)
      .join(' ')
      .trim();

    return {
      start,
      end,
      referenceLabel:
        start === end
          ? `${selectedBook.name} ${currentChapter}:${start}`
          : `${selectedBook.name} ${currentChapter}:${start}-${end}`,
      excerpt: excerpt.length > 380 ? `${excerpt.slice(0, 377)}...` : excerpt,
    };
  }, [selectedBook, selectedVerseNumbers, verses, currentChapter]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMultiSelectMode(false);
      setSelectedVerseNumbers([]);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [bookId, currentChapter]);

  function buildVerseReference(verseNumber: number) {
    if (!selectedBook) return `Ayat ${verseNumber}`;
    return `${selectedBook.name} ${currentChapter}:${verseNumber}`;
  }

  function findVerseHighlightColor(verseNumber: number) {
    const highlight = chapterHighlights.find((entry) => verseInRange(verseNumber, entry.verse_start, entry.verse_end));
    return highlight?.color;
  }

  function findChapterBookmarkEntry(verseNumber: number) {
    return chapterBookmarks.find((entry) => verseInRange(verseNumber, entry.verse_start, entry.verse_end));
  }

  function findChapterHighlightEntry(verseNumber: number) {
    return chapterHighlights.find((entry) => verseInRange(verseNumber, entry.verse_start, entry.verse_end));
  }

  function findChapterNoteEntry(verseNumber: number) {
    return chapterNotes.find((entry) => verseInRange(verseNumber, entry.verse_start, entry.verse_end));
  }

  function isVerseBookmarked(verseNumber: number) {
    return Boolean(findChapterBookmarkEntry(verseNumber));
  }

  function hasVerseNote(verseNumber: number) {
    return Boolean(findChapterNoteEntry(verseNumber));
  }

  function getVerseNote(verseNumber: number) {
    return findChapterNoteEntry(verseNumber)?.note || '';
  }

  function toggleSelectedVerse(verseNumber: number) {
    if (verseNumber <= 0) return;
    setSelectedVerseNumbers((current) => {
      if (current.includes(verseNumber)) {
        return current.filter((value) => value !== verseNumber);
      }
      return [...current, verseNumber];
    });
  }

  function openRangeNoteDialog() {
    if (!selectedVerseRange) return;
    setNoteTarget({
      verseStart: selectedVerseRange.start,
      verseEnd: selectedVerseRange.end,
      referenceLabel: selectedVerseRange.referenceLabel,
      excerpt: selectedVerseRange.excerpt,
    });

    const existing = chapterNotes.find(
      (entry) =>
        entry.verse_start === selectedVerseRange.start && entry.verse_end === selectedVerseRange.end
    );
    setNoteDraft(existing?.note || '');
    setNoteDialogOpen(true);
  }

  function applyRangeBookmark() {
    if (!selectedBook || !selectedVerseRange) return;

    const store = upsertBibleBookmark({
      book_id: selectedBook.id,
      chapter: currentChapter,
      verse_start: selectedVerseRange.start,
      verse_end: selectedVerseRange.end,
      reference_label: selectedVerseRange.referenceLabel,
      excerpt: selectedVerseRange.excerpt,
      language_code: requestedLanguage,
      version_code: requestedVersion,
    });
    setPersonalStore(store);

    if (user?.id) {
      const entryId = buildBiblePersonalEntryId({
        book_id: selectedBook.id,
        chapter: currentChapter,
        verse_start: selectedVerseRange.start,
        verse_end: selectedVerseRange.end,
        language_code: requestedLanguage,
        version_code: requestedVersion,
      });
      const entry = store.bookmarks.find((bookmark) => bookmark.id === entryId);
      if (entry) {
        void upsertBibleBookmarkToCloud(user.id, entry);
      } else {
        void syncBiblePersonalStoreToCloud(user.id, store);
      }
    }

    toast.success('Bookmark rentang ayat tersimpan');
  }

  function applyRangeHighlight(color: string) {
    if (!selectedBook || !selectedVerseRange) return;

    const store = upsertBibleHighlight({
      book_id: selectedBook.id,
      chapter: currentChapter,
      verse_start: selectedVerseRange.start,
      verse_end: selectedVerseRange.end,
      color,
      reference_label: selectedVerseRange.referenceLabel,
      excerpt: selectedVerseRange.excerpt,
      language_code: requestedLanguage,
      version_code: requestedVersion,
    });
    setPersonalStore(store);

    if (user?.id) {
      const entryId = buildBiblePersonalEntryId({
        book_id: selectedBook.id,
        chapter: currentChapter,
        verse_start: selectedVerseRange.start,
        verse_end: selectedVerseRange.end,
        language_code: requestedLanguage,
        version_code: requestedVersion,
      });
      const entry = store.highlights.find((highlight) => highlight.id === entryId);
      if (entry) {
        void upsertBibleHighlightToCloud(user.id, entry);
      } else {
        void syncBiblePersonalStoreToCloud(user.id, store);
      }
    }

    toast.success('Highlight rentang ayat tersimpan');
  }

  async function handleShareChapter() {
    if (!selectedBook) return;

    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const text = `${selectedBook.name} ${currentChapter}`;
    const nav = getBrowserNavigator();

    try {
      if (nav && typeof nav.share === 'function') {
        await nav.share({
          title: `${selectedBook.name} ${currentChapter}`,
          text,
          url: shareUrl,
        });
        return;
      }

      if (nav?.clipboard) {
        await nav.clipboard.writeText(`${text}\n${shareUrl}`);
        toast.success('Tautan pasal disalin ke clipboard');
        return;
      }

      toast.info('Fitur share belum tersedia di browser ini');
    } catch {
      toast.error('Gagal membagikan pasal');
    }
  }

  function openVerseActions(verse: BibleVerse) {
    if (verse.verse_number <= 0) return;
    const existingNote = findChapterNoteEntry(verse.verse_number);
    setActionVerse(verse);
    setNoteDraft(existingNote?.note || '');
    setNoteTarget({
      verseStart: existingNote?.verse_start ?? verse.verse_number,
      verseEnd: existingNote?.verse_end ?? verse.verse_number,
      referenceLabel: existingNote?.reference_label || buildVerseReference(verse.verse_number),
      excerpt: existingNote?.excerpt || verse.text,
    });
    setActionDialogOpen(true);
  }

  async function handleCopyVerse() {
    const nav = getBrowserNavigator();
    if (!actionVerse || !selectedBook || !nav?.clipboard) {
      toast.info('Clipboard belum tersedia di browser ini');
      return;
    }

    const reference = buildVerseReference(actionVerse.verse_number);
    const text = `${reference}\n${actionVerse.text}`;

    try {
      await nav.clipboard.writeText(text);
      toast.success('Ayat disalin');
    } catch {
      toast.error('Gagal menyalin ayat');
    }
  }

  async function handleShareVerse() {
    if (!actionVerse || !selectedBook) return;

    const reference = buildVerseReference(actionVerse.verse_number);
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const text = `${reference}\n${actionVerse.text}`;
    const nav = getBrowserNavigator();

    try {
      if (nav && typeof nav.share === 'function') {
        await nav.share({
          title: reference,
          text,
          url: shareUrl,
        });
        return;
      }

      if (nav?.clipboard) {
        await nav.clipboard.writeText(text);
        toast.success('Ayat disalin untuk dibagikan');
        return;
      }

      toast.info('Fitur share belum tersedia di browser ini');
    } catch {
      toast.error('Gagal membagikan ayat');
    }
  }

  async function handleShareVerseAsImage() {
    if (!actionVerse || !selectedBook) return;

    try {
      const reference = buildVerseReference(actionVerse.verse_number);
      const blob = await createVerseImageBlob(reference, actionVerse.text);
      const file = new File([blob], `ayat-${actionVerse.verse_number}.png`, { type: 'image/png' });
      const nav = getBrowserNavigator();

      if (
        nav &&
        typeof nav.share === 'function' &&
        typeof nav.canShare === 'function' &&
        nav.canShare({ files: [file] })
      ) {
        await nav.share({
          title: reference,
          text: 'Bagikan firman Tuhan',
          files: [file],
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ayat-${actionVerse.verse_number}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Gambar ayat berhasil dibuat');
    } catch {
      toast.error('Gagal membuat gambar ayat');
    }
  }

  function handleToggleBookmark() {
    if (!actionVerse || !selectedBook) return;

    const verseNumber = actionVerse.verse_number;
    const existingEntry = findChapterBookmarkEntry(verseNumber);

    if (existingEntry) {
      const store = removeBibleBookmark({
        book_id: selectedBook.id,
        chapter: currentChapter,
        verse_start: existingEntry.verse_start,
        verse_end: existingEntry.verse_end,
        language_code: requestedLanguage,
        version_code: requestedVersion,
      });
      setPersonalStore(store);
      if (user?.id) {
        void removeBibleBookmarkFromCloud(user.id, existingEntry.id);
      }
      toast.success('Bookmark dihapus');
      return;
    }

    const entryId = buildBiblePersonalEntryId({
      book_id: selectedBook.id,
      chapter: currentChapter,
      verse_start: verseNumber,
      verse_end: verseNumber,
      language_code: requestedLanguage,
      version_code: requestedVersion,
    });
    const store = upsertBibleBookmark({
      book_id: selectedBook.id,
      chapter: currentChapter,
      verse_start: verseNumber,
      reference_label: buildVerseReference(verseNumber),
      excerpt: actionVerse.text,
      language_code: requestedLanguage,
      version_code: requestedVersion,
    });

    setPersonalStore(store);
    if (user?.id) {
      const entry = store.bookmarks.find((bookmark) => bookmark.id === entryId);
      if (entry) {
        void upsertBibleBookmarkToCloud(user.id, entry);
      } else {
        void syncBiblePersonalStoreToCloud(user.id, store);
      }
    }
    toast.success('Ayat dibookmark');
  }

  function handleHighlight(color: string) {
    if (!actionVerse || !selectedBook) return;

    const verseNumber = actionVerse.verse_number;
    const existingEntry = findChapterHighlightEntry(verseNumber);
    const verseStart = existingEntry?.verse_start ?? verseNumber;
    const verseEnd = existingEntry?.verse_end ?? verseNumber;
    const entryId = buildBiblePersonalEntryId({
      book_id: selectedBook.id,
      chapter: currentChapter,
      verse_start: verseStart,
      verse_end: verseEnd,
      language_code: requestedLanguage,
      version_code: requestedVersion,
    });
    const store = upsertBibleHighlight({
      book_id: selectedBook.id,
      chapter: currentChapter,
      verse_start: verseStart,
      verse_end: verseEnd,
      color,
      reference_label: existingEntry?.reference_label || buildVerseReference(verseNumber),
      excerpt: existingEntry?.excerpt || actionVerse.text,
      language_code: requestedLanguage,
      version_code: requestedVersion,
    });
    setPersonalStore(store);
    if (user?.id) {
      const entry = store.highlights.find((highlight) => highlight.id === entryId);
      if (entry) {
        void upsertBibleHighlightToCloud(user.id, entry);
      } else {
        void syncBiblePersonalStoreToCloud(user.id, store);
      }
    }
    toast.success('Highlight tersimpan');
  }

  function handleRemoveHighlight() {
    if (!actionVerse || !selectedBook) return;

    const verseNumber = actionVerse.verse_number;
    const existingEntry = findChapterHighlightEntry(verseNumber);
    if (!existingEntry) {
      toast.info('Ayat ini belum memiliki highlight');
      return;
    }

    const store = removeBibleHighlight({
      book_id: selectedBook.id,
      chapter: currentChapter,
      verse_start: existingEntry.verse_start,
      verse_end: existingEntry.verse_end,
      language_code: requestedLanguage,
      version_code: requestedVersion,
    });
    setPersonalStore(store);
    if (user?.id) {
      void removeBibleHighlightFromCloud(user.id, existingEntry.id);
    }
    toast.success('Highlight dihapus');
  }

  function handleSaveNote() {
    if (!selectedBook || !noteTarget) return;

    const clean = noteDraft.trim();
    if (!clean) {
      toast.error('Catatan tidak boleh kosong');
      return;
    }

    const entryId = buildBiblePersonalEntryId({
      book_id: selectedBook.id,
      chapter: currentChapter,
      verse_start: noteTarget.verseStart,
      verse_end: noteTarget.verseEnd,
      language_code: requestedLanguage,
      version_code: requestedVersion,
    });
    const store = upsertBibleNote({
      book_id: selectedBook.id,
      chapter: currentChapter,
      verse_start: noteTarget.verseStart,
      verse_end: noteTarget.verseEnd,
      reference_label: noteTarget.referenceLabel,
      excerpt: noteTarget.excerpt,
      note: clean,
      language_code: requestedLanguage,
      version_code: requestedVersion,
    });

    setPersonalStore(store);
    if (user?.id) {
      const entry = store.notes.find((note) => note.id === entryId);
      if (entry) {
        void upsertBibleNoteToCloud(user.id, entry);
      } else {
        void syncBiblePersonalStoreToCloud(user.id, store);
      }
    }
    setNoteDialogOpen(false);
    setNoteTarget(null);
    toast.success('Catatan renungan tersimpan');
  }

  function handleRemoveNote() {
    if (!selectedBook || !noteTarget) return;

    const existingEntry = chapterNotes.find(
      (entry) => entry.verse_start === noteTarget.verseStart && entry.verse_end === noteTarget.verseEnd
    );
    if (!existingEntry) {
      toast.info('Belum ada catatan tersimpan pada rentang ini');
      return;
    }

    const store = removeBibleNote({
      book_id: selectedBook.id,
      chapter: currentChapter,
      verse_start: existingEntry.verse_start,
      verse_end: existingEntry.verse_end,
      language_code: requestedLanguage,
      version_code: requestedVersion,
    });
    setPersonalStore(store);

    if (user?.id) {
      void removeBibleNoteFromCloud(user.id, existingEntry.id);
    }

    setNoteDialogOpen(false);
    setNoteTarget(null);
    setNoteDraft('');
    toast.success('Catatan dihapus');
  }

  if (isLoadingBooks) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Memuat data kitab...
      </div>
    );
  }

  if (!selectedBook) {
    return (
      <Card className="mx-auto max-w-xl border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle>Kitab tidak ditemukan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Kitab yang Anda buka tidak ada atau sudah berubah.</p>
          <Button asChild>
            <Link href="/bible">Kembali ke Library Alkitab</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-sky-100/80 via-card to-cyan-100/50 p-4 shadow-sm sm:p-6 dark:from-sky-950/30 dark:to-cyan-950/20">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-44 w-44 rounded-full bg-cyan-400/15 blur-3xl" />

        <div className="relative space-y-4">
          <Button asChild variant="outline" size="sm" className="w-fit gap-2 rounded-full">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              Kembali ke library
            </Link>
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <Badge className="bg-primary/90 text-primary-foreground">
                {testamentLabel(selectedBook.testament)}
              </Badge>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{selectedBook.name}</h1>
              <p className="text-sm text-muted-foreground">
                Bab {currentChapter} • {requestedVersion} •{' '}
                {requestedLanguage.toUpperCase()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="rounded-xl" onClick={handleShareChapter}>
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="space-y-4 border-b border-border/50 bg-muted/20">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl"
              disabled={!canGoPrevious || isLoadingChapters}
              onClick={() =>
                canGoPrevious &&
                router.push(
                  buildReaderHref(selectedBook.id, availableChapters[chapterIndex - 1], baseQueryString)
                )
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <select
              value={currentChapter}
              onChange={(event) =>
                router.push(
                  buildReaderHref(selectedBook.id, Number(event.target.value), baseQueryString)
                )
              }
              className="h-9 rounded-xl border border-input bg-background px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              disabled={isLoadingChapters || availableChapters.length === 0}
            >
              {availableChapters.map((chapter) => (
                <option key={chapter} value={chapter}>
                  Bab {chapter}
                </option>
              ))}
            </select>

            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl"
              disabled={!canGoNext || isLoadingChapters}
              onClick={() =>
                canGoNext &&
                router.push(
                  buildReaderHref(selectedBook.id, availableChapters[chapterIndex + 1], baseQueryString)
                )
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <div className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 dark:border-white/20 dark:bg-white/[0.03] sm:ml-auto sm:w-[260px]">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground dark:text-white/85">
                <Type className="h-3.5 w-3.5" />
                Ukuran teks ({Math.round(fontSize)}px)
              </div>
              <Slider
                value={fontSizeRange}
                min={14}
                max={28}
                step={1}
                onValueChange={(value) => setFontSizeRange(value)}
                className="dark:[&_[data-slot=slider-track]]:bg-white/14 dark:[&_[data-slot=slider-range]]:bg-white dark:[&_[data-slot=slider-thumb]]:border-white dark:[&_[data-slot=slider-thumb]]:bg-zinc-950"
              />

              <div className="mb-2 mt-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground dark:text-white/85">
                <Type className="h-3.5 w-3.5" />
                Jarak baris ({lineHeight.toFixed(2)}x)
              </div>
              <Slider
                value={lineHeightRange}
                min={1.4}
                max={2.3}
                step={0.05}
                onValueChange={(value) => setLineHeightRange(value)}
                className="dark:[&_[data-slot=slider-track]]:bg-white/14 dark:[&_[data-slot=slider-range]]:bg-white dark:[&_[data-slot=slider-thumb]]:border-white dark:[&_[data-slot=slider-thumb]]:bg-zinc-950"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Ketuk ayat untuk aksi cepat: salin, bagikan, highlight, bookmark, dan catatan.
          </p>

          <div className="rounded-xl border border-border/70 bg-background px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={multiSelectMode ? 'default' : 'outline'}
                onClick={() => {
                  setMultiSelectMode((current) => !current);
                  setSelectedVerseNumbers([]);
                }}
              >
                {multiSelectMode ? 'Keluar multi-select' : 'Mode multi-select'}
              </Button>

              {multiSelectMode ? (
                <p className="text-xs text-muted-foreground">
                  Pilih beberapa ayat untuk aksi rentang.
                </p>
              ) : null}
            </div>

            {multiSelectMode && selectedVerseRange ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  Rentang aktif: {selectedVerseRange.referenceLabel}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={applyRangeBookmark}>
                    Bookmark rentang
                  </Button>
                  <Button size="sm" variant="outline" onClick={openRangeNoteDialog}>
                    Catatan rentang
                  </Button>
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      key={`range-${color}`}
                      type="button"
                      className="h-7 w-7 rounded-full border border-border shadow-sm"
                      style={{ backgroundColor: color }}
                      onClick={() => applyRangeHighlight(color)}
                    />
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedVerseNumbers([]);
                    }}
                  >
                    Bersihkan pilihan
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {isLoadingVerses ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
              Memuat ayat...
            </div>
          ) : verses.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <BookOpenText className="mx-auto mb-3 h-9 w-9" />
              Teks bab ini belum tersedia (masih proses digitalisasi).
            </div>
          ) : (
            <div className="space-y-3">
              {versesWithPericopeTitle.map(({ verse, pericopeTitle }, index) => (
                <VerseLine
                  key={`${verse.verse_number}-${index}`}
                  verse={verse}
                  pericopeTitle={pericopeTitle}
                  fontSize={fontSize}
                  lineHeight={lineHeight}
                  highlightedFromQuery={highlightedVerse > 0 && verse.verse_number === highlightedVerse}
                  highlightColor={findVerseHighlightColor(verse.verse_number)}
                  bookmarked={isVerseBookmarked(verse.verse_number)}
                  hasNote={hasVerseNote(verse.verse_number)}
                  selected={selectedVerseNumbers.includes(verse.verse_number)}
                  multiSelectMode={multiSelectMode}
                  onClick={() => {
                    if (multiSelectMode) {
                      toggleSelectedVerse(verse.verse_number);
                      return;
                    }
                    openVerseActions(verse);
                  }}
                  onLongPress={() => {
                    if (verse.verse_number <= 0) return;
                    setMultiSelectMode(true);
                    setSelectedVerseNumbers([verse.verse_number]);
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={actionDialogOpen}
        onOpenChange={(open) => {
          setActionDialogOpen(open);
          if (!open) {
            setActionVerse(null);
          }
        }}
      >
        <DialogContent className="max-h-[88dvh] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle>{actionVerse ? buildVerseReference(actionVerse.verse_number) : 'Aksi Ayat'}</DialogTitle>
            <DialogDescription>Pilih aksi cepat untuk ayat ini.</DialogDescription>
          </DialogHeader>

          {actionVerse ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm leading-7">
                {actionVerse.text}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button variant="outline" className="justify-start gap-2" onClick={handleCopyVerse}>
                  <Copy className="h-4 w-4" />
                  Salin
                </Button>
                <Button variant="outline" className="justify-start gap-2" onClick={handleShareVerse}>
                  <Share2 className="h-4 w-4" />
                  Bagikan
                </Button>
                <Button
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={handleShareVerseAsImage}
                >
                  <BookOpenText className="h-4 w-4" />
                  Bagikan Gambar
                </Button>
                <Button variant="outline" className="justify-start gap-2" onClick={handleToggleBookmark}>
                  <Bookmark className="h-4 w-4" />
                  Bookmark
                </Button>
                <Button
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={() => {
                    setActionDialogOpen(false);
                    setNoteDialogOpen(true);
                  }}
                >
                  <NotebookPen className="h-4 w-4" />
                  Catatan
                </Button>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Highlighter className="h-3.5 w-3.5" />
                  Pilih warna sorotan
                </div>
                <div className="flex flex-wrap gap-2">
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleHighlight(color)}
                      className="h-7 w-7 rounded-full border border-border shadow-sm transition hover:scale-105"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <Button size="sm" variant="ghost" onClick={handleRemoveHighlight}>
                    Hapus highlight
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={noteDialogOpen}
        onOpenChange={(open) => {
          setNoteDialogOpen(open);
          if (!open) {
            setNoteTarget(null);
          }
        }}
      >
        <DialogContent className="max-h-[88dvh] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle>Catatan Renungan</DialogTitle>
            <DialogDescription>
              Simpan refleksi pribadi untuk ayat ini. Catatan tersimpan privat secara default.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              rows={6}
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Apa yang Tuhan tegur atau kuatkan dalam dirimu melalui ayat ini?"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="w-full" onClick={handleSaveNote}>
                Simpan catatan
              </Button>
              <Button variant="outline" className="w-full" onClick={handleRemoveNote}>
                Hapus catatan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VerseLine({
  verse,
  pericopeTitle,
  fontSize,
  lineHeight,
  highlightedFromQuery,
  highlightColor,
  bookmarked,
  hasNote,
  selected,
  multiSelectMode,
  onClick,
  onLongPress,
}: {
  verse: BibleVerse;
  pericopeTitle?: string;
  fontSize: number;
  lineHeight: number;
  highlightedFromQuery: boolean;
  highlightColor?: string;
  bookmarked: boolean;
  hasNote: boolean;
  selected: boolean;
  multiSelectMode: boolean;
  onClick: () => void;
  onLongPress: () => void;
}) {
  const [longPressed, setLongPressed] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const resolvedPericopeTitle = normalizePericopeTitle(pericopeTitle);
  const pericopeFontSize = Math.min(32, Math.max(fontSize + 6, 22));
  const headingFontSize = Math.min(34, Math.max(fontSize + 8, 24));
  const verseHighlightStyle = buildVerseHighlightStyle(highlightColor);

  useEffect(() => {
    if (!longPressed) return;
    const timeout = window.setTimeout(() => setLongPressed(false), 80);
    return () => window.clearTimeout(timeout);
  }, [longPressed]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  if (verse.type?.toLowerCase() === 'heading') {
    const headingText = verse.text.trim() || normalizePericopeTitle(pericopeTitle) || normalizePericopeTitle(verse.pericope);
    if (!headingText) return null;
    return (
      <div className="rounded-xl border border-primary/25 bg-primary/8 px-4 py-3 dark:border-white/35 dark:bg-white/8">
        <p
          className="font-bold tracking-tight text-primary dark:text-white"
          style={{ fontSize: headingFontSize, lineHeight: 1.22 }}
        >
          {headingText}
        </p>
      </div>
    );
  }

  return (
    <article
      id={verse.verse_number > 0 ? `verse-${verse.verse_number}` : undefined}
      className={cn(
        'rounded-xl border border-border/60 bg-background px-4 py-3 transition hover:border-primary/40',
        highlightedFromQuery && 'border-primary/60 bg-primary/5 shadow-sm',
        selected && 'border-primary bg-primary/10 ring-1 ring-primary/40'
      )}
      style={verseHighlightStyle}
    >
      {resolvedPericopeTitle ? (
        <div className="mb-3 rounded-lg border border-primary/25 bg-primary/8 px-3 py-3 dark:border-white/35 dark:bg-white/8">
          <p
            className="font-bold tracking-tight text-primary dark:text-white"
            style={{ fontSize: pericopeFontSize, lineHeight: 1.24 }}
          >
            {resolvedPericopeTitle}
          </p>
        </div>
      ) : null}

      <button
        type="button"
        className={cn('w-full text-left', multiSelectMode && 'cursor-pointer')}
        onPointerDown={() => {
          if (multiSelectMode || verse.verse_number <= 0) return;
          longPressTimerRef.current = window.setTimeout(() => {
            setLongPressed(true);
            onLongPress();
          }, 420);
        }}
        onPointerUp={() => {
          if (longPressTimerRef.current) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        }}
        onPointerLeave={() => {
          if (longPressTimerRef.current) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        }}
        onClick={() => {
          if (longPressed) return;
          onClick();
        }}
      >
        <p className="text-foreground" style={{ fontSize, lineHeight }}>
          <sup className="mr-2 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary dark:border-white/45 dark:bg-white/15 dark:text-white">
            {verse.verse_number}
          </sup>
          {verse.text}
        </p>
      </button>

      {(bookmarked || hasNote) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {bookmarked && (
            <Badge variant="outline" className="rounded-full text-[10px]">
              Bookmark
            </Badge>
          )}
          {hasNote && (
            <Badge variant="outline" className="rounded-full text-[10px]">
              Catatan
            </Badge>
          )}
        </div>
      )}
    </article>
  );
}
