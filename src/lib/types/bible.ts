// Bible Types

export interface BibleBook {
  id: string;
  name: string;
  abbreviation: string;
  testament: 'old' | 'new' | 'deutero';
  total_chapters: number;
  book_order: number;
  language_code: string;
}

export interface BibleChapter {
  id: string;
  book_id: string;
  chapter_number: number;
  content?: string;
  language_code: string;
}

export interface BibleVerse {
  verse_number: number;
  text: string;
  type?: string;
  pericope?: string;
}
