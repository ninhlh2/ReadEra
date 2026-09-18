const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function createSampleEpub() {
  const zip = new JSZip();

  // 1. mimetype (MUST be first, uncompressed)
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

  // 3. Chapters content
  const chapters = [
    {
      id: 'chapter0',
      title: 'Lời giới thiệu',
      content: `
        <h1>Hoàng Tử Bé</h1>
        <p class="author">Tác giả: Antoine de Saint-Exupéry</p>
        <p class="subtitle">Bản dịch & Tác phẩm mẫu dành cho ReadEra</p>
        <hr class="divider"/>
        <blockquote>
          “Người ta chỉ nhìn thấy thật rõ ràng bằng trái tim. Điều cốt lõi thì vô hình trong mắt trần.”
        </blockquote>
        <p>Chào mừng bạn đến với <strong>ReadEra</strong> — ứng dụng đọc sách điện tử EPUB đa nền tảng hiện đại! Đây là cuốn sách mẫu được tích hợp sẵn để bạn có thể trải nghiệm ngay các tính năng:</p>
        <ul>
          <li>Lật trang mượt mà hoặc cuộn liên tục</li>
          <li>Tùy biến phông chữ, cỡ chữ, khoảng cách dòng và lề</li>
          <li>Chế độ màu: Sáng, Vàng Sepia dịu mắt, Đêm OLED sâu thẳm, Rừng Nord</li>
          <li>Mục lục chương nhanh chóng, đánh dấu trang (Bookmark)</li>
          <li>Tìm kiếm nội dung và đọc văn bản tự động (Text-to-Speech)</li>
        </ul>
      `
    },
    {
      id: 'chapter1',
      title: 'Chương 1: Bức tranh con trăn và chiếc mũ',
      content: `
        <h2>Chương 1: Bức tranh con trăn và chiếc mũ</h2>
        <p>Hồi lên sáu tuổi, có một lần tôi trông thấy một bức tranh tuyệt đẹp trong một cuốn sách viết về Rừng Nguyên Thủy mang tựa đề <em>“Những Chuyện Có Thật”</em>. Bức tranh vẽ một con trăn đang nuốt một con thú dữ.</p>
        <p>Cuốn sách nói rằng: <em>“Loài trăn nuốt chửng con mồi nguyên con mà không cần nhai. Sau đó chúng không thể nhúc nhích được nữa và nằm ngủ say sưa suốt sáu tháng ròng để tiêu hóa.”</em></p>
        <p>Tôi đã suy nghĩ rất nhiều về những chuyến phiêu lưu trong rừng sâu rồi lấy bút chì màu vẽ lại bức tranh đầu tiên trong đời. Đó là Bức vẽ Số 1 của tôi. Nó trông giống như một chiếc mũ cao bồi, nhưng thực ra là hình một con trăn đang tiêu hóa một con voi.</p>
        <p>Tôi đem kiệt tác này cho người lớn xem và hỏi họ có thấy sợ không. Họ trả lời: <em>“Sao lại phải sợ một cái mũ?”</em> Thế là tôi vẽ thêm Bức vẽ Số 2, vẽ rõ cả con voi bên trong bụng trăn để người lớn có thể hiểu được. Người lớn bao giờ cũng cần phải có lời giải thích tỉ mỉ!</p>
      `
    },
    {
      id: 'chapter2',
      title: 'Chương 2: Cuộc gặp gỡ nơi sa mạc hoang vu',
      content: `
        <h2>Chương 2: Cuộc gặp gỡ nơi sa mạc hoang vu</h2>
        <p>Tôi đã sống cô độc như thế, chẳng có ai để thực sự trò chuyện, cho đến một ngày nọ máy bay của tôi gặp sự cố và bị rơi xuống giữa sa mạc Sahara, sáu năm về trước. Động cơ máy bay bị hỏng một thứ gì đó nghiêm trọng, và vì không có thợ máy hay hành khách nào đi cùng, tôi phải tự mình cáng đáng một công việc sửa chữa vô cùng khó khăn.</p>
        <p>Đó là vấn đề sống còn đối với tôi: lượng nước uống mang theo chỉ vừa đủ dùng trong tám ngày.</p>
        <p>Đêm đầu tiên, tôi ngủ thiếp đi trên cát, cách xa mọi chốn có người ở hàng ngàn dặm. Tôi còn cô đơn hơn cả một người bị đắm tàu đang lênh đênh trên chiếc bè giữa đại dương bao la. Thế nên bạn có thể hình dung sự kinh ngạc của tôi lớn đến dường nào, khi bình minh vừa ló dạng, một giọng nói mảnh dẻ lạ lùng đánh thức tôi dậy:</p>
        <blockquote>
          “Xin chú... làm ơn vẽ hộ cháu một con cừu!”
        </blockquote>
        <p>Tôi bật dậy như bị sét đánh. Tôi dụi mắt và nhìn thật kỹ. Và tôi trông thấy một cậu bé kỳ lạ vô cùng, đang chăm chú quan sát tôi với vẻ nghiêm trang...</p>
      `
    },
    {
      id: 'chapter3',
      title: 'Chương 3: Bông hoa hồng kiêu kỳ & Tinh cầu B-612',
      content: `
        <h2>Chương 3: Bông hoa hồng kiêu kỳ & Tinh cầu B-612</h2>
        <p>Trên hành tinh của Hoàng tử bé, có một hạt giống lạ đã nảy mầm. Đó là một bông hoa hồng kiều diễm nhưng vô cùng đỏng đảnh. Nàng chuẩn bị nhan sắc kỹ lưỡng từ rất lâu trong căn phòng màu xanh lá của mình, chọn lọc từng màu sắc, ướm thử từng cánh hoa rực rỡ.</p>
        <p>Vào một buổi sáng đúng lúc mặt trời mọc, nàng đã hé nở. Vừa vươn vai ngáp duyên dáng, nàng vừa nói: <em>“Ôi! Em vừa mới thức dậy... Xin thứ lỗi cho em, tóc tai em vẫn còn bù xù quá...”</em></p>
        <p>Hoàng tử bé không thể kìm nén được nỗi ngưỡng mộ: <em>“Bạn đẹp biết bao!”</em></p>
        <p>Nhưng chẳng mấy chốc, nàng hoa đã bắt đầu làm khổ cậu bằng tính kiêu kỳ và đa nghi của mình. Nàng sợ gió lùa, bắt cậu phải đem chụp thủy tinh che chắn. Nàng bảo nàng có bốn cái gai nhọn hoắt để tự vệ trước loài hổ dữ, dù ở tiểu tinh cầu làm gì có hổ!</p>
        <p><em>“Hồi ấy tôi chưa hiểu gì cả!”</em> — Hoàng tử bé thổ lộ với tôi sau này. <em>“Lẽ ra tôi phải đánh giá nàng qua hành động chứ không phải qua lời nói. Nàng tỏa hương thơm ngát và làm rực rỡ cả hành tinh của tôi. Lẽ ra tôi không nên bỏ trốn...”</em></p>
      `
    },
    {
      id: 'chapter4',
      title: 'Chương 4: Con cáo và bài học cảm hóa',
      content: `
        <h2>Chương 4: Con cáo và bài học cảm hóa</h2>
        <p>Đó là lúc con cáo xuất hiện.</p>
        <p><em>“Xin chào,”</em> con cáo cất tiếng.</p>
        <p><em>“Xin chào,”</em> Hoàng tử bé lịch sự đáp lại, dù quay lại chẳng thấy ai cả ngoài một cái bóng dưới gốc cây táo.</p>
        <p><em>“Tôi ở đây này,”</em> giọng nói vang lên, <em>“ngay dưới cây táo.”</em></p>
        <p><em>“Bạn là ai thế?”</em> Hoàng tử bé hỏi. <em>“Bạn xinh xắn quá...”</em></p>
        <p><em>“Tôi là một con cáo.”</em></p>
        <p><em>“Lại đây chơi với tôi đi,”</em> Hoàng tử bé đề nghị. <em>“Tôi đang buồn quá...”</em></p>
        <p><em>“Tôi không thể chơi với bạn được,”</em> con cáo bảo. <em>“Tôi chưa được cảm hóa.”</em></p>
        <p><em>“‘Cảm hóa’ nghĩa là gì?”</em></p>
        <p><em>“Đó là điều người ta đã lãng quên từ lâu lắm rồi,”</em> con cáo giải thích. <em>“Nó có nghĩa là ‘tạo nên những mối ràng buộc’... Hiện giờ đối với tôi, bạn chỉ là một cậu bé giống như trăm ngàn cậu bé khác. Và tôi chẳng cần gì bạn cả. Bạn cũng chẳng cần gì tôi. Nhưng nếu bạn cảm hóa tôi, chúng ta sẽ cần đến nhau. Đối với tôi, bạn sẽ là duy nhất trên cõi đời này. Và đối với bạn, tôi cũng sẽ là duy nhất...”</em></p>
      `
    }
  ];

  // CSS for book
  const css = `
    body {
      font-family: 'Literata', 'Merriweather', 'Georgia', serif;
      line-height: 1.8;
      color: inherit;
      padding: 1em;
    }
    h1 {
      font-size: 2em;
      text-align: center;
      margin-top: 1.5em;
      margin-bottom: 0.2em;
      color: inherit;
    }
    h2 {
      font-size: 1.4em;
      margin-top: 1.8em;
      margin-bottom: 0.8em;
      border-bottom: 1px solid rgba(128,128,128,0.2);
      padding-bottom: 0.3em;
    }
    p {
      text-indent: 1.5em;
      margin-bottom: 0.8em;
      text-align: justify;
    }
    p.author {
      text-align: center;
      font-weight: 500;
      font-style: italic;
      text-indent: 0;
      margin-bottom: 0.2em;
    }
    p.subtitle {
      text-align: center;
      font-size: 0.9em;
      opacity: 0.8;
      text-indent: 0;
    }
    blockquote {
      margin: 1.5em 2em;
      padding: 0.8em 1.2em;
      border-left: 4px solid #6366f1;
      font-style: italic;
      background: rgba(99, 102, 241, 0.05);
      border-radius: 4px;
    }
    ul {
      margin-left: 1.5em;
      margin-bottom: 1.5em;
    }
    li {
      margin-bottom: 0.4em;
    }
    hr.divider {
      border: none;
      border-top: 2px dashed rgba(128,128,128,0.3);
      margin: 2em auto;
      width: 50%;
    }
  `;

  zip.file('OEBPS/style.css', css);

  // Add chapter xhtml files
  chapters.forEach((ch) => {
    const xhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head>
    <title>${ch.title}</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
  </head>
  <body>
    ${ch.content}
  </body>
</html>`;
    zip.file(`OEBPS/${ch.id}.xhtml`, xhtml);
  });

  // 4. TOC Navigation (EPUB 3 nav.xhtml)
  const navXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head>
    <title>Mục lục</title>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Mục lục sách</h1>
      <ol>
        ${chapters.map((ch) => `<li><a href="${ch.id}.xhtml">${ch.title}</a></li>`).join('\n        ')}
      </ol>
    </nav>
  </body>
</html>`;
  zip.file('OEBPS/nav.xhtml', navXhtml);

  // 5. OEBPS/toc.ncx (EPUB 2 backward compatibility)
  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="readera-sample-hoang-tu-be"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>Hoàng Tử Bé</text>
  </docTitle>
  <navMap>
    ${chapters
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

  // 6. OEBPS/content.opf
  const contentOpf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:readera-hoang-tu-be-sample</dc:identifier>
    <dc:title>Hoàng Tử Bé</dc:title>
    <dc:creator>Antoine de Saint-Exupéry</dc:creator>
    <dc:language>vi</dc:language>
    <dc:description>Cuốn tiểu thuyết kinh điển Hoàng Tử Bé của Antoine de Saint-Exupéry, bản mẫu đọc sách tối ưu cho ReadEra.</dc:description>
    <meta property="dcterms:modified">2026-09-18T10:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${chapters.map((ch) => `<item id="${ch.id}" href="${ch.id}.xhtml" media-type="application/xhtml+xml"/>`).join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${chapters.map((ch) => `<itemref idref="${ch.id}"/>`).join('\n    ')}
  </spine>
</package>`;
  zip.file('OEBPS/content.opf', contentOpf);

  // Generate binary buffer
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  const outDir = path.resolve(__dirname, '../public');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outFile = path.join(outDir, 'sample-book.epub');
  fs.writeFileSync(outFile, buffer);
  console.log('Successfully generated sample EPUB:', outFile, buffer.length, 'bytes');
}

createSampleEpub().catch(console.error);
