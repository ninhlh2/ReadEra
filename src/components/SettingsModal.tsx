import React from 'react';
import {
  X,
  Sliders,
  Type,
  Palette,
  AlignLeft,
  AlignJustify,
  BookOpen,
  Scroll,
  Eye,
  Check,
  Sun,
} from 'lucide-react';
import type { ReadingSettings, ReadingTheme, FontFamily, FlowMode } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReadingSettings;
  onUpdateSettings: (newSettings: Partial<ReadingSettings>) => void;
}

export const THEME_PALETTES: {
  id: ReadingTheme;
  label: string;
  sublabel: string;
  bg: string;
  text: string;
  border: string;
  previewClass?: string;
}[] = [
  {
    id: 'light',
    label: 'Trắng Ngà',
    sublabel: 'Dịu mắt ban ngày',
    bg: '#f8f9fa',
    text: '#212529',
    border: '#e2e8f0',
  },
  {
    id: 'sepia',
    label: 'Giấy Sepia',
    sublabel: 'Cổ điển ấm áp',
    bg: '#f4ecd8',
    text: '#3d2b1f',
    border: '#e5d7b7',
  },
  {
    id: 'forest',
    label: 'Xanh Rừng',
    sublabel: 'Thư giãn thị giác',
    bg: '#13241b',
    text: '#d8ebd9',
    border: '#1e382a',
  },
  {
    id: 'dark',
    label: 'Tối Hiện Đại',
    sublabel: 'Xám than dịu nhẹ',
    bg: '#1a1d24',
    text: '#d8dee9',
    border: '#2a2f3a',
  },
  {
    id: 'nord',
    label: 'Xanh Bắc Âu',
    sublabel: 'Sắc lạnh tinh tế',
    bg: '#1e2530',
    text: '#dbe2ef',
    border: '#2e3849',
  },
  {
    id: 'black',
    label: 'Đen OLED',
    sublabel: 'Đêm sâu tối đa pin',
    bg: '#000000',
    text: '#f1f5f9',
    border: '#334155',
  },
];

