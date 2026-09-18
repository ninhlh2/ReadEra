export type ReadingTheme = 'light' | 'sepia' | 'dark' | 'black' | 'nord' | 'forest';

export type FontFamily = 'literata' | 'merriweather' | 'inter' | 'mono' | 'crimson' | 'sourceserif' | 'lora' | 'nunito';


export type FlowMode = 'paginated' | 'scrolled-doc';

export type BookStatus = 'reading' | 'to_read' | 'have_read';

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'orange' | 'pink';

export interface ReadingSettings {
  theme: ReadingTheme;
  fontFamily: FontFamily;
  fontSize: number; // in px
  lineHeight: number; // e.g. 1.7
  marginHorizontal: number; // in px
  flow: FlowMode;
  textAlign: 'justify' | 'left';
  brightness: number; // 30 to 100
  spread: 'auto' | 'none' | 'always';
}

export interface Collection {
  id: string;
  name: string;
  color: string;
  description?: string;
  createdAt: number;
}

export interface BookRecord {
  id: string;
  title: string;
  author: string;
  description?: string;
  coverUrl?: string;
  fileSize: number;
  addedAt: number;
  lastReadAt?: number;
  progress: number; // 0 to 100
  lastCfi?: string;
  totalLocations?: number;
  isFavorite?: boolean;
  status?: BookStatus;
  collectionIds?: string[];
  fileFormat?: 'epub';
  pageCount?: number;
  currentPage?: number;
}

export interface Bookmark {
  id: string;
  bookId: string;
  cfi: string;
  title: string;
  percentage: number;
  previewText?: string;
  createdAt: number;
}

export interface HighlightItem {
  id: string;
  bookId: string;
  cfiRange: string;
  text: string;
  color: HighlightColor;
  note?: string;
  chapterTitle?: string;
  createdAt: number;
}

export interface TocItem {
  id: string;
  label: string;
  href: string;
  subitems?: TocItem[];
}

export interface SearchResultItem {
  cfi: string;
  excerpt: string;
}

export interface AuthorGroup {
  name: string;
  bookCount: number;
  books: BookRecord[];
}

export interface AppBackupData {
  version: string;
  exportedAt: number;
  books: BookRecord[];
  bookmarks: Bookmark[];
  highlights: HighlightItem[];
  collections: Collection[];
  settings: ReadingSettings;
}
