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
  getSettings,
  getStoredSettingsSync,
  getBookHighlights,
  saveHighlight,
  removeHighlight,
} from '../services/storage';
import { TocDrawer } from './TocDrawer';
import { BookmarksDrawer } from './BookmarksDrawer';
import { SettingsModal } from './SettingsModal';
import { SearchModal } from './SearchModal';
import { TtsPlayer } from './TtsPlayer';
import { splitIntoSentences, ttsService } from '../services/ttsService';
import { TextSelectionMenu, HIGHLIGHT_COLORS } from './TextSelectionMenu';
import { QuotesDrawer } from './QuotesDrawer';
import { TranslateModal } from './TranslateModal';
import { QuoteCardModal } from './QuoteCardModal';

interface ReaderViewProps {
  book: BookRecord;
  fileBuffer: ArrayBuffer;
  initialSettings: ReadingSettings;
  onClose: (finalSettings?: ReadingSettings) => void;
  onUpdateSettings?: (newSettings: ReadingSettings) => void;
  onUpdateProgress: (cfi: string, progress: number) => void;
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  book,
  fileBuffer,
  initialSettings,
  onClose,
  onUpdateSettings,
  onUpdateProgress,
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<Rendition | null>(null);

  // States
  const [settings, setSettings] = useState<ReadingSettings>(() => {
    return { ...initialSettings, ...getStoredSettingsSync() };
  });
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
  const [ttsSentences, setTtsSentences] = useState<string[]>([]);
  const [ttsSentenceIndex, setTtsSentenceIndex] = useState<number>(0);
  const [ttsHighlightEnabled, setTtsHighlightEnabled] = useState<boolean>(true);
  const lastTtsIndexRef = useRef<number>(0);
  const displayPromiseRef = useRef<Promise<void> | null>(null);
  const currentLocationRef = useRef<any>(null);
  const currentTtsCfiRef = useRef<string | null>(null);
  const currentTtsSectionHrefRef = useRef<string | null>(null);
  const currentReadingAnchorRef = useRef<string>('');
  const prevSettingsRef = useRef<ReadingSettings>(initialSettings);

