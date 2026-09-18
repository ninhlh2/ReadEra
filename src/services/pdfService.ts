import * as pdfjsLib from 'pdfjs-dist';
import type { BookRecord, TocItem } from '../types';
import { saveBookFile, saveBookMetadata } from './storage';

// Configure pdfjs worker for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export async function importPdfFile(file: File): Promise<BookRecord> {
  const arrayBuffer = await file.arrayBuffer();
  const bookId = `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  let title = file.name.replace(/\.pdf$/i, '');
  let author = 'Chưa rõ tác giả';
  let coverUrl: string | undefined;
  let pageCount = 0;

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4/cmaps/',
      cMapPacked: true,
    });
    const pdf = await loadingTask.promise;
    pageCount = pdf.numPages;

    // Extract metadata
    try {
      const metadata = await pdf.getMetadata();
      const info = metadata?.info as Record<string, unknown> | undefined;
      if (info) {
        if (typeof info.Title === 'string' && info.Title.trim()) {
          title = info.Title.trim();
        }
        if (typeof info.Author === 'string' && info.Author.trim()) {
          author = info.Author.trim();
        }
      }
    } catch {
      // ignore metadata extraction errors
    }

    // Render cover from page 1
    if (pageCount > 0) {
      try {
        const page1 = await pdf.getPage(1);
        const viewport = page1.getViewport({ scale: 0.8 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page1.render({
            canvas,
            canvasContext: ctx,
            viewport,
            intent: 'display',
          }).promise;
          coverUrl = canvas.toDataURL('image/jpeg', 0.82);
        }
      } catch (coverErr) {
        console.warn('Không tạo được ảnh bìa PDF:', coverErr);
      }
    }
  } catch (err) {
    console.error('Lỗi khi đọc file PDF:', err);
    throw new Error('File PDF bị lỗi hoặc không hỗ trợ.');
  }

  const bookRecord: BookRecord = {
    id: bookId,
    title,
    author,
    fileSize: file.size,
    addedAt: Date.now(),
    progress: 0,
    pageCount,
    currentPage: 1,
    coverUrl,
    fileFormat: 'pdf',
    status: 'to_read',
  };

  // Save to IndexedDB
  await saveBookFile(bookId, arrayBuffer);
  await saveBookMetadata(bookRecord);

  return bookRecord;
}

export async function extractPdfToc(pdf: pdfjsLib.PDFDocumentProxy): Promise<TocItem[]> {
  try {
    const outline = await pdf.getOutline();
    if (!outline || outline.length === 0) return [];

    const mapItem = async (item: { title: string; dest?: unknown; items?: unknown[] }, idx: number): Promise<TocItem> => {
      let pageNum = 1;
      if (typeof item.dest === 'string') {
        const dest = await pdf.getDestination(item.dest);
        if (Array.isArray(dest) && dest[0]) {
          const refIndex = await pdf.getPageIndex(dest[0]);
          pageNum = refIndex + 1;
        }
      } else if (Array.isArray(item.dest) && item.dest[0]) {
        const refIndex = await pdf.getPageIndex(item.dest[0]);
        pageNum = refIndex + 1;
      }

      const sub: TocItem[] = [];
      if (Array.isArray(item.items)) {
        for (let i = 0; i < item.items.length; i++) {
          sub.push(await mapItem(item.items[i] as any, i));
        }
      }

      return {
        id: `pdf_toc_${idx}_${pageNum}`,
        label: item.title || `Trang ${pageNum}`,
        href: `${pageNum}`,
        subitems: sub.length > 0 ? sub : undefined,
      };
    };

    const result: TocItem[] = [];
    for (let i = 0; i < outline.length; i++) {
      result.push(await mapItem(outline[i] as any, i));
    }
    return result;
  } catch (err) {
    console.warn('Lỗi đọc mục lục PDF:', err);
    return [];
  }
}
