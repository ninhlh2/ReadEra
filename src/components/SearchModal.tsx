import React, { useState } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import type { SearchResultItem } from '../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => Promise<SearchResultItem[]>;
  onSelectResult: (cfi: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSearch,
  onSelectResult,
}) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [searched, setSearched] = useState(false);

  if (!isOpen) return null;

  const handleExecuteSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isSearching) return;

    setIsSearching(true);
    setSearched(true);
    try {
      const items = await onSearch(query.trim());
      setResults(items);
    } catch (err) {
      console.error('Lỗi tìm kiếm sách:', err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer-sidebar right">
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Search size={20} color="var(--color-primary)" />
            <h3 className="drawer-title">Tìm kiếm trong sách</h3>
          </div>
          <button className="btn-icon" onClick={onClose} title="Đóng tìm kiếm">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-content">
          <form onSubmit={handleExecuteSearch} style={{ marginBottom: 16 }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="header-search"
                style={{
                  width: '100%',
                  height: 42,
                  margin: 0,
                  padding: '0 40px 0 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                }}
                placeholder="Nhập từ hoặc cụm từ cần tìm..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: 6,
                  color: 'var(--color-primary)',
                }}
                disabled={isSearching}
              >
                {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              </button>
            </div>
          </form>

          {isSearching && (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
              <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13 }}>Đang quét toàn bộ các chương...</p>
            </div>
          )}

          {!isSearching && searched && results.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 30 }}>
              Không tìm thấy kết quả nào chứa từ khóa "{query}".
            </p>
          )}

          {!isSearching && results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                Tìm thấy {results.length} kết quả:
              </span>
              {results.map((res, i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: 12,
                    cursor: 'pointer',
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: 'var(--text-secondary)',
                  }}
                  onClick={() => {
                    onSelectResult(res.cfi);
                    onClose();
                  }}
                >
                  <p
                    dangerouslySetInnerHTML={{
                      __html: res.excerpt.replace(
                        new RegExp(`(${query})`, 'gi'),
                        '<mark style="background:#f59e0b;color:#000;padding:1px 3px;border-radius:2px;">$1</mark>'
                      ),
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
