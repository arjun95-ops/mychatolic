import { supabase } from '@/lib/supabase/client';
import {
  buildBiblePersonalEntryId,
  createEmptyBiblePersonalStore,
  resolveBibleAnnotationScope,
  type BibleBookmarkEntry,
  type BibleHighlightEntry,
  type BibleNoteEntry,
  type BiblePersonalStore,
  type BiblePlanProgress,
} from './personalization';

function isCompatibilityError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes('does not exist') ||
    lower.includes('could not find') ||
    lower.includes('schema cache') ||
    lower.includes('42p01') ||
    lower.includes('42703') ||
    lower.includes('pgrst204') ||
    lower.includes('pgrst205')
  );
}

function ensureString(value: unknown, fallback = '') {
  const text = value?.toString().trim();
  return text || fallback;
}

function ensureNumber(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => {
    return typeof item === 'object' && item !== null && !Array.isArray(item);
  });
}

function mapBookmarkRow(row: Record<string, unknown>): BibleBookmarkEntry {
  const scope = resolveBibleAnnotationScope(row);
  const bookId = ensureString(row.book_id);
  const chapter = ensureNumber(row.chapter, 1);
  const verseStart = ensureNumber(row.verse_start, 1);
  const verseEnd = ensureNumber(row.verse_end, verseStart);

  return {
    id:
      ensureString(row.id) ||
      buildBiblePersonalEntryId({
        ...scope,
        book_id: bookId,
        chapter,
        verse_start: verseStart,
        verse_end: verseEnd,
      }),
    ...scope,
    book_id: bookId,
    chapter,
    verse_start: verseStart,
    verse_end: verseEnd,
    reference_label: ensureString(row.reference_label),
    excerpt: ensureString(row.excerpt),
    created_at: ensureString(row.created_at, new Date().toISOString()),
  };
}

function mapHighlightRow(row: Record<string, unknown>): BibleHighlightEntry {
  const scope = resolveBibleAnnotationScope(row);
  const bookId = ensureString(row.book_id);
  const chapter = ensureNumber(row.chapter, 1);
  const verseStart = ensureNumber(row.verse_start, 1);
  const verseEnd = ensureNumber(row.verse_end, verseStart);

  return {
    id:
      ensureString(row.id) ||
      buildBiblePersonalEntryId({
        ...scope,
        book_id: bookId,
        chapter,
        verse_start: verseStart,
        verse_end: verseEnd,
      }),
    ...scope,
    book_id: bookId,
    chapter,
    verse_start: verseStart,
    verse_end: verseEnd,
    color: ensureString(row.color, '#FDE68A'),
    reference_label: ensureString(row.reference_label),
    excerpt: ensureString(row.excerpt),
    created_at: ensureString(row.created_at, new Date().toISOString()),
  };
}

function mapNoteRow(row: Record<string, unknown>): BibleNoteEntry {
  const scope = resolveBibleAnnotationScope(row);
  const bookId = ensureString(row.book_id);
  const chapter = ensureNumber(row.chapter, 1);
  const verseStart = ensureNumber(row.verse_start, 1);
  const verseEnd = ensureNumber(row.verse_end, verseStart);

  return {
    id:
      ensureString(row.id) ||
      buildBiblePersonalEntryId({
        ...scope,
        book_id: bookId,
        chapter,
        verse_start: verseStart,
        verse_end: verseEnd,
      }),
    ...scope,
    book_id: bookId,
    chapter,
    verse_start: verseStart,
    verse_end: verseEnd,
    reference_label: ensureString(row.reference_label),
    excerpt: ensureString(row.excerpt),
    note: ensureString(row.note),
    created_at: ensureString(row.created_at, new Date().toISOString()),
    updated_at: ensureString(row.updated_at, new Date().toISOString()),
  };
}

function mapPlanRow(row: Record<string, unknown>): [string, BiblePlanProgress] {
  const planId = ensureString(row.plan_id);
  const completedDatesRaw = row.completed_dates;
  const completedDates = Array.isArray(completedDatesRaw)
    ? completedDatesRaw
        .map((value) => ensureString(value))
        .filter((value) => value.length > 0)
        .sort((a, b) => a.localeCompare(b))
    : [];

  return [
    planId,
    {
      completed_dates: completedDates,
      last_completed_at: ensureString(row.last_completed_at),
    },
  ];
}

