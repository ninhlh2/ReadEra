import React, { useState } from 'react';
import {
  Book as BookIcon,
  Star,
  Trash2,
  UploadCloud,
  Sparkles,
  Menu,
  BookmarkCheck,
  CheckCircle,
  FolderPlus,
  Copy,
  Check,
} from 'lucide-react';
import type { BookRecord, Collection, AuthorGroup, HighlightItem, BookStatus } from '../types';
import { LibrarySidebar, type LibraryCategory } from './LibrarySidebar';
import { QuoteCardModal } from './QuoteCardModal';

interface LibraryViewProps {
  books: BookRecord[];
  collections: Collection[];
  highlights: HighlightItem[];
  onSelectBook: (book: BookRecord) => void;
  onDeleteBook: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onUpdateBookStatus: (id: string, status: BookStatus) => void;
  onSetBookCollections: (bookId: string, colIds: string[]) => void;
  onUploadFile: (file: File) => void;
  onLoadSample: () => void;
  onCreateCollection: (name: string, color: string) => void;
  onDeleteCollection: (id: string) => void;
  onDeleteHighlight: (id: string) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  isLoadingSample?: boolean;
  viewMode: 'grid' | 'list';
  searchQuery: string;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  collections,
  highlights,
  onSelectBook,
  onDeleteBook,
  onToggleFavorite,
  onUpdateBookStatus,
  onSetBookCollections,
  onUploadFile,
  onLoadSample,
  onCreateCollection,
  onDeleteCollection,
  onDeleteHighlight,
  onExportBackup,
  onImportBackup,
  isLoadingSample,
  viewMode,
  searchQuery,
}) => {
  const [currentCategory, setCurrentCategory] = useState<LibraryCategory>('all');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>();
  const [selectedAuthor, setSelectedAuthor] = useState<string | undefined>();
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'author'>('recent');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [editingCollectionBookId, setEditingCollectionBookId] = useState<string | null>(null);
  const [copiedQuoteId, setCopiedQuoteId] = useState<string | null>(null);
  const [quoteCardData, setQuoteCardData] = useState<{
    quote: string;
    note?: string;
    bookTitle: string;
    bookAuthor: string;
  } | null>(null);

  // Group books by authors
  const authorMap = new Map<string, BookRecord[]>();
  books.forEach((b) => {
    const author = b.author?.trim() || 'Tác giả không xác định';
    if (!authorMap.has(author)) authorMap.set(author, []);
    authorMap.get(author)!.push(b);
  });
  const authorGroups: AuthorGroup[] = Array.from(authorMap.entries()).map(([name, bList]) => ({
    name,
    bookCount: bList.length,
    books: bList,
  }));

  // Calculate category counts
  const counts = {
    all: books.length,
    reading: books.filter((b) => (b.status === 'reading' || (b.progress > 0 && b.progress < 100))).length,
    favorite: books.filter((b) => b.isFavorite).length,
    toRead: books.filter((b) => b.status === 'to_read').length,
    haveRead: books.filter((b) => b.status === 'have_read' || b.progress >= 100).length,
    quotes: highlights.length,
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.epub')) {
      onUploadFile(file);
    }
  };

  // Filter books according to category & search
  const filteredBooks = books.filter((book) => {
    const matchesSearch =
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (currentCategory === 'reading') {
      return book.status === 'reading' || (book.progress > 0 && book.progress < 100);
    }
    if (currentCategory === 'favorite') {
      return !!book.isFavorite;
    }
    if (currentCategory === 'to_read') {
      return book.status === 'to_read';
    }
    if (currentCategory === 'have_read') {
      return book.status === 'have_read' || book.progress >= 100;
    }
    if (currentCategory === 'authors') {
      if (selectedAuthor) {
        return book.author === selectedAuthor;
      }
      return true;
    }
    if (currentCategory === 'collections') {
      if (selectedCollectionId) {
        return book.collectionIds && book.collectionIds.includes(selectedCollectionId);
      }
      return true;
    }
    return true;
  });

  // Sort books
  const sortedBooks = [...filteredBooks].sort((a, b) => {
    if (sortBy === 'recent') {
      return (b.lastReadAt || b.addedAt) - (a.lastReadAt || a.addedAt);
    }
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    }
    if (sortBy === 'author') {
      return a.author.localeCompare(b.author);
    }
    return 0;
  });

  // Category Title
  const getCategoryTitle = () => {
    switch (currentCategory) {
      case 'reading':
        return 'Đang đọc';
      case 'favorite':
        return 'Sách yêu thích';
      case 'to_read':
        return 'Muốn đọc';
      case 'have_read':
        return 'Đã đọc xong';
      case 'authors':
        return selectedAuthor ? `Tác giả: ${selectedAuthor}` : 'Tất cả tác giả';
      case 'collections': {
        const col = collections.find((c) => c.id === selectedCollectionId);
        return col ? `Bộ sưu tập: ${col.name}` : 'Bộ sưu tập';
      }
      case 'quotes':
        return 'Trích dẫn & Ghi chú tổng hợp';
      default:
        return 'Tất cả sách';
    }
  };

  const handleCopyQuote = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQuoteId(id);
    setTimeout(() => setCopiedQuoteId(null), 1000);
  };

  return (
    <div className="library-layout">
      {/* ReadEra Left Sidebar */}
      <LibrarySidebar
        currentCategory={currentCategory}
        onSelectCategory={setCurrentCategory}
        collections={collections}
        selectedCollectionId={selectedCollectionId}
        onSelectCollection={setSelectedCollectionId}
        onCreateCollection={onCreateCollection}
        onDeleteCollection={onDeleteCollection}
        authorGroups={authorGroups}
        selectedAuthor={selectedAuthor}
        onSelectAuthor={setSelectedAuthor}
        counts={counts}
        onExportBackup={onExportBackup}
        onImportBackup={onImportBackup}
        isOpenOnMobile={showMobileSidebar}
        onCloseMobile={() => setShowMobileSidebar(false)}
      />

      {/* Main Books Content Area */}
      <main
        className="library-container"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="library-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="btn-icon mobile-sidebar-toggle"
              onClick={() => setShowMobileSidebar(true)}
              title="Mở thanh phân loại"
            >
              <Menu size={18} />
            </button>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
              {getCategoryTitle()} ({currentCategory === 'quotes' ? highlights.length : sortedBooks.length})
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {currentCategory !== 'quotes' && (
              <>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sắp xếp:</span>
                <select
                  className="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="recent">Đọc gần nhất</option>
                  <option value="title">Tên sách (A-Z)</option>
                  <option value="author">Tác giả</option>
                </select>
              </>
            )}
          </div>
        </div>

        {/* QUOTES VIEW */}
        {currentCategory === 'quotes' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {highlights.length === 0 ? (
              <div className="empty-library">
                <p style={{ color: 'var(--text-muted)' }}>Chưa có câu trích dẫn nào trong thư viện.</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Khi đọc sách, bạn hãy bôi đen chọn bất kỳ dòng chữ nào để tạo trích dẫn và ghi chú.
                </p>
              </div>
            ) : (
              highlights.map((h) => {
                const book = books.find((b) => b.id === h.bookId);
                return (
                  <div
                    key={h.id}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <p style={{ fontSize: 15, fontStyle: 'italic', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                      “{h.text}”
                    </p>

                    {h.note && (
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 13,
                          color: '#818cf8',
                        }}
                      >
                        <strong>Ghi chú:</strong> {h.note}
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 8,
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        fontSize: 12,
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>
                        Sách: <strong>{book?.title || 'Không rõ'}</strong> •{' '}
                        {new Date(h.createdAt).toLocaleDateString()}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          className="btn-icon"
                          style={{ width: 28, height: 28 }}
                          onClick={() =>
                            setQuoteCardData({
                              quote: h.text,
                              note: h.note,
                              bookTitle: book?.title || 'Tác phẩm',
                              bookAuthor: book?.author || 'Tác giả',
                            })
                          }
                          title="Tạo thiệp ảnh trích dẫn ReadEra"
                        >
                          <Sparkles size={14} color="#f59e0b" />
                        </button>

                        <button
                          className="btn-icon"
                          style={{ width: 28, height: 28 }}
                          onClick={() => handleCopyQuote(h.text, h.id)}
                          title="Sao chép"
                        >
                          {copiedQuoteId === h.id ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                        </button>

                        <button
                          className="btn-icon"
                          style={{ width: 28, height: 28 }}
                          onClick={() => onDeleteHighlight(h.id)}
                          title="Xóa trích dẫn"
                        >
                          <Trash2 size={14} color="var(--color-danger)" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : sortedBooks.length === 0 ? (
          /* EMPTY STATE */
          <div className={`empty-library ${isDragOver ? 'drag-over' : ''}`}>
            <div className="empty-icon-wrap">
              <UploadCloud size={36} />
            </div>
            <h3 className="empty-title">
              {books.length === 0 ? 'Thư viện chưa có cuốn sách nào' : 'Không có sách trong mục này'}
            </h3>
            <p className="empty-desc">
              Kéo thả file sách <strong>.EPUB</strong> vào đây hoặc tải sách mẫu để trải nghiệm ngay.
            </p>
            {books.length === 0 && (
              <div className="empty-actions">
                <button className="btn-primary" onClick={onLoadSample} disabled={isLoadingSample}>
                  <Sparkles size={16} />
                  <span>{isLoadingSample ? 'Đang nạp...' : 'Tải sách mẫu (EPUB)'}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* BOOKS GRID / LIST */
          <div className={viewMode === 'grid' ? 'books-grid' : 'books-list'}>
            {sortedBooks.map((book) => {
              const bookCols = collections.filter((c) => book.collectionIds?.includes(c.id));
              return (
                <div
                  key={book.id}
                  className="book-card"
                  onClick={() => onSelectBook(book)}
                  title={`Mở cuốn "${book.title}"`}
                >
                  <div className="book-cover-wrap">
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt={book.title} className="book-cover-img" loading="lazy" />
                    ) : (
                      <div className="book-cover-placeholder">
                        <BookIcon className="book-cover-placeholder-icon" />
                        <span className="book-cover-placeholder-title">{book.title}</span>
                      </div>
                    )}

                    {/* Favorite star */}
                    <button
                      className="book-badge-fav"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(book.id);
                      }}
                      title={book.isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                    >
                      <Star
                        size={16}
                        fill={book.isFavorite ? '#f59e0b' : 'none'}
                        stroke={book.isFavorite ? '#f59e0b' : 'currentColor'}
                      />
                    </button>

                    {/* Progress bar */}
                    <div className="book-progress-bar-container">
                      <div className="book-progress-bar-fill" style={{ width: `${book.progress}%` }} />
                    </div>
                  </div>

                  <div className="book-info">
                    <h4 className="book-title">{book.title}</h4>
                    <p className="book-author">{book.author}</p>

                    {/* Collection Tags */}
                    {bookCols.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                        {bookCols.map((c) => (
                          <span
                            key={c.id}
                            style={{
                              fontSize: 10,
                              padding: '1px 6px',
                              borderRadius: 4,
                              backgroundColor: `${c.color}25`,
                              color: c.color,
                              fontWeight: 600,
                            }}
                          >
                            {c.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="book-footer">
                      <span className="book-progress-text">
                        {book.progress >= 100
                          ? 'Đã đọc xong'
                          : book.progress > 0
                          ? `${book.progress}%`
                          : book.status === 'to_read'
                          ? 'Muốn đọc'
                          : 'Chưa đọc'}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {/* Status Quick Toggle */}
                        <button
                          className="book-menu-trigger"
                          onClick={(e) => {
                            e.stopPropagation();
                            const nextStatus: BookStatus =
                              book.status === 'to_read'
                                ? 'reading'
                                : book.status === 'reading'
                                ? 'have_read'
                                : 'to_read';
                            onUpdateBookStatus(book.id, nextStatus);
                          }}
                          title={`Trạng thái: ${book.status || 'Chưa đọc'}. Bấm để đổi`}
                        >
                          {book.status === 'have_read' ? (
                            <CheckCircle size={15} color="var(--color-success)" />
                          ) : (
                            <BookmarkCheck size={15} />
                          )}
                        </button>

                        {/* Collections toggle */}
                        <button
                          className="book-menu-trigger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCollectionBookId(
                              editingCollectionBookId === book.id ? null : book.id
                            );
                          }}
                          title="Gán vào bộ sưu tập"
                        >
                          <FolderPlus size={15} />
                        </button>

                        {/* Delete button */}
                        <button
                          className="book-menu-trigger"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Bạn có chắc muốn xóa cuốn sách "${book.title}"?`)) {
                              onDeleteBook(book.id);
                            }
                          }}
                          title="Xóa sách"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Collection Picker Popup */}
                    {editingCollectionBookId === book.id && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 8,
                          background: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 8,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                          CHỌN BỘ SƯU TẬP
                        </span>
                        {collections.length === 0 ? (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Chưa có bộ sưu tập nào.
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {collections.map((col) => {
                              const checked = book.collectionIds?.includes(col.id);
                              return (
                                <label
                                  key={col.id}
                                  style={{
                                    fontSize: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      const current = book.collectionIds || [];
                                      const next = checked
                                        ? current.filter((id) => id !== col.id)
                                        : [...current, col.id];
                                      onSetBookCollections(book.id, next);
                                    }}
                                  />
                                  <span>{col.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Quote Card Creator Modal */}
      {quoteCardData && (
        <QuoteCardModal
          quote={quoteCardData.quote}
          note={quoteCardData.note}
          bookTitle={quoteCardData.bookTitle}
          bookAuthor={quoteCardData.bookAuthor}
          onClose={() => setQuoteCardData(null)}
        />
      )}
    </div>
  );
};
