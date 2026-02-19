'use client';

import { useQuery } from '@tanstack/react-query';
import { BibleService } from './bible-service';

export function useBibleBooks() {
  return useQuery({
    queryKey: ['bible-books'],
    queryFn: BibleService.getBooks,
  });
}

export function useBibleChapters(bookId?: string) {
  return useQuery({
    queryKey: ['bible-chapters', bookId],
    queryFn: () => BibleService.getChapters(bookId || ''),
    enabled: Boolean(bookId),
  });
}

export function useBibleVerses(bookId?: string, chapter?: number) {
  return useQuery({
    queryKey: ['bible-verses', bookId, chapter],
    queryFn: () => BibleService.getVerses(bookId || '', chapter || 0),
    enabled: Boolean(bookId) && Boolean(chapter && chapter > 0),
  });
}

export function useBibleVerseSearch(params: {
  query: string;
  languageCode?: string;
  versionCode?: string;
  limit?: number;
  enabled?: boolean;
}) {
  const normalizedQuery = params.query.trim();
  const isEnabled = (params.enabled ?? true) && normalizedQuery.length >= 3;

  return useQuery({
    queryKey: [
      'bible-verse-search',
      normalizedQuery,
      params.languageCode,
      params.versionCode,
      params.limit,
    ],
    queryFn: () =>
      BibleService.searchVerses({
        query: normalizedQuery,
        languageCode: params.languageCode,
        versionCode: params.versionCode,
        limit: params.limit,
      }),
    enabled: isEnabled,
  });
}