function buildVerseNumbersInRange(start: number, end: number) {
  const safeStart = Math.max(1, Math.floor(start));
  const safeEnd = Math.max(safeStart, Math.floor(end));
  return Array.from({ length: safeEnd - safeStart + 1 }, (_, index) => safeStart + index);
}

function parseScopeAwareEntryId(entryId: string) {
  const parts = entryId.trim().split(':');
  if (parts.length < 6) return null;

  const verseEnd = ensureNumber(parts[parts.length - 1], 0);
  const verseStart = ensureNumber(parts[parts.length - 2], 0);
  const chapter = ensureNumber(parts[parts.length - 3], 0);
  const languageCode = parts[0];
  const versionCode = parts[1];
  const bookId = parts.slice(2, parts.length - 3).join(':');
  if (!bookId || chapter <= 0 || verseStart <= 0 || verseEnd <= 0) return null;

  const scope = resolveBibleAnnotationScope({
    language_code: languageCode,
    version_code: versionCode,
  });

  return {
    ...scope,
    book_id: bookId,
    chapter,
    verse_start: verseStart,
    verse_end: verseEnd,
  };
}

function toMobileVersionCode(scope: { language_code: string; version_code: string }) {
  if (scope.language_code === 'id' && scope.version_code === 'TB1') {
    return 'TB';
  }
  return scope.version_code;
}

function toMobileVersionCodeCandidates(scope: { language_code: string; version_code: string }) {
  if (scope.language_code === 'id' && scope.version_code === 'TB1') {
    return ['TB1', 'TB'];
  }
  return [scope.version_code];
}

function normalizeMobileBookmarkRow(row: Record<string, unknown>): Record<string, unknown> {
  const scope = resolveBibleAnnotationScope(row);
  const bookId = ensureString(row.book_id);
  const chapter = ensureNumber(row.chapter_number, 1);
  const verse = ensureNumber(row.verse_number, 1);
  return {
    id: buildBiblePersonalEntryId({
      ...scope,
      book_id: bookId,
      chapter,
      verse_start: verse,
      verse_end: verse,
    }),
    ...scope,
    book_id: bookId,
    chapter,
    verse_start: verse,
    verse_end: verse,
    reference_label: `${chapter}:${verse}`,
    excerpt: '',
    created_at: ensureString(row.created_at, new Date().toISOString()),
  };
}

function normalizeMobileHighlightRow(row: Record<string, unknown>): Record<string, unknown> {
  const scope = resolveBibleAnnotationScope(row);
  const bookId = ensureString(row.book_id);
  const chapter = ensureNumber(row.chapter_number, 1);
  const verse = ensureNumber(row.verse_number, 1);
  return {
    id: buildBiblePersonalEntryId({
      ...scope,
      book_id: bookId,
      chapter,
      verse_start: verse,
      verse_end: verse,
    }),
    ...scope,
    book_id: bookId,
    chapter,
    verse_start: verse,
    verse_end: verse,
    color: ensureString(row.color, '#FDE68A'),
    reference_label: `${chapter}:${verse}`,
    excerpt: '',
    created_at: ensureString(row.created_at, new Date().toISOString()),
  };
}

function normalizeMobileNoteRow(row: Record<string, unknown>): Record<string, unknown> {
  const scope = resolveBibleAnnotationScope(row);
  const bookId = ensureString(row.book_id);
  const chapter = ensureNumber(row.chapter_number, 1);
  const verse = ensureNumber(row.verse_number, 1);
  return {
    id: buildBiblePersonalEntryId({
      ...scope,
      book_id: bookId,
      chapter,
      verse_start: verse,
      verse_end: verse,
    }),
    ...scope,
    book_id: bookId,
    chapter,
    verse_start: verse,
    verse_end: verse,
    reference_label: `${chapter}:${verse}`,
    excerpt: '',
    note: ensureString(row.note),
    created_at: ensureString(row.created_at, new Date().toISOString()),
    updated_at: ensureString(row.updated_at, new Date().toISOString()),
  };
}

