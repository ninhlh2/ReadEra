import React, { useState } from 'react';
import { X, Download, Copy, Check, Sparkles } from 'lucide-react';

interface QuoteCardModalProps {
  quote: string;
  note?: string;
  bookTitle: string;
  bookAuthor: string;
  onClose: () => void;
}

type CardTheme = 'classic-dark' | 'warm-sepia' | 'oled-black' | 'nord-aurora' | 'forest-night' | 'sunset';

interface ThemePreset {
  id: CardTheme;
  name: string;
  bg: string;
  text: string;
  accent: string;
  subtext: string;
  border: string;
  canvasBg: string | string[]; // Single color or gradient [start, end]
}

const THEMES: ThemePreset[] = [
  {
    id: 'classic-dark',
    name: 'Cổ điển tối',
    bg: '#181b22',
    text: '#f1f5f9',
    accent: '#f59e0b',
    subtext: '#94a3b8',
    border: '#2e3440',
    canvasBg: '#181b22',
  },
  {
    id: 'warm-sepia',
    name: 'Giấy cổ điển',
    bg: '#f5edd6',
    text: '#2d1f14',
    accent: '#b45309',
    subtext: '#785e48',
    border: '#e2d3b3',
    canvasBg: '#f5edd6',
  },
  {
    id: 'oled-black',
    name: 'Đen tuyền',
    bg: '#000000',
    text: '#ffffff',
    accent: '#38bdf8',
    subtext: '#9ca3af',
    border: '#27272a',
    canvasBg: '#000000',
  },
  {
    id: 'nord-aurora',
    name: 'Bắc cực',
    bg: '#0f172a',
    text: '#e2e8f0',
    accent: '#2dd4bf',
    subtext: '#64748b',
    border: '#1e293b',
    canvasBg: ['#0f172a', '#134e4a'],
  },
  {
    id: 'forest-night',
    name: 'Xanh rừng',
    bg: '#06281e',
    text: '#d1fae5',
    accent: '#34d399',
    subtext: '#6ee7b7',
    border: '#064e3b',
    canvasBg: ['#06281e', '#064e3b'],
  },
  {
    id: 'sunset',
    name: 'Hoàng hôn',
    bg: '#3b0764',
    text: '#fdf4ff',
    accent: '#f472b6',
    subtext: '#d8b4fe',
    border: '#581c87',
    canvasBg: ['#3b0764', '#701a75'],
  },
];

