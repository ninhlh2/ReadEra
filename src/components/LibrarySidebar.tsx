import React, { useState } from 'react';
import {
  BookOpen,
  Star,
  Bookmark,
  CheckCircle2,
  Folder,
  User,
  Quote,
  Plus,
  Trash2,
  Download,
  Upload,
  Layers,
  FileType,
} from 'lucide-react';
import type { Collection, AuthorGroup } from '../types';

export type LibraryCategory =
  | 'all'
  | 'reading'
  | 'favorite'
  | 'to_read'
  | 'have_read'
  | 'authors'
  | 'collections'
  | 'quotes'
  | 'formats';

interface LibrarySidebarProps {
  currentCategory: LibraryCategory;
  onSelectCategory: (cat: LibraryCategory) => void;
  collections: Collection[];
  selectedCollectionId?: string;
  onSelectCollection: (id: string) => void;
  onCreateCollection: (name: string, color: string) => void;
  onDeleteCollection: (id: string) => void;
  authorGroups: AuthorGroup[];
  selectedAuthor?: string;
  onSelectAuthor: (author: string) => void;
  selectedFormat?: 'all' | 'epub' | 'pdf' | 'txt';
  onSelectFormat?: (format: 'all' | 'epub' | 'pdf' | 'txt') => void;
  formatCounts?: { epub: number; pdf: number; txt: number };
  counts: {
    all: number;
    reading: number;
    favorite: number;
    toRead: number;
    haveRead: number;
    quotes: number;
  };
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
}