const DELETE_BATCH_SIZE = 250;

function uniqueIds(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function chunkIds(ids: string[], size = DELETE_BATCH_SIZE) {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

async function deleteMissingRowsById(params: {
  table: 'bible_user_bookmarks' | 'bible_user_highlights' | 'bible_user_notes' | 'bible_user_plan_progress';
  userId: string;
  idColumn: 'id' | 'plan_id';
  localIds: string[];
}) {
  const { table, userId, idColumn, localIds } = params;
  const { data, error } = await supabase.from(table).select(idColumn).eq('user_id', userId);

  if (error) {
    if (isCompatibilityError(error.message)) return { ok: false, incompatible: true };
    console.error(`Error loading ${table} ids for reconciliation:`, error);
    return { ok: false, incompatible: false };
  }

  const localIdSet = new Set(uniqueIds(localIds));
  const cloudIds = toRows(data)
    .map((row) => ensureString(row[idColumn]))
    .filter((value) => value.length > 0);
  const idsToDelete = cloudIds.filter((id) => !localIdSet.has(id));

  if (idsToDelete.length === 0) {
    return { ok: true, incompatible: false };
  }

  for (const batch of chunkIds(idsToDelete)) {
    const deleteRes = await supabase
      .from(table)
      .delete()
      .eq('user_id', userId)
      .in(idColumn, batch);

    if (!deleteRes.error) {
      continue;
    }
    if (isCompatibilityError(deleteRes.error.message)) {
      return { ok: false, incompatible: true };
    }
    console.error(`Error reconciling deleted rows for ${table}:`, deleteRes.error);
    return { ok: false, incompatible: false };
  }

  return { ok: true, incompatible: false };
}

async function loadAnnotationRowsWithScopeFallback(params: {
  table: 'bible_user_bookmarks' | 'bible_user_highlights' | 'bible_user_notes';
  userId: string;
  scopedSelect: string;
  legacySelect: string;
  mobileSelect: string;
  mapMobileRow: (row: Record<string, unknown>) => Record<string, unknown>;
}) {
  const { table, userId, scopedSelect, legacySelect, mobileSelect, mapMobileRow } = params;

  const scopedRes = await supabase.from(table).select(scopedSelect).eq('user_id', userId);
  if (!scopedRes.error) {
    return {
      rows: toRows(scopedRes.data),
      incompatible: false,
      failed: false,
    };
  }

  if (!isCompatibilityError(scopedRes.error.message ?? '')) {
    console.error(`Error loading ${table} (scoped):`, scopedRes.error);
    return {
      rows: [] as Record<string, unknown>[],
      incompatible: false,
      failed: true,
    };
  }

  const legacyRes = await supabase.from(table).select(legacySelect).eq('user_id', userId);
  if (!legacyRes.error) {
    return {
      rows: toRows(legacyRes.data),
      incompatible: false,
      failed: false,
    };
  }

  if (!isCompatibilityError(legacyRes.error.message ?? '')) {
    console.error(`Error loading ${table} (legacy):`, legacyRes.error);
    return {
      rows: [] as Record<string, unknown>[],
      incompatible: false,
      failed: true,
    };
  }

  const mobileRes = await supabase.from(table).select(mobileSelect).eq('user_id', userId);
  if (!mobileRes.error) {
    return {
      rows: toRows(mobileRes.data).map(mapMobileRow),
      incompatible: false,
      failed: false,
    };
  }

  if (isCompatibilityError(mobileRes.error.message ?? '')) {
    return {
      rows: [] as Record<string, unknown>[],
      incompatible: true,
      failed: false,
    };
  }

  console.error(`Error loading ${table} (mobile):`, mobileRes.error);
  return {
    rows: [] as Record<string, unknown>[],
    incompatible: false,
    failed: true,
  };
}

export async function loadBiblePersonalStoreFromCloud(userId: string): Promise<{
  supported: boolean;
  store: BiblePersonalStore;
}> {
  const emptyStore = createEmptyBiblePersonalStore();
  if (!userId.trim()) {
    return { supported: false, store: emptyStore };
  }

  const [bookmarksRes, highlightsRes, notesRes, plansRes] = await Promise.all([
    loadAnnotationRowsWithScopeFallback({
      table: 'bible_user_bookmarks',
      userId,
      scopedSelect:
        'id, book_id, chapter, verse_start, verse_end, language_code, version_code, reference_label, excerpt, created_at',
      legacySelect:
        'id, book_id, chapter, verse_start, verse_end, reference_label, excerpt, created_at',
      mobileSelect: 'book_id, chapter_number, verse_number, language_code, version_code, created_at',
      mapMobileRow: normalizeMobileBookmarkRow,
    }),
    loadAnnotationRowsWithScopeFallback({
      table: 'bible_user_highlights',
      userId,
      scopedSelect:
        'id, book_id, chapter, verse_start, verse_end, language_code, version_code, color, reference_label, excerpt, created_at',
      legacySelect:
        'id, book_id, chapter, verse_start, verse_end, color, reference_label, excerpt, created_at',
      mobileSelect:
        'book_id, chapter_number, verse_number, language_code, version_code, color, created_at',
      mapMobileRow: normalizeMobileHighlightRow,
    }),
    loadAnnotationRowsWithScopeFallback({
      table: 'bible_user_notes',
      userId,
      scopedSelect:
        'id, book_id, chapter, verse_start, verse_end, language_code, version_code, reference_label, excerpt, note, created_at, updated_at',
      legacySelect:
        'id, book_id, chapter, verse_start, verse_end, reference_label, excerpt, note, created_at, updated_at',
      mobileSelect:
        'book_id, chapter_number, verse_number, language_code, version_code, note, created_at, updated_at',
      mapMobileRow: normalizeMobileNoteRow,
    }),
    supabase
      .from('bible_user_plan_progress')
      .select('plan_id, completed_dates, last_completed_at')
      .eq('user_id', userId),
  ]);

  const plansError = plansRes.error;
  const incompatible =
    bookmarksRes.incompatible ||
    highlightsRes.incompatible ||
    notesRes.incompatible ||
    isCompatibilityError(plansError?.message ?? '');
  if (incompatible) {
    return { supported: false, store: emptyStore };
  }

  const hasAnyError = bookmarksRes.failed || highlightsRes.failed || notesRes.failed || Boolean(plansError);
  if (hasAnyError) {
    if (plansError && !isCompatibilityError(plansError.message ?? '')) {
      console.error('Error loading Bible plan progress from cloud:', plansError);
    }
    return { supported: false, store: emptyStore };
  }

  const mappedStore: BiblePersonalStore = {
    bookmarks: bookmarksRes.rows.map(mapBookmarkRow),
    highlights: highlightsRes.rows.map(mapHighlightRow),
    notes: notesRes.rows.map(mapNoteRow),
    plan_progress: Object.fromEntries(
      toRows(plansRes.data)
        .map(mapPlanRow)
        .filter(([planId]) => planId.length > 0)
    ),
  };

  return { supported: true, store: mappedStore };
}

async function upsertBookmarkToMobileSchema(userId: string, entry: BibleBookmarkEntry) {
  const verseNumbers = buildVerseNumbersInRange(entry.verse_start, entry.verse_end);
  const mobileVersionCode = toMobileVersionCode(entry);
  const rows = verseNumbers.map((verseNumber) => ({
    user_id: userId,
    language_code: entry.language_code,
    version_code: mobileVersionCode,
    book_id: entry.book_id,
    chapter_number: entry.chapter,
    verse_number: verseNumber,
    created_at: entry.created_at,
  }));

  const { error } = await supabase.from('bible_user_bookmarks').upsert(rows, {
    onConflict: 'user_id,language_code,version_code,book_id,chapter_number,verse_number',
  });

  if (!error) return true;
  if (isCompatibilityError(error.message)) return false;
  console.error('Error upserting Bible bookmark to mobile schema:', error);
  return false;
}

async function upsertHighlightToMobileSchema(userId: string, entry: BibleHighlightEntry) {
  const verseNumbers = buildVerseNumbersInRange(entry.verse_start, entry.verse_end);
  const mobileVersionCode = toMobileVersionCode(entry);
  const rows = verseNumbers.map((verseNumber) => ({
    user_id: userId,
    language_code: entry.language_code,
    version_code: mobileVersionCode,
    book_id: entry.book_id,
    chapter_number: entry.chapter,
    verse_number: verseNumber,
    color: entry.color,
    created_at: entry.created_at,
  }));

  const { error } = await supabase.from('bible_user_highlights').upsert(rows, {
    onConflict: 'user_id,language_code,version_code,book_id,chapter_number,verse_number',
  });

  if (!error) return true;
  if (isCompatibilityError(error.message)) return false;
  console.error('Error upserting Bible highlight to mobile schema:', error);
  return false;
}

async function upsertNoteToMobileSchema(userId: string, entry: BibleNoteEntry) {
  const verseNumbers = buildVerseNumbersInRange(entry.verse_start, entry.verse_end);
  const mobileVersionCode = toMobileVersionCode(entry);
  const rows = verseNumbers.map((verseNumber) => ({
    user_id: userId,
    language_code: entry.language_code,
    version_code: mobileVersionCode,
    book_id: entry.book_id,
    chapter_number: entry.chapter,
    verse_number: verseNumber,
    note: entry.note,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  }));

  const { error } = await supabase.from('bible_user_notes').upsert(rows, {
    onConflict: 'user_id,language_code,version_code,book_id,chapter_number,verse_number',
  });

  if (!error) return true;
  if (isCompatibilityError(error.message)) return false;
  console.error('Error upserting Bible note to mobile schema:', error);
  return false;
}

async function removeEntryFromMobileSchema(params: {
  table: 'bible_user_bookmarks' | 'bible_user_highlights' | 'bible_user_notes';
  userId: string;
  entryId: string;
}) {
  const parsed = parseScopeAwareEntryId(params.entryId);
  if (!parsed) return false;
  const verseNumbers = buildVerseNumbersInRange(parsed.verse_start, parsed.verse_end);
  const versionCandidates = toMobileVersionCodeCandidates(parsed);
  const query = supabase
    .from(params.table)
    .delete()
    .eq('user_id', params.userId)
    .eq('language_code', parsed.language_code)
    .eq('book_id', parsed.book_id)
    .eq('chapter_number', parsed.chapter)
    .in('verse_number', verseNumbers);
  const { error } =
    versionCandidates.length > 1
      ? await query.in('version_code', versionCandidates)
      : await query.eq('version_code', versionCandidates[0]);

  if (!error) return true;
  if (isCompatibilityError(error.message)) return false;
  console.error(`Error removing ${params.table} entry from mobile schema:`, error);
  return false;
}

export async function upsertBibleBookmarkToCloud(userId: string, entry: BibleBookmarkEntry) {
  if (!userId.trim()) return false;

  const { error } = await supabase.from('bible_user_bookmarks').upsert(
    {
      user_id: userId,
      id: entry.id,
      book_id: entry.book_id,
      chapter: entry.chapter,
      verse_start: entry.verse_start,
      verse_end: entry.verse_end,
      language_code: entry.language_code,
      version_code: entry.version_code,
      reference_label: entry.reference_label,
      excerpt: entry.excerpt,
      created_at: entry.created_at,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,id' }
  );

  if (!error) return true;
  if (isCompatibilityError(error.message)) {
    return upsertBookmarkToMobileSchema(userId, entry);
  }
  console.error('Error upserting Bible bookmark to cloud:', error);
  return false;
}

export async function removeBibleBookmarkFromCloud(userId: string, bookmarkId: string) {
  if (!userId.trim() || !bookmarkId.trim()) return false;
  const { error } = await supabase
    .from('bible_user_bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('id', bookmarkId);

  if (!error) return true;
  if (isCompatibilityError(error.message)) {
    return removeEntryFromMobileSchema({
      table: 'bible_user_bookmarks',
      userId,
      entryId: bookmarkId,
    });
  }
  console.error('Error removing Bible bookmark from cloud:', error);
  return false;
}

export async function upsertBibleHighlightToCloud(userId: string, entry: BibleHighlightEntry) {
  if (!userId.trim()) return false;

  const { error } = await supabase.from('bible_user_highlights').upsert(
    {
      user_id: userId,
      id: entry.id,
      book_id: entry.book_id,
      chapter: entry.chapter,
      verse_start: entry.verse_start,
      verse_end: entry.verse_end,
      language_code: entry.language_code,
      version_code: entry.version_code,
      color: entry.color,
      reference_label: entry.reference_label,
      excerpt: entry.excerpt,
      created_at: entry.created_at,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,id' }
  );

  if (!error) return true;
  if (isCompatibilityError(error.message)) {
    return upsertHighlightToMobileSchema(userId, entry);
  }
  console.error('Error upserting Bible highlight to cloud:', error);
  return false;
}

export async function removeBibleHighlightFromCloud(userId: string, highlightId: string) {
  if (!userId.trim() || !highlightId.trim()) return false;
  const { error } = await supabase
    .from('bible_user_highlights')
    .delete()
    .eq('user_id', userId)
    .eq('id', highlightId);

  if (!error) return true;
  if (isCompatibilityError(error.message)) {
    return removeEntryFromMobileSchema({
      table: 'bible_user_highlights',
      userId,
      entryId: highlightId,
    });
  }
  console.error('Error removing Bible highlight from cloud:', error);
  return false;
}

export async function upsertBibleNoteToCloud(userId: string, entry: BibleNoteEntry) {
  if (!userId.trim()) return false;

  const { error } = await supabase.from('bible_user_notes').upsert(
    {
      user_id: userId,
      id: entry.id,
      book_id: entry.book_id,
      chapter: entry.chapter,
      verse_start: entry.verse_start,
      verse_end: entry.verse_end,
      language_code: entry.language_code,
      version_code: entry.version_code,
      reference_label: entry.reference_label,
      excerpt: entry.excerpt,
      note: entry.note,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    },
    { onConflict: 'user_id,id' }
  );

  if (!error) return true;
  if (isCompatibilityError(error.message)) {
    return upsertNoteToMobileSchema(userId, entry);
  }
  console.error('Error upserting Bible note to cloud:', error);
  return false;
}

export async function removeBibleNoteFromCloud(userId: string, noteId: string) {
  if (!userId.trim() || !noteId.trim()) return false;
  const { error } = await supabase
    .from('bible_user_notes')
    .delete()
    .eq('user_id', userId)
    .eq('id', noteId);

  if (!error) return true;
  if (isCompatibilityError(error.message)) {
    return removeEntryFromMobileSchema({
      table: 'bible_user_notes',
      userId,
      entryId: noteId,
    });
  }
  console.error('Error removing Bible note from cloud:', error);
  return false;
}

export async function upsertBiblePlanProgressToCloud(
  userId: string,
  planId: string,
  progress: BiblePlanProgress
) {
  if (!userId.trim() || !planId.trim()) return false;

  const { error } = await supabase.from('bible_user_plan_progress').upsert(
    {
      user_id: userId,
      plan_id: planId,
      completed_dates: progress.completed_dates,
      last_completed_at: progress.last_completed_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,plan_id' }
  );

  if (!error) return true;
  if (isCompatibilityError(error.message)) return false;
  console.error('Error upserting Bible plan progress to cloud:', error);
  return false;
}

export async function syncBiblePersonalStoreToCloud(userId: string, store: BiblePersonalStore) {
  if (!userId.trim()) return false;

  const nowIso = new Date().toISOString();
  const bookmarkRows = store.bookmarks.map((entry) => ({
    user_id: userId,
    id: entry.id,
    book_id: entry.book_id,
    chapter: entry.chapter,
    verse_start: entry.verse_start,
    verse_end: entry.verse_end,
    language_code: entry.language_code,
    version_code: entry.version_code,
    reference_label: entry.reference_label,
    excerpt: entry.excerpt,
    created_at: entry.created_at,
    updated_at: nowIso,
  }));

  const highlightRows = store.highlights.map((entry) => ({
    user_id: userId,
    id: entry.id,
    book_id: entry.book_id,
    chapter: entry.chapter,
    verse_start: entry.verse_start,
    verse_end: entry.verse_end,
    language_code: entry.language_code,
    version_code: entry.version_code,
    color: entry.color,
    reference_label: entry.reference_label,
    excerpt: entry.excerpt,
    created_at: entry.created_at,
    updated_at: nowIso,
  }));

  const noteRows = store.notes.map((entry) => ({
    user_id: userId,
    id: entry.id,
    book_id: entry.book_id,
    chapter: entry.chapter,
    verse_start: entry.verse_start,
    verse_end: entry.verse_end,
    language_code: entry.language_code,
    version_code: entry.version_code,
    reference_label: entry.reference_label,
    excerpt: entry.excerpt,
    note: entry.note,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  }));

  const planRows = Object.entries(store.plan_progress).map(([planId, progress]) => ({
    user_id: userId,
    plan_id: planId,
    completed_dates: progress.completed_dates,
    last_completed_at: progress.last_completed_at || nowIso,
    updated_at: nowIso,
  }));

  const [bookmarkRes, highlightRes, noteRes, planRes] = await Promise.all([
    bookmarkRows.length
      ? supabase.from('bible_user_bookmarks').upsert(bookmarkRows, { onConflict: 'user_id,id' })
      : Promise.resolve({ error: null }),
    highlightRows.length
      ? supabase.from('bible_user_highlights').upsert(highlightRows, { onConflict: 'user_id,id' })
      : Promise.resolve({ error: null }),
    noteRows.length
      ? supabase.from('bible_user_notes').upsert(noteRows, { onConflict: 'user_id,id' })
      : Promise.resolve({ error: null }),
    planRows.length
      ? supabase.from('bible_user_plan_progress').upsert(planRows, { onConflict: 'user_id,plan_id' })
      : Promise.resolve({ error: null }),
  ]);

  const errors = [bookmarkRes.error, highlightRes.error, noteRes.error, planRes.error].filter(Boolean);
  if (errors.length > 0) {
    const incompatible = errors.some((error) => isCompatibilityError(error?.message ?? ''));
    if (incompatible) {
      const [bookmarkFallbackOk, highlightFallbackOk, noteFallbackOk] = await Promise.all([
        Promise.all(store.bookmarks.map((entry) => upsertBibleBookmarkToCloud(userId, entry))).then((results) =>
          results.every(Boolean)
        ),
        Promise.all(store.highlights.map((entry) => upsertBibleHighlightToCloud(userId, entry))).then(
          (results) => results.every(Boolean)
        ),
        Promise.all(store.notes.map((entry) => upsertBibleNoteToCloud(userId, entry))).then((results) =>
          results.every(Boolean)
        ),
      ]);

      const planFallbackOk = !planRes.error || isCompatibilityError(planRes.error.message ?? '');
      return bookmarkFallbackOk && highlightFallbackOk && noteFallbackOk && planFallbackOk;
    }

    console.error('Error syncing Bible personal store to cloud:', errors);
    return false;
  }

  const [bookmarkDeleteRes, highlightDeleteRes, noteDeleteRes, planDeleteRes] = await Promise.all([
    deleteMissingRowsById({
      table: 'bible_user_bookmarks',
      userId,
      idColumn: 'id',
      localIds: store.bookmarks.map((entry) => entry.id),
    }),
    deleteMissingRowsById({
      table: 'bible_user_highlights',
      userId,
      idColumn: 'id',
      localIds: store.highlights.map((entry) => entry.id),
    }),
    deleteMissingRowsById({
      table: 'bible_user_notes',
      userId,
      idColumn: 'id',
      localIds: store.notes.map((entry) => entry.id),
    }),
    deleteMissingRowsById({
      table: 'bible_user_plan_progress',
      userId,
      idColumn: 'plan_id',
      localIds: Object.keys(store.plan_progress),
    }),
  ]);

  const deleteResults = [bookmarkDeleteRes, highlightDeleteRes, noteDeleteRes, planDeleteRes];
  if (deleteResults.every((result) => result.ok)) return true;
  if (deleteResults.some((result) => result.incompatible)) return false;
  return false;
}