export const QuoteCardModal: React.FC<QuoteCardModalProps> = ({
  quote,
  note,
  bookTitle,
  bookAuthor,
  onClose,
}) => {
  const [currentTheme, setCurrentTheme] = useState<CardTheme>('classic-dark');
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>('serif');
  const [showQuoteMarks, setShowQuoteMarks] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const selectedPreset = THEMES.find((t) => t.id === currentTheme) || THEMES[0];

  // Draw card onto canvas for export
  const renderCanvas = (scale = 2): HTMLCanvasElement | null => {
    const canvas = document.createElement('canvas');
    const width = 1000 * scale;
    const height = 1200 * scale;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background
    if (Array.isArray(selectedPreset.canvasBg)) {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, selectedPreset.canvasBg[0]);
      grad.addColorStop(1, selectedPreset.canvasBg[1]);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = selectedPreset.canvasBg;
    }
    ctx.fillRect(0, 0, width, height);

    // Decorative outer border
    ctx.strokeStyle = selectedPreset.border;
    ctx.lineWidth = 4 * scale;
    ctx.strokeRect(40 * scale, 40 * scale, width - 80 * scale, height - 80 * scale);

    // Inner subtle border
    ctx.strokeStyle = selectedPreset.accent + '33';
    ctx.lineWidth = 1 * scale;
    ctx.strokeRect(52 * scale, 52 * scale, width - 104 * scale, height - 104 * scale);

    // Watermark/Brand Top
    ctx.font = `600 ${18 * scale}px 'Inter', sans-serif`;
    ctx.fillStyle = selectedPreset.accent;
    ctx.textAlign = 'center';
    ctx.fillText('READERA • TRÍCH DẪN HAY', width / 2, 90 * scale);

    // Big Quotation Mark
    if (showQuoteMarks) {
      ctx.font = `bold ${120 * scale}px 'Literata', serif`;
      ctx.fillStyle = selectedPreset.accent + '26';
      ctx.textAlign = 'left';
      ctx.fillText('“', 90 * scale, 220 * scale);
    }

    // Quote text wrapping
    const fontName = fontFamily === 'serif' ? 'Literata, Georgia, serif' : 'Inter, system-ui, sans-serif';
    const quoteFontSize = quote.length > 250 ? 28 * scale : quote.length > 120 ? 34 * scale : 40 * scale;
    const lineHeight = quoteFontSize * 1.55;
    ctx.font = `normal ${quoteFontSize}px ${fontName}`;
    ctx.fillStyle = selectedPreset.text;
    ctx.textAlign = 'center';

    const maxTextWidth = width - 240 * scale;
    const words = quote.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxTextWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Center vertical placement
    const totalTextHeight = lines.length * lineHeight;
    let startY = Math.max(260 * scale, (height - totalTextHeight) / 2 - 40 * scale);

    for (const line of lines) {
      ctx.fillText(line, width / 2, startY);
      startY += lineHeight;
    }

    // Personal Note if exists
    if (note && note.trim()) {
      startY += 30 * scale;
      ctx.font = `italic ${20 * scale}px 'Inter', sans-serif`;
      ctx.fillStyle = selectedPreset.accent;
      ctx.fillText(`✎ ${note.trim()}`, width / 2, startY);
      startY += 30 * scale;
    }

    // Decorative divider line
    const dividerY = height - 200 * scale;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 80 * scale, dividerY);
    ctx.lineTo(width / 2 + 80 * scale, dividerY);
    ctx.strokeStyle = selectedPreset.accent;
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    // Book Title
    ctx.font = `bold ${24 * scale}px ${fontName}`;
    ctx.fillStyle = selectedPreset.text;
    ctx.textAlign = 'center';
    ctx.fillText(bookTitle, width / 2, dividerY + 50 * scale);

    // Book Author
    ctx.font = `normal ${20 * scale}px 'Inter', sans-serif`;
    ctx.fillStyle = selectedPreset.subtext;
    ctx.fillText(bookAuthor, width / 2, dividerY + 85 * scale);

    return canvas;
  };

  // Download Card
  const handleDownload = () => {
    setIsExporting(true);
    try {
      const canvas = renderCanvas(2);
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `ReadEra-Quote-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Lỗi xuất ảnh:', err);
      alert('Không thể tạo file ảnh.');
    } finally {
      setIsExporting(false);
    }
  };

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      const canvas = renderCanvas(2);
      if (!canvas) return;
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2200);
        } catch {
          // Fallback copy text
          await navigator.clipboard.writeText(`"${quote}" — ${bookTitle} (${bookAuthor})`);
          setCopied(true);
          setTimeout(() => setCopied(false), 2200);
        }
      });
    } catch {
      alert('Không hỗ trợ sao chép ảnh trên trình duyệt này.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="quote-card-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="quote-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="#f59e0b" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Tạo ảnh trích dẫn ReadEra</h3>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="quote-modal-body">
          {/* Card Preview */}
          <div className="quote-preview-container">
            <div
              className="quote-preview-card"
              style={{
                backgroundColor: Array.isArray(selectedPreset.canvasBg) ? undefined : selectedPreset.canvasBg,
                backgroundImage: Array.isArray(selectedPreset.canvasBg)
                  ? `linear-gradient(135deg, ${selectedPreset.canvasBg[0]}, ${selectedPreset.canvasBg[1]})`
                  : undefined,
                color: selectedPreset.text,
                borderColor: selectedPreset.border,
                fontFamily: fontFamily === 'serif' ? 'Literata, Georgia, serif' : 'Inter, system-ui, sans-serif',
              }}
            >
              <div className="quote-badge" style={{ color: selectedPreset.accent }}>
                READERA • TRÍCH DẪN
              </div>

              {showQuoteMarks && (
                <div className="quote-mark-icon" style={{ color: selectedPreset.accent }}>
                  “
                </div>
              )}

              <blockquote className="quote-text-content">
                {quote}
              </blockquote>

              {note && (
                <div className="quote-note-content" style={{ color: selectedPreset.accent }}>
                  ✎ {note}
                </div>
              )}

              <div className="quote-card-footer" style={{ borderColor: selectedPreset.accent }}>
                <div className="quote-book-name" style={{ color: selectedPreset.text }}>
                  {bookTitle}
                </div>
                <div className="quote-book-author" style={{ color: selectedPreset.subtext }}>
                  {bookAuthor}
                </div>
              </div>
            </div>
          </div>

          {/* Settings Sidebar */}
          <div className="quote-modal-controls">
            <div className="control-group">
              <label className="control-label">Chủ đề màu sắc</label>
              <div className="theme-grid">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    className={`theme-chip-btn ${currentTheme === theme.id ? 'active' : ''}`}
                    onClick={() => setCurrentTheme(theme.id)}
                    style={{
                      background: Array.isArray(theme.canvasBg)
                        ? `linear-gradient(135deg, ${theme.canvasBg[0]}, ${theme.canvasBg[1]})`
                        : theme.canvasBg,
                      color: theme.text,
                    }}
                  >
                    <span>{theme.name}</span>
                    {currentTheme === theme.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <label className="control-label">Kiểu chữ</label>
              <div className="toggle-btn-group">
                <button
                  className={`toggle-btn ${fontFamily === 'serif' ? 'active' : ''}`}
                  onClick={() => setFontFamily('serif')}
                  style={{ fontFamily: 'Literata, Georgia, serif' }}
                >
                  Có chân (Serif)
                </button>
                <button
                  className={`toggle-btn ${fontFamily === 'sans' ? 'active' : ''}`}
                  onClick={() => setFontFamily('sans')}
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  Không chân (Sans)
                </button>
              </div>
            </div>

            <div className="control-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showQuoteMarks}
                  onChange={(e) => setShowQuoteMarks(e.target.checked)}
                />
                <span>Hiển thị dấu ngoặc kép nghệ thuật</span>
              </label>
            </div>

            <div className="quote-actions-row">
              <button
                className="btn btn-primary"
                onClick={handleDownload}
                disabled={isExporting}
                style={{ flex: 1, gap: 8 }}
              >
                <Download size={16} />
                <span>{isExporting ? 'Đang xuất...' : 'Tải ảnh PNG'}</span>
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleCopy}
                style={{ gap: 8 }}
              >
                {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