export const LibrarySidebar: React.FC<LibrarySidebarProps> = ({
  currentCategory,
  onSelectCategory,
  collections,
  selectedCollectionId,
  onSelectCollection,
  onCreateCollection,
  onDeleteCollection,
  authorGroups,
  selectedAuthor,
  onSelectAuthor,
  selectedFormat,
  onSelectFormat,
  formatCounts,
  counts,
  onExportBackup,
  onImportBackup,
  isOpenOnMobile,
  onCloseMobile,
}) => {
  const [showAddCollection, setShowAddCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionColor, setNewCollectionColor] = useState('#6366f1');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    onCreateCollection(newCollectionName.trim(), newCollectionColor);
    setNewCollectionName('');
    setShowAddCollection(false);
  };

  const navItems = [
    { id: 'all' as LibraryCategory, label: 'Tất cả sách', icon: BookOpen, count: counts.all },
    { id: 'reading' as LibraryCategory, label: 'Đang đọc', icon: Layers, count: counts.reading },
    { id: 'favorite' as LibraryCategory, label: 'Yêu thích', icon: Star, count: counts.favorite },
    { id: 'to_read' as LibraryCategory, label: 'Muốn đọc', icon: Bookmark, count: counts.toRead },
    { id: 'have_read' as LibraryCategory, label: 'Đã đọc xong', icon: CheckCircle2, count: counts.haveRead },
    { id: 'quotes' as LibraryCategory, label: 'Trích dẫn & Ghi chú', icon: Quote, count: counts.quotes },
  ];

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];

  const content = (
    <aside className={`library-sidebar ${isOpenOnMobile ? 'mobile-open' : ''}`}>
      <div className="sidebar-section">
        <span className="sidebar-label">Thư viện ReadEra</span>
        <ul className="sidebar-menu">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentCategory === item.id;
            return (
              <li key={item.id}>
                <button
                  className={`sidebar-btn ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    onSelectCategory(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={17} />
                    <span>{item.label}</span>
                  </div>
                  <span className="sidebar-count">{item.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Tác giả */}
      <div className="sidebar-section">
        <button
          className={`sidebar-section-header ${currentCategory === 'authors' ? 'active' : ''}`}
          onClick={() => {
            onSelectCategory('authors');
            if (onCloseMobile) onCloseMobile();
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={16} />
            <span>Tác giả ({authorGroups.length})</span>
          </div>
        </button>

        {currentCategory === 'authors' && (
          <ul className="sidebar-sub-list">
            <li key="all-authors">
              <button
                className={`sidebar-sub-btn ${!selectedAuthor ? 'active' : ''}`}
                onClick={() => onSelectAuthor('')}
              >
                <span>Tất cả tác giả</span>
              </button>
            </li>
            {authorGroups.map((ag) => (
              <li key={ag.name}>
                <button
                  className={`sidebar-sub-btn ${selectedAuthor === ag.name ? 'active' : ''}`}
                  onClick={() => onSelectAuthor(ag.name)}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ag.name}
                  </span>
                  <span className="sidebar-count">{ag.bookCount}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Bộ sưu tập (Collections) */}
      <div className="sidebar-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            className={`sidebar-section-header ${currentCategory === 'collections' ? 'active' : ''}`}
            onClick={() => {
              onSelectCategory('collections');
              if (onCloseMobile) onCloseMobile();
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Folder size={16} />
              <span>Bộ sưu tập ({collections.length})</span>
            </div>
          </button>

          <button
            className="btn-icon"
            style={{ width: 24, height: 24 }}
            onClick={() => setShowAddCollection((v) => !v)}
            title="Thêm bộ sưu tập mới"
          >
            <Plus size={14} />
          </button>
        </div>

        {showAddCollection && (
          <form onSubmit={handleCreate} style={{ marginTop: 8, padding: 8, background: 'var(--bg-surface)', borderRadius: 8 }}>
            <input
              type="text"
              placeholder="Tên bộ sưu tập..."
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-surface-elevated)',
                color: '#fff',
                marginBottom: 6,
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewCollectionColor(c)}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    backgroundColor: c,
                    border: newCollectionColor === c ? '2px solid #fff' : 'none',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: 11, padding: '2px 6px' }}
                onClick={() => setShowAddCollection(false)}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="btn-primary"
                style={{ fontSize: 11, padding: '2px 8px' }}
              >
                Tạo
              </button>
            </div>
          </form>
        )}

        <ul className="sidebar-sub-list">
          {collections.map((col) => {
            const isColActive = currentCategory === 'collections' && selectedCollectionId === col.id;
            return (
              <li key={col.id} style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  className={`sidebar-sub-btn ${isColActive ? 'active' : ''}`}
                  onClick={() => {
                    onSelectCategory('collections');
                    onSelectCollection(col.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  style={{ flex: 1 }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: col.color, flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {col.name}
                  </span>
                </button>
                <button
                  className="btn-icon"
                  style={{ width: 22, height: 22, opacity: 0.5 }}
                  onClick={() => {
                    if (confirm(`Bạn có chắc muốn xóa bộ sưu tập "${col.name}"?`)) {
                      onDeleteCollection(col.id);
                    }
                  }}
                  title="Xóa bộ sưu tập"
                >
                  <Trash2 size={12} color="var(--color-danger)" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Định dạng */}
      <div className="sidebar-section">
        <button
          className={`sidebar-section-header ${currentCategory === 'formats' ? 'active' : ''}`}
          onClick={() => {
            onSelectCategory('formats');
            if (onCloseMobile) onCloseMobile();
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileType size={16} />
            <span>Định dạng sách</span>
          </div>
        </button>

        {currentCategory === 'formats' && (
          <ul className="sidebar-sub-list">
            <li>
              <button
                className={`sidebar-sub-btn ${!selectedFormat || selectedFormat === 'all' ? 'active' : ''}`}
                onClick={() => onSelectFormat && onSelectFormat('all')}
              >
                <span>Tất cả</span>
              </button>
            </li>
            <li>
              <button
                className={`sidebar-sub-btn ${selectedFormat === 'epub' ? 'active' : ''}`}
                onClick={() => onSelectFormat && onSelectFormat('epub')}
              >
                <span>EPUB</span>
                <span className="sidebar-count" style={{ marginLeft: 'auto' }}>
                  {formatCounts?.epub || 0}
                </span>
              </button>
            </li>
            <li>
              <button
                className={`sidebar-sub-btn ${selectedFormat === 'pdf' ? 'active' : ''}`}
                onClick={() => onSelectFormat && onSelectFormat('pdf')}
              >
                <span>PDF</span>
                <span className="sidebar-count" style={{ marginLeft: 'auto' }}>
                  {formatCounts?.pdf || 0}
                </span>
              </button>
            </li>
            <li>
              <button
                className={`sidebar-sub-btn ${selectedFormat === 'txt' ? 'active' : ''}`}
                onClick={() => onSelectFormat && onSelectFormat('txt')}
              >
                <span>TXT</span>
                <span className="sidebar-count" style={{ marginLeft: 'auto' }}>
                  {formatCounts?.txt || 0}
                </span>
              </button>
            </li>
          </ul>
        )}
      </div>

      {/* Backup & Restore */}
      <div className="sidebar-footer">
        <button className="sidebar-footer-btn" onClick={onExportBackup} title="Sao lưu dữ liệu thư viện ra file JSON">
          <Download size={14} />
          <span>Sao lưu thư viện</span>
        </button>

        <label className="sidebar-footer-btn" style={{ cursor: 'pointer' }} title="Khôi phục dữ liệu từ file backup JSON">
          <Upload size={14} />
          <span>Phục hồi dữ liệu</span>
          <input
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onImportBackup(file);
                e.target.value = '';
              }
            }}
          />
        </label>
      </div>
    </aside>
  );

  return (
    <>
      {isOpenOnMobile && <div className="drawer-overlay" onClick={onCloseMobile} />}
      {content}
    </>
  );
};
