import React from 'react';
import { X, BookMarked } from 'lucide-react';
import type { TocItem } from '../types';

interface TocDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  toc: TocItem[];
  currentHref?: string;
  onSelectChapter: (href: string) => void;
}

export const TocDrawer: React.FC<TocDrawerProps> = ({
  isOpen,
  onClose,
  toc,
  currentHref,
  onSelectChapter,
}) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer-sidebar">
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookMarked size={20} color="var(--color-primary)" />
            <h3 className="drawer-title">Mục lục sách</h3>
          </div>
          <button className="btn-icon" onClick={onClose} title="Đóng mục lục">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-content">
          {toc.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>
              Không tìm thấy mục lục trong sách này.
            </p>
          ) : (
            <ul className="toc-list">
              {toc.map((item, index) => {
                const isActive = currentHref && item.href.includes(currentHref);
                return (
                  <li key={item.id || index}>
                    <button
                      className={`toc-item-btn ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        onSelectChapter(item.href);
                        onClose();
                      }}
                    >
                      <span style={{ flex: 1 }}>{item.label.trim()}</span>
                    </button>
                    {item.subitems && item.subitems.length > 0 && (
                      <ul style={{ listStyle: 'none', paddingLeft: 16 }}>
                        {item.subitems.map((sub, sIdx) => (
                          <li key={sub.id || sIdx}>
                            <button
                              className="toc-item-btn"
                              style={{ fontSize: 13 }}
                              onClick={() => {
                                onSelectChapter(sub.href);
                                onClose();
                              }}
                            >
                              <span>{sub.label.trim()}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
};
