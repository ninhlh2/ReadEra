import React, { useState } from 'react';
import { Copy, MessageSquarePlus, Languages, Volume2, Check, X, Sparkles } from 'lucide-react';
import type { HighlightColor } from '../types';

interface TextSelectionMenuProps {
  position: { x: number; y: number };
  selectedText: string;
  onHighlight: (color: HighlightColor) => void;
  onAddNote: (color: HighlightColor, note: string) => void;
  onTranslate: (text: string) => void;
  onSpeak: (text: string) => void;
  onCreateQuoteCard?: (text: string) => void;
  onClose: () => void;
}

export const HIGHLIGHT_COLORS: { id: HighlightColor; name: string; hex: string }[] = [
  { id: 'yellow', name: 'Vàng', hex: '#fbbf24' },
  { id: 'green', name: 'Xanh lá', hex: '#34d399' },
  { id: 'blue', name: 'Xanh dương', hex: '#60a5fa' },
  { id: 'orange', name: 'Cam', hex: '#fb923c' },
  { id: 'pink', name: 'Hồng', hex: '#f472b6' },
];

export const TextSelectionMenu: React.FC<TextSelectionMenuProps> = ({
  position,
  selectedText,
  onHighlight,
  onAddNote,
  onTranslate,
  onSpeak,
  onCreateQuoteCard,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedText);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 800);
  };

  const handleSaveNote = () => {
    onAddNote(selectedColor, noteText.trim());
    onClose();
  };

  // Adjust coordinates so it doesn't go off screen
  const menuWidth = showNoteInput ? 280 : 260;
  const left = Math.max(10, Math.min(window.innerWidth - menuWidth - 10, position.x - menuWidth / 2));
  const top = Math.max(70, position.y - (showNoteInput ? 130 : 54));

  return (
    <div
      className="text-selection-popover"
      style={{
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        zIndex: 150,
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-full)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      {showNoteInput ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 4, width: '100%' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.id}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  backgroundColor: c.hex,
                  border: selectedColor === c.id ? '2px solid #fff' : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedColor(c.id)}
              />
            ))}
          </div>
          <input
            type="text"
            placeholder="Viết ghi chú cá nhân..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveNote();
            }}
            autoFocus
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 13,
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button
              className="btn-secondary"
              style={{ padding: '4px 8px', fontSize: 12 }}
              onClick={() => setShowNoteInput(false)}
            >
              Hủy
            </button>
            <button
              className="btn-primary"
              style={{ padding: '4px 10px', fontSize: 12 }}
              onClick={handleSaveNote}
            >
              Lưu ghi chú
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Highlight Color Dots */}
          <div style={{ display: 'flex', gap: 6, paddingRight: 6, borderRight: '1px solid var(--border-color)' }}>
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.id}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  backgroundColor: c.hex,
                  boxShadow: '0 0 6px rgba(0,0,0,0.3)',
                  cursor: 'pointer',
                  transition: 'transform 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.25)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                onClick={() => {
                  onHighlight(c.id);
                  onClose();
                }}
                title={`Tô màu ${c.name}`}
              />
            ))}
          </div>

          {/* Add Note Button */}
          <button
            className="btn-icon"
            style={{ width: 30, height: 30 }}
            onClick={() => setShowNoteInput(true)}
            title="Thêm ghi chú"
          >
            <MessageSquarePlus size={15} />
          </button>

          {/* Copy Button */}
          <button
            className="btn-icon"
            style={{ width: 30, height: 30 }}
            onClick={handleCopy}
            title={copied ? 'Đã chép!' : 'Sao chép'}
          >
            {copied ? <Check size={15} color="var(--color-success)" /> : <Copy size={15} />}
          </button>

          {/* Translate Button */}
          <button
            className="btn-icon"
            style={{ width: 30, height: 30 }}
            onClick={() => {
              onTranslate(selectedText);
              onClose();
            }}
            title="Tra từ / Dịch nghĩa"
          >
            <Languages size={15} />
          </button>

          {/* TTS Read Selection */}
          <button
            className="btn-icon"
            style={{ width: 30, height: 30 }}
            onClick={() => {
              onSpeak(selectedText);
              onClose();
            }}
            title="Đọc to đoạn này"
          >
            <Volume2 size={15} />
          </button>

          {/* Create Quote Card */}
          {onCreateQuoteCard && (
            <button
              className="btn-icon"
              style={{ width: 30, height: 30 }}
              onClick={() => {
                onCreateQuoteCard(selectedText);
                onClose();
              }}
              title="Tạo thiệp ảnh trích dẫn ReadEra"
            >
              <Sparkles size={15} color="#f59e0b" />
            </button>
          )}

          {/* Close popover */}
          <button
            className="btn-icon"
            style={{ width: 24, height: 24, opacity: 0.6 }}
            onClick={onClose}
            title="Đóng menu"
          >
            <X size={13} />
          </button>
        </>
      )}
    </div>
  );
};
