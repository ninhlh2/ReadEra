import React, { useState, useEffect } from 'react';
import { X, Languages, Copy, Check, ExternalLink, Loader2 } from 'lucide-react';

interface TranslateModalProps {
  isOpen: boolean;
  onClose: () => void;
  text: string;
}

export const TranslateModal: React.FC<TranslateModalProps> = ({
  isOpen,
  onClose,
  text,
}) => {
  const [translatedText, setTranslatedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [targetLang, setTargetLang] = useState<'vi' | 'en'>('vi');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !text.trim()) return;

    let isMounted = true;
    setIsLoading(true);

    const fetchTranslation = async () => {
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(
          text.trim()
        )}`;
        const res = await fetch(url);
        const data = await res.json();
        if (isMounted) {
          if (data && data[0]) {
            const result = data[0].map((item: any) => item[0]).join('');
            setTranslatedText(result);
          } else {
            setTranslatedText('Không tìm thấy bản dịch.');
          }
        }
      } catch (err) {
        console.warn('Lỗi dịch Google Translate:', err);
        if (isMounted) {
          setTranslatedText('Không thể kết nối đến dịch vụ dịch tự động. Bạn có thể mở trực tiếp trên Google Dịch bằng nút bên dưới.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchTranslation();

    return () => {
      isMounted = false;
    };
  }, [isOpen, text, targetLang]);

  if (!isOpen) return null;

  const handleCopyTranslation = () => {
    navigator.clipboard.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const openGoogleTranslateWeb = () => {
    window.open(
      `https://translate.google.com/?sl=auto&tl=${targetLang}&text=${encodeURIComponent(text)}`,
      '_blank'
    );
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div
        className="glass"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '480px',
          borderRadius: 'var(--radius-lg)',
          zIndex: 160,
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease',
        }}
      >
        <div className="drawer-header" style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Languages size={18} color="var(--color-primary)" />
            <h3 className="drawer-title" style={{ fontSize: 15 }}>
              Tra cứu & Dịch nghĩa
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', background: 'var(--bg-surface)', borderRadius: 6, padding: 2 }}>
              <button
                className={`filter-tab ${targetLang === 'vi' ? 'active' : ''}`}
                style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={() => setTargetLang('vi')}
              >
                Tiếng Việt
              </button>
              <button
                className={`filter-tab ${targetLang === 'en' ? 'active' : ''}`}
                style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={() => setTargetLang('en')}
              >
                English
              </button>
            </div>

            <button className="btn-icon" onClick={onClose} title="Đóng">
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Original Text */}
          <div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
              VĂN BẢN GỐC
            </span>
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                fontSize: 13,
                lineHeight: 1.5,
                maxHeight: '100px',
                overflowY: 'auto',
                color: 'var(--text-secondary)',
              }}
            >
              {text}
            </div>
          </div>

          {/* Translated Text */}
          <div>
            <span style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
              BẢN DỊCH NGHĨA
            </span>
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-focus)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                fontSize: 14,
                lineHeight: 1.6,
                minHeight: '70px',
                maxHeight: '140px',
                overflowY: 'auto',
                color: 'var(--text-primary)',
              }}
            >
              {isLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 13 }}>Đang dịch nghĩa...</span>
                </div>
              ) : (
                translatedText
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 }}>
            <button
              className="btn-secondary"
              style={{ fontSize: 12, padding: '6px 12px' }}
              onClick={openGoogleTranslateWeb}
              title="Mở trên Google Dịch"
            >
              <ExternalLink size={13} />
              <span>Google Dịch</span>
            </button>

            <button
              className="btn-primary"
              style={{ fontSize: 12, padding: '6px 14px' }}
              onClick={handleCopyTranslation}
              disabled={isLoading || !translatedText}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Đã sao chép' : 'Chép bản dịch'}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
