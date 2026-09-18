import React, { useEffect, useRef, useState, useCallback } from 'react';
import ePub from 'epubjs';
import type { Book as EpubBook, Rendition, NavItem } from 'epubjs';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Bookmark as BookmarkIcon,
  Search,
  Sliders,
  Maximize2,
  Minimize2,
  Volume2,
  Menu,
  BookmarkCheck,
  Highlighter,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import type {
  BookRecord,
  Bookmark,
  ReadingSettings,
  TocItem,
  SearchResultItem,
  HighlightItem,
  HighlightColor,
} from '../types';
import {
  getBookBookmarks,
  addBookmark,
  removeBookmark,
  saveSettings,
  getBookHighlights,
  saveHighlight,
  removeHighlight,
} from '../services/storage';
import { TocDrawer } from './TocDrawer';
import { BookmarksDrawer } from './BookmarksDrawer';
import { SettingsModal } from './SettingsModal';
import { SearchModal } from './SearchModal';
import { TtsPlayer } from './TtsPlayer';
import { TextSelectionMenu, HIGHLIGHT_COLORS } from './TextSelectionMenu';
import { QuotesDrawer } from './QuotesDrawer';
import { TranslateModal } from './TranslateModal';
import { QuoteCardModal } from './QuoteCardModal';

interface ReaderViewProps {
  book: BookRecord;
  fileBuffer: ArrayBuffer;
  initialSettings: ReadingSettings;
  onClose: () => void;
  onUpdateProgress: (cfi: string, progress: number) => void;
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  book,
  fileBuffer,
  initialSettings,
  onClose,
  onUpdateProgress,
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<Rendition | null>(null);

