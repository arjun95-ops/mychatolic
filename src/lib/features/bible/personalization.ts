export interface BibleAnnotationScope {
  language_code: 'id' | 'en';
  version_code: string;
}

export interface BibleBookmarkEntry extends BibleAnnotationScope {
  id: string;
  book_id: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  reference_label: string;
  excerpt: string;
  created_at: string;
}

export interface BibleHighlightEntry extends BibleAnnotationScope {
  id: string;
  book_id: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  color: string;
  reference_label: string;
  excerpt: string;
  created_at: string;
}

export interface BibleNoteEntry extends BibleAnnotationScope {
  id: string;
  book_id: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  reference_label: string;
  excerpt: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface BiblePlanProgress {
  completed_dates: string[];
  last_completed_at?: string;
}

export interface BiblePersonalStore {
  bookmarks: BibleBookmarkEntry[];
  highlights: BibleHighlightEntry[];
  notes: BibleNoteEntry[];
  plan_progress: Record<string, BiblePlanProgress>;
}

type RawScope = {
  language_code?: unknown;
  version_code?: unknown;
};

const STORAGE_KEY = 'mychatolic:bible:personal:v2';
const LEGACY_STORAGE_KEY = 'mychatolic:bible:personal:v1';
const OWNER_STORAGE_KEY = 'mychatolic:bible:personal:owner:v1';

function hasWindow() {
  return typeof window !== 'undefined';
}

function normalizeOwnerId(value: unknown): string | null {
  const normalized = value?.toString().trim();
  return normalized || null;
}

function normalizeScopeLanguageCode(value: unknown): 'id' | 'en' {
  return value?.toString().trim().toLowerCase() === 'en' ? 'en' : 'id';
}

function normalizeVersionCode(value: unknown): string {
  return value?.toString().trim().toUpperCase() || '';
}

function normalizeRequestedVersionByLanguage(
  languageCode: 'id' | 'en',
  requestedVersion: unknown
) {
  const normalized = normalizeVersionCode(requestedVersion);
  if (languageCode === 'id') {
    if (normalized === 'TB2') return 'TB2';
    return 'TB1';
  }
  return 'EN1';
}

export function resolveBibleAnnotationScope(rawScope: RawScope): BibleAnnotationScope {
  const language_code = normalizeScopeLanguageCode(rawScope.language_code);
  const version_code = normalizeRequestedVersionByLanguage(language_code, rawScope.version_code);
  return {
    language_code,
    version_code,
  };
}

function normalizeBibleAnnotationScope<T extends RawScope>(entry: T): T & BibleAnnotationScope {
  return {
    ...entry,
    ...resolveBibleAnnotationScope(entry),
  };
}

function hasSameBibleAnnotationScope(entry: RawScope, scope: BibleAnnotationScope) {
  const normalized = resolveBibleAnnotationScope(entry);
  return (
    normalized.language_code === scope.language_code &&
    normalized.version_code === scope.version_code
  );
}

function hasSameVerseRange(
  entry: {
    book_id: string;
    chapter: number;
    verse_start: number;
    verse_end: number;
  },
  target: {
    book_id: string;
    chapter: number;
    verse_start: number;
    verse_end: number;
  }
) {
  return (
    entry.book_id === target.book_id &&
    entry.chapter === target.chapter &&
    entry.verse_start === target.verse_start &&
    entry.verse_end === target.verse_end
  );
}

export function buildBiblePersonalEntryId(params: {
  book_id: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  language_code: unknown;
  version_code: unknown;
}) {
  const scope = resolveBibleAnnotationScope(params);
  return [
    scope.language_code,
    scope.version_code,
    params.book_id,
    params.chapter,
    params.verse_start,
    params.verse_end,
  ].join(':');
}

export function createEmptyBiblePersonalStore(): BiblePersonalStore {
  return {
    bookmarks: [],
    highlights: [],
    notes: [],
    plan_progress: {},
  };
}

function safeDateIso(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getBibleLocalDateKey(value?: string | Date) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return toLocalDateKey(new Date());
  }
  return toLocalDateKey(date);
}

function sortByDateDesc<T extends { created_at?: string; updated_at?: string }>(items: T[]) {
  return [...items].sort((a, b) => {
    const aDate = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const bDate = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return bDate - aDate;
  });
}

