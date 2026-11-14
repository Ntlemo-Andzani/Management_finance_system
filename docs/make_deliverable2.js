/**
 * Assembles Project Deliverable 2 into a Word document.
 *   node docs/make_deliverable2.js
 */
const fs = require('fs');
const K = require('./build_deliverable2');
const { cover, toc, s11 } = require('./deliverable2_content');
const { s12, s13, s14, s15 } = require('./deliverable2_content2');

const {
  Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle,
  Header, Footer, PageNumber, LevelFormat, convertInchesToTwip,
  BRAND, INK, SOFT, OUT,
} = K;

const doc = new Document({
  creator: 'Andzani Ntlemo',
  title: 'Project Deliverable 2 — Back End Development',
  description: 'KhupFin Microfinance Management System — ITTFA4-B21',

  styles: {
    default: {
      document: { run: { font: 'Calibri', size: 22, color: INK } },
      heading1: {
        run: { font: 'Calibri', size: 32, bold: true, color: BRAND },
        paragraph: { spacing: { before: 360, after: 180 }, keepNext: true },
      },
      heading2: {
        run: { font: 'Calibri', size: 26, bold: true, color: INK },
        paragraph: { spacing: { before: 280, after: 140 }, keepNext: true },
      },
      heading3: {
        run: { font: 'Calibri', size: 23, bold: true, color: SOFT },
        paragraph: { spacing: { before: 220, after: 110 }, keepNext: true },
      },
    },
  },

  numbering: {
    config: [{
      reference: 'dot-list',
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: '•',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 420, hanging: 220 } } },
      }],
    }],
  },

  sections: [{
    properties: {
      page: {
        margin: {
          top: convertInchesToTwip(0.9),
          bottom: convertInchesToTwip(0.9),
          left: convertInchesToTwip(1),
          right: convertInchesToTwip(1),
        },
      },
    },

    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'C9D2CC' } },
          spacing: { after: 120 },
          children: [new TextRun({
            text: 'ITTFA4-B21  ·  Deliverable 2  ·  KhupFin Microfinance Management System',
            font: 'Calibri', size: 16, color: SOFT,
          })],
        })],
      }),
    },

    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Andzani Ntlemo  ·  EDUV4820290  ·  ', font: 'Calibri', size: 16, color: SOFT }),
            new TextRun({ children: [PageNumber.CURRENT], font: 'Calibri', size: 16, color: SOFT }),
          ],
        })],
      }),
    },

    children: [...cover, ...toc, ...s11, ...s12, ...s13, ...s14, ...s15],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log(`Written: ${OUT}`);
  console.log(`Size:    ${(buf.length / 1024 / 1024).toFixed(2)} MB`);
});