  // Load bookmarks & highlights on start, and ensure latest settings loaded
  useEffect(() => {
    getBookBookmarks(book.id).then(setBookmarks);
    getBookHighlights(book.id).then(setHighlights);
    getSettings().then((saved) => {
      if (saved) {
        setSettings((prev) => ({ ...prev, ...saved }));
      }
    });
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
        crimson: "'Crimson Pro', Georgia, serif",
        lora: "'Lora', Georgia, serif",
        sourceserif: "'Source Serif 4', Georgia, serif",
        nunito: "'Nunito', sans-serif",
      }[currentSettings.fontFamily];

      // Inject Google Fonts link inside iframe head if not present
      let fontLink = doc.getElementById('readera-google-fonts');
      if (!fontLink) {
        fontLink = doc.createElement('link');
        fontLink.id = 'readera-google-fonts';
        fontLink.setAttribute('rel', 'stylesheet');
        fontLink.setAttribute(
          'href',
          'https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,500;0,7..72,600;1,7..72,400;1,7..72,600&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400&family=Nunito:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,500;0,8..60,600;1,8..60,300;1,8..60,400&display=swap'
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
        /* ReadEra Signature Active Sentence Highlighting */
        mark.readera-tts-sentence-active,
        .readera-tts-sentence-active {
          background-color: ${
            currentSettings.theme === 'black' || currentSettings.theme === 'dark' || currentSettings.theme === 'nord'
              ? 'rgba(99, 102, 241, 0.38)'
              : currentSettings.theme === 'sepia'
              ? 'rgba(217, 119, 6, 0.30)'
              : currentSettings.theme === 'forest'
              ? 'rgba(74, 222, 128, 0.32)'
              : 'rgba(245, 158, 11, 0.35)'
          } !important;
          color: inherit !important;
          font-weight: 600 !important;
          border-radius: 4px !important;
          padding: 2px 4px !important;
          box-shadow: 0 0 0 2px ${
            currentSettings.theme === 'black' || currentSettings.theme === 'dark' || currentSettings.theme === 'nord'
              ? 'rgba(99, 102, 241, 0.25)'
              : currentSettings.theme === 'sepia'
              ? 'rgba(217, 119, 6, 0.22)'
              : currentSettings.theme === 'forest'
              ? 'rgba(74, 222, 128, 0.22)'
              : 'rgba(245, 158, 11, 0.25)'
          } !important;
          border-bottom: 2px solid ${
            currentSettings.theme === 'black' || currentSettings.theme === 'dark' || currentSettings.theme === 'nord'
              ? '#818cf8'
              : currentSettings.theme === 'sepia'
              ? '#b45309'
              : currentSettings.theme === 'forest'
              ? '#4ade80'
              : '#f59e0b'
          } !important;
          transition: background-color 0.2s ease, box-shadow 0.2s ease !important;
          display: inline !important;
        }

        @keyframes ttsSentenceLocatePulse {
          0% {
            box-shadow: 0 0 0 0 ${themeColors.link}, 0 0 16px ${themeColors.link} !important;
            transform: scale(1);
          }
          40% {
            box-shadow: 0 0 0 8px rgba(99, 102, 241, 0.2), 0 0 24px ${themeColors.link} !important;
            transform: scale(1.03);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(99, 102, 241, 0) !important;
            transform: scale(1);
          }
        }
        .readera-tts-sentence-locate-pulse {
          animation: ttsSentenceLocatePulse 1.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        .readera-tts-highlight {
          background-color: ${
            currentSettings.theme === 'black' || currentSettings.theme === 'dark' || currentSettings.theme === 'nord'
              ? 'rgba(99, 102, 241, 0.25)'
              : 'rgba(245, 158, 11, 0.22)'
          } !important;
          color: inherit !important;
          border-radius: 6px !important;
          transition: background-color 0.2s ease !important;
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
        crimson: "'Crimson Pro', Georgia, serif",
        lora: "'Lora', Georgia, serif",
        sourceserif: "'Source Serif 4', Georgia, serif",
        nunito: "'Nunito', sans-serif",
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

    // Hook each content load to inject custom styles and tap listeners
    rendition.hooks.content.register((contents: any) => {
      if (contents && contents.document) {
        injectThemeStyles(contents.document, settingsRef.current);

        contents.document.addEventListener('click', (e: MouseEvent) => {
          const sel = contents.window?.getSelection();
          if (sel && sel.toString().trim().length > 0) return;
          const target = e.target as HTMLElement | null;
          if (target && (target.tagName === 'A' || target.closest('a'))) return;

          const width = contents.window?.innerWidth || window.innerWidth;
          const x = e.clientX;
          if (x < width * 0.25) {
            renditionRef.current?.prev();
            setSelectionData(null);
          } else if (x > width * 0.75) {
            renditionRef.current?.next();
            setSelectionData(null);
          } else {
            setShowBars((prev) => !prev);
            setSelectionData(null);
          }
        });
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
          currentLocationRef.current = loc;
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
      currentLocationRef.current = location;
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

      // Update visible text anchor when user flips pages or scrolls normally
      if (!showTts) {
        setTimeout(() => {
          const anchor = getCurrentVisibleTextAnchor();
          if (anchor) currentReadingAnchorRef.current = anchor;
        }, 120);
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
        const targetCfi = currentLocationRef.current?.start?.cfi;
        (renditionRef.current as any).resize(viewerRef.current.clientWidth, viewerRef.current.clientHeight, targetCfi || undefined);
      }
    };
    window.addEventListener('resize', handleWindowResize);

    // ResizeObserver to detect any dimension change of the viewer container
    let resizeTimer: any = null;
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && viewerRef.current) {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0 && renditionRef.current) {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
              try {
                const targetCfi = currentLocationRef.current?.start?.cfi;
                (renditionRef.current as any)?.resize(Math.floor(width), Math.floor(height), targetCfi || undefined);
              } catch (e) {
                console.warn('ResizeObserver error:', e);
              }
            }, 50);
          }
        }
      });
      observer.observe(viewerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      clearTimeout(resizeTimer);
      if (observer) observer.disconnect();
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
    saveSettings(updated);
    onUpdateSettings?.(updated);
  };

  const handleCloseReader = () => {
    saveSettings(settings);
    onClose(settings);
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

  // Extract sentences from current chapter/document in EPUB
  const extractCurrentDocSentences = useCallback(() => {
    if (renditionRef.current) {
      try {
        const contents: any = renditionRef.current.getContents();
        const item = Array.isArray(contents) ? contents[0] : contents;
        if (item && item.document && item.document.body) {
          const rawText = item.document.body.innerText || item.document.body.textContent || '';
          return splitIntoSentences(rawText);
        }
      } catch (err) {
        console.warn('Lỗi trích xuất câu EPUB:', err);
      }
    }
    return [];
  }, []);

  const cleanupTtsHighlight = useCallback((targetDoc?: Document) => {
    try {
      const docs: Document[] = [];
      if (targetDoc) {
        docs.push(targetDoc);
      } else {
        const contents: any = renditionRef.current?.getContents();
        const items = Array.isArray(contents) ? contents : contents ? [contents] : [];
        for (const item of items) {
          if (item && item.document) docs.push(item.document);
        }
      }

      for (const doc of docs) {
        // 1. Unwrap any <mark class="readera-tts-sentence-active"> cleanly
        doc.querySelectorAll('mark.readera-tts-sentence-active').forEach((mark) => {
          const parent = mark.parentNode;
          if (parent) {
            while (mark.firstChild) {
              parent.insertBefore(mark.firstChild, mark);
            }
            parent.removeChild(mark);
            parent.normalize();
          }
        });

        // 2. Remove any fallback classes
        doc.querySelectorAll('.readera-tts-sentence-active, .readera-tts-highlight').forEach((el) => {
          el.classList.remove('readera-tts-sentence-active', 'readera-tts-highlight');
        });
      }
    } catch (err) {
      console.warn('Lỗi dọn dẹp highlight TTS:', err);
    }
  }, []);

  // Normalize text for fuzzy matching: lowercase, collapse whitespace, strip punctuation
  const normalizeText = (t: string): string =>
    t
      .toLowerCase()
      .replace(/[\u200b\u00ad\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();



  // Find which sentence index corresponds to the currently visible page
  // Uses two complementary techniques:
  // 1. CFI-based DOM Range (primary, pinpoint precision using EPUB.js location)
  // 2. Viewport DOM Scan (fallback, adjusted for horizontal scroll container in paginated mode)
  const findCurrentVisibleSentenceIndex = (providedSentences?: string[]): number => {
    const list = providedSentences && providedSentences.length > 0 ? providedSentences : ttsSentences;
    if (!list || list.length === 0) return 0;

    try {
      const loc: any = renditionRef.current?.currentLocation() || currentLocationRef.current;
      const startCfi: string | undefined = loc?.start?.cfi;

      const contents: any = renditionRef.current?.getContents();
      const item = Array.isArray(contents) ? contents[0] : contents;
      const doc: Document | undefined = item?.document;

      // =========================================================================
      // METHOD 1: CFI-based DOM Range
      // =========================================================================
      if (startCfi && doc && doc.body) {
        let range: Range | null = null;
        try {
          if (item && typeof item.range === 'function') {
            range = item.range(startCfi);
          }
        } catch {
          // ignore
        }

        if (!range && renditionRef.current && typeof (renditionRef.current as any).getRange === 'function') {
          try {
            range = (renditionRef.current as any).getRange(startCfi);
          } catch {
            // ignore
          }
        }

        if (range && range.startContainer) {
          try {
            // 1. Preceding text length before this visible page
            let preLen = 0;
            try {
              const preRange = doc.createRange();
              preRange.selectNodeContents(doc.body);
              preRange.setEnd(range.startContainer, range.startOffset);
              preLen = preRange.toString().length;
            } catch {
              // ignore
            }

            // 2. Text starting from the start of the visible page forward
            let postText = '';
            try {
              const postRange = doc.createRange();
              postRange.setStart(range.startContainer, range.startOffset);
              postRange.setEndAfter(doc.body.lastChild || doc.body);
              postText = postRange.toString().trim();
            } catch {
              // ignore
            }

            const normPost = normalizeText(postText.slice(0, 350));

            // Match first sentence whose beginning appears near the start of the visible page text
            let bestIdx = -1;
            for (let i = 0; i < list.length; i++) {
              const sNorm = normalizeText(list[i]);
              if (!sNorm || sNorm.length < 3) continue;

              const snippet = sNorm.slice(0, Math.min(25, sNorm.length));
              const idxInPost = normPost.indexOf(snippet);
              if (idxInPost >= 0 && idxInPost < 120) {
                bestIdx = i;
                break;
              }
            }

            if (bestIdx >= 0) {
              console.debug('[TTS] Method 1 (CFI snippet) matched sentence index:', bestIdx);
              return bestIdx;
            }

            // Fallback: character offset mapping
            if (preLen > 0) {
              let charCount = 0;
              for (let i = 0; i < list.length; i++) {
                charCount += list[i].length;
                if (charCount >= preLen) {
                  console.debug('[TTS] Method 1 (CFI char offset) matched sentence index:', i);
                  return i;
                }
              }
            }
          } catch (err) {
            console.warn('[TTS] Error in CFI Range calculation:', err);
          }
        }
      }

      // =========================================================================
      // METHOD 2: Viewport DOM Scan (Fallback)
      // =========================================================================
      if (doc && doc.body) {
        const isPaginated = settings.flow !== 'scrolled-doc';
        const view = doc.defaultView;
        const viewWidth = view?.innerWidth || window.innerWidth;
        const viewHeight = view?.innerHeight || window.innerHeight;

        const managerContainer = (renditionRef.current as any)?.manager?.container;
        const containerScrollLeft = managerContainer?.scrollLeft || 0;
        const windowScrollX = view?.scrollX || 0;
        const scrollOffsetLeft = windowScrollX > 0 ? 0 : containerScrollLeft;

        const containerScrollTop = managerContainer?.scrollTop || 0;
        const windowScrollY = view?.scrollY || 0;
        const scrollOffsetTop = windowScrollY > 0 ? 0 : containerScrollTop;

        const blockEls = Array.from(
          doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, td, div')
        );

        const visibleBlocksText: string[] = [];

        for (const el of blockEls) {
          const ownText = (el.textContent || '').trim();
          if (!ownText || ownText.length < 4) continue;
          const hasBlockChild = Array.from(el.children).some((c) =>
            /^(P|H[1-6]|LI|BLOCKQUOTE|TD|DIV)$/.test(c.tagName)
          );
          if (hasBlockChild) continue;

          try {
            const r = el.getBoundingClientRect();
            let isVisible = false;
            if (isPaginated) {
              const relLeft = r.left - scrollOffsetLeft;
              const relRight = r.right - scrollOffsetLeft;
              isVisible = relRight > 15 && relLeft < viewWidth - 15 && r.bottom > 5 && r.top < viewHeight + 5;
            } else {
              const relTop = r.top - scrollOffsetTop;
              const relBottom = r.bottom - scrollOffsetTop;
              isVisible = relBottom > 10 && relTop < viewHeight * 0.9;
            }

            if (isVisible) {
              visibleBlocksText.push(normalizeText(ownText));
            }
          } catch {
            // ignore
          }
        }

        if (visibleBlocksText.length > 0) {
          const visibleNorm = visibleBlocksText.join(' ');
          for (let i = 0; i < list.length; i++) {
            const sNorm = normalizeText(list[i]);
            if (!sNorm || sNorm.length < 4) continue;

            const key = sNorm.slice(0, Math.min(30, sNorm.length));
            if (visibleNorm.includes(key)) {
              console.debug('[TTS] Method 2 (Viewport DOM scan) matched sentence index:', i);
              return i;
            }

            const words = sNorm.split(' ');
            if (words.length >= 3) {
              const shortKey = words.slice(0, 3).join(' ');
              if (shortKey.length >= 8 && visibleNorm.includes(shortKey)) {
                console.debug('[TTS] Method 2 (Viewport short words) matched sentence index:', i);
                return i;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[TTS] Lỗi xác định vị trí câu trang hiện tại:', err);
    }

    return 0;
  };

  // Turn action for TTS synchronization
  type TurnAction = 'next' | 'prev' | 'none' | { jumpScroll: number };

  // Locate and highlight sentence; accurately determines page turn action in paginated mode
  const highlightSentenceAndDetermineTurn = useCallback(
    (
      doc: Document,
      sentenceText: string,
      isMovingForward: boolean,
      isPaginated: boolean,
      item?: any,
      forceLocate: boolean = false
    ): TurnAction => {
      cleanupTtsHighlight(doc);

      const clean = sentenceText.trim();
      if (!clean) return 'none';

      // Primary snippet: up to 30 characters, fallback to 16 characters
      const searchSnippet = clean.slice(0, Math.min(30, clean.length)).trim();
      if (!searchSnippet) return 'none';
      const shortSnippet = clean.slice(0, Math.min(16, clean.length)).trim();
      // Normalized versions for fuzzy matching
      const normSnippet = normalizeText(searchSnippet);
      const normShort = normalizeText(shortSnippet);

      const viewWidth = doc.defaultView?.innerWidth || window.innerWidth;
      const viewHeight = doc.defaultView?.innerHeight || window.innerHeight;

      // Walk document text nodes to find candidates
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
      let node: Node | null;
      interface MatchCandidate {
        node: Node;
        startIdx: number;
        snippetLen: number;
        rect: DOMRect;
        score: number;
      }
      const candidates: MatchCandidate[] = [];

      const manager = (renditionRef.current as any)?.manager;
      const managerContainer = manager?.container;
      const containerScrollLeft = managerContainer?.scrollLeft || 0;
      const delta = manager?.layout?.delta || viewerRef.current?.clientWidth || viewWidth || 1;

      while ((node = walker.nextNode())) {
        const rawText = node.textContent || '';
        const normText = normalizeText(rawText);

        // Try exact match first, then normalized match
        let idx = rawText.indexOf(searchSnippet);
        let snippetLen = searchSnippet.length;
        if (idx === -1 && shortSnippet.length >= 6) {
          idx = rawText.indexOf(shortSnippet);
          snippetLen = shortSnippet.length;
        }
        // Normalized fallback
        if (idx === -1 && normSnippet.length >= 6) {
          const normIdx = normText.indexOf(normSnippet);
          if (normIdx !== -1) {
            idx = Math.min(normIdx, rawText.length - 1);
            snippetLen = Math.min(normSnippet.length, rawText.length - idx);
          }
        }
        if (idx === -1 && normShort.length >= 5) {
          const normIdx = normText.indexOf(normShort);
          if (normIdx !== -1) {
            idx = Math.min(normIdx, rawText.length - 1);
            snippetLen = Math.min(normShort.length, rawText.length - idx);
          }
        }

        if (idx !== -1) {
          try {
            const range = doc.createRange();
            range.setStart(node, idx);
            range.setEnd(node, Math.min(rawText.length, idx + snippetLen));
            const rect = range.getBoundingClientRect();

            let score = 0;
            if (isPaginated) {
              const targetPageScroll = Math.max(0, Math.floor(rect.left / delta) * delta);
              const pageDiff = Math.round((targetPageScroll - containerScrollLeft) / delta);

              const relLeft = rect.left - containerScrollLeft;
              const relRight = rect.right - containerScrollLeft;
              const isCurrentPage = pageDiff === 0 && relRight > 15 && relLeft < viewWidth - 25;
              const isNextPage = pageDiff > 0 || relLeft >= viewWidth - 25;
              const isPrevPage = pageDiff < 0 || relRight <= 15;

              if (forceLocate) {
                score = isCurrentPage ? 1000 : 600;
              } else if (isCurrentPage) {
                score = 1000;
              } else if (isNextPage) {
                score = isMovingForward ? (700 - pageDiff * 10) : (200 - pageDiff * 10);
              } else if (isPrevPage) {
                score = isMovingForward ? (-500 + pageDiff * 10) : (800 + pageDiff * 10);
              } else {
                score = 100;
              }
            } else {
              const isVisible = rect.top >= -20 && rect.top < viewHeight * 0.9;
              score = isVisible ? 1000 : 500;
            }

            candidates.push({ node, startIdx: idx, snippetLen, rect, score });
          } catch {}
        }
      }

      // Sort candidates by score descending
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates.length > 0 && candidates[0].score > -100 ? candidates[0] : null;

      let activeEl: HTMLElement | null = null;
      let targetRect: DOMRect | null = null;
      let highlightRange: Range | null = null;

      if (best) {
        targetRect = best.rect;
        try {
          const range = doc.createRange();
          const text = best.node.textContent || '';
          const matchLen = Math.min(clean.length, text.length - best.startIdx);
          range.setStart(best.node, best.startIdx);
          range.setEnd(best.node, best.startIdx + matchLen);
          highlightRange = range;

          if (ttsHighlightEnabled || forceLocate) {
            const mark = doc.createElement('mark');
            mark.className = 'readera-tts-sentence-active';
            range.surroundContents(mark);
            activeEl = mark;
            try {
              targetRect = mark.getBoundingClientRect() || best.rect;
            } catch {}
          } else {
            activeEl = (best.node.parentElement || doc.body) as HTMLElement;
          }
        } catch {
          const parent = best.node.parentElement;
          if (parent) {
            if (ttsHighlightEnabled || forceLocate) {
              parent.classList.add('readera-tts-sentence-active');
            }
            activeEl = parent;
            targetRect = best.rect;
          }
        }

        if (item) {
          try {
            const cfi = item.cfiFromRange
              ? item.cfiFromRange(highlightRange)
              : item.cfiFromNode
              ? item.cfiFromNode(activeEl)
              : null;
            if (cfi) {
              currentTtsCfiRef.current = cfi;
            }
          } catch {}
          if (item.section?.href) {
            currentTtsSectionHrefRef.current = item.section.href;
          }
        }
      } else {
        // Fallback: block-level element search (normalized text matching)
        const blockCandidates = doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
        for (const el of blockCandidates) {
          const elNorm = normalizeText(el.textContent || '');
          if (elNorm.includes(normSnippet) || (normShort.length >= 5 && elNorm.includes(normShort))) {
            const r = el.getBoundingClientRect();
            if (isPaginated) {
              const relLeft = r.left - containerScrollLeft;
              const isVisible = relLeft >= -20 && relLeft < viewWidth - 25;
              const isNext = relLeft >= viewWidth - 25;
              if (isVisible || (isMovingForward && isNext) || !isMovingForward) {
                if (ttsHighlightEnabled || forceLocate) {
                  el.classList.add('readera-tts-sentence-active');
                }
                activeEl = el as HTMLElement;
                targetRect = r;
                break;
              }
            } else {
              if (ttsHighlightEnabled || forceLocate) {
                el.classList.add('readera-tts-sentence-active');
              }
              activeEl = el as HTMLElement;
              targetRect = r;
              break;
            }
          }
        }
      }

      if (!activeEl || !targetRect) return 'none';

      if (isPaginated) {
        const relLeft = targetRect.left - containerScrollLeft;
        const relRight = targetRect.right - containerScrollLeft;

        const isOnCurrentPage =
          relRight > 15 && relLeft < viewWidth - 25 &&
          targetRect.bottom > 10 && targetRect.top < viewHeight + 20;

        if (!isOnCurrentPage) {
          const targetScrollLeft = Math.max(0, Math.floor(targetRect.left / delta) * delta);
          const pageDiff = Math.round((targetScrollLeft - containerScrollLeft) / delta);

          if (pageDiff === 1 || (pageDiff === 0 && relLeft >= viewWidth - 25)) {
            return 'next';
          } else if (pageDiff === -1 || (pageDiff === 0 && relRight <= 15)) {
            return 'prev';
          } else if (pageDiff !== 0) {
            return { jumpScroll: targetScrollLeft };
          }
        }
        return 'none';
      } else {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return 'none';
      }
    },
    [cleanupTtsHighlight, ttsHighlightEnabled, normalizeText]
  );

  // Synchronize sentence display and page turning before speaking
  const prepareSentenceDisplay = useCallback(
    (index: number, sentenceText: string): Promise<void> => {
      setTtsSentenceIndex(index);
      currentReadingAnchorRef.current = sentenceText;
      const isMovingForward = index >= lastTtsIndexRef.current;
      lastTtsIndexRef.current = index;

      if (!sentenceText) return Promise.resolve();

      // Guard against concurrent duplicate calls: reuse ongoing promise if in-flight
      if (displayPromiseRef.current) {
        return displayPromiseRef.current;
      }

      const task = (async () => {
        try {
          const contents: any = renditionRef.current?.getContents();
          const item = Array.isArray(contents) ? contents[0] : contents;
          if (!item || !item.document || !item.document.body) return;
          const doc: Document = item.document;

          const isPaginated = settings.flow !== 'scrolled-doc';
          const action = highlightSentenceAndDetermineTurn(doc, sentenceText, isMovingForward, isPaginated, item);

          if (action === 'next' && renditionRef.current) {
            await renditionRef.current.next();
            // Short pause (~100ms) for page turn animation/layout to settle
            await new Promise((r) => setTimeout(r, 100));
            // Re-highlight sentence on the new visible page
            const newContents: any = renditionRef.current?.getContents();
            const newItem = Array.isArray(newContents) ? newContents[0] : newContents;
            if (newItem && newItem.document) {
              highlightSentenceAndDetermineTurn(newItem.document, sentenceText, true, isPaginated, newItem);
            }
          } else if (action === 'prev' && renditionRef.current) {
            await renditionRef.current.prev();
            await new Promise((r) => setTimeout(r, 100));
            const newContents: any = renditionRef.current?.getContents();
            const newItem = Array.isArray(newContents) ? newContents[0] : newContents;
            if (newItem && newItem.document) {
              highlightSentenceAndDetermineTurn(newItem.document, sentenceText, false, isPaginated, newItem);
            }
          } else if (action && typeof action === 'object' && 'jumpScroll' in action && renditionRef.current) {
            const manager = (renditionRef.current as any)?.manager;
            if (manager && typeof manager.scrollTo === 'function') {
              manager.scrollTo(action.jumpScroll, 0, false);
            } else if (manager?.container) {
              manager.container.scrollLeft = action.jumpScroll;
            }
            renditionRef.current.reportLocation?.();
            await new Promise((r) => setTimeout(r, 100));
            const newContents: any = renditionRef.current?.getContents();
            const newItem = Array.isArray(newContents) ? newContents[0] : newContents;
            if (newItem && newItem.document) {
              highlightSentenceAndDetermineTurn(newItem.document, sentenceText, isMovingForward, isPaginated, newItem);
            }
          }
        } catch (err) {
          console.warn('Lỗi chuẩn bị hiển thị câu TTS:', err);
        } finally {
          displayPromiseRef.current = null;
        }
      })();

      displayPromiseRef.current = task;
      return task;
    },
    [highlightSentenceAndDetermineTurn, settings.flow]
  );

  // Connect TTS beforeSpeakHook to synchronize reading
  useEffect(() => {
    if (showTts) {
      ttsService.setBeforeSpeakHook(prepareSentenceDisplay);
    } else {
      ttsService.setBeforeSpeakHook(null);
    }
    return () => {
      ttsService.setBeforeSpeakHook(null);
    };
  }, [showTts, prepareSentenceDisplay]);

  const handleTtsSentenceChange = useCallback(
    (index: number, sentenceText: string) => {
      setTtsSentenceIndex(index);
      currentReadingAnchorRef.current = sentenceText;
      // Only invoke manual display if TTS is currently stopped or paused
      // (during active playback, ttsService beforeSpeakHook invokes and awaits prepareSentenceDisplay)
      if (!ttsService.getIsPlaying() || ttsService.getIsPaused()) {
        prepareSentenceDisplay(index, sentenceText);
      }
    },
    [prepareSentenceDisplay]
  );

  // Start TTS
  const handleStartTts = (customText?: string) => {
    if (customText) {
      // When reading a selected snippet: find its position in the chapter so TTS continues from there
      const allSentences = extractCurrentDocSentences();
      const list = splitIntoSentences(customText);
      if (list.length > 0 && allSentences.length > 0) {
        // Try to find where in the full chapter the selected text begins
        const normCustom = normalizeText(list[0].slice(0, Math.min(30, list[0].length)));
        let matchIdx = -1;
        for (let i = 0; i < allSentences.length; i++) {
          if (normalizeText(allSentences[i]).includes(normCustom)) {
            matchIdx = i;
            break;
          }
        }
        if (matchIdx >= 0) {
          // Start TTS at the matched sentence in the full chapter
          lastTtsIndexRef.current = matchIdx;
          setTtsSentences(allSentences);
          setTtsSentenceIndex(matchIdx);
          setShowTts(true);
          return;
        }
      }
      // Fallback: just read the selected text
      lastTtsIndexRef.current = 0;
      setTtsSentences(list.length > 0 ? list : [customText]);
      setTtsSentenceIndex(0);
      setShowTts(true);
      return;
    }

    const sentences = extractCurrentDocSentences();
    if (sentences.length > 0) {
      const startIndex = findCurrentVisibleSentenceIndex(sentences);
      console.debug('[TTS] handleStartTts: totalSentences=', sentences.length, 'startIndex=', startIndex,
        '| sentence[startIndex]:', sentences[startIndex]?.slice(0, 50));
      lastTtsIndexRef.current = startIndex;
      setTtsSentences(sentences);
      setTtsSentenceIndex(startIndex);
      setShowTts(true);
      if (showTts) {
        // If TTS window was already open, jump directly to new position
        ttsService.loadSentences(sentences, startIndex);
        ttsService.play();
      }
    } else {
      lastTtsIndexRef.current = 0;
      setTtsSentences([chapterTitle || book.title]);
      setTtsSentenceIndex(0);
      setShowTts(true);
    }
  };

  // Re-determine position according to currently visible screen when Play is clicked after pause
  const handleTtsPlayResume = useCallback(async () => {
    // 1. Check if chapter changed
    const freshSentences = extractCurrentDocSentences();
    const currentSentences = ttsSentences;

    const isSameChapter =
      freshSentences.length > 0 &&
      currentSentences.length > 0 &&
      freshSentences.length === currentSentences.length &&
      freshSentences[0] === currentSentences[0];

    if (!isSameChapter && freshSentences.length > 0) {
      const newStartIndex = findCurrentVisibleSentenceIndex(freshSentences);
      setTtsSentences(freshSentences);
      setTtsSentenceIndex(newStartIndex);
      lastTtsIndexRef.current = newStartIndex;
      ttsService.loadSentences(freshSentences, newStartIndex);
      prepareSentenceDisplay(newStartIndex, freshSentences[newStartIndex]);
      return;
    }

    // 2. Same chapter: determine new visible sentence index based on screen display
    const sentenceListToSearch = currentSentences.length > 0 ? currentSentences : freshSentences;
    const newIndex = findCurrentVisibleSentenceIndex(sentenceListToSearch);
    if (newIndex >= 0) {
      setTtsSentenceIndex(newIndex);
      lastTtsIndexRef.current = newIndex;
      ttsService.jumpToSentence(newIndex);
      if (sentenceListToSearch[newIndex]) {
        prepareSentenceDisplay(newIndex, sentenceListToSearch[newIndex]);
      }
    }
  }, [extractCurrentDocSentences, ttsSentences, findCurrentVisibleSentenceIndex, prepareSentenceDisplay]);

  // Extract text snippet currently at the top/center of the visible viewport
  const getCurrentVisibleTextAnchor = useCallback((): string => {
    if (!renditionRef.current) return '';
    try {
      const contents: any = renditionRef.current.getContents();
      const item = Array.isArray(contents) ? contents[0] : contents;
      const doc: Document | undefined = item?.document;
      if (!doc || !doc.body) return '';

      const isPaginated = settings.flow !== 'scrolled-doc';
      const view = doc.defaultView;
      const viewWidth = view?.innerWidth || window.innerWidth;
      const viewHeight = view?.innerHeight || window.innerHeight;

      const managerContainer = (renditionRef.current as any)?.manager?.container;
      const containerScrollLeft = managerContainer?.scrollLeft || 0;
      const containerScrollTop = managerContainer?.scrollTop || 0;

      const blockEls = Array.from(
        doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote')
      );

      for (const el of blockEls) {
        const text = (el.textContent || '').trim();
        if (!text || text.length < 5) continue;

        try {
          const r = el.getBoundingClientRect();
          let isVisible = false;
          if (isPaginated) {
            const relLeft = r.left - containerScrollLeft;
            const relRight = r.right - containerScrollLeft;
            isVisible = relRight > 20 && relLeft < viewWidth - 20;
          } else {
            const relTop = r.top - containerScrollTop;
            const relBottom = r.bottom - containerScrollTop;
            isVisible = relBottom > 15 && relTop < viewHeight * 0.7;
          }

          if (isVisible) {
            return text.slice(0, 60);
          }
        } catch {}
      }
    } catch (err) {
      console.warn('[Anchor] Lỗi lấy đoạn text đang đọc:', err);
    }
    return '';
  }, [settings.flow]);

  // Text-anchor approach: Locate and navigate directly to the specified text snippet
  // without depending on stale CFIs or obsolete layout coordinates.
  const relocateToTextAnchor = useCallback(
    async (
      anchorText: string,
      options: { highlight?: boolean; pulse?: boolean; smooth?: boolean } = {}
    ) => {
      if (!anchorText || !renditionRef.current) return;
      const clean = anchorText.trim();
      if (!clean) return;

      try {
        const contents: any = renditionRef.current.getContents();
        const item = Array.isArray(contents) ? contents[0] : contents;
        if (!item || !item.document || !item.document.body) return;
        const doc: Document = item.document;

        // Clean any temporary mark to search in clean DOM
        cleanupTtsHighlight(doc);

        const targetSnippet = clean.slice(0, Math.min(32, clean.length)).trim();
        const shortSnippet = clean.slice(0, Math.min(16, clean.length)).trim();
        const normTarget = normalizeText(targetSnippet);
        const normShort = normalizeText(shortSnippet);
        const words = normTarget.split(' ').filter((w) => w.length > 0);
        const wordKey = words.slice(0, Math.min(4, words.length)).join(' ');

        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
        let node: Node | null;
        let matchedNode: Node | null = null;
        let startIdx = -1;
        let matchLen = 0;

        while ((node = walker.nextNode())) {
          const raw = node.textContent || '';
          const norm = normalizeText(raw);

          let idx = raw.indexOf(targetSnippet);
          let len = targetSnippet.length;
          if (idx === -1 && shortSnippet.length >= 6) {
            idx = raw.indexOf(shortSnippet);
            len = shortSnippet.length;
          }
          if (idx === -1 && normTarget.length >= 6) {
            const nIdx = norm.indexOf(normTarget);
            if (nIdx !== -1) {
              idx = Math.min(nIdx, raw.length - 1);
              len = Math.min(normTarget.length, raw.length - idx);
            }
          }
          if (idx === -1 && normShort.length >= 5) {
            const nIdx = norm.indexOf(normShort);
            if (nIdx !== -1) {
              idx = Math.min(nIdx, raw.length - 1);
              len = Math.min(normShort.length, raw.length - idx);
            }
          }
          if (idx === -1 && wordKey.length >= 6) {
            const nIdx = norm.indexOf(wordKey);
            if (nIdx !== -1) {
              idx = Math.min(nIdx, raw.length - 1);
              len = Math.min(wordKey.length, raw.length - idx);
            }
          }

          if (idx !== -1) {
            matchedNode = node;
            startIdx = idx;
            matchLen = len;
            break;
          }
        }

        let targetRange: Range | null = null;
        let activeEl: HTMLElement | null = null;

        if (matchedNode && startIdx !== -1) {
          try {
            const r = doc.createRange();
            r.setStart(matchedNode, startIdx);
            r.setEnd(matchedNode, Math.min(matchedNode.textContent?.length || 0, startIdx + matchLen));
            targetRange = r;
            activeEl = matchedNode.parentElement;
          } catch {}
        }

        if (!targetRange || !activeEl) {
          // Fallback to block element query
          const blockEls = doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
          for (const b of blockEls) {
            const bNorm = normalizeText(b.textContent || '');
            if (
              bNorm.includes(normTarget) ||
              (wordKey.length >= 6 && bNorm.includes(wordKey)) ||
              (normShort.length >= 5 && bNorm.includes(normShort))
            ) {
              const r = doc.createRange();
              r.selectNodeContents(b);
              targetRange = r;
              activeEl = b as HTMLElement;
              break;
            }
          }
        }

        if (!targetRange || !activeEl) return;

        const isPaginated = settings.flow !== 'scrolled-doc';

        if (isPaginated) {
          let navigated = false;
          if (item && typeof item.cfiFromRange === 'function') {
            try {
              const freshCfi = item.cfiFromRange(targetRange);
              if (freshCfi) {
                currentTtsCfiRef.current = freshCfi;
                if (item?.section?.href) {
                  currentTtsSectionHrefRef.current = item.section.href;
                }
                await renditionRef.current.display(freshCfi);
                navigated = true;
              }
            } catch (e) {
              console.debug('[Relocate] cfiFromRange fallback to column scroll:', e);
            }
          }

          if (!navigated) {
            const managerContainer = (renditionRef.current as any)?.manager?.container;
            const delta =
              (renditionRef.current as any)?.manager?.layout?.delta ||
              viewerRef.current?.clientWidth ||
              1;
            if (managerContainer && delta > 0) {
              const currentScrollLeft = managerContainer.scrollLeft || 0;
              const rangeRect = targetRange.getBoundingClientRect();
              const absLeft = currentScrollLeft + rangeRect.left;
              const targetScrollLeft = Math.max(0, Math.floor(absLeft / delta) * delta);
              managerContainer.scrollLeft = targetScrollLeft;
            }
          }
        } else {
          activeEl.scrollIntoView({
            behavior: options.smooth ? 'smooth' : 'auto',
            block: 'center',
          });
        }

        if (options.highlight || ttsHighlightEnabled) {
          await new Promise((r) => setTimeout(r, 60));
          const freshContents: any = renditionRef.current.getContents();
          const freshItem = Array.isArray(freshContents) ? freshContents[0] : freshContents;
          if (freshItem && freshItem.document) {
            highlightSentenceAndDetermineTurn(
              freshItem.document,
              clean,
              true,
              isPaginated,
              freshItem,
              true // forceLocate
            );

            if (options.pulse) {
              const mark = freshItem.document.querySelector('.readera-tts-sentence-active');
              if (mark) {
                mark.classList.remove('readera-tts-sentence-locate-pulse');
                void (mark as HTMLElement).offsetWidth;
                mark.classList.add('readera-tts-sentence-locate-pulse');
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Relocate] Lỗi định vị theo đoạn text:', err);
      }
    },
    [settings.flow, cleanupTtsHighlight, normalizeText, ttsHighlightEnabled, highlightSentenceAndDetermineTurn]
  );

  // Re-apply styles on settings change and anchor reading position across font changes
  useEffect(() => {
    const prev = prevSettingsRef.current;
    const fontOrLayoutChanged =
      prev.fontSize !== settings.fontSize ||
      prev.fontFamily !== settings.fontFamily ||
      prev.lineHeight !== settings.lineHeight ||
      prev.textAlign !== settings.textAlign;

    prevSettingsRef.current = settings;

    if (fontOrLayoutChanged) {
      // 1. Capture text chunk currently being read before layout changes
      let anchorText = '';
      if (showTts && ttsSentences.length > 0) {
        const currentIdx = ttsService.getCurrentIndex() >= 0 ? ttsService.getCurrentIndex() : ttsSentenceIndex;
        anchorText = ttsSentences[currentIdx] || ttsSentences[ttsSentenceIndex] || currentReadingAnchorRef.current;
      }
      if (!anchorText) {
        anchorText = currentReadingAnchorRef.current || getCurrentVisibleTextAnchor();
      }

      // 2. Apply new font and styling
      applyStyles(settings);
      saveSettings(settings);

      // 3. Immediately relocate to the exact reading text in the new layout
      if (anchorText) {
        setTimeout(() => {
          relocateToTextAnchor(anchorText, {
            highlight: showTts,
            pulse: showTts,
            smooth: false,
          });
        }, 80);
      }
    } else {
      applyStyles(settings);
      saveSettings(settings);
    }
  }, [settings, applyStyles, showTts, ttsSentences, ttsSentenceIndex, getCurrentVisibleTextAnchor, relocateToTextAnchor]);

  // Navigate directly to the currently reading sentence in the book
  const handleLocateCurrentTtsSentence = useCallback(async () => {
    const currentIdx = ttsService.getCurrentIndex() >= 0 ? ttsService.getCurrentIndex() : ttsSentenceIndex;
    const sentenceText = ttsSentences[currentIdx] || ttsSentences[ttsSentenceIndex] || currentReadingAnchorRef.current;
    if (!sentenceText) return;

    try {
      const contents: any = renditionRef.current?.getContents();
      const item = Array.isArray(contents) ? contents[0] : contents;
      const currentHref = item?.section?.href;

      if (currentTtsSectionHrefRef.current && currentHref && currentHref !== currentTtsSectionHrefRef.current) {
        await renditionRef.current?.display(currentTtsSectionHrefRef.current);
        await new Promise((r) => setTimeout(r, 120));
      }

      await relocateToTextAnchor(sentenceText, {
        highlight: true,
        pulse: true,
        smooth: true,
      });
    } catch (err) {
      console.warn('[TTS] Lỗi chuyển tới vị trí đang đọc:', err);
    }
  }, [ttsSentences, ttsSentenceIndex, relocateToTextAnchor]);


  const handleTtsNextChapter = () => {
    if (!renditionRef.current) {
      ttsService.stop();
      return;
    }

    renditionRef.current
      .next()
      .then(() => {
        setTimeout(() => {
          const freshSentences = extractCurrentDocSentences();
          // Check if we actually advanced to a new chapter/content
          const isSameContent =
            freshSentences.length === 0 ||
            (freshSentences.length === ttsSentences.length &&
              freshSentences[0] === ttsSentences[0] &&
              freshSentences[freshSentences.length - 1] === ttsSentences[ttsSentences.length - 1]);

          if (isSameContent) {
            console.debug('[TTS] Đã đọc đến hết sách, dừng TTS.');
            ttsService.stop();
          } else {
            setTtsSentences(freshSentences);
            setTtsSentenceIndex(0);
          }
        }, 500);
      })
      .catch(() => {
        ttsService.stop();
      });
  };

  // Resize rendition to full screen or default when bars are toggled (nhấn vào giữa để ẩn/hiện thanh công cụ)
  useEffect(() => {
    if (!renditionRef.current || !viewerRef.current) return;
    const timer = setTimeout(() => {
      try {
        if (renditionRef.current && viewerRef.current) {
          const width = viewerRef.current.clientWidth;
          const height = viewerRef.current.clientHeight;
          if (width > 0 && height > 0) {
            const targetCfi = currentLocationRef.current?.start?.cfi || currentCfi;
            (renditionRef.current as any).resize(width, height, targetCfi || undefined);

            // Re-highlight active TTS sentence if TTS is active
            if (showTts && ttsSentences[ttsSentenceIndex]) {
              setTimeout(() => {
                const contents: any = renditionRef.current?.getContents();
                const item = Array.isArray(contents) ? contents[0] : contents;
                if (item?.document) {
                  highlightSentenceAndDetermineTurn(
                    item.document,
                    ttsSentences[ttsSentenceIndex],
                    true,
                    settings.flow !== 'scrolled-doc',
                    item
                  );
                }
              }, 100);
            }
          }
        }
      } catch (err) {
        console.warn('Lỗi resize rendition khi toggle thanh công cụ:', err);
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [showBars]);

  return (
    <div className={`reader-container reader-theme-${settings.theme} ${!showBars ? 'bars-hidden' : ''}`}>
      {/* Top Floating Control Bar */}
      <header className={`reader-top-bar ${!showBars ? 'hidden' : ''}`}>
        <div className="reader-bar-left">
          <button className="btn-icon" onClick={handleCloseReader} title="Quay lại thư viện">
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
            onClick={() => handleStartTts()}
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
        <div className="reader-slider-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              className="btn-icon"
              style={{ width: 32, height: 32 }}
              onClick={handlePrevChapter}
              title="Chương trước"
            >
              <SkipBack size={16} />
            </button>
            <button
              className="btn-icon"
              style={{ width: 32, height: 32 }}
              onClick={handlePrevPage}
              title="Trang trước"
            >
              <ChevronLeft size={18} />
            </button>
          </div>

          {/* Clean percentage progress display (No draggable slider) */}
          <div
            className="reader-progress-badge-wrap"
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
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '0.02em',
              }}
            >
              {progressPercentage}%
            </span>
            <span
              style={{
                fontSize: 10,
                opacity: 0.75,
                color: 'var(--text-secondary)',
                marginTop: -1,
              }}
            >
              Đã đọc
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              className="btn-icon"
              style={{ width: 32, height: 32 }}
              onClick={handleNextPage}
              title="Trang tiếp"
            >
              <ChevronRight size={18} />
            </button>
            <button
              className="btn-icon"
              style={{ width: 32, height: 32 }}
              onClick={handleNextChapter}
              title="Chương kế tiếp"
            >
              <SkipForward size={16} />
            </button>
          </div>
        </div>

        <div className="reader-bottom-meta" style={{ justifyContent: 'center' }}>
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
          onSpeak={(text) => handleStartTts(text)}
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
          bookTitle={book.title}
          chapterTitle={chapterTitle}
          sentences={ttsSentences}
          initialSentenceIndex={ttsSentenceIndex}
          highlightEnabled={ttsHighlightEnabled}
          onToggleHighlight={(enabled) => setTtsHighlightEnabled(enabled)}
          onSentenceChange={handleTtsSentenceChange}
          onClose={() => {
            setShowTts(false);
            cleanupTtsHighlight();
            currentTtsCfiRef.current = null;
            currentTtsSectionHrefRef.current = null;
          }}
          onNextChapter={handleTtsNextChapter}
          onPlayResume={handleTtsPlayResume}
          onLocateSentence={handleLocateCurrentTtsSentence}
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
