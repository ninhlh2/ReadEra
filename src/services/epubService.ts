import ePub from 'epubjs';
import type { BookRecord } from '../types';
import { saveBookFile, saveBookMetadata } from './storage';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function parseEpubFile(
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<{
  title: string;
  author: string;
  description?: string;
  coverUrl?: string;
}> {
  const book = ePub(arrayBuffer);
  try {
    await book.ready;
    const meta = await book.loaded.metadata;

    let coverUrl: string | undefined = undefined;
    try {
      const rawCoverUrl = await book.coverUrl();
      if (rawCoverUrl) {
        const res = await fetch(rawCoverUrl);
        const blob = await res.blob();
        coverUrl = await blobToBase64(blob);
      }
    } catch {
      // Cover not found or failed to load, ignore
    }

    const title =
      meta?.title?.trim() || fileName.replace(/\.epub$/i, '') || 'Sách không có tiêu đề';
    const author = meta?.creator?.trim() || 'Tác giả không xác định';
    const description = meta?.description?.trim();

    return { title, author, description, coverUrl };
  } finally {
    try {
      book.destroy();
    } catch {
      // ignore
    }
  }
}

export async function importEpubFile(file: File): Promise<BookRecord> {
  const arrayBuffer = await file.arrayBuffer();
  const meta = await parseEpubFile(arrayBuffer, file.name);

  const bookId = `book_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const bookRecord: BookRecord = {
    id: bookId,
    title: meta.title,
    author: meta.author,
    description: meta.description,
    coverUrl: meta.coverUrl,
    fileSize: file.size,
    addedAt: Date.now(),
    progress: 0,
    isFavorite: false,
  };

  await saveBookFile(bookId, arrayBuffer);
  await saveBookMetadata(bookRecord);

  return bookRecord;
}

export async function importSampleBook(): Promise<BookRecord> {
  const response = await fetch('/sample-book.epub');
  const arrayBuffer = await response.arrayBuffer();
  const meta = await parseEpubFile(arrayBuffer, 'Hoàng Tử Bé.epub');

  const bookId = 'book_sample_hoang_tu_be';
  const bookRecord: BookRecord = {
    id: bookId,
    title: meta.title || 'Hoàng Tử Bé',
    author: meta.author || 'Antoine de Saint-Exupéry',
    description:
      meta.description ||
      'Tác phẩm kinh điển thế giới về tình bạn, tình yêu và trách nhiệm. Bản mẫu chuẩn được tích hợp sẵn trên ReadEra.',
    coverUrl: meta.coverUrl,
    fileSize: arrayBuffer.byteLength,
    addedAt: Date.now(),
    progress: 0,
    isFavorite: true,
  };

  await saveBookFile(bookId, arrayBuffer);
  await saveBookMetadata(bookRecord);

  return bookRecord;
}
