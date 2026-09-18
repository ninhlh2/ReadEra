import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Bookmark as BookmarkIcon,
  BookmarkCheck,
  Maximize2,
  Minimize2,
  Menu,
  ZoomIn,
  ZoomOut,
  Sun,
  Volume2,
} from 'lucide-react';
import type {
  BookRecord,
  Bookmark,
  ReadingSettings,
  TocItem,
} from '../types';
import {
  getBookBookmarks,
  addBookmark,
  removeBookmark,
  saveSettings,
} from '../services/storage';
import { extractPdfToc } from '../services/pdfService';
import { TocDrawer } from './TocDrawer';
import { BookmarksDrawer } from './BookmarksDrawer';
import { TtsPlayer } from './TtsPlayer';
import { splitIntoSentences, ttsService } from '../services/ttsService';

interface PdfReaderViewProps {
  book: BookRecord;
  fileBuffer: ArrayBuffer;
  initialSettings: ReadingSettings;
  onClose: () => void;
  onUpdateProgress: (cfi: string, progress: number, currentPage?: number) => void;
}

export const PdfReaderView: React.FC<PdfReaderViewProps> = ({
  book,
  fileBuffer,
  initialSettings,
  onClose,
  onUpdateProgress,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const lastTtsPageRef = useRef<number>(book.currentPage || 1);

  const [settings, setSettings] = useState<ReadingSettings>(initialSettings);
  const [currentPage, setCurrentPage] = useState<number>(book.currentPage || 1);
  const [totalPages, setTotalPages] = useState<number>(book.pageCount || 1);
  const [scale, setScale] = useState<number>(1.2);
  const [showBars, setShowBars] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fitMode, setFitMode] = useState<'width' | 'page' | 'custom'>('width');

  // Drawers
  const [showToc, setShowToc] = useState<boolean>(false);
  const [showBookmarks, setShowBookmarks] = useState<boolean>(false);
  const [showBrightnessMenu, setShowBrightnessMenu] = useState<boolean>(false);
  const [showTts, setShowTts] = useState<boolean>(false);
  const [ttsSentences, setTtsSentences] = useState<string[]>([]);
  const [ttsSentenceIndex, setTtsSentenceIndex] = useState<number>(0);

  // Metadata
  const [toc, setToc] = useState<TocItem[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isCurrentBookmarked, setIsCurrentBookmarked] = useState<boolean>(false);

  // Load PDF Document
  useEffect(() => {
    let isCancelled = false;

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(fileBuffer),
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4/cmaps/',
          cMapPacked: true,
        });
        const pdf = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);

        // Load TOC
        const extractedToc = await extractPdfToc(pdf);
        if (!isCancelled) setToc(extractedToc);

        // Load Bookmarks
        const bms = await getBookBookmarks(book.id);
        if (!isCancelled) setBookmarks(bms);
      } catch (err) {
        console.error('Lỗi nạp tài liệu PDF:', err);
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [fileBuffer, book.id]);

  // Check bookmark status
  useEffect(() => {
    const exists = bookmarks.some((b) => b.cfi === `page_${currentPage}`);
    setIsCurrentBookmarked(exists);
  }, [currentPage, bookmarks]);

  // Render Page
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDocRef.current || !canvasRef.current) return;
      try {
        const page = await pdfDocRef.current.getPage(pageNum);

        let targetScale = scale;
        if (fitMode === 'width' && containerRef.current) {
          const containerWidth = containerRef.current.clientWidth - 40;
          const unscaledViewport = page.getViewport({ scale: 1 });
          targetScale = containerWidth / unscaledViewport.width;
          targetScale = Math.min(Math.max(targetScale, 0.6), 3.0);
        } else if (fitMode === 'page' && containerRef.current) {
          const containerHeight = containerRef.current.clientHeight - 40;
          const unscaledViewport = page.getViewport({ scale: 1 });
          targetScale = containerHeight / unscaledViewport.height;
          targetScale = Math.min(Math.max(targetScale, 0.6), 3.0);
        }

        const viewport = page.getViewport({ scale: targetScale });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvas,
          canvasContext: ctx,
          transform,
          viewport,
          intent: 'display',
        }).promise;

        // Update progress
        const pct = Math.round((pageNum / totalPages) * 100);
        onUpdateProgress(`page_${pageNum}`, pct, pageNum);
      } catch (err) {
        console.warn('Lỗi render trang PDF:', err);
      }
    },
    [scale, fitMode, totalPages, onUpdateProgress]
  );

  useEffect(() => {
    if (pdfDocRef.current) {
      renderPage(currentPage);
    }
  }, [currentPage, renderPage]);

  // Page navigation
  const goToPage = (page: number) => {
    const p = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(p);
  };

  const nextPage = () => {
    if (currentPage < totalPages) goToPage(currentPage + 1);
  };

  const prevPage = () => {
    if (currentPage > 1) goToPage(currentPage - 1);
  };

  // PDF TTS helpers
  const extractPdfPageSentences = async (pageNum: number): Promise<string[]> => {
    if (!pdfDocRef.current) return [];
    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const textContent = await page.getTextContent();
      const rawText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');
      return splitIntoSentences(rawText);
    } catch (err) {
      console.warn('Lỗi trích xuất chữ từ trang PDF:', err);
      return [];
    }
  };

  const handleStartPdfTts = async () => {
    lastTtsPageRef.current = currentPage;
    const sentences = await extractPdfPageSentences(currentPage);
    if (sentences.length > 0) {
      setTtsSentences(sentences);
      setTtsSentenceIndex(0);
      setShowTts(true);
    } else {
      alert('Không tìm thấy văn bản để đọc trên trang này (có thể là trang scan hình ảnh).');
    }
  };

  const handlePdfPlayResume = async () => {
    if (currentPage !== lastTtsPageRef.current) {
      lastTtsPageRef.current = currentPage;
      const sentences = await extractPdfPageSentences(currentPage);
      if (sentences.length > 0) {
        setTtsSentences(sentences);
        setTtsSentenceIndex(0);
        ttsService.loadSentences(sentences, 0);
      }
    }
  };

  const handlePdfSentenceChange = (idx: number) => {
    setTtsSentenceIndex(idx);
  };

  const handlePdfNextPageTts = async () => {
    if (currentPage < totalPages) {
      const nextPageNum = currentPage + 1;
      goToPage(nextPageNum);
      lastTtsPageRef.current = nextPageNum;
      const nextSentences = await extractPdfPageSentences(nextPageNum);
      if (nextSentences.length > 0) {
        setTtsSentences(nextSentences);
        setTtsSentenceIndex(0);
      } else {
        ttsService.stop();
        setShowTts(false);
      }
    } else {
      ttsService.stop();
      setShowTts(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        nextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prevPage();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages]);

  // Toggle Bookmark
  const handleToggleBookmark = async () => {
    const cfiKey = `page_${currentPage}`;
    if (isCurrentBookmarked) {
      const bm = bookmarks.find((b) => b.cfi === cfiKey);
      if (bm) {
        await removeBookmark(bm.id);
        setBookmarks((prev) => prev.filter((b) => b.id !== bm.id));
      }
    } else {
      const pct = Math.round((currentPage / totalPages) * 100);
      const newBm: Bookmark = {
        id: `bm_${Date.now()}`,
        bookId: book.id,
        cfi: cfiKey,
        title: `Trang ${currentPage}`,
        percentage: pct,
        previewText: `Trang ${currentPage} / ${totalPages}`,
        createdAt: Date.now(),
      };
      await addBookmark(newBm);
      setBookmarks((prev) => [newBm, ...prev]);
    }
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Theme filter for canvas
  const getThemeFilter = () => {
    switch (settings.theme) {
      case 'black':
      case 'dark':
        return 'invert(0.9) hue-rotate(180deg) brightness(0.95) contrast(1.1)';
      case 'sepia':
        return 'sepia(0.35) contrast(0.95) brightness(0.98)';
      case 'forest':
        return 'invert(0.85) sepia(0.3) hue-rotate(90deg) brightness(0.9)';
      case 'nord':
        return 'invert(0.88) hue-rotate(190deg) contrast(1.05)';
      default:
        return 'none';
    }
  };

  const brightnessDim = (100 - settings.brightness) / 100;

  return (
    <div className={`reader-container theme-${settings.theme}`}>
      {/* Top Header */}
      <header className={`reader-top-bar ${!showBars ? 'hidden' : ''}`}>
        <div className="reader-bar-left">
          <button className="btn-icon" onClick={onClose} title="Trở về Thư viện">
            <ArrowLeft size={18} />
          </button>
          <button className="btn-icon" onClick={() => setShowToc(true)} title="Mục lục">
            <Menu size={18} />
          </button>
        </div>

        <span className="reader-chapter-title" title={`${book.title} - Trang ${currentPage}/${totalPages}`}>
          {book.title} &bull; Trang {currentPage}/{totalPages}
        </span>

        <div className="reader-bar-right">
          <button
            className={`btn-icon ${isCurrentBookmarked ? 'active-bookmark' : ''}`}
            onClick={handleToggleBookmark}
            title={isCurrentBookmarked ? 'Bỏ đánh dấu' : 'Đánh dấu trang này'}
          >
            {isCurrentBookmarked ? <BookmarkCheck size={18} color="#f59e0b" /> : <BookmarkIcon size={18} />}
          </button>
          <button className="btn-icon hide-on-mobile" onClick={() => setShowBookmarks(true)} title="Danh sách trang đã lưu">
            <BookmarkIcon size={18} />
          </button>
          <button
            className="btn-icon"
            onClick={() => setShowBrightnessMenu(!showBrightnessMenu)}
            title="Độ sáng"
          >
            <Sun size={18} />
          </button>
          <button
            className="btn-icon"
            onClick={handleStartPdfTts}
            title="Đọc văn bản bằng giọng nói (TTS)"
          >
            <Volume2 size={18} />
          </button>
          <button className="btn-icon hide-on-mobile" onClick={toggleFullscreen} title="Toàn màn hình">
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </header>

      {/* Brightness Quick Popup */}
      {showBrightnessMenu && (
        <div className="brightness-popup">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Sun size={16} color="#f59e0b" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Độ sáng đọc sách ({settings.brightness}%)</span>
          </div>
          <input
            type="range"
            min="30"
            max="100"
            value={settings.brightness}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSettings((prev) => ({ ...prev, brightness: val }));
              saveSettings({ brightness: val });
            }}
            className="slider-input"
          />
        </div>
      )}

      {/* Main View Area */}
      <div
        className="reader-stage"
        ref={containerRef}
        onClick={() => setShowBars(!showBars)}
      >
        <div
          className="pdf-viewport-wrapper"
          onClick={(e) => e.stopPropagation()}
        >
          <canvas
            ref={canvasRef}
            className="pdf-page-canvas"
            style={{
              filter: getThemeFilter(),
            }}
          />
        </div>

        {/* Night Dimmer Overlay */}
        {brightnessDim > 0 && (
          <div
            className="reader-night-overlay"
            style={{
              backgroundColor: `rgba(0, 0, 0, ${brightnessDim * 0.75})`,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Touch zones for flipping */}
        <div
          className="touch-zone touch-left"
          onClick={(e) => {
            e.stopPropagation();
            prevPage();
          }}
        />
        <div
          className="touch-zone touch-right"
          onClick={(e) => {
            e.stopPropagation();
            nextPage();
          }}
        />
      </div>

      {/* Bottom Control Bar */}
      <footer className={`reader-bottom-bar ${!showBars ? 'hidden' : ''}`}>
        <div className="reader-scrubber-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            className="btn-icon"
            onClick={prevPage}
            disabled={currentPage <= 1}
            title="Trang trước"
          >
            <ChevronLeft size={22} />
          </button>

          {/* Clean percentage progress display without draggable slider */}
          <div
            className="pdf-page-badge-wrap"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px 18px',
              borderRadius: 20,
              background: 'rgba(128, 128, 128, 0.12)',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {Math.round((currentPage / totalPages) * 100)}%
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: -1 }}>
              Trang {currentPage} / {totalPages}
            </span>
          </div>

          <button
            className="btn-icon"
            onClick={nextPage}
            disabled={currentPage >= totalPages}
            title="Trang sau"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        <div className="reader-status-row">
          <div className="pdf-zoom-controls">
            <button
              className="btn-icon-sm"
              onClick={() => {
                setFitMode('custom');
                setScale((s) => Math.max(0.6, s - 0.15));
              }}
              title="Thu nhỏ"
            >
              <ZoomOut size={16} />
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {Math.round(scale * 100)}%
            </span>
            <button
              className="btn-icon-sm"
              onClick={() => {
                setFitMode('custom');
                setScale((s) => Math.min(3.0, s + 0.15));
              }}
              title="Phóng to"
            >
              <ZoomIn size={16} />
            </button>
            <button
              className={`btn-chip ${fitMode === 'width' ? 'active' : ''}`}
              onClick={() => setFitMode('width')}
              title="Vừa chiều rộng màn hình"
            >
              Vừa trang
            </button>
          </div>

          <div className="page-indicator">
            <span>
              Trang {currentPage} / {totalPages} ({Math.round((currentPage / totalPages) * 100)}%)
            </span>
          </div>
        </div>
      </footer>

      {/* Floating Active Sentence Banner for PDF */}
      {showTts && ttsSentences[ttsSentenceIndex] && (
        <div className="pdf-tts-floating-sentence">
          <div className="pdf-tts-sentence-pill">
            <span className="pdf-tts-badge">
              Trang {currentPage} &bull; Câu {ttsSentenceIndex + 1}/{ttsSentences.length}
            </span>
            <span className="pdf-tts-current-text">{ttsSentences[ttsSentenceIndex]}</span>
          </div>
        </div>
      )}

      {/* TTS Floating Player */}
      {showTts && (
        <TtsPlayer
          bookTitle={book.title}
          chapterTitle={`Trang ${currentPage} / ${totalPages}`}
          sentences={ttsSentences}
          initialSentenceIndex={ttsSentenceIndex}
          onSentenceChange={handlePdfSentenceChange}
          onClose={() => {
            ttsService.stop();
            setShowTts(false);
          }}
          onNextChapter={handlePdfNextPageTts}
          onPlayResume={handlePdfPlayResume}
        />
      )}

      {/* Drawers */}
      <TocDrawer
        isOpen={showToc}
        onClose={() => setShowToc(false)}
        toc={toc}
        onSelectChapter={(href: string) => {
          const pageNum = parseInt(href, 10);
          if (!isNaN(pageNum)) goToPage(pageNum);
          setShowToc(false);
        }}
      />

      <BookmarksDrawer
        isOpen={showBookmarks}
        onClose={() => setShowBookmarks(false)}
        bookmarks={bookmarks}
        onSelectBookmark={(cfi: string) => {
          const num = parseInt(cfi.replace('page_', ''), 10);
          if (!isNaN(num)) goToPage(num);
          setShowBookmarks(false);
        }}
        onRemoveBookmark={async (id: string) => {
          await removeBookmark(id);
          setBookmarks((prev) => prev.filter((b) => b.id !== id));
        }}
      />
    </div>
  );
};
