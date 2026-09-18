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
import { splitIntoSentences, ttsService } from '../services/ttsService';
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
  const [ttsSentences, setTtsSentences] = useState<string[]>([]);
  const [ttsSentenceIndex, setTtsSentenceIndex] = useState<number>(0);
  const [ttsHighlightEnabled, setTtsHighlightEnabled] = useState<boolean>(true);
  const lastTtsIndexRef = useRef<number>(0);

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

  // Find which sentence index corresponds to the currently visible page
  const findCurrentPageSentenceIndex = (doc: Document, sentencesList: string[]): number => {
    if (sentencesList.length === 0) return 0;
    const viewWidth = doc.defaultView?.innerWidth || window.innerWidth;
    const viewHeight = doc.defaultView?.innerHeight || window.innerHeight;
    const isPaginated = settings.flow !== 'scrolled-doc';

    for (let i = 0; i < sentencesList.length; i++) {
      const s = sentencesList[i].trim();
      if (!s) continue;
      const snippet = s.slice(0, Math.min(25, s.length)).trim();
      if (!snippet) continue;

      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const text = n.textContent || '';
        const idx = text.indexOf(snippet);
        if (idx !== -1) {
          try {
            const range = doc.createRange();
            range.setStart(n, idx);
            range.setEnd(n, Math.min(text.length, idx + snippet.length));
            const r = range.getBoundingClientRect();
            if (isPaginated) {
              if (r.left >= -10 && r.left < viewWidth - 30 && r.bottom > 20) {
                return i;
              }
            } else {
              if (r.top >= 0 && r.top < viewHeight * 0.8) {
                return i;
              }
            }
          } catch {
            const parent = n.parentElement;
            if (parent) {
              const r = parent.getBoundingClientRect();
              if (isPaginated) {
                if (r.left >= -10 && r.left < viewWidth - 30 && r.bottom > 20) {
                  return i;
                }
              } else {
                if (r.top >= 0 && r.top < viewHeight * 0.8) {
                  return i;
                }
              }
            }
          }
          break;
        }
      }
    }
    return 0;
  };

  // Locate and highlight sentence, returning whether a page turn is required
  const highlightSentenceAndDetermineTurn = useCallback(
    (
      doc: Document,
      sentenceText: string,
      isMovingForward: boolean,
      isPaginated: boolean
    ): 'next' | 'prev' | 'none' => {
      cleanupTtsHighlight(doc);
      if (!ttsHighlightEnabled) return 'none';

      const clean = sentenceText.trim();
      if (!clean) return 'none';

      // Primary snippet: up to 30 characters, fallback to 16 characters
      const searchSnippet = clean.slice(0, Math.min(30, clean.length)).trim();
      if (!searchSnippet) return 'none';
      const shortSnippet = clean.slice(0, Math.min(16, clean.length)).trim();

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

      while ((node = walker.nextNode())) {
        const text = node.textContent || '';
        let idx = text.indexOf(searchSnippet);
        let snippetLen = searchSnippet.length;
        if (idx === -1 && shortSnippet.length >= 6) {
          idx = text.indexOf(shortSnippet);
          snippetLen = shortSnippet.length;
        }

        if (idx !== -1) {
          try {
            const range = doc.createRange();
            range.setStart(node, idx);
            range.setEnd(node, Math.min(text.length, idx + snippetLen));
            const rect = range.getBoundingClientRect();

            let score = 0;
            if (isPaginated) {
              const isCurrentPage = rect.left >= -20 && rect.left < viewWidth - 25 && rect.bottom > 15;
              const isNextPage = rect.left >= viewWidth - 25 && rect.left < viewWidth * 2.5;
              const isPrevPage = rect.right <= 10;

              if (isCurrentPage) {
                score = 1000;
              } else if (isNextPage) {
                score = isMovingForward ? 700 : 200;
              } else if (isPrevPage) {
                // If moving forward, discard past occurrences (prevents jumping back on repeated dialogue)
                score = isMovingForward ? -500 : 800;
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

      if (best) {
        try {
          const range = doc.createRange();
          const text = best.node.textContent || '';
          const matchLen = Math.min(clean.length, text.length - best.startIdx);
          range.setStart(best.node, best.startIdx);
          range.setEnd(best.node, best.startIdx + matchLen);

          const mark = doc.createElement('mark');
          mark.className = 'readera-tts-sentence-active';
          range.surroundContents(mark);
          activeEl = mark;
          targetRect = best.rect;
        } catch {
          const parent = best.node.parentElement;
          if (parent) {
            parent.classList.add('readera-tts-sentence-active');
            activeEl = parent;
            targetRect = best.rect;
          }
        }
      } else {
        // Fallback: block-level element search
        const blockCandidates = doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
        for (const el of blockCandidates) {
          if (el.textContent && el.textContent.includes(searchSnippet)) {
            const r = el.getBoundingClientRect();
            if (isPaginated) {
              const isVisible = r.left >= -20 && r.left < viewWidth - 25;
              const isNext = r.left >= viewWidth - 25;
              if (isVisible || (isMovingForward && isNext)) {
                el.classList.add('readera-tts-sentence-active');
                activeEl = el as HTMLElement;
                targetRect = r;
                break;
              }
            } else {
              el.classList.add('readera-tts-sentence-active');
              activeEl = el as HTMLElement;
              targetRect = r;
              break;
            }
          }
        }
      }

      if (!activeEl || !targetRect) return 'none';

      if (isPaginated) {
        if (targetRect.left >= viewWidth - 25) {
          return 'next';
        } else if (targetRect.right < -15 && !isMovingForward) {
          return 'prev';
        }
        return 'none';
      } else {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return 'none';
      }
    },
    [cleanupTtsHighlight, ttsHighlightEnabled]
  );

  // Synchronize sentence display and page turning before speaking
  const prepareSentenceDisplay = useCallback(
    async (index: number, sentenceText: string) => {
      setTtsSentenceIndex(index);
      const isMovingForward = index >= lastTtsIndexRef.current;
      lastTtsIndexRef.current = index;

      if (!sentenceText) return;

      try {
        const contents: any = renditionRef.current?.getContents();
        const item = Array.isArray(contents) ? contents[0] : contents;
        if (!item || !item.document || !item.document.body) return;
        const doc: Document = item.document;

        const isPaginated = settings.flow !== 'scrolled-doc';
        const action = highlightSentenceAndDetermineTurn(doc, sentenceText, isMovingForward, isPaginated);

        if (action === 'next' && renditionRef.current) {
          await renditionRef.current.next();
          // Natural pause (~220ms) for page turn animation to complete before voice starts reading
          await new Promise((r) => setTimeout(r, 220));
          // Re-highlight sentence on the new visible page
          highlightSentenceAndDetermineTurn(doc, sentenceText, true, isPaginated);
        } else if (action === 'prev' && renditionRef.current) {
          await renditionRef.current.prev();
          await new Promise((r) => setTimeout(r, 220));
          highlightSentenceAndDetermineTurn(doc, sentenceText, false, isPaginated);
        }
      } catch (err) {
        console.warn('Lỗi chuẩn bị hiển thị câu TTS:', err);
      }
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
      prepareSentenceDisplay(index, sentenceText);
    },
    [prepareSentenceDisplay]
  );

  // Start TTS
  const handleStartTts = (customText?: string) => {
    if (customText) {
      const list = splitIntoSentences(customText);
      setTtsSentences(list.length > 0 ? list : [customText]);
      setTtsSentenceIndex(0);
      setShowTts(true);
      return;
    }

    const sentences = extractCurrentDocSentences();
    if (sentences.length > 0) {
      let startIndex = 0;
      try {
        const contents: any = renditionRef.current?.getContents();
        const item = Array.isArray(contents) ? contents[0] : contents;
        if (item && item.document && item.document.body) {
          startIndex = findCurrentPageSentenceIndex(item.document, sentences);
        }
      } catch {}

      setTtsSentences(sentences);
      setTtsSentenceIndex(startIndex);
      setShowTts(true);
    } else {
      setTtsSentences([chapterTitle || book.title]);
      setTtsSentenceIndex(0);
      setShowTts(true);
    }
  };

  const handleTtsNextChapter = () => {
    if (renditionRef.current) {
      renditionRef.current.next().then(() => {
        setTimeout(() => {
          const sentences = extractCurrentDocSentences();
          if (sentences.length > 0) {
            setTtsSentences(sentences);
            setTtsSentenceIndex(0);
          }
        }, 500);
      });
    }
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
          }}
          onNextChapter={handleTtsNextChapter}
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