export const FONT_OPTIONS: {
  id: FontFamily;
  label: string;
  sublabel: string;
  fontFamilyCSS: string;
}[] = [
  {
    id: 'literata',
    label: 'Literata',
    sublabel: 'Serif điện tử Google',
    fontFamilyCSS: "'Literata', Georgia, serif",
  },
  {
    id: 'merriweather',
    label: 'Merriweather',
    sublabel: 'Serif báo chí thanh lịch',
    fontFamilyCSS: "'Merriweather', Georgia, serif",
  },
  {
    id: 'inter',
    label: 'Inter',
    sublabel: 'Sans-serif hiện đại, rõ nét',
    fontFamilyCSS: "'Inter', sans-serif",
  },
  {
    id: 'mono',
    label: 'JetBrains Mono',
    sublabel: 'Đơn cách kỹ thuật',
    fontFamilyCSS: "'JetBrains Mono', monospace",
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  const currentTheme =
    THEME_PALETTES.find((t) => t.id === settings.theme) || THEME_PALETTES[0];
  const currentFont =
    FONT_OPTIONS.find((f) => f.id === settings.fontFamily) || FONT_OPTIONS[0];

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer-sidebar right settings-drawer">
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sliders size={20} color="var(--color-primary)" />
            <h3 className="drawer-title">Tùy biến hiển thị</h3>
          </div>
          <button className="btn-icon" onClick={onClose} title="Đóng cài đặt">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-content" style={{ padding: '16px 20px' }}>
          {/* ================================================================
              CHẾ ĐỘ XEM TRƯỚC TRỰC QUAN (LIVE PREVIEW BOX)
              ================================================================ */}
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Eye size={15} color="var(--color-primary)" />
                <span className="settings-label" style={{ margin: 0 }}>
                  Xem trước trực quan
                </span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: 'var(--color-primary-light)',
                  color: '#818cf8',
                  fontWeight: 600,
                }}
              >
                {currentTheme.label} • {currentFont.label} • {settings.fontSize}px
              </span>
            </div>

            {/* Khung mô phỏng trang sách thực tế */}
            <div
              style={{
                backgroundColor: currentTheme.bg,
                color: currentTheme.text,
                border: `1px solid ${currentTheme.border}`,
                borderRadius: 'var(--radius-md)',
                padding: `${Math.max(14, Math.min(24, settings.marginHorizontal / 2))}px`,
                fontFamily: currentFont.fontFamilyCSS,
                fontSize: `${Math.max(13, Math.min(20, settings.fontSize))}px`,
                lineHeight: settings.lineHeight,
                textAlign: settings.textAlign,
                boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <h5
                style={{
                  fontSize: '1.15em',
                  fontWeight: 700,
                  marginBottom: '0.4em',
                  textAlign: 'center',
                  color: currentTheme.text,
                  opacity: 0.95,
                  letterSpacing: '-0.3px',
                }}
              >
                Hoàng Tử Bé
              </h5>
              <p
                style={{
                  fontSize: '0.9em',
                  fontStyle: 'italic',
                  marginBottom: '0.6em',
                  color: currentTheme.text,
                  opacity: 0.85,
                  borderLeft: '3px solid var(--color-primary)',
                  paddingLeft: '10px',
                }}
              >
                “Người ta chỉ nhìn thấy thật rõ ràng bằng trái tim. Điều cốt lõi thì vô hình trong mắt trần.”
              </p>
              <p style={{ margin: 0, color: currentTheme.text, opacity: 0.9 }}>
                Tất cả những người lớn đều từng là trẻ con... nhưng rất ít người trong số họ nhớ được điều đó.
              </p>
            </div>
          </div>

          {/* ================================================================
              CHỌN BỘ MÀU (THEMES)
              ================================================================ */}
          <div className="settings-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Palette size={15} color="var(--color-primary)" />
              <span className="settings-label" style={{ margin: 0 }}>Chủ đề màu sắc</span>
            </div>
            <div className="theme-grid">
              {THEME_PALETTES.map((t) => {
                const isActive = settings.theme === t.id;
                return (
                  <button
                    key={t.id}
                    className={`theme-btn ${isActive ? 'active' : ''}`}
                    style={{
                      backgroundColor: t.bg,
                      color: t.text,
                      border: isActive
                        ? '2px solid var(--color-primary)'
                        : `1px solid ${t.border}`,
                      position: 'relative',
                      boxShadow: isActive ? '0 0 0 3px rgba(99, 102, 241, 0.35)' : 'none',
                    }}
                    onClick={() => onUpdateSettings({ theme: t.id })}
                    title={t.sublabel}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        className="theme-preview-dot"
                        style={{
                          backgroundColor: t.bg,
                          borderColor: t.text,
                          opacity: 0.8,
                        }}
                      />
                      <span style={{ fontWeight: 600 }}>{t.label}</span>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        opacity: 0.7,
                        fontWeight: 400,
                      }}
                    >
                      {t.sublabel}
                    </span>
                    {isActive && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          background: 'var(--color-primary)',
                          color: '#fff',
                          borderRadius: '50%',
                          width: 16,
                          height: 16,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={11} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ================================================================
              CHỌN PHÔNG CHỮ (FONTS)
              ================================================================ */}
          <div className="settings-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Type size={15} color="var(--color-primary)" />
              <span className="settings-label" style={{ margin: 0 }}>Phông chữ đọc</span>
            </div>
            <div className="font-grid">
              {FONT_OPTIONS.map((f) => {
                const isActive = settings.fontFamily === f.id;
                return (
                  <button
                    key={f.id}
                    className={`font-btn ${isActive ? 'active' : ''}`}
                    style={{
                      fontFamily: f.fontFamilyCSS,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '10px 14px',
                      gap: 2,
                    }}
                    onClick={() => onUpdateSettings({ fontFamily: f.id })}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{f.label}</span>
                      {isActive && <Check size={14} color="var(--color-primary)" />}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {f.sublabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ================================================================
              CỠ CHỮ (FONT SIZE)
              ================================================================ */}
          <div className="settings-section">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <span className="settings-label" style={{ margin: 0 }}>Cỡ chữ</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>
                {settings.fontSize} px
              </span>
            </div>
            <div className="stepper-control">
              <button
                className="stepper-btn"
                onClick={() =>
                  onUpdateSettings({ fontSize: Math.max(12, settings.fontSize - 1) })
                }
                title="Giảm cỡ chữ"
              >
                A-
              </button>
              <input
                type="range"
                min="12"
                max="36"
                value={settings.fontSize}
                onChange={(e) => onUpdateSettings({ fontSize: Number(e.target.value) })}
                className="reader-slider"
                style={{ margin: '0 12px' }}
              />
              <button
                className="stepper-btn"
                onClick={() =>
                  onUpdateSettings({ fontSize: Math.min(36, settings.fontSize + 1) })
                }
                title="Tăng cỡ chữ"
              >
                A+
              </button>
            </div>
          </div>

          {/* ================================================================
              CHIỀU CAO DÒNG (LINE HEIGHT)
              ================================================================ */}
          <div className="settings-section">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <span className="settings-label" style={{ margin: 0 }}>Giãn cách dòng</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>
                {settings.lineHeight.toFixed(1)}x
              </span>
            </div>
            <div className="stepper-control">
              <button
                className="stepper-btn"
                onClick={() =>
                  onUpdateSettings({
                    lineHeight: Math.max(1.2, parseFloat((settings.lineHeight - 0.1).toFixed(1))),
                  })
                }
              >
                -
              </button>
              <input
                type="range"
                min="1.2"
                max="2.4"
                step="0.1"
                value={settings.lineHeight}
                onChange={(e) => onUpdateSettings({ lineHeight: parseFloat(e.target.value) })}
                className="reader-slider"
                style={{ margin: '0 12px' }}
              />
              <button
                className="stepper-btn"
                onClick={() =>
                  onUpdateSettings({
                    lineHeight: Math.min(2.4, parseFloat((settings.lineHeight + 0.1).toFixed(1))),
                  })
                }
              >
                +
              </button>
            </div>
          </div>

          {/* ================================================================
              LỀ TRANG (MARGINS)
              ================================================================ */}
          <div className="settings-section">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <span className="settings-label" style={{ margin: 0 }}>Lề trang ngang</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>
                {settings.marginHorizontal} px
              </span>
            </div>
            <div className="stepper-control">
              <button
                className="stepper-btn"
                onClick={() =>
                  onUpdateSettings({
                    marginHorizontal: Math.max(12, settings.marginHorizontal - 4),
                  })
                }
              >
                -
              </button>
              <input
                type="range"
                min="12"
                max="80"
                step="4"
                value={settings.marginHorizontal}
                onChange={(e) =>
                  onUpdateSettings({ marginHorizontal: Number(e.target.value) })
                }
                className="reader-slider"
                style={{ margin: '0 12px' }}
              />
              <button
                className="stepper-btn"
                onClick={() =>
                  onUpdateSettings({
                    marginHorizontal: Math.min(80, settings.marginHorizontal + 4),
                  })
                }
              >
                +
              </button>
            </div>
          </div>

          {/* ================================================================
              CHẾ ĐỘ ĐỌC (PAGINATED VS SCROLLED)
              ================================================================ */}
          <div className="settings-section">
            <span className="settings-label">Chế độ hiển thị</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                className={`font-btn ${settings.flow === 'paginated' ? 'active' : ''}`}
                onClick={() => onUpdateSettings({ flow: 'paginated' as FlowMode })}
              >
                <BookOpen size={16} />
                <span>Lật từng trang</span>
              </button>
              <button
                className={`font-btn ${settings.flow === 'scrolled-doc' ? 'active' : ''}`}
                onClick={() => onUpdateSettings({ flow: 'scrolled-doc' as FlowMode })}
              >
                <Scroll size={16} />
                <span>Cuộn liên tục</span>
              </button>
            </div>
          </div>

          {/* ================================================================
              BỐ CỤC TRANG (SPREAD LAYOUT - DUAL PAGE)
              ================================================================ */}
          <div className="settings-section">
            <span className="settings-label">Bố cục trang (Trang đôi)</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <button
                className={`font-btn ${settings.spread === 'none' ? 'active' : ''}`}
                onClick={() => onUpdateSettings({ spread: 'none' })}
                style={{ padding: '8px 6px', fontSize: 12 }}
              >
                <span>Trang đơn</span>
              </button>
              <button
                className={`font-btn ${settings.spread === 'auto' ? 'active' : ''}`}
                onClick={() => onUpdateSettings({ spread: 'auto' })}
                style={{ padding: '8px 6px', fontSize: 12 }}
              >
                <span>Tự động</span>
              </button>
              <button
                className={`font-btn ${settings.spread === 'always' ? 'active' : ''}`}
                onClick={() => onUpdateSettings({ spread: 'always' })}
                style={{ padding: '8px 6px', fontSize: 12 }}
              >
                <span>Trang đôi</span>
              </button>
            </div>
          </div>

          {/* ================================================================
              ĐỘ SÁNG ĐỌC SÁCH BAN ĐÊM (BRIGHTNESS)
              ================================================================ */}
          <div className="settings-section">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <span className="settings-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sun size={15} color="#f59e0b" />
                Độ sáng màn hình
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>
                {settings.brightness || 100}%
              </span>
            </div>
            <div className="stepper-control">
              <input
                type="range"
                min="30"
                max="100"
                step="5"
                value={settings.brightness || 100}
                onChange={(e) =>
                  onUpdateSettings({ brightness: Number(e.target.value) })
                }
                className="reader-slider"
                style={{ margin: '0 4px', width: '100%' }}
              />
            </div>
          </div>

          {/* ================================================================
              CĂN CHỈNH VĂN BẢN (TEXT ALIGN)
              ================================================================ */}
          <div className="settings-section">
            <span className="settings-label">Căn chỉnh lề văn bản</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                className={`font-btn ${settings.textAlign === 'justify' ? 'active' : ''}`}
                onClick={() => onUpdateSettings({ textAlign: 'justify' })}
              >
                <AlignJustify size={16} />
                <span>Căn đều hai bên</span>
              </button>
              <button
                className={`font-btn ${settings.textAlign === 'left' ? 'active' : ''}`}
                onClick={() => onUpdateSettings({ textAlign: 'left' })}
              >
                <AlignLeft size={16} />
                <span>Căn lề trái</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