  // States
  const [settings, setSettings] = useState<ReadingSettings>(initialSettings);
  const [showBars, setShowBars] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chapterTitle, setChapterTitle] = useState('Đang tải...');
  const [currentCfi, setCurrentCfi] = useState<string>(book.lastCfi || '');
  const [progressPercentage, setProgressPercentage] = useState<number>(book.progress || 0);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [isCurrentBookmarked, setIsCurrentBookmarked] = useState(false);

  // Selection & Translation state
  const [selectionData, setSelectionData] = useState<{
    cfiRange: string;
    text: string;
    position: { x: number; y: number };
  } | null>(null);
  const [translateText, setTranslateText] = useState<string | null>(null);
  const [quoteCardData, setQuoteCardData] = useState<{ quote: string; note?: string } | null>(null);

  // Drawers & Modals
  const [showToc, setShowToc] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showQuotes, setShowQuotes] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showTts, setShowTts] = useState(false);
  const [ttsText, setTtsText] = useState('');

  // Load bookmarks & highlights on start
  useEffect(() => {
    getBookBookmarks(book.id).then(setBookmarks);
    getBookHighlights(book.id).then(setHighlights);
  }, [book.id]);

  // Check if current location is bookmarked
  useEffect(() => {
    if (!currentCfi) return;
    const exists = bookmarks.some((b) => b.cfi === currentCfi);
    setIsCurrentBookmarked(exists);
  }, [currentCfi, bookmarks]);

  const settingsRef = useRef<ReadingSettings>(initialSettings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Inject deep CSS rules into the EPUB iframe document
  const injectThemeStyles = useCallback(
    (doc: Document, currentSettings: ReadingSettings) => {
      if (!doc || !doc.head) return;

      const themeColors = {
        light: { bg: '#f8f9fa', text: '#212529', link: '#4f46e5' },
        sepia: { bg: '#f4ecd8', text: '#3d2b1f', link: '#b45309' },
        forest: { bg: '#13241b', text: '#d8ebd9', link: '#4ade80' },
        dark: { bg: '#1a1d24', text: '#d8dee9', link: '#818cf8' },
        nord: { bg: '#1e2530', text: '#dbe2ef', link: '#88c0d0' },
        black: { bg: '#000000', text: '#f1f5f9', link: '#38bdf8' },
      }[currentSettings.theme];

      const fontFamilies = {
        literata: "'Literata', Georgia, serif",
        merriweather: "'Merriweather', serif",
        inter: "'Inter', sans-serif",
        mono: "'JetBrains Mono', monospace",
      }[currentSettings.fontFamily];

      // Inject Google Fonts link inside iframe head if not present
      let fontLink = doc.getElementById('readera-google-fonts');
      if (!fontLink) {
        fontLink = doc.createElement('link');
        fontLink.id = 'readera-google-fonts';
        fontLink.setAttribute('rel', 'stylesheet');
        fontLink.setAttribute(
          'href',
          'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,500;0,7..72,600;1,7..72,400;1,7..72,600&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400&display=swap'
        );
        doc.head.appendChild(fontLink);
      }

      let styleEl = doc.getElementById('readera-epub-theme-style');
      if (!styleEl) {
        styleEl = doc.createElement('style');
        styleEl.id = 'readera-epub-theme-style';
        doc.head.appendChild(styleEl);
      }

      styleEl.innerHTML = `
        html, body {
          background-color: ${themeColors.bg} !important;
          background: ${themeColors.bg} !important;
          color: ${themeColors.text} !important;
          font-family: ${fontFamilies} !important;
          font-size: ${currentSettings.fontSize}px !important;
          line-height: ${currentSettings.lineHeight} !important;
          text-align: ${currentSettings.textAlign} !important;
          -webkit-text-size-adjust: 100% !important;
          word-break: break-word !important;
        }
        *, *::before, *::after {
          color: ${themeColors.text} !important;
        }
        p, div, span, h1, h2, h3, h4, h5, h6, li, em, strong, b, i, small, font, section, article {
          color: ${themeColors.text} !important;
          font-family: ${fontFamilies} !important;
          line-height: ${currentSettings.lineHeight} !important;
        }
        p {
          text-indent: 1.2em;
          margin-top: 0.35em !important;
          margin-bottom: 0.35em !important;
        }
        h1, h2, h3, h4, h5, h6 {
          border-bottom-color: rgba(128, 128, 128, 0.25) !important;
          text-align: center;
        }
        blockquote {
          color: ${themeColors.text} !important;
          border-left: 4px solid var(--color-primary, #6366f1) !important;
          background: ${currentSettings.theme === 'black' ? '#141414' : 'rgba(128, 128, 128, 0.08)'} !important;
        }
        a, a:visited {
          color: ${themeColors.link} !important;
        }
        hr, hr.divider {
          border-color: rgba(128, 128, 128, 0.25) !important;
        }
      `;
    },
    []
  );

  // Apply visual styling into epubjs rendition
  const applyStyles = useCallback(
    (currentSettings: ReadingSettings) => {
      if (!renditionRef.current) return;

      const themeColors = {
        light: { bg: '#f8f9fa', text: '#212529' },
        sepia: { bg: '#f4ecd8', text: '#3d2b1f' },
        forest: { bg: '#13241b', text: '#d8ebd9' },
        dark: { bg: '#1a1d24', text: '#d8dee9' },
        nord: { bg: '#1e2530', text: '#dbe2ef' },
        black: { bg: '#000000', text: '#f1f5f9' },
      }[currentSettings.theme];

      const fontFamilies = {
        literata: "'Literata', Georgia, serif",
        merriweather: "'Merriweather', serif",
        inter: "'Inter', sans-serif",
        mono: "'JetBrains Mono', monospace",
      }[currentSettings.fontFamily];

      const rendition = renditionRef.current;
      rendition.themes.fontSize(`${currentSettings.fontSize}px`);

      rendition.themes.override('color', themeColors.text, true);
      rendition.themes.override('background', themeColors.bg, true);
      rendition.themes.override('font-family', fontFamilies, true);
      rendition.themes.override('line-height', `${currentSettings.lineHeight}`, true);
      rendition.themes.override('text-align', currentSettings.textAlign, true);

      // Force-inject comprehensive CSS into all rendered content documents
      const contents: any = rendition.getContents();
      if (Array.isArray(contents)) {
        contents.forEach((c: any) => {
          if (c && c.document) {
            injectThemeStyles(c.document, currentSettings);
          }
        });
      }
    },
    [injectThemeStyles]
  );

  // Initialize EPUB Book & Rendition
  useEffect(() => {
    if (!viewerRef.current) return;

    // Reset container
    viewerRef.current.innerHTML = '';

    const epubBook = ePub(fileBuffer);
    bookRef.current = epubBook;

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 800;
    const effectiveSpread = isMobile ? 'none' : (settings.spread === 'always' ? 'always' : 'none');

    const rendition = epubBook.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      flow: settings.flow === 'scrolled-doc' ? 'scrolled-doc' : 'paginated',
      spread: effectiveSpread,
      minSpreadWidth: 1000,
      allowScriptedContent: true,
    });
    renditionRef.current = rendition;

    // Hook each content load to inject custom styles
    rendition.hooks.content.register((contents: any) => {
      if (contents && contents.document) {
        injectThemeStyles(contents.document, settingsRef.current);
      }
    });

    // Apply styles after rendition is created
    applyStyles(settings);

    // Display initial position or beginning
    if (book.lastCfi) {
      rendition.display(book.lastCfi);
    } else {
      rendition.display();
    }

    // Load Navigation and Locations
    epubBook.ready
      .then(() => epubBook.loaded.navigation)
      .then((nav) => {
        const parseNavItems = (items: NavItem[]): TocItem[] => {
          return items.map((item) => ({
            id: item.id,
            label: item.label,
            href: item.href,
            subitems: item.subitems ? parseNavItems(item.subitems) : undefined,
          }));
        };
        const parsedToc = parseNavItems(nav.toc);
        setToc(parsedToc);
        return epubBook.locations.generate(1000);
      })
      .then(() => {
        if (rendition.location) {
          const loc = rendition.location;
          const pct = Math.round(epubBook.locations.percentageFromCfi(loc.start.cfi) * 100);
          setProgressPercentage(pct);
        }
      })
      .catch((err) => {
        console.warn('Lỗi nạp locations/TOC:', err);
      });

    // Handle relocated (page changed)
    rendition.on('relocated', (location: any) => {
      if (!location || !location.start) return;
      const cfi = location.start.cfi;
      setCurrentCfi(cfi);

      let pct = progressPercentage;
      if (epubBook.locations && epubBook.locations.length()) {
        pct = Math.round(epubBook.locations.percentageFromCfi(cfi) * 100);
      } else if (location.start.percentage) {
        pct = Math.round(location.start.percentage * 100);
      }
      setProgressPercentage(pct);
      onUpdateProgress(cfi, pct);

      // Find chapter title from TOC
      if (epubBook.navigation && epubBook.navigation.toc) {
        const currentHref = location.start.href;
        const findChapter = (items: NavItem[]): string | undefined => {
          for (const item of items) {
            if (currentHref && currentHref.includes(item.href)) return item.label;
            if (item.subitems) {
              const sub = findChapter(item.subitems);
              if (sub) return sub;
            }
          }
          return undefined;
        };
        const title = findChapter(epubBook.navigation.toc);
        setChapterTitle(title?.trim() || book.title);
      }
    });

    // Handle Text Selection in reader
    rendition.on('selected', (cfiRange: string) => {
      try {
        const range = rendition.getRange(cfiRange);
        const text = range.toString();
        if (!text || text.trim().length === 0) return;

        const iframe = viewerRef.current?.querySelector('iframe');
        const iframeRect = iframe ? iframe.getBoundingClientRect() : { left: 0, top: 0 };
        const rect = range.getBoundingClientRect();

        const x = iframeRect.left + rect.left + rect.width / 2;
        const y = iframeRect.top + rect.top;

        setSelectionData({
          cfiRange,
          text: text.trim(),
          position: { x, y },
        });
      } catch (err) {
        console.warn('Lỗi nhận diện bôi đen:', err);
      }
    });

    // Listen to key events inside rendition iframe
    rendition.on('keyup', handleKeyNavigation);

    // Dynamic resize handler for viewport and orientation change
    const handleWindowResize = () => {
      if (renditionRef.current && viewerRef.current) {
        const isMobileNow = window.innerWidth < 800;
        if (isMobileNow) {
          try {
            (renditionRef.current as any).spread('none', 1000);
          } catch {}
        }
        renditionRef.current.resize(viewerRef.current.clientWidth, viewerRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      try {
        rendition.destroy();
        epubBook.destroy();
      } catch {
        // ignore
      }
    };
  }, [fileBuffer]);

  // Re-apply highlights to rendition when rendered
  useEffect(() => {
    if (!renditionRef.current || highlights.length === 0) return;
    highlights.forEach((item) => {
      try {
        const colorHex = HIGHLIGHT_COLORS.find((c) => c.id === item.color)?.hex || '#fbbf24';
        renditionRef.current?.annotations.add(
          'highlight',
          item.cfiRange,
          {},
          undefined,
          `hl-${item.id}`,
          { fill: colorHex, 'fill-opacity': '0.35' }
        );
      } catch {
        // ignore duplicate annotations
      }
    });
  }, [highlights]);

  // Re-apply styles on settings change
  useEffect(() => {
    applyStyles(settings);
    saveSettings(settings);
  }, [settings, applyStyles]);

  // Re-render if flow mode or spread changes
  const handleUpdateSettings = (newSettings: Partial<ReadingSettings>) => {
    const updated = { ...settings, ...newSettings };
    if (newSettings.flow && newSettings.flow !== settings.flow) {
      if (renditionRef.current) {
        try {
          renditionRef.current.flow(newSettings.flow === 'scrolled-doc' ? 'scrolled-doc' : 'paginated');
        } catch {}
      }
    }
    if (newSettings.spread && newSettings.spread !== settings.spread) {
      if (renditionRef.current) {
        try {
          const isMobileNow = typeof window !== 'undefined' && window.innerWidth < 800;
          const targetSpread = isMobileNow ? 'none' : newSettings.spread;
          (renditionRef.current as any).spread(targetSpread, 1000);
        } catch {}
      }
    }
    setSettings(updated);
  };

  // Jump to previous chapter
  const handlePrevChapter = () => {
    if (!toc.length || !renditionRef.current) return;
    const currentIdx = toc.findIndex((item) => item.label === chapterTitle);
    if (currentIdx > 0) {
      renditionRef.current.display(toc[currentIdx - 1].href);
    } else {
      renditionRef.current.display(toc[0].href);
    }
  };

  // Jump to next chapter
  const handleNextChapter = () => {
    if (!toc.length || !renditionRef.current) return;
    const currentIdx = toc.findIndex((item) => item.label === chapterTitle);
    if (currentIdx >= 0 && currentIdx < toc.length - 1) {
      renditionRef.current.display(toc[currentIdx + 1].href);
    }
  };

  // Keyboard navigation handler
  const handleKeyNavigation = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      handleNextPage();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      handlePrevPage();
    } else if (e.key === 'Escape') {
      setShowBars((prev) => !prev);
      setSelectionData(null);
    }
  };

  useEffect(() => {
    window.addEventListener('keyup', handleKeyNavigation);
    return () => window.removeEventListener('keyup', handleKeyNavigation);
  }, []);

  // Navigation actions
  const handleNextPage = () => {
    if (renditionRef.current) {
      renditionRef.current.next();
      setSelectionData(null);
    }
  };

  const handlePrevPage = () => {
    if (renditionRef.current) {
      renditionRef.current.prev();
      setSelectionData(null);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setProgressPercentage(val);
    if (bookRef.current && renditionRef.current && bookRef.current.locations.length()) {
      const cfi = bookRef.current.locations.cfiFromPercentage(val / 100);
      renditionRef.current.display(cfi);
    }
  };

  // Bookmark current position
  const handleToggleBookmarkCurrent = async () => {
    if (!currentCfi) return;
    if (isCurrentBookmarked) {
      const target = bookmarks.find((b) => b.cfi === currentCfi);
      if (target) {
        await removeBookmark(target.id);
        setBookmarks((prev) => prev.filter((b) => b.id !== target.id));
      }
    } else {
      const newBm: Bookmark = {
        id: `bm_${Date.now()}`,
        bookId: book.id,
        cfi: currentCfi,
        title: chapterTitle || 'Đánh dấu trang',
        percentage: progressPercentage,
        createdAt: Date.now(),
      };
      await addBookmark(newBm);
      setBookmarks((prev) => [newBm, ...prev]);
    }
  };

  // Add Highlight & Quote
  const handleAddHighlight = async (color: HighlightColor, note?: string) => {
    if (!selectionData || !renditionRef.current) return;
    const highlightId = `hl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newHighlight: HighlightItem = {
      id: highlightId,
      bookId: book.id,
      cfiRange: selectionData.cfiRange,
      text: selectionData.text,
      color,
      note,
      chapterTitle,
      createdAt: Date.now(),
    };

    await saveHighlight(newHighlight);
    setHighlights((prev) => [newHighlight, ...prev]);

    const colorHex = HIGHLIGHT_COLORS.find((c) => c.id === color)?.hex || '#fbbf24';
    try {
      renditionRef.current.annotations.add(
        'highlight',
        selectionData.cfiRange,
        {},
        undefined,
        `hl-${highlightId}`,
        { fill: colorHex, 'fill-opacity': '0.35' }
      );
    } catch {}

    setSelectionData(null);
  };

  // Delete Highlight
  const handleDeleteHighlight = async (id: string) => {
    const target = highlights.find((h) => h.id === id);
    if (target && renditionRef.current) {
      try {
        renditionRef.current.annotations.remove(target.cfiRange, 'highlight');
      } catch {}
    }
    await removeHighlight(id);
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  };

  // Fullscreen toggle
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  // In-book search
  const handleExecuteSearch = async (query: string): Promise<SearchResultItem[]> => {
    if (!bookRef.current) return [];
    const book = bookRef.current;
    const results: SearchResultItem[] = [];

    const spine = (book as any).spine;
    if (spine && spine.spineItems) {
      for (const item of spine.spineItems) {
        try {
          await item.load(book.load.bind(book));
          const matches = item.find(query);
          for (const match of matches) {
            results.push({
              cfi: match.cfi,
              excerpt: match.excerpt,
            });
          }
          item.unload();
        } catch {
          // ignore error
        }
      }
    }
    return results;
  };

  // Start TTS
  const handleStartTts = () => {
    if (renditionRef.current) {
      try {
        const contents: any = renditionRef.current.getContents();
        const item = Array.isArray(contents) ? contents[0] : contents;
        if (item && item.document) {
          const doc = item.document;
          if (doc && doc.body) {
            const text = doc.body.innerText || doc.body.textContent || '';
            setTtsText(text.trim());
            setShowTts(true);
            return;
          }
        }
      } catch (err) {
        console.warn('Lỗi trích xuất TTS:', err);
      }
    }
    setTtsText(chapterTitle);
    setShowTts(true);
  };

  return (
    <div className={`reader-container reader-theme-${settings.theme}`}>
      {/* Top Floating Control Bar */}
      <header className={`reader-top-bar ${!showBars ? 'hidden' : ''}`}>
        <div className="reader-bar-left">
          <button className="btn-icon" onClick={onClose} title="Quay lại thư viện">
            <ArrowLeft size={18} />
          </button>
          <button className="btn-icon" onClick={() => setShowToc(true)} title="Mục lục sách">
            <Menu size={18} />
          </button>
        </div>

        <span className="reader-chapter-title" title={chapterTitle}>
          {chapterTitle}
        </span>

        <div className="reader-bar-right">
          {/* Bookmark toggle */}
          <button
            className="btn-icon"
            onClick={handleToggleBookmarkCurrent}
            title={isCurrentBookmarked ? 'Bỏ đánh dấu trang này' : 'Đánh dấu trang hiện tại'}
          >
            {isCurrentBookmarked ? (
              <BookmarkCheck size={18} color="#f59e0b" />
            ) : (
              <BookmarkIcon size={18} />
            )}
          </button>

          {/* Bookmarks list */}
          <button
            className="btn-icon hide-on-mobile"
            onClick={() => setShowBookmarks(true)}
            title="Danh sách đánh dấu trang"
          >
            <BookmarkIcon size={18} fill="currentColor" style={{ opacity: 0.6 }} />
          </button>

          {/* Quotes & Notes button (ReadEra feature) */}
          <button
            className="btn-icon hide-on-mobile"
            onClick={() => setShowQuotes(true)}
            title={`Trích dẫn & Ghi chú (${highlights.length})`}
          >
            <Highlighter size={18} color={highlights.length > 0 ? '#38bdf8' : 'currentColor'} />
          </button>

          {/* In-book search */}
          <button
            className="btn-icon hide-on-mobile"
            onClick={() => setShowSearch(true)}
            title="Tìm kiếm trong sách"
          >
            <Search size={18} />
          </button>

          {/* TTS Read Aloud */}
          <button
            className="btn-icon"
            onClick={handleStartTts}
            title="Đọc văn bản bằng giọng nói (TTS)"
          >
            <Volume2 size={18} />
          </button>

          {/* Settings */}
          <button
            className="btn-icon"
            onClick={() => setShowSettings(true)}
            title="Tùy chỉnh giao diện đọc"
          >
            <Sliders size={18} />
          </button>

          {/* Fullscreen (desktop) */}
          <button
            className="btn-icon hide-on-mobile"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </header>

      {/* Main EPUB Reader Canvas */}
      <div className="reader-stage">
        <div ref={viewerRef} className="epub-viewer-area" />

        {/* Night Dimmer Overlay */}
        {settings.brightness && settings.brightness < 100 && (
          <div
            className="reader-night-overlay"
            style={{
              backgroundColor: `rgba(0, 0, 0, ${((100 - settings.brightness) / 100) * 0.75})`,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Tap/Click navigation zones */}
        <div className="reader-nav-zone prev" onClick={handlePrevPage} title="Trang trước" />
        <div
          className="reader-nav-zone center"
          onClick={() => {
            setShowBars((prev) => !prev);
            setSelectionData(null);
          }}
          title="Bật/tắt thanh công cụ"
        />
        <div className="reader-nav-zone next" onClick={handleNextPage} title="Trang tiếp" />

        {/* Arrow Buttons on Hover */}
        <button
          className="nav-arrow-btn prev"
          onClick={(e) => {
            e.stopPropagation();
            handlePrevPage();
          }}
          title="Trang trước"
        >
          <ChevronLeft size={24} />
        </button>
        <button
          className="nav-arrow-btn next"
          onClick={(e) => {
            e.stopPropagation();
            handleNextPage();
          }}
          title="Trang tiếp"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Bottom Floating Control Bar */}
      <footer className={`reader-bottom-bar ${!showBars ? 'hidden' : ''}`}>
        <div className="reader-slider-row">
          <button
            className="btn-icon"
            style={{ width: 28, height: 28 }}
            onClick={handlePrevChapter}
            title="Chương trước"
          >
            <SkipBack size={15} />
          </button>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <input
              type="range"
              min="0"
              max="100"
              value={progressPercentage}
              onChange={handleSliderChange}
              className="reader-slider"
            />
          </div>

          <button
            className="btn-icon"
            style={{ width: 28, height: 28 }}
            onClick={handleNextChapter}
            title="Chương kế tiếp"
          >
            <SkipForward size={15} />
          </button>
        </div>

        <div className="reader-bottom-meta">
          <div className="reader-page-nav">
            <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={handlePrevPage}>
              <ChevronLeft size={16} />
            </button>
            <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={handleNextPage}>
              <ChevronRight size={16} />
            </button>
          </div>

          <span className="reader-progress-meta-text">{progressPercentage}% hoàn thành</span>
          <span className="reader-book-title-meta" title={book.title}>
            {book.title}
          </span>
        </div>
      </footer>

      {/* Text Selection Floating Popover Menu (ReadEra Signature) */}
      {selectionData && (
        <TextSelectionMenu
          position={selectionData.position}
          selectedText={selectionData.text}
          onHighlight={(color) => handleAddHighlight(color)}
          onAddNote={(color, note) => handleAddHighlight(color, note)}
          onTranslate={(text) => setTranslateText(text)}
          onSpeak={(text) => {
            setTtsText(text);
            setShowTts(true);
          }}
          onCreateQuoteCard={(text) => setQuoteCardData({ quote: text })}
          onClose={() => setSelectionData(null)}
        />
      )}

      {/* Quick Translate Modal */}
      {translateText && (
        <TranslateModal
          isOpen={!!translateText}
          onClose={() => setTranslateText(null)}
          text={translateText}
        />
      )}

      {/* TTS Floating Player */}
      {showTts && (
        <TtsPlayer
          textToRead={ttsText}
          onClose={() => setShowTts(false)}
          onNextChunk={handleNextPage}
        />
      )}

      {/* Modals & Drawers */}
      <TocDrawer
        isOpen={showToc}
        onClose={() => setShowToc(false)}
        toc={toc}
        currentHref={currentCfi}
        onSelectChapter={(href) => {
          if (renditionRef.current) renditionRef.current.display(href);
        }}
      />

      <BookmarksDrawer
        isOpen={showBookmarks}
        onClose={() => setShowBookmarks(false)}
        bookmarks={bookmarks}
        onSelectBookmark={(cfi) => {
          if (renditionRef.current) renditionRef.current.display(cfi);
        }}
        onRemoveBookmark={async (id) => {
          await removeBookmark(id);
          setBookmarks((prev) => prev.filter((b) => b.id !== id));
        }}
      />

      <QuotesDrawer
        isOpen={showQuotes}
        onClose={() => setShowQuotes(false)}
        highlights={highlights}
        onSelectHighlight={(cfi) => {
          if (renditionRef.current) renditionRef.current.display(cfi);
        }}
        onDeleteHighlight={handleDeleteHighlight}
        onOpenQuoteCard={(quote, note) => setQuoteCardData({ quote, note })}
        bookTitle={book.title}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      <SearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onSearch={handleExecuteSearch}
        onSelectResult={(cfi) => {
          if (renditionRef.current) renditionRef.current.display(cfi);
        }}
      />

      {/* Quote Card Creator Modal */}
      {quoteCardData && (
        <QuoteCardModal
          quote={quoteCardData.quote}
          note={quoteCardData.note}
          bookTitle={book.title}
          bookAuthor={book.author}
          onClose={() => setQuoteCardData(null)}
        />
      )}
    </div>
  );
};
