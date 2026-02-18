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