function dedupeById<T extends { id: string; created_at?: string; updated_at?: string }>(
  primary: T[],
  secondary: T[]
) {
  const merged = [...primary, ...secondary];
  const byId = new Map<string, T>();

  for (const item of merged) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }

    const existingDate = new Date(existing.updated_at ?? existing.created_at ?? 0).getTime();
    const itemDate = new Date(item.updated_at ?? item.created_at ?? 0).getTime();
    if (itemDate >= existingDate) {
      byId.set(item.id, item);
    }
  }

  return sortByDateDesc(Array.from(byId.values()));
}

function normalizeBookmarkEntry(raw: unknown): BibleBookmarkEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;

  const verseStart = Number(row.verse_start ?? 0);
  const verseEnd = Number(row.verse_end ?? verseStart);
  const chapter = Number(row.chapter ?? 0);
  const bookId = row.book_id?.toString().trim() || '';
  if (!bookId || chapter <= 0 || verseStart <= 0 || verseEnd <= 0) return null;

  const scope = resolveBibleAnnotationScope(row);
  const id =
    row.id?.toString().trim() ||
    buildBiblePersonalEntryId({
      ...scope,
      book_id: bookId,
      chapter,
      verse_start: verseStart,
      verse_end: verseEnd,
    });

  return {
    id,
    ...scope,
    book_id: bookId,
    chapter,
    verse_start: verseStart,
    verse_end: verseEnd,
    reference_label: row.reference_label?.toString() || '',
    excerpt: row.excerpt?.toString() || '',
    created_at: safeDateIso(row.created_at?.toString()),
  };
}

function normalizeHighlightEntry(raw: unknown): BibleHighlightEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;

  const verseStart = Number(row.verse_start ?? 0);
  const verseEnd = Number(row.verse_end ?? verseStart);
  const chapter = Number(row.chapter ?? 0);
  const bookId = row.book_id?.toString().trim() || '';
  if (!bookId || chapter <= 0 || verseStart <= 0 || verseEnd <= 0) return null;

  const scope = resolveBibleAnnotationScope(row);
  const id =
    row.id?.toString().trim() ||
    buildBiblePersonalEntryId({
      ...scope,
      book_id: bookId,
      chapter,
      verse_start: verseStart,
      verse_end: verseEnd,
    });

  return {
    id,
    ...scope,
    book_id: bookId,
    chapter,
    verse_start: verseStart,
    verse_end: verseEnd,
    color: row.color?.toString().trim() || '#FDE68A',
    reference_label: row.reference_label?.toString() || '',
    excerpt: row.excerpt?.toString() || '',
    created_at: safeDateIso(row.created_at?.toString()),
  };
}

function normalizeNoteEntry(raw: unknown): BibleNoteEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;

  const verseStart = Number(row.verse_start ?? 0);
  const verseEnd = Number(row.verse_end ?? verseStart);
  const chapter = Number(row.chapter ?? 0);
  const bookId = row.book_id?.toString().trim() || '';
  if (!bookId || chapter <= 0 || verseStart <= 0 || verseEnd <= 0) return null;

  const scope = resolveBibleAnnotationScope(row);
  const id =
    row.id?.toString().trim() ||
    buildBiblePersonalEntryId({
      ...scope,
      book_id: bookId,
      chapter,
      verse_start: verseStart,
      verse_end: verseEnd,
    });

  return {
    id,
    ...scope,
    book_id: bookId,
    chapter,
    verse_start: verseStart,
    verse_end: verseEnd,
    reference_label: row.reference_label?.toString() || '',
    excerpt: row.excerpt?.toString() || '',
    note: row.note?.toString() || '',
    created_at: safeDateIso(row.created_at?.toString()),
    updated_at: safeDateIso(row.updated_at?.toString()),
  };
}

function parseStore(rawValue: string | null): BiblePersonalStore {
  if (!rawValue) return createEmptyBiblePersonalStore();

  const parsed = JSON.parse(rawValue) as Partial<BiblePersonalStore>;
  const bookmarks = Array.isArray(parsed.bookmarks)
    ? parsed.bookmarks
        .map(normalizeBookmarkEntry)
        .filter((entry): entry is BibleBookmarkEntry => Boolean(entry))
    : [];
  const highlights = Array.isArray(parsed.highlights)
    ? parsed.highlights
        .map(normalizeHighlightEntry)
        .filter((entry): entry is BibleHighlightEntry => Boolean(entry))
    : [];
  const notes = Array.isArray(parsed.notes)
    ? parsed.notes
        .map(normalizeNoteEntry)
        .filter((entry): entry is BibleNoteEntry => Boolean(entry))
    : [];

  return {
    bookmarks,
    highlights,
    notes,
    plan_progress:
      parsed.plan_progress && typeof parsed.plan_progress === 'object'
        ? parsed.plan_progress
        : {},
  };
}

