'use client';

import { useMemo, useState } from 'react';
import { BookOpen, BookText, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useBibleBooks, useBibleChapters, useBibleVerses } from '@/lib/features/bible/use-bible';
import type { BibleBook, BibleVerse } from '@/lib/types';

function fallbackChapterList(book?: BibleBook | null) {
  const total = Number(book?.total_chapters ?? 0);
  if (!Number.isFinite(total) || total <= 0) {
    return [1];
  }
  return Array.from({ length: total }, (_, index) => index + 1);
}

export default function BiblePage() {
  const [keyword, setKeyword] = useState('');
  const [activeTestament, setActiveTestament] = useState<BibleBook['testament']>('old');
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [selectedChapter, setSelectedChapter] = useState<number>(1);

  const { data: books = [], isLoading: isLoadingBooks } = useBibleBooks();

  const filteredBooks = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return books;
    return books.filter((book) => {
      return (
        book.name.toLowerCase().includes(query) ||
        book.abbreviation.toLowerCase().includes(query)
      );
    });
  }, [books, keyword]);

  const testamentBooks = useMemo(
    () => filteredBooks.filter((book) => book.testament === activeTestament),
    [activeTestament, filteredBooks]
  );

  const selectedBook = useMemo(
    () => testamentBooks.find((book) => book.id === selectedBookId) || testamentBooks[0] || null,
    [selectedBookId, testamentBooks]
  );

  const { data: chapters = [], isLoading: isLoadingChapters } = useBibleChapters(selectedBook?.id);

  const availableChapters = useMemo(() => {
    if (chapters.length > 0) {
      return chapters;
    }
    return fallbackChapterList(selectedBook);
  }, [chapters, selectedBook]);

  const effectiveSelectedChapter = useMemo(() => {
    if (availableChapters.length === 0) {
      return 1;
    }

    if (availableChapters.includes(selectedChapter)) {
      return selectedChapter;
    }

    return availableChapters[0];
  }, [availableChapters, selectedChapter]);

  const { data: verses = [], isLoading: isLoadingVerses } = useBibleVerses(
    selectedBook?.id,
    effectiveSelectedChapter
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Alkitab</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari kitab..."
          className="pl-10"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </div>

      <Tabs
        value={activeTestament}
        onValueChange={(value) => setActiveTestament(value as BibleBook['testament'])}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="old">PL</TabsTrigger>
          <TabsTrigger value="new">PB</TabsTrigger>
          <TabsTrigger value="deutero">Deutero</TabsTrigger>
        </TabsList>

        <TabsContent value="old" className="mt-4">
          <BibleContent
            books={testamentBooks}
            isLoadingBooks={isLoadingBooks}
            selectedBookId={selectedBookId}
            onSelectBook={(book) => {
              setSelectedBookId(book.id);
              setSelectedChapter(1);
            }}
            selectedBook={selectedBook}
            selectedChapter={effectiveSelectedChapter}
            onSelectChapter={setSelectedChapter}
            availableChapters={availableChapters}
            verses={verses}
            isLoadingChapters={isLoadingChapters}
            isLoadingVerses={isLoadingVerses}
          />
        </TabsContent>

        <TabsContent value="new" className="mt-4">
          <BibleContent
            books={testamentBooks}
            isLoadingBooks={isLoadingBooks}
            selectedBookId={selectedBookId}
            onSelectBook={(book) => {
              setSelectedBookId(book.id);
              setSelectedChapter(1);
            }}
            selectedBook={selectedBook}
            selectedChapter={effectiveSelectedChapter}
            onSelectChapter={setSelectedChapter}
            availableChapters={availableChapters}
            verses={verses}
            isLoadingChapters={isLoadingChapters}
            isLoadingVerses={isLoadingVerses}
          />
        </TabsContent>

        <TabsContent value="deutero" className="mt-4">
          <BibleContent
            books={testamentBooks}
            isLoadingBooks={isLoadingBooks}
            selectedBookId={selectedBookId}
            onSelectBook={(book) => {
              setSelectedBookId(book.id);
              setSelectedChapter(1);
            }}
            selectedBook={selectedBook}
            selectedChapter={effectiveSelectedChapter}
            onSelectChapter={setSelectedChapter}
            availableChapters={availableChapters}
            verses={verses}
            isLoadingChapters={isLoadingChapters}
            isLoadingVerses={isLoadingVerses}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BibleContent({
  books,
  isLoadingBooks,
  selectedBookId,
  onSelectBook,
  selectedBook,
  selectedChapter,
  onSelectChapter,
  availableChapters,
  verses,
  isLoadingChapters,
  isLoadingVerses,
}: {
  books: BibleBook[];
  isLoadingBooks: boolean;
  selectedBookId: string;
  onSelectBook: (book: BibleBook) => void;
  selectedBook: BibleBook | null;
  selectedChapter: number;
  onSelectChapter: (chapter: number) => void;
  availableChapters: number[];
  verses: BibleVerse[];
  isLoadingChapters: boolean;
  isLoadingVerses: boolean;
}) {
  const chapterIndex = availableChapters.indexOf(selectedChapter);
  const canGoPrevious = chapterIndex > 0;
  const canGoNext = chapterIndex >= 0 && chapterIndex < availableChapters.length - 1;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <Card className="border-border/70 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Daftar Kitab</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingBooks ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
              Memuat daftar kitab...
            </div>
          ) : books.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <BookText className="mx-auto mb-2 h-8 w-8" />
              Tidak ada kitab yang cocok.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
              {books.map((book) => {
                const selected = selectedBookId === book.id;
                return (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => onSelectBook(book)}
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'border-border/70 bg-card hover:bg-muted/40'
                    }`}
                  >
                    <p className="line-clamp-1 text-sm font-semibold">{book.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{book.total_chapters} bab</p>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card shadow-sm">
        <CardHeader className="space-y-3">
          {selectedBook ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">{selectedBook.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => canGoPrevious && onSelectChapter(availableChapters[chapterIndex - 1])}
                    disabled={!canGoPrevious || isLoadingChapters}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <select
                    value={selectedChapter}
                    onChange={(event) => onSelectChapter(Number(event.target.value))}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
                    className="h-8 w-8"
                    onClick={() => canGoNext && onSelectChapter(availableChapters[chapterIndex + 1])}
                    disabled={!canGoNext || isLoadingChapters}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Reader sinkron dengan data `bible_books`, `bible_chapters`, dan `bible_verses`.
              </p>
            </>
          ) : (
            <CardTitle className="text-base">Pilih kitab untuk mulai membaca</CardTitle>
          )}
        </CardHeader>

        <CardContent>
          {!selectedBook ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <BookOpen className="mx-auto mb-3 h-10 w-10" />
              Pilih kitab dari daftar di sebelah kiri.
            </div>
          ) : isLoadingVerses ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
              Memuat ayat...
            </div>
          ) : verses.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <BookText className="mx-auto mb-2 h-8 w-8" />
              Belum ada ayat untuk kitab/bab ini.
            </div>
          ) : (
            <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
              {verses.map((verse, index) => (
                <VerseLine
                  key={`${verse.verse_number}-${index}`}
                  verse={verse}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VerseLine({ verse }: { verse: BibleVerse }) {
  if (verse.type?.toLowerCase() === 'heading') {
    return (
      <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm font-semibold text-foreground/90">
        {verse.text}
      </div>
    );
  }

  return (
    <p className="text-sm leading-7 text-foreground">
      <sup className="mr-1 text-[10px] font-semibold text-primary">{verse.verse_number}</sup>
      {verse.text}
    </p>
  );
}
