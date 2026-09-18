import { get, set, del } from 'idb-keyval';
import type {
  BookRecord,
  Bookmark,
  HighlightItem,
  ReadingSettings,
  Collection,
  BookStatus,
  AppBackupData,
} from '../types';

const STORAGE_KEYS = {
  BOOKS_LIST: 'readera_books_meta',
  BOOK_FILE_PREFIX: 'readera_file_',
  BOOKMARKS: 'readera_bookmarks',
  HIGHLIGHTS: 'readera_highlights',
  COLLECTIONS: 'readera_collections',
  SETTINGS: 'readera_settings',
};

export const DEFAULT_SETTINGS: ReadingSettings = {
  theme: 'dark',
  fontFamily: 'literata',
  fontSize: 18,
  lineHeight: 1.7,
  marginHorizontal: 32,
  flow: 'paginated',
  textAlign: 'justify',
  brightness: 100,
  spread: 'none',
};

// ==========================================
// BOOKS METADATA
// ==========================================
export async function getAllBooks(): Promise<BookRecord[]> {
  const books = await get<BookRecord[]>(STORAGE_KEYS.BOOKS_LIST);
  return books || [];
}

export async function saveBookMetadata(book: BookRecord): Promise<void> {
  const books = await getAllBooks();
  const index = books.findIndex((b) => b.id === book.id);
  if (index >= 0) {
    books[index] = book;
  } else {
    books.unshift(book);
  }
  await set(STORAGE_KEYS.BOOKS_LIST, books);
}

export async function updateBookProgress(
  id: string,
  cfi: string,
  progress: number,
  currentPage?: number
): Promise<void> {
  const books = await getAllBooks();
  const book = books.find((b) => b.id === id);
  if (book) {
    book.lastCfi = cfi;
    if (currentPage !== undefined) {
      book.currentPage = currentPage;
    }
    book.progress = Math.min(100, Math.max(0, Math.round(progress)));
    book.lastReadAt = Date.now();
    if (book.progress >= 100) {
      book.status = 'have_read';
    } else if (book.progress > 0) {
      book.status = 'reading';
    }
    await set(STORAGE_KEYS.BOOKS_LIST, books);
  }
}

export async function updateBookStatus(id: string, status: BookStatus): Promise<void> {
  const books = await getAllBooks();
  const book = books.find((b) => b.id === id);
  if (book) {
    book.status = status;
    await set(STORAGE_KEYS.BOOKS_LIST, books);
  }
}

export async function toggleBookFavorite(id: string): Promise<boolean> {
  const books = await getAllBooks();
  const book = books.find((b) => b.id === id);
  if (book) {
    book.isFavorite = !book.isFavorite;
    await set(STORAGE_KEYS.BOOKS_LIST, books);
    return book.isFavorite;
  }
  return false;
}

export async function setBookCollections(bookId: string, collectionIds: string[]): Promise<void> {
  const books = await getAllBooks();
  const book = books.find((b) => b.id === bookId);
  if (book) {
    book.collectionIds = collectionIds;
    await set(STORAGE_KEYS.BOOKS_LIST, books);
  }
}

export async function deleteBook(id: string): Promise<void> {
  const books = await getAllBooks();
  const filtered = books.filter((b) => b.id !== id);
  await set(STORAGE_KEYS.BOOKS_LIST, filtered);
  await deleteBookFile(id);

  // Also remove bookmarks & highlights for this book
  const bookmarks = await getAllBookmarks();
  await set(
    STORAGE_KEYS.BOOKMARKS,
    bookmarks.filter((b) => b.bookId !== id)
  );

  const highlights = await getAllHighlights();
  await set(
    STORAGE_KEYS.HIGHLIGHTS,
    highlights.filter((h) => h.bookId !== id)
  );
}

// ==========================================
// BINARY FILE STORAGE
// ==========================================
export async function saveBookFile(id: string, fileData: ArrayBuffer): Promise<void> {
  await set(`${STORAGE_KEYS.BOOK_FILE_PREFIX}${id}`, fileData);
}

export async function getBookFile(id: string): Promise<ArrayBuffer | undefined> {
  return await get<ArrayBuffer>(`${STORAGE_KEYS.BOOK_FILE_PREFIX}${id}`);
}

export async function deleteBookFile(id: string): Promise<void> {
  await del(`${STORAGE_KEYS.BOOK_FILE_PREFIX}${id}`);
}

// ==========================================
// BOOKMARKS
// ==========================================
export async function getAllBookmarks(): Promise<Bookmark[]> {
  const list = await get<Bookmark[]>(STORAGE_KEYS.BOOKMARKS);
  return list || [];
}

export async function getBookBookmarks(bookId: string): Promise<Bookmark[]> {
  const all = await getAllBookmarks();
  return all.filter((b) => b.bookId === bookId);
}

export async function addBookmark(bookmark: Bookmark): Promise<void> {
  const all = await getAllBookmarks();
  all.unshift(bookmark);
  await set(STORAGE_KEYS.BOOKMARKS, all);
}

export async function removeBookmark(id: string): Promise<void> {
  const all = await getAllBookmarks();
  await set(
    STORAGE_KEYS.BOOKMARKS,
    all.filter((b) => b.id !== id)
  );
}

