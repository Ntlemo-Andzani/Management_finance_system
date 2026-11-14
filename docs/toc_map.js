/**
 * Finds the page each heading lands on, by searching the rendered PDF for the
 * exact heading text. Scraping with a number pattern picks up false positives
 * such as "1.7 ms" from the performance table, so the headings are listed here
 * explicitly and looked up one by one.
 *
 * Writes docs/toc_pages.json, consumed by the second build pass.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PDF = process.argv[2];
if (!PDF || !fs.existsSync(PDF)) {
  console.error('usage: node docs/toc_map.js <rendered.pdf>');
  process.exit(1);
}

const HEADINGS = [
  ['1.1', 'Coding', 1],
  ['1.1.1', 'Screenshots of the final website', 2],
  ['1.1.2', 'Sample HTML code', 2],
  ['1.1.3', 'Sample CSS code', 2],
  ['1.1.4', 'Sample JavaScript code', 2],
  ['1.1.5', 'Sample Node.js code', 2],
  ['1.1.6', 'Sample MySQL code', 2],
  ['1.2', 'Full-Stack Integration (Frontend ↔ Backend ↔ DB)', 1],
  ['1.2.1', 'The request pipeline', 2],
  ['1.2.2', 'Worked example: taking a repayment at the counter', 2],
  ['1.2.3', 'Evidence of integration', 2],
  ['1.3', 'Code Quality & Best Practices', 1],
  ['1.3.1', 'Modular structure', 2],
  ['1.3.2', 'Design patterns', 2],
  ['1.3.3', 'Conventions followed', 2],
  ['1.3.4', 'Documentation', 2],
  ['1.3.5', 'Testing', 2],
  ['1.4', 'Security & Performance', 1],
  ['1.4.1', 'Input validation', 2],
  ['1.4.2', 'Password hashing', 2],
  ['1.4.3', 'Environment variables', 2],
  ['1.4.4', 'SQL injection', 2],
  ['1.4.5', 'Authentication and authorisation', 2],
  ['1.4.6', 'Safe error handling', 2],
  ['1.4.7', 'Performance', 2],
  ['1.5', 'User Manual', 1],
  ['1.5.1', 'Installing the system', 2],
  ['1.5.2', 'Signing in', 2],
  ['1.5.3', 'Registering a client', 2],
  ['1.5.4', 'Granting a loan', 2],
  ['1.5.5', 'Taking a repayment', 2],
  ['1.5.6', 'Nominating beneficiaries', 2],
  ['1.5.7', 'Lodging an insurance claim', 2],
  ['1.5.8', 'Resetting the demonstration data', 2],
];

const pages = Number(
  execSync(`pdfinfo "${PDF}"`).toString().match(/Pages:\s+(\d+)/)[1]
);

// Cache each page's text once.
const text = [];
for (let p = 1; p <= pages; p += 1) {
  text[p] = execSync(`pdftotext -f ${p} -l ${p} "${PDF}" - 2>/dev/null`).toString();
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();

const out = HEADINGS.map(([num, title, level]) => {
  // The heading is rendered as "1.4.2  Password hashing" — match on both parts
  // so a stray occurrence of the title in body text is not mistaken for it.
  let page = null;
  for (let p = 1; p <= pages; p += 1) {
    // The contents page lists every heading, so it would match them all.
    if (text[p].includes('Table of Contents')) continue;
    const lines = text[p].split('\n').map(norm);
    if (lines.some((l) => l.startsWith(num + ' ') && l.includes(title.slice(0, 18)))) {
      page = p; break;
    }
  }
  if (page === null) console.error(`  ! not found: ${num} ${title}`);
  return { num, title, level, page: page ?? 0 };
});

const dest = path.join(__dirname, 'toc_pages.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
console.log(`Mapped ${out.filter((e) => e.page).length}/${out.length} headings across ${pages} pages`);
