import React from 'react';
import { X, Bookmark, Trash2, ExternalLink } from 'lucide-react';
import type { Bookmark as BookmarkType } from '../types';

interface BookmarksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: BookmarkType[];
  onSelectBookmark: (cfi: string) => void;
  onRemoveBookmark: (id: string) => void;
}

export const BookmarksDrawer: React.FC<BookmarksDrawerProps> = ({
  isOpen,
  onClose,
  bookmarks,
  onSelectBookmark,
  onRemoveBookmark,
}) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer-sidebar right">
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bookmark size={20} color="var(--color-accent)" />
            <h3 className="drawer-title">Đánh dấu trang ({bookmarks.length})</h3>
          </div>
          <button className="btn-icon" onClick={onClose} title="Đóng danh sách bookmark">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-content">
          {bookmarks.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: 50, color: 'var(--text-muted)' }}>
              <Bookmark size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p>Chưa có trang nào được đánh dấu.</p>
              <p style={{ fontSize: 13, marginTop: 6 }}>
                Nhấn biểu tượng ruy-băng trên thanh điều khiển để lưu lại trang hiện tại.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {bookmarks.map((bm) => (
                <div
                  key={bm.id}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    onSelectBookmark(bm.cfi);
                    onClose();
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {bm.title || 'Trang sách'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 600 }}>
                      {bm.percentage}%
                    </span>
                  </div>

                  {bm.previewText && (
                    <p
                      style={{
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        fontStyle: 'italic',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      "{bm.previewText}"
                    </p>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 4,
                      paddingTop: 6,
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(bm.createdAt).toLocaleString()}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        className="btn-icon"
                        style={{ width: 28, height: 28 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveBookmark(bm.id);
                        }}
                        title="Xóa đánh dấu"
                      >
                        <Trash2 size={13} color="var(--color-danger)" />
                      </button>
                      <button
                        className="btn-icon"
                        style={{ width: 28, height: 28 }}
                        title="Đến vị trí này"
                      >
                        <ExternalLink size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