// ==========================================
// HIGHLIGHTS & QUOTES & NOTES
// ==========================================
export async function getAllHighlights(): Promise<HighlightItem[]> {
  const list = await get<HighlightItem[]>(STORAGE_KEYS.HIGHLIGHTS);
  return list || [];
}

export async function getBookHighlights(bookId: string): Promise<HighlightItem[]> {
  const all = await getAllHighlights();
  return all.filter((h) => h.bookId === bookId);
}

export async function saveHighlight(highlight: HighlightItem): Promise<void> {
  const all = await getAllHighlights();
  const idx = all.findIndex((h) => h.id === highlight.id);
  if (idx >= 0) {
    all[idx] = highlight;
  } else {
    all.unshift(highlight);
  }
  await set(STORAGE_KEYS.HIGHLIGHTS, all);
}

export async function removeHighlight(id: string): Promise<void> {
  const all = await getAllHighlights();
  await set(
    STORAGE_KEYS.HIGHLIGHTS,
    all.filter((h) => h.id !== id)
  );
}

// ==========================================
// COLLECTIONS
// ==========================================
export async function getAllCollections(): Promise<Collection[]> {
  const list = await get<Collection[]>(STORAGE_KEYS.COLLECTIONS);
  return (
    list || [
      { id: 'col_default_1', name: 'Tiểu thuyết', color: '#6366f1', createdAt: Date.now() },
      { id: 'col_default_2', name: 'Kỹ năng sống', color: '#10b981', createdAt: Date.now() },
      { id: 'col_default_3', name: 'Kinh điển', color: '#f59e0b', createdAt: Date.now() },
    ]
  );
}

export async function saveCollection(collection: Collection): Promise<void> {
  const list = await getAllCollections();
  const idx = list.findIndex((c) => c.id === collection.id);
  if (idx >= 0) {
    list[idx] = collection;
  } else {
    list.push(collection);
  }
  await set(STORAGE_KEYS.COLLECTIONS, list);
}

export async function deleteCollection(id: string): Promise<void> {
  const list = await getAllCollections();
  await set(
    STORAGE_KEYS.COLLECTIONS,
    list.filter((c) => c.id !== id)
  );

  // Remove collection id from all books
  const books = await getAllBooks();
  let changed = false;
  books.forEach((b) => {
    if (b.collectionIds && b.collectionIds.includes(id)) {
      b.collectionIds = b.collectionIds.filter((cid) => cid !== id);
      changed = true;
    }
  });
  if (changed) {
    await set(STORAGE_KEYS.BOOKS_LIST, books);
  }
}

// ==========================================
// SETTINGS
// ==========================================
export function getStoredSettingsSync(): ReadingSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.SETTINGS) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      const res = { ...DEFAULT_SETTINGS, ...parsed };
      if (res.spread === 'auto') res.spread = 'none';
      return res;
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export async function getSettings(): Promise<ReadingSettings> {
  try {
    const saved = await get<ReadingSettings>(STORAGE_KEYS.SETTINGS);
    const syncSaved = getStoredSettingsSync();
    const settings = { ...DEFAULT_SETTINGS, ...syncSaved, ...saved };
    if (settings.spread === 'auto') {
      settings.spread = 'none';
    }
    return settings;
  } catch {
    return getStoredSettingsSync();
  }
}

export async function saveSettings(settings: Partial<ReadingSettings>): Promise<void> {
  try {
    const current = getStoredSettingsSync();
    const updated = { ...current, ...settings };
    if (updated.spread === 'auto') {
      updated.spread = 'none';
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      } catch {}
    }
    await set(STORAGE_KEYS.SETTINGS, updated);
  } catch (err) {
    console.warn('Lỗi lưu cài đặt:', err);
  }
}

// ==========================================
// BACKUP & RESTORE
// ==========================================
export async function exportBackupJSON(): Promise<string> {
  const [books, bookmarks, highlights, collections, settings] = await Promise.all([
    getAllBooks(),
    getAllBookmarks(),
    getAllHighlights(),
    getAllCollections(),
    getSettings(),
  ]);

  const backupData: AppBackupData = {
    version: '1.0.0',
    exportedAt: Date.now(),
    books,
    bookmarks,
    highlights,
    collections,
    settings,
  };

  return JSON.stringify(backupData, null, 2);
}

export async function importBackupJSON(jsonString: string): Promise<boolean> {
  try {
    const data: AppBackupData = JSON.parse(jsonString);
    if (!data.books || !Array.isArray(data.books)) {
      throw new Error('Định dạng backup không hợp lệ');
    }

    await Promise.all([
      set(STORAGE_KEYS.BOOKS_LIST, data.books),
      set(STORAGE_KEYS.BOOKMARKS, data.bookmarks || []),
      set(STORAGE_KEYS.HIGHLIGHTS, data.highlights || []),
      set(STORAGE_KEYS.COLLECTIONS, data.collections || []),
      set(STORAGE_KEYS.SETTINGS, data.settings || DEFAULT_SETTINGS),
    ]);

    return true;
  } catch (err) {
    console.error('Lỗi khi phục hồi dữ liệu:', err);
    return false;
  }
}
