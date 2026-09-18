import { useState, useEffect } from 'react';
import type { BookRecord, ReadingSettings, Collection, HighlightItem, BookStatus } from './types';
import {
  getAllBooks,
  getBookFile,
  deleteBook,
  toggleBookFavorite,
  updateBookProgress,
  updateBookStatus,
  setBookCollections,
  getAllCollections,
  saveCollection,
  deleteCollection,
  getAllHighlights,
  removeHighlight,
  getSettings,
  saveSettings,
  getStoredSettingsSync,
  exportBackupJSON,
  importBackupJSON,
} from './services/storage';
import { importEpubFile, importSampleBook } from './services/epubService';
import { Header } from './components/Header';
import { LibraryView } from './components/LibraryView';
import { ReaderView } from './components/ReaderView';

export function App() {
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [activeBook, setActiveBook] = useState<BookRecord | null>(null);
  const [activeBuffer, setActiveBuffer] = useState<ArrayBuffer | null>(null);
  const [settings, setSettings] = useState<ReadingSettings>(getStoredSettingsSync);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [isLoadingBook, setIsLoadingBook] = useState(false);

  // Load books, collections, highlights and user settings
  const refreshAll = async () => {
    const [bookList, colList, hlList, savedSettings] = await Promise.all([
      getAllBooks(),
      getAllCollections(),
      getAllHighlights(),
      getSettings(),
    ]);
    setBooks(bookList);
    setCollections(colList);
    setHighlights(hlList);
    if (savedSettings) {
      setSettings(savedSettings);
    }
  };

  useEffect(() => {
    refreshAll();
    getSettings().then(setSettings);
  }, []);

  // Open book for reading
  const handleSelectBook = async (book: BookRecord) => {
    try {
      setIsLoadingBook(true);
      const buffer = await getBookFile(book.id);
      if (!buffer) {
        alert('Không tìm thấy file sách trên thiết bị này.');
        return;
      }
      setActiveBuffer(buffer);
      setActiveBook(book);
    } catch (err) {
      console.error('Lỗi khi mở sách:', err);
      alert('Đã xảy ra lỗi khi mở sách.');
    } finally {
      setIsLoadingBook(false);
    }
  };

  // Upload new EPUB file
  const handleUploadFile = async (file: File) => {
    try {
      setIsLoadingBook(true);
      if (!file.name.toLowerCase().endsWith('.epub')) {
        alert('Định dạng file không được hỗ trợ. Vui lòng chọn file sách .epub.');
        return;
      }
      const newBook = await importEpubFile(file);
      await refreshAll();
      await handleSelectBook(newBook);
    } catch (err) {
      console.error('Lỗi import sách:', err);
      alert('Không thể đọc file sách này. Vui lòng kiểm tra lại file EPUB.');
    } finally {
      setIsLoadingBook(false);
    }
  };

  // Load sample book (Hoàng Tử Bé)
  const handleLoadSample = async () => {
    try {
      setIsLoadingSample(true);
      const sample = await importSampleBook();
      await refreshAll();
      await handleSelectBook(sample);
    } catch (err) {
      console.error('Lỗi nạp sách mẫu:', err);
      alert('Không thể tải sách mẫu.');
    } finally {
      setIsLoadingSample(false);
    }
  };

  // Delete book
  const handleDeleteBook = async (id: string) => {
    await deleteBook(id);
    await refreshAll();
  };

  // Toggle favorite
  const handleToggleFavorite = async (id: string) => {
    await toggleBookFavorite(id);
    await refreshAll();
  };

  // Update book reading status
  const handleUpdateBookStatus = async (id: string, status: BookStatus) => {
    await updateBookStatus(id, status);
    await refreshAll();
  };

  // Set book collections
  const handleSetBookCollections = async (bookId: string, colIds: string[]) => {
    await setBookCollections(bookId, colIds);
    await refreshAll();
  };

  // Create collection
  const handleCreateCollection = async (name: string, color: string) => {
    const newCol: Collection = {
      id: `col_${Date.now()}`,
      name,
      color,
      createdAt: Date.now(),
    };
    await saveCollection(newCol);
    await refreshAll();
  };

  // Delete collection
  const handleDeleteCollection = async (id: string) => {
    await deleteCollection(id);
    await refreshAll();
  };

  // Delete highlight
  const handleDeleteHighlight = async (id: string) => {
    await removeHighlight(id);
    await refreshAll();
  };

  // Backup & Restore
  const handleExportBackup = async () => {
    try {
      const jsonStr = await exportBackupJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ReadEra-Backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Không thể tạo file sao lưu.');
    }
  };

  const handleImportBackup = async (file: File) => {
    try {
      const text = await file.text();
      const ok = await importBackupJSON(text);
      if (ok) {
        await refreshAll();
        const s = await getSettings();
        setSettings(s);
        alert('Phục hồi dữ liệu thành công!');
      } else {
        alert('File sao lưu không hợp lệ.');
      }
    } catch {
      alert('Lỗi đọc file sao lưu.');
    }
  };

  // Update progress
  const handleUpdateProgress = async (cfi: string, progress: number, currentPage?: number) => {
    if (!activeBook) return;
    await updateBookProgress(activeBook.id, cfi, progress, currentPage);
    setBooks((prev) =>
      prev.map((b) =>
        b.id === activeBook.id
          ? { ...b, lastCfi: cfi, progress, currentPage: currentPage ?? b.currentPage }
          : b
      )
    );
  };

  return (
    <div className="app-container">
      {activeBook && activeBuffer ? (
        <ReaderView
          book={activeBook}
          fileBuffer={activeBuffer}
          initialSettings={settings}
          onClose={async (finalSettings) => {
            if (finalSettings) {
              setSettings(finalSettings);
              await saveSettings(finalSettings);
            }
            setActiveBook(null);
            setActiveBuffer(null);
            refreshAll();
          }}
          onUpdateSettings={(newSettings) => {
            setSettings(newSettings);
            saveSettings(newSettings);
          }}
          onUpdateProgress={handleUpdateProgress}
        />
      ) : (
        <>
          <Header
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onUploadFile={handleUploadFile}
            onLoadSample={handleLoadSample}
            isLoadingSample={isLoadingSample || isLoadingBook}
          />
          <LibraryView
            books={books}
            collections={collections}
            highlights={highlights}
            onSelectBook={handleSelectBook}
            onDeleteBook={handleDeleteBook}
            onToggleFavorite={handleToggleFavorite}
            onUpdateBookStatus={handleUpdateBookStatus}
            onSetBookCollections={handleSetBookCollections}
            onUploadFile={handleUploadFile}
            onLoadSample={handleLoadSample}
            onCreateCollection={handleCreateCollection}
            onDeleteCollection={handleDeleteCollection}
            onDeleteHighlight={handleDeleteHighlight}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            isLoadingSample={isLoadingSample || isLoadingBook}
            viewMode={viewMode}
            searchQuery={searchQuery}
          />
        </>
      )}
    </div>
  );
}

export default App;
