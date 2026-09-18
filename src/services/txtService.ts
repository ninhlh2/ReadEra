import JSZip from 'jszip';
import type { BookRecord } from '../types';
import { saveBookFile, saveBookMetadata } from './storage';

interface TxtChapter {
  id: string;
  title: string;
  paragraphs: string[];
}

export async function convertTxtToEpubBuffer(
  rawText: string,
  bookTitle: string,
  author: string = 'Tác giả không xác định'
): Promise<ArrayBuffer> {
  const zip = new JSZip();

  // 1. mimetype
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  // Split lines
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Chapter detection regex (Hỗ trợ tiếng Việt: Chương, Hồi, Tiết, Mục, Phần, Chapter, Part)
  const chapterRegex = /^(?:Chương|Hồi|Tiết|Mục|Phần|Chapter|Part|Quyển)\s+[\dIVXLCDM\w]+[^\n]*/i;

  const chapters: TxtChapter[] = [];
  let currentChapter: TxtChapter = {
    id: 'chapter_0',
    title: 'Mở đầu',
    paragraphs: [],
  };

  for (const line of lines) {
    if (chapterRegex.test(line)) {
      if (currentChapter.paragraphs.length > 0) {
        chapters.push(currentChapter);
      }
      currentChapter = {
        id: `chapter_${chapters.length + 1}`,
        title: line,
        paragraphs: [],
      };
    } else {
      currentChapter.paragraphs.push(line);
    }
  }

  if (currentChapter.paragraphs.length > 0 || chapters.length === 0) {
    chapters.push(currentChapter);
  }

  // If no chapters were detected by regex and the text is large, split into chunks
  let finalChapters = chapters;
  if (chapters.length === 1 && chapters[0].paragraphs.length > 60) {
    finalChapters = [];
    const allParas = chapters[0].paragraphs;
    const chunkSize = 40;
    for (let i = 0; i < allParas.length; i += chunkSize) {
      const partIdx = Math.floor(i / chunkSize) + 1;
      finalChapters.push({
        id: `part_${partIdx}`,
        title: `Phần ${partIdx}`,
        paragraphs: allParas.slice(i, i + chunkSize),
      });
    }
  }

  // CSS for book
  const css = `
    body {
      font-family: 'Literata', 'Merriweather', 'Georgia', serif;
      line-height: 1.8;
      color: inherit;
      padding: 1em;
    }
    h2 {
      font-size: 1.4em;
      margin-top: 1.5em;
      margin-bottom: 0.8em;
      border-bottom: 1px solid rgba(128,128,128,0.2);
      padding-bottom: 0.3em;
      text-align: center;
    }
    p {
      text-indent: 1.5em;
      margin-bottom: 0.8em;
      text-align: justify;
    }
  `;
  zip.file('OEBPS/style.css', css);

  // Add chapter XHTML files
  finalChapters.forEach((ch) => {
    const contentHtml = ch.paragraphs
      .map(
        (p) =>
          `<p>${p
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</p>`
      )
      .join('\n');

    const xhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>${ch.title}</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
  </head>
  <body>
    <h2>${ch.title}</h2>
    ${contentHtml}
  </body>
</html>`;
    zip.file(`OEBPS/${ch.id}.xhtml`, xhtml);
  });

  // TOC Navigation (EPUB 3 nav.xhtml)
  const navXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head>
    <title>Mục lục</title>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Mục lục</h1>
      <ol>
        ${finalChapters.map((ch) => `<li><a href="${ch.id}.xhtml">${ch.title}</a></li>`).join('\n        ')}
      </ol>
    </nav>
  </body>
</html>`;
  zip.file('OEBPS/nav.xhtml', navXhtml);

  // OEBPS/toc.ncx (EPUB 2)
  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="readera-txt-${Date.now()}"/>
    <meta name="dtb:depth" content="1"/>
  </head>
  <docTitle>
    <text>${bookTitle}</text>
  </docTitle>
  <navMap>
    ${finalChapters
      .map(
        (ch, idx) => `
    <navPoint id="navPoint-${idx + 1}" playOrder="${idx + 1}">
      <navLabel><text>${ch.title}</text></navLabel>
      <content src="${ch.id}.xhtml"/>
    </navPoint>`
      )
      .join('')}
  </navMap>
</ncx>`;
  zip.file('OEBPS/toc.ncx', tocNcx);

  // OEBPS/content.opf
  const contentOpf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:readera-txt-${Date.now()}</dc:identifier>
    <dc:title>${bookTitle}</dc:title>
    <dc:creator>${author}</dc:creator>
    <dc:language>vi</dc:language>
  </metadata>
  <manifest>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${finalChapters.map((ch) => `<item id="${ch.id}" href="${ch.id}.xhtml" media-type="application/xhtml+xml"/>`).join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${finalChapters.map((ch) => `<itemref idref="${ch.id}"/>`).join('\n    ')}
  </spine>
</package>`;
  zip.file('OEBPS/content.opf', contentOpf);

  // Generate buffer
  return await zip.generateAsync({
    type: 'arraybuffer',
    mimeType: 'application/epub+zip',
  });
}

export async function importTxtFile(file: File): Promise<BookRecord> {
  const text = await file.text();
  const cleanTitle = file.name.replace(/\.txt$/i, '');

  const epubBuffer = await convertTxtToEpubBuffer(text, cleanTitle);

  const bookId = `txt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const bookRecord: BookRecord = {
    id: bookId,
    title: cleanTitle,
    author: 'Truyện chữ / Văn bản',
    fileSize: file.size,
    addedAt: Date.now(),
    progress: 0,
    isFavorite: false,
    fileFormat: 'txt',
  };

  await saveBookFile(bookId, epubBuffer);
  await saveBookMetadata(bookRecord);

  return bookRecord;
}