export function loadBiblePersonalStore(): BiblePersonalStore {
  if (!hasWindow()) return createEmptyBiblePersonalStore();

  try {
    const current = parseStore(window.localStorage.getItem(STORAGE_KEY));
    if (
      current.bookmarks.length > 0 ||
      current.highlights.length > 0 ||
      current.notes.length > 0 ||
      Object.keys(current.plan_progress).length > 0
    ) {
      return current;
    }

    const legacy = parseStore(window.localStorage.getItem(LEGACY_STORAGE_KEY));
    if (
      legacy.bookmarks.length > 0 ||
      legacy.highlights.length > 0 ||
      legacy.notes.length > 0 ||
      Object.keys(legacy.plan_progress).length > 0
    ) {
      saveBiblePersonalStore(legacy);
      return legacy;
    }

    return createEmptyBiblePersonalStore();
  } catch {
    return createEmptyBiblePersonalStore();
  }
}

export function getBiblePersonalStoreOwnerId() {
  if (!hasWindow()) return null;
  try {
    return normalizeOwnerId(window.localStorage.getItem(OWNER_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function setBiblePersonalStoreOwnerId(userId: string | null | undefined) {
  if (!hasWindow()) return;
  const normalized = normalizeOwnerId(userId);
  if (!normalized) {
    window.localStorage.removeItem(OWNER_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(OWNER_STORAGE_KEY, normalized);
}

export function saveBiblePersonalStore(store: BiblePersonalStore) {
  if (!hasWindow()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function mergeBiblePersonalStore(
  localStore: BiblePersonalStore,
  cloudStore: BiblePersonalStore
): BiblePersonalStore {
  const mergedPlanProgress: Record<string, BiblePlanProgress> = {
    ...cloudStore.plan_progress,
    ...localStore.plan_progress,
  };

  for (const [planId, cloudPlan] of Object.entries(cloudStore.plan_progress)) {
    const localPlan = localStore.plan_progress[planId];
    if (!localPlan) {
      mergedPlanProgress[planId] = cloudPlan;
      continue;
    }

    const mergedDates = new Set([...cloudPlan.completed_dates, ...localPlan.completed_dates]);
    const cloudLast = cloudPlan.last_completed_at ? new Date(cloudPlan.last_completed_at).getTime() : 0;
    const localLast = localPlan.last_completed_at ? new Date(localPlan.last_completed_at).getTime() : 0;

    mergedPlanProgress[planId] = {
      completed_dates: [...mergedDates].sort((a, b) => a.localeCompare(b)),
      last_completed_at:
        cloudLast >= localLast ? cloudPlan.last_completed_at : localPlan.last_completed_at,
    };
  }

  return {
    bookmarks: dedupeById(localStore.bookmarks, cloudStore.bookmarks),
    highlights: dedupeById(localStore.highlights, cloudStore.highlights),
    notes: dedupeById(localStore.notes, cloudStore.notes),
    plan_progress: mergedPlanProgress,
  };
}

function mutateStore(mutator: (store: BiblePersonalStore) => void): BiblePersonalStore {
  const store = loadBiblePersonalStore();
  mutator(store);
  saveBiblePersonalStore(store);
  return store;
}

export function toggleBibleBookmark(payload: {
  book_id: string;
  chapter: number;
  verse_start: number;
  verse_end?: number;
  reference_label: string;
  excerpt: string;
  language_code: unknown;
  version_code: unknown;
}) {
  const verseEnd = payload.verse_end ?? payload.verse_start;
  const scope = resolveBibleAnnotationScope(payload);
  const id = buildBiblePersonalEntryId({
    ...scope,
    book_id: payload.book_id,
    chapter: payload.chapter,
    verse_start: payload.verse_start,
    verse_end: verseEnd,
  });

  let bookmarked = false;
  const store = mutateStore((draft) => {
    const index = draft.bookmarks.findIndex((entry) => {
      if (entry.id === id) return true;
      return (
        hasSameBibleAnnotationScope(entry, scope) &&
        hasSameVerseRange(entry, {
          book_id: payload.book_id,
          chapter: payload.chapter,
          verse_start: payload.verse_start,
          verse_end: verseEnd,
        })
      );
    });
    if (index >= 0) {
      draft.bookmarks.splice(index, 1);
      bookmarked = false;
      return;
    }

    draft.bookmarks.unshift({
      id,
      ...scope,
      book_id: payload.book_id,
      chapter: payload.chapter,
      verse_start: payload.verse_start,
      verse_end: verseEnd,
      reference_label: payload.reference_label,
      excerpt: payload.excerpt,
      created_at: safeDateIso(),
    });
    bookmarked = true;
  });

  return { store, bookmarked };
}

export function upsertBibleBookmark(payload: {
  book_id: string;
  chapter: number;
  verse_start: number;
  verse_end?: number;
  reference_label: string;
  excerpt: string;
  language_code: unknown;
  version_code: unknown;
}) {
  const verseEnd = payload.verse_end ?? payload.verse_start;
  const scope = resolveBibleAnnotationScope(payload);
  const id = buildBiblePersonalEntryId({
    ...scope,
    book_id: payload.book_id,
    chapter: payload.chapter,
    verse_start: payload.verse_start,
    verse_end: verseEnd,
  });

  return mutateStore((draft) => {
    const entry: BibleBookmarkEntry = {
      id,
      ...scope,
      book_id: payload.book_id,
      chapter: payload.chapter,
      verse_start: payload.verse_start,
      verse_end: verseEnd,
      reference_label: payload.reference_label,
      excerpt: payload.excerpt,
      created_at: safeDateIso(),
    };

    const index = draft.bookmarks.findIndex((item) => {
      if (item.id === id) return true;
      return (
        hasSameBibleAnnotationScope(item, scope) &&
        hasSameVerseRange(item, {
          book_id: payload.book_id,
          chapter: payload.chapter,
          verse_start: payload.verse_start,
          verse_end: verseEnd,
        })
      );
    });
    if (index >= 0) {
      draft.bookmarks[index] = {
        ...normalizeBibleAnnotationScope(draft.bookmarks[index]),
        ...entry,
        created_at: draft.bookmarks[index].created_at,
      };
      return;
    }
    draft.bookmarks.unshift(entry);
  });
}

export function removeBibleBookmark(payload: {
  book_id: string;
  chapter: number;
  verse_start: number;
  verse_end?: number;
  language_code: unknown;
  version_code: unknown;
}) {
  const verseEnd = payload.verse_end ?? payload.verse_start;
  const scope = resolveBibleAnnotationScope(payload);
  const id = buildBiblePersonalEntryId({
    ...scope,
    book_id: payload.book_id,
    chapter: payload.chapter,
    verse_start: payload.verse_start,
    verse_end: verseEnd,
  });

  return mutateStore((draft) => {
    draft.bookmarks = draft.bookmarks.filter((entry) => {
      if (entry.id === id) return false;
      if (!hasSameBibleAnnotationScope(entry, scope)) return true;
      return !hasSameVerseRange(entry, {
        book_id: payload.book_id,
        chapter: payload.chapter,
        verse_start: payload.verse_start,
        verse_end: verseEnd,
      });
    });
  });
}

export function upsertBibleHighlight(payload: {
  book_id: string;
  chapter: number;
  verse_start: number;
  verse_end?: number;
  color: string;
  reference_label: string;
  excerpt: string;
  language_code: unknown;
  version_code: unknown;
}) {
  const verseEnd = payload.verse_end ?? payload.verse_start;
  const scope = resolveBibleAnnotationScope(payload);
  const id = buildBiblePersonalEntryId({
    ...scope,
    book_id: payload.book_id,
    chapter: payload.chapter,
    verse_start: payload.verse_start,
    verse_end: verseEnd,
  });

  return mutateStore((draft) => {
    const nextEntry: BibleHighlightEntry = {
      id,
      ...scope,
      book_id: payload.book_id,
      chapter: payload.chapter,
      verse_start: payload.verse_start,
      verse_end: verseEnd,
      color: payload.color,
      reference_label: payload.reference_label,
      excerpt: payload.excerpt,
      created_at: safeDateIso(),
    };

    const index = draft.highlights.findIndex((entry) => {
      if (entry.id === id) return true;
      return (
        hasSameBibleAnnotationScope(entry, scope) &&
        hasSameVerseRange(entry, {
          book_id: payload.book_id,
          chapter: payload.chapter,
          verse_start: payload.verse_start,
          verse_end: verseEnd,
        })
      );
    });
    if (index >= 0) {
      draft.highlights[index] = {
        ...normalizeBibleAnnotationScope(draft.highlights[index]),
        ...nextEntry,
        created_at: draft.highlights[index].created_at,
      };
      return;
    }
    draft.highlights.unshift(nextEntry);
  });
}

export function removeBibleHighlight(payload: {
  book_id: string;
  chapter: number;
  verse_start: number;
  verse_end?: number;
  language_code: unknown;
  version_code: unknown;
}) {
  const verseEnd = payload.verse_end ?? payload.verse_start;
  const scope = resolveBibleAnnotationScope(payload);
  const id = buildBiblePersonalEntryId({
    ...scope,
    book_id: payload.book_id,
    chapter: payload.chapter,
    verse_start: payload.verse_start,
    verse_end: verseEnd,
  });

  return mutateStore((draft) => {
    draft.highlights = draft.highlights.filter((entry) => {
      if (entry.id === id) return false;
      if (!hasSameBibleAnnotationScope(entry, scope)) return true;
      return !hasSameVerseRange(entry, {
        book_id: payload.book_id,
        chapter: payload.chapter,
        verse_start: payload.verse_start,
        verse_end: verseEnd,
      });
    });
  });
}

export function upsertBibleNote(payload: {
  book_id: string;
  chapter: number;
  verse_start: number;
  verse_end?: number;
  reference_label: string;
  excerpt: string;
  note: string;
  language_code: unknown;
  version_code: unknown;
}) {
  const verseEnd = payload.verse_end ?? payload.verse_start;
  const scope = resolveBibleAnnotationScope(payload);
  const id = buildBiblePersonalEntryId({
    ...scope,
    book_id: payload.book_id,
    chapter: payload.chapter,
    verse_start: payload.verse_start,
    verse_end: verseEnd,
  });
  const nowIso = safeDateIso();

  return mutateStore((draft) => {
    const nextEntry: BibleNoteEntry = {
      id,
      ...scope,
      book_id: payload.book_id,
      chapter: payload.chapter,
      verse_start: payload.verse_start,
      verse_end: verseEnd,
      reference_label: payload.reference_label,
      excerpt: payload.excerpt,
      note: payload.note.trim(),
      created_at: nowIso,
      updated_at: nowIso,
    };

    const index = draft.notes.findIndex((entry) => {
      if (entry.id === id) return true;
      return (
        hasSameBibleAnnotationScope(entry, scope) &&
        hasSameVerseRange(entry, {
          book_id: payload.book_id,
          chapter: payload.chapter,
          verse_start: payload.verse_start,
          verse_end: verseEnd,
        })
      );
    });
    if (index >= 0) {
      draft.notes[index] = {
        ...normalizeBibleAnnotationScope(draft.notes[index]),
        ...nextEntry,
        created_at: draft.notes[index].created_at,
      };
      return;
    }

    draft.notes.unshift(nextEntry);
  });
}

export function removeBibleNote(payload: {
  book_id: string;
  chapter: number;
  verse_start: number;
  verse_end?: number;
  language_code: unknown;
  version_code: unknown;
}) {
  const verseEnd = payload.verse_end ?? payload.verse_start;
  const scope = resolveBibleAnnotationScope(payload);
  const id = buildBiblePersonalEntryId({
    ...scope,
    book_id: payload.book_id,
    chapter: payload.chapter,
    verse_start: payload.verse_start,
    verse_end: verseEnd,
  });

  return mutateStore((draft) => {
    draft.notes = draft.notes.filter((entry) => {
      if (entry.id === id) return false;
      if (!hasSameBibleAnnotationScope(entry, scope)) return true;
      return !hasSameVerseRange(entry, {
        book_id: payload.book_id,
        chapter: payload.chapter,
        verse_start: payload.verse_start,
        verse_end: verseEnd,
      });
    });
  });
}

export function markBiblePlanDayCompleted(planId: string, dateIso?: string) {
  const dateKey = getBibleLocalDateKey(dateIso);
  return mutateStore((draft) => {
    const current = draft.plan_progress[planId] ?? { completed_dates: [] };
    const completedDates = new Set(current.completed_dates);
    completedDates.add(dateKey);

    draft.plan_progress[planId] = {
      completed_dates: [...completedDates].sort((a, b) => a.localeCompare(b)),
      last_completed_at: safeDateIso(),
    };
  });
}
