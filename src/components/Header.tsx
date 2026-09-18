import React, { useRef } from 'react';
import { BookOpen, Plus, LayoutGrid, List, Sparkles, Search } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onUploadFile: (file: File) => void;
  onLoadSample: () => void;
  isLoadingSample?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onUploadFile,
  onLoadSample,
  isLoadingSample,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
      e.target.value = '';
    }
  };

  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-icon">
          <BookOpen size={20} />
        </div>
        <span className="brand-name">ReadEra</span>
        <span className="brand-badge">PWA</span>
      </div>

      <div className="header-search">
        <Search size={16} className="header-search-icon" />
        <input
          type="text"
          placeholder="Tìm sách trong thư viện (tiêu đề, tác giả)..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="header-actions">
        <button
          className="btn-secondary"
          onClick={onLoadSample}
          disabled={isLoadingSample}
          title="Tải cuốn sách mẫu Hoàng Tử Bé để thử ngay"
        >
          <Sparkles size={16} style={{ color: '#f59e0b' }} />
          <span className="header-btn-label">{isLoadingSample ? 'Đang tải...' : 'Sách mẫu'}</span>
        </button>

        <button
          className="btn-primary"
          onClick={() => fileInputRef.current?.click()}
          title="Mở file sách EPUB, PDF, TXT từ thiết bị của bạn"
        >
          <Plus size={18} />
          <span className="header-btn-label">Thêm sách</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".epub,.txt,.pdf"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <div className="view-mode-toggle" style={{ display: 'flex', gap: 4 }}>
          <button
            className={`btn-icon ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => onViewModeChange('grid')}
            title="Hiển thị dạng lưới"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            className={`btn-icon ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => onViewModeChange('list')}
            title="Hiển thị dạng danh sách"
          >
            <List size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
