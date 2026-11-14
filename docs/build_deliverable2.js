/**
 * Builds "Project Deliverable 2 — Back End Development" as a Word document,
 * following the module template supplied by the faculty.
 *
 *   node docs/build_deliverable2.js
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, ImageRun,
  TableOfContents, Header, Footer, PageNumber, LevelFormat, convertInchesToTwip,
} = require('docx');

const IMG = '/tmp/claude-0/-home-claude/8cb83916-4b53-5580-b498-72a397551dbf/scratchpad/docimg';
const OUT = path.join(__dirname, '..', 'Deliverable2_KhupFin_Andzani_Ntlemo.docx');

/* ---------- palette, taken from the application's own design tokens ------- */
const BRAND = '0C4A3E';
const INK = '10201C';
const SOFT = '5A6B66';
const RULE = 'C9D2CC';
const CODE_BG = 'F4F6F4';
const TABLE_HEAD = 'E3EDE8';

/* ---------- building blocks ---------------------------------------------- */

const body = (text, opts = {}) => new Paragraph({
  spacing: { after: opts.after ?? 140, line: 280 },
  alignment: opts.align,
  children: [new TextRun({ text, font: 'Calibri', size: 22, color: INK, ...opts.run })],
});

/** A paragraph built from runs, so one sentence can carry bold or code. */
const rich = (runs, opts = {}) => new Paragraph({
  spacing: { after: opts.after ?? 140, line: 280 },
  children: runs.map((r) => (typeof r === 'string'
    ? new TextRun({ text: r, font: 'Calibri', size: 22, color: INK })
    : new TextRun({
        text: r.t,
        font: r.code ? 'Consolas' : 'Calibri',
        size: r.code ? 19 : 22,
        bold: !!r.b,
        italics: !!r.i,
        color: r.color || INK,
      }))),
});

const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 360, after: 180 },
  children: [new TextRun({ text, font: 'Calibri', size: 32, bold: true, color: BRAND })],
});

const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 280, after: 140 },
  children: [new TextRun({ text, font: 'Calibri', size: 26, bold: true, color: INK })],
});

const h3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 220, after: 110 },
  children: [new TextRun({ text, font: 'Calibri', size: 23, bold: true, color: SOFT })],
});

/** Monospaced code block, shaded, with the file it came from above it. */
function code(lines, caption) {
  const out = [];
  if (caption) {
    out.push(new Paragraph({
      spacing: { before: 120, after: 40 },
      children: [new TextRun({ text: caption, font: 'Consolas', size: 17, bold: true, color: BRAND })],
    }));
  }
  const text = Array.isArray(lines) ? lines : lines.split('\n');
  text.forEach((ln, i) => {
    out.push(new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: CODE_BG },
      spacing: { after: 0, line: 240, before: i === 0 ? 40 : 0 },
      indent: { left: 170, right: 110 },
      children: [new TextRun({
        text: ln.length ? ln : ' ',
        font: 'Consolas', size: 17, color: INK,
      })],
    }));
  });
  out.push(new Paragraph({ spacing: { after: 140 }, children: [] }));
  return out;
}

/** Console transcript — same as code() but labelled as captured output. */
const console_ = (lines, caption) => code(lines, caption);

function bullets(items) {
  return items.map((t) => new Paragraph({
    numbering: { reference: 'dot-list', level: 0 },
    spacing: { after: 90, line: 280 },
    children: (typeof t === 'string'
      ? [new TextRun({ text: t, font: 'Calibri', size: 22, color: INK })]
      : t.map((r) => (typeof r === 'string'
          ? new TextRun({ text: r, font: 'Calibri', size: 22, color: INK })
          : new TextRun({
              text: r.t, font: r.code ? 'Consolas' : 'Calibri',
              size: r.code ? 19 : 22, bold: !!r.b, color: INK,
            })))),
  }));
}

/** A figure: the image, then a caption beneath it. */
function figure(file, caption) {
  const full = path.join(IMG, file);
  const data = fs.readFileSync(full);
  // Measure the JPEG so the aspect ratio is preserved exactly.
  const { width, height } = jpegSize(data);
  const maxW = 600;                      // fits the A4 text column
  const maxH = 430;                      // keeps a figure plus caption on one page
  let w = maxW;
  let h = Math.round(height * maxW / width);
  if (h > maxH) { h = maxH; w = Math.round(width * maxH / height); }

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 140, after: 60 },
      children: [new ImageRun({ data, type: 'jpg', transformation: { width: w, height: h } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [new TextRun({ text: caption, font: 'Calibri', size: 18, italics: true, color: SOFT })],
    }),
  ];
}

/** Minimal JPEG dimension reader — avoids adding an image library. */
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xFF) { i += 1; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xC0 && marker <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return { width: 1300, height: 812 };
}

/** Data table with a shaded header row. */
function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (text, opts = {}) => new TableCell({
    width: { size: opts.w, type: WidthType.DXA },
    shading: opts.head ? { type: ShadingType.CLEAR, fill: TABLE_HEAD } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: [new Paragraph({
      spacing: { after: 0, line: 260 },
      children: [new TextRun({
        text: String(text),
        font: opts.mono ? 'Consolas' : 'Calibri',
        size: opts.mono ? 17 : 20,
        bold: !!opts.head,
        color: INK,
      })],
    })],
  });

  const built = new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      left: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      right: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: RULE },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((hd, i) => cell(hd, { head: true, w: widths[i] })),
      }),
      ...rows.map((r) => new TableRow({
        children: r.map((c, i) => cell(
          typeof c === 'object' ? c.t : c,
          { w: widths[i], mono: typeof c === 'object' && c.mono }
        )),
      })),
    ],
  });

  // Returned with a trailing gap, so the paragraph after a table is not flush
  // against its bottom border.
  return [built, new Paragraph({ spacing: { after: 160 }, children: [] })];
}

const spacer = (n = 1) => Array.from({ length: n }, () => new Paragraph({ children: [] }));

module.exports = {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, ImageRun,
  TableOfContents, Header, Footer, PageNumber, LevelFormat, convertInchesToTwip,
  body, rich, h1, h2, h3, code, console_, bullets, figure, table, spacer,
  BRAND, INK, SOFT, RULE, OUT, IMG,
};
