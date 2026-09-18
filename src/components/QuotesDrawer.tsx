import React, { useState } from 'react';
import {
  X,
  Highlighter,
  Trash2,
  Copy,
  ExternalLink,
  Download,
  Check,
  Sparkles,
} from 'lucide-react';
import type { HighlightItem, HighlightColor } from '../types';
import { HIGHLIGHT_COLORS } from './TextSelectionMenu';

interface QuotesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  highlights: HighlightItem[];
  onSelectHighlight: (cfiRange: string) => void;
  onDeleteHighlight: (id: string) => void;
  onOpenQuoteCard?: (quote: string, note?: string) => void;
  bookTitle?: string;
}

export const QuotesDrawer: React.FC<QuotesDrawerProps> = ({
  isOpen,
  onClose,
  highlights,
  onSelectHighlight,
  onDeleteHighlight,
  onOpenQuoteCard,
  bookTitle: _bookTitle,
}) => {
  const [selectedColorFilter, setSelectedColorFilter] = useState<HighlightColor | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredHighlights =
    selectedColorFilter === 'all'
      ? highlights
      : highlights.filter((h) => h.color === selectedColorFilter);

  const handleCopyOne = (item: HighlightItem) => {
    const textToCopy = item.note ? `"${item.text}"\n— Ghi chú: ${item.note}` : `"${item.text}"`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  const handleExportAll = () => {
    if (highlights.length === 0) return;
    const content = highlights
      .map(
        (h, i) =>
          `${i + 1}. "${h.text}"\n   ${h.chapterTitle ? `[${h.chapterTitle}] ` : ''}${
            h.note ? `Ghi chú: ${h.note}\n` : ''
          }   (Thời gian: ${new Date(h.createdAt).toLocaleString()})\n`
      )
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ReadEra-Quotes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getColorHex = (colorId: HighlightColor) => {
    return HIGHLIGHT_COLORS.find((c) => c.id === colorId)?.hex || '#fbbf24';
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer-sidebar right">
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Highlighter size={20} color="var(--color-primary)" />
            <h3 className="drawer-title">Trích dẫn & Ghi chú ({highlights.length})</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {highlights.length > 0 && (
              <button
                className="btn-icon"
                onClick={handleExportAll}
                title="Xuất tất cả trích dẫn ra file text"
              >
                <Download size={16} />
              </button>
            )}
            <button className="btn-icon" onClick={onClose} title="Đóng">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Color Filters */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color)',
            overflowX: 'auto',
          }}
        >
          <button
            className={`filter-tab ${selectedColorFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedColorFilter('all')}
            style={{ fontSize: 12, padding: '4px 8px' }}
          >
            Tất cả
          </button>
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedColorFilter(c.id)}
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                backgroundColor: c.hex,
                border: selectedColorFilter === c.id ? '2px solid #fff' : 'none',
                boxShadow: selectedColorFilter === c.id ? '0 0 0 2px var(--color-primary)' : 'none',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title={c.name}
            />
          ))}
        </div>

        <div className="drawer-content">
          {filteredHighlights.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: 50, color: 'var(--text-muted)' }}>
              <Highlighter size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p>Chưa có đoạn trích dẫn nào.</p>
              <p style={{ fontSize: 13, marginTop: 6 }}>
                Hãy bôi đen chọn bất kỳ dòng chữ nào trong sách để tô màu highlight hoặc viết ghi chú.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredHighlights.map((item) => {
                const colorHex = getColorHex(item.color);
                return (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: 12,
                      borderLeft: `4px solid ${colorHex}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease',
                    }}
                    onClick={() => {
                      onSelectHighlight(item.cfiRange);
                      onClose();
                    }}
                  >
                    <p
                      style={{
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: 'var(--text-primary)',
                        fontStyle: 'italic',
                      }}
                    >
                      “{item.text}”
                    </p>

                    {item.note && (
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          padding: '6px 10px',
                          borderRadius: 6,
                          fontSize: 13,
                          color: '#818cf8',
                        }}
                      >
                        <strong>Ghi chú:</strong> {item.note}
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 6,
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        fontSize: 11,
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>
                        {item.chapterTitle || 'Trang sách'} •{' '}
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {onOpenQuoteCard && (
                          <button
                            className="btn-icon"
                            style={{ width: 28, height: 28 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenQuoteCard(item.text, item.note);
                            }}
                            title="Tạo ảnh thẻ trích dẫn"
                          >
                            <Sparkles size={13} color="#f59e0b" />
                          </button>
                        )}

                        <button
                          className="btn-icon"
                          style={{ width: 28, height: 28 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyOne(item);
                          }}
                          title="Sao chép trích dẫn"
                        >
                          {copiedId === item.id ? (
                            <Check size={13} color="var(--color-success)" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>

                        <button
                          className="btn-icon"
                          style={{ width: 28, height: 28 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteHighlight(item.id);
                          }}
                          title="Xóa trích dẫn"
                        >
                          <Trash2 size={13} color="var(--color-danger)" />
                        </button>

                        <button
                          className="btn-icon"
                          style={{ width: 28, height: 28 }}
                          title="Nhảy tới vị trí này"
                        >
                          <ExternalLink size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
