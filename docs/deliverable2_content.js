/**
 * Content for Project Deliverable 2 — Back End Development.
 * Structure follows the faculty template exactly.
 */
const fs = require('fs');
const K = require('./build_deliverable2');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  TableOfContents, Header, Footer, PageNumber, LevelFormat,
  body, rich, h1, h2, h3, code, console_, bullets, figure, table, spacer,
  BRAND, INK, SOFT, RULE, OUT,
} = K;

const STUDENT = 'Andzani Ntlemo';
const STUDENT_NO = 'EDUV4820290';
const PROJECT = 'KhupFin Microfinance Management System';
const SUBMITTED = 'Block 4, Week 6';

/* ====================================================================
   COVER PAGE
   ==================================================================== */
const coverLabel = (t) => new Paragraph({
  spacing: { after: 60 },
  children: [new TextRun({ text: t, font: 'Calibri', size: 22, bold: true, color: BRAND })],
});

function coverRow(label, value) {
  const cell = (text, bold, w, shade) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: shade ? { type: ShadingType.CLEAR, fill: 'E3EDE8' } : undefined,
    margins: { top: 110, bottom: 110, left: 140, right: 140 },
    children: [new Paragraph({
      spacing: { after: 0 },
      children: [new TextRun({ text, font: 'Calibri', size: 22, bold, color: INK })],
    })],
  });
  return new TableRow({ children: [cell(label, true, 3200, true), cell(value, false, 5800, false)] });
}

const cover = [
  new Paragraph({
    spacing: { before: 600, after: 120 },
    children: [new TextRun({
      text: 'Project Deliverable 2 – Back End Development',
      font: 'Calibri', size: 44, bold: true, color: BRAND,
    })],
  }),
  new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: 'B07D0A' } },
    spacing: { after: 420 },
    children: [],
  }),

  ...[
    ['Faculty Name:', 'Information Technology'],
    ['Module Code:', 'ITTFA4-B21'],
    ['Module Name:', 'Welcome to the Front-end and Backend Technologies and Frameworks'],
    ['Content Writer:', 'Sophie Bhebe'],
    ['Copy Editor:', 'Mr Kyle Keens'],
    ['Submission Date:', 'Block 4 Week 6'],
  ].map(([l, v]) => new Paragraph({
    spacing: { after: 110 },
    children: [
      new TextRun({ text: l.padEnd(0), font: 'Calibri', size: 22, bold: true, color: INK }),
      new TextRun({ text: '  ' + v, font: 'Calibri', size: 22, color: INK }),
    ],
  })),

  ...spacer(2),

  new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: [3200, 5800],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      left: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      right: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: RULE },
    },
    rows: [
      coverRow('Student Name', STUDENT),
      coverRow('Student Number', STUDENT_NO),
      coverRow('Project Title', PROJECT),
      coverRow('Submission Date', SUBMITTED),
    ],
  }),

  ...spacer(2),
  new Paragraph({
    spacing: { after: 0 },
    children: [new TextRun({
      text: 'Built with HTML, CSS, JavaScript, Node.js (Express) and MySQL 8.',
      font: 'Calibri', size: 20, italics: true, color: SOFT,
    })],
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

/* ====================================================================
   TABLE OF CONTENTS
   ==================================================================== */
/**
 * A static contents page. A Word TOC field renders blank until the reader
 * presses F9, and renders blank permanently in LibreOffice, Google Docs and
 * most PDF previews — not what a marker should be met with. The page numbers
 * below are measured from the rendered document by docs/toc_map.js and written
 * in on a second build pass, so they are accurate without depending on the
 * reader updating a field.
 */
const { Tab, TabStopType, LeaderType } = require('docx');

// A4 (11906 twips) less one-inch margins each side.
const TEXT_WIDTH = 11906 - 1440 * 2;

let tocEntries = [];
try {
  tocEntries = require('./toc_pages.json');
} catch {
  tocEntries = [];   // first pass: the map does not exist yet
}

const tocLine = ({ num, title, level, page }) => {
  const size = level === 1 ? 22 : 20;
  const indent = level === 1 ? 0 : 360;
  const run = (text) => new TextRun({
    text,
    font: 'Calibri',
    size,
    bold: level === 1,
    color: level === 1 ? INK : SOFT,
  });

  return new Paragraph({
    spacing: { after: level === 1 ? 80 : 50, line: 260 },
    indent: { left: indent },
    // A right tab stop carrying a dot leader: standard OOXML, so it renders in
    // Word, LibreOffice, Google Docs and PDF alike.
    tabStops: [{
      type: TabStopType.RIGHT,
      position: TEXT_WIDTH - indent,
      leader: LeaderType.DOT,
    }],
    children: [
      run(`${num}  ${title}`),
      new TextRun({ children: [new Tab()], font: 'Calibri', size, color: SOFT }),
      run(String(page)),
    ],
  });
};

const toc = [
  new Paragraph({
    spacing: { after: 240 },
    children: [new TextRun({ text: 'Table of Contents', font: 'Calibri', size: 32, bold: true, color: BRAND })],
  }),
  ...(tocEntries.length
    ? tocEntries.map(tocLine)
    : [new Paragraph({
        children: [new TextRun({
          text: '(page numbers are inserted on the second build pass)',
          font: 'Calibri', size: 20, italics: true, color: SOFT,
        })],
      })]),
  new Paragraph({ children: [new PageBreak()] }),
];

/* ====================================================================
   1.1 CODING
   ==================================================================== */
const s11 = [
  h1('1.1  Coding'),

  body('This section presents the delivered application and a representative code sample from each '
    + 'technology in the stack. The samples were chosen because each one carries a decision worth '
    + 'explaining, rather than because it is long: a form that validates before it reaches the server, '
    + 'a calculation that must balance to the cent, a query that cannot be injected into.'),

  body('The system is KhupFin, a branch-level microfinance management system. It registers clients, '
    + 'prices and approves loans, generates repayment schedules, receipts payments at the counter, '
    + 'runs passbook savings, issues credit life cover and reports on the portfolio. It is built on '
    + 'HTML, CSS and JavaScript at the front end, Node.js with Express at the back end, and MySQL 8 '
    + 'for storage.'),

  h2('1.1.1  Screenshots of the final website'),
  body('Every screenshot below was taken from the running application, signed in as a real role, with '
    + 'data produced by the system itself rather than typed into the database by hand.'),

  ...figure('01-login.jpg',
    'Figure 1 — Sign-in screen. One message is returned for a wrong email and a wrong password, so the '
    + 'form cannot be used to discover which accounts exist.'),

  ...figure('02-dashboard.jpg',
    'Figure 2 — Dashboard. Outstanding portfolio, amount disbursed, portfolio at risk, the approval '
    + 'queue and active clients, with disbursement and collection trends beneath.'),

  ...figure('03-clients.jpg',
    'Figure 3 — Client register. One search box matches name, client number, phone or ID number.'),

  ...figure('04-client-profile.jpg',
    'Figure 4 — Client profile, showing loans, savings and the nominated beneficiaries. The green bar '
    + 'confirms the nomination totals 100%.'),

  ...figure('05-loans.jpg',
    'Figure 5 — Loan register, with a repayment progress meter on each row.'),

  ...figure('06-loan-quote.jpg',
    'Figure 6 — Loan application. Pricing the loan shows the instalment, interest, fees, credit life '
    + 'premium, the net amount the client receives and the full schedule, before anything is committed.'),

  ...figure('07-loan-detail.jpg',
    'Figure 7 — Loan detail with the repayment schedule rendered as a passbook: a status rail down the '
    + 'left edge and a stamped state on each instalment.'),

  ...figure('08-repayment-statement.jpg',
    'Figure 8 — Repayment counter. The teller sees what is due today including penalty, the full '
    + 'settlement figure and the next due date before taking any money.'),

  ...figure('09-receipt.jpg',
    'Figure 9 — Receipt issued after posting a payment, showing how the money was split across '
    + 'penalty, interest and principal, and the resulting balance.'),

  ...figure('10-savings.jpg', 'Figure 10 — Passbook savings accounts.'),

  ...figure('11-insurance.jpg',
    'Figure 11 — Credit life. Cover in force, premiums written, open claims and the policy book. '
    + 'Declining cover tracks the loan balance; flat cover stays fixed.'),

  ...figure('12-reports.jpg',
    'Figure 12 — Reports. The arrears register is sorted worst-first and names the responsible officer.'),

  ...figure('13-users.jpg',
    'Figure 13 — Staff and access, with the permission matrix the back end enforces.'),

  new Paragraph({ children: [new PageBreak()] }),

  /* ---- a. HTML ---- */
  h2('1.1.2  Sample HTML code'),
  body('The loan application form. Every control is a real form element with a label bound to it by '
    + 'id, so the form is usable with a keyboard and readable by assistive technology. The browser '
    + 'enforces type, step and min before a request is ever sent, which catches the ordinary mistakes '
    + 'without a round trip; the server then validates the same fields again, because anything arriving '
    + 'over HTTP can be forged.'),
  ...code([
    '<div class="field">',
    '  <label for="client_id">Client</label>',
    '  <select id="client_id" name="client_id" required></select>',
    '  <div class="help">Only active clients without an open loan can borrow.</div>',
    '  <div class="err"></div>',
    '</div>',
    '',
    '<div class="field-row">',
    '  <div class="field">',
    '    <label for="principal">Amount (R)</label>',
    '    <input id="principal" name="principal" type="number"',
    '           step="100" min="1" required>',
    '    <div class="err"></div>',
    '  </div>',
    '  <div class="field">',
    '    <label for="term_months">Term (months)</label>',
    '    <input id="term_months" name="term_months" type="number"',
    '           min="1" step="1" required>',
    '    <div class="err"></div>',
    '  </div>',
    '</div>',
    '',
    '<button type="button" class="btn is-ghost" id="previewBtn">',
    '  Price this loan',
    '</button>',
  ], 'public/loans.html'),
  body('The empty div with class "err" beside each input is the slot the JavaScript fills when the '
    + 'server rejects a field, so a validation message appears under the field it belongs to rather '
    + 'than as one banner at the top of the form.'),

  /* ---- c. CSS ---- */
  h2('1.1.3  Sample CSS code'),
  body('The stylesheet opens with a single block of custom properties. Defining the palette, the type '
    + 'and the radius once means a change to the brand colour is a one-line edit rather than a '
    + 'find-and-replace across nine pages.'),
  ...code([
    ':root {',
    '  --paper:      #EDF0EC;',
    '  --ink:        #10201C;',
    '  --brand:      #0C4A3E;',
    '  --gold:       #A8780C;   /* sampled from the KhupFin swoosh */',
    '  --rust:       #A5301C;',
    '',
    "  --font-display: 'Space Grotesk', 'Segoe UI', system-ui, sans-serif;",
    "  --font-body:    'Public Sans', 'Segoe UI', system-ui, sans-serif;",
    "  --font-data:    'IBM Plex Mono', 'Consolas', ui-monospace, monospace;",
    '}',
    '',
    '/* Every figure is set in a monospaced face with tabular numerals, so',
    '   columns of money line up the way they do in a written cash book. */',
    '.num, .money, td.num, th.num {',
    '  font-family: var(--font-data);',
    '  font-variant-numeric: tabular-nums;',
    "  font-feature-settings: 'tnum' 1;",
    '}',
  ], 'public/css/app.css'),
  body('The second rule is the one that matters in a financial system. Proportional digits make a '
    + 'column of rand amounts ragged and hard to scan; tabular numerals give every digit the same '
    + 'width so the decimal points align down the column.'),

  /* ---- b. JavaScript ---- */
  h2('1.1.4  Sample JavaScript code'),
  body('All browser-to-server traffic goes through one function. Centralising it means the bearer '
    + 'token is attached in exactly one place, an expired session is handled identically on every '
    + 'page, and a server that is not running produces a sentence a user can act on instead of an '
    + 'unhandled promise rejection in the console.'),
  ...code([
    'async function request(method, path, body) {',
    "  const options = { method, headers: { 'Content-Type': 'application/json' } };",
    '  if (Session.token) options.headers.Authorization = `Bearer ${Session.token}`;',
    '  if (body !== undefined) options.body = JSON.stringify(body);',
    '',
    '  let response;',
    '  try {',
    '    response = await fetch(API_BASE + path, options);',
    '  } catch {',
    "    throw new ApiError('The server is not responding. "
      + "Check that it is running on port 4000.', 0);",
    '  }',
    '',
    "  if (response.status === 401 && !path.includes('/auth/login')) {",
    '    Session.clear();',
    "    window.location.href = '/index.html';",
    "    throw new ApiError('Session expired', 401);",
    '  }',
    '',
    '  const payload = await response.json().catch(() => ({}));',
    '  if (!response.ok) {',
    "    throw new ApiError(payload.message || 'Request failed', response.status, payload.errors);",
    '  }',
    '  return payload;',
    '}',
  ], 'public/js/api.js'),
  body('A 401 on any route other than the login route means the token has expired, so the session is '
    + 'cleared and the user is returned to the sign-in page automatically. Without this the user would '
    + 'see a screen of empty tables and no explanation.'),

  /* ---- d. Node.js ---- */
  h2('1.1.5  Sample Node.js code'),
  body('Microfinance products price money in two different ways, and the rest of the system should '
    + 'not have to know which. Each method is therefore an interchangeable object exposing the same '
    + 'method — the Strategy pattern. Adding a new pricing method means adding one class and '
    + 'registering it; no existing code changes.'),
  ...code([
    '/**',
    ' * FLAT RATE — interest is charged on the original principal for the full',
    ' * term. The most common method for small, short micro-loans because it is',
    ' * easy to explain to a client at the counter.',
    ' */',
    'class FlatRateStrategy extends InterestStrategy {',
    "  get name() { return 'flat'; }",
    '',
    '  buildInstallments({ principal, annualRate, periods, periodsPerYear }) {',
    '    const years = periods / periodsPerYear;',
    '    const totalInterest = round2(principal * (annualRate / 100) * years);',
    '    const principalPer = round2(principal / periods);',
    '    const interestPer = round2(totalInterest / periods);',
    '',
    '    let balance = principal;',
    '    const rows = [];',
    '    for (let i = 1; i <= periods; i += 1) {',
    '      balance = round2(balance - principalPer);',
    '      rows.push({',
    '        installmentNo: i,',
    '        principalDue: principalPer,',
    '        interestDue: interestPer,',
    '        totalDue: round2(principalPer + interestPer),',
    '        balance: Math.max(balance, 0),',
    '      });',
    '    }',
    '    return this._reconcile(rows, principal, totalInterest);',
    '  }',
    '}',
  ], 'server/src/services/interest/InterestStrategy.js'),
  body('The closing call is the important one. Dividing R10 000 into twelve parts leaves a remainder '
    + 'of fractions of a cent, and twelve rounded instalments will not sum back to the total payable. '
    + '_reconcile() pushes that remainder into the final instalment so the schedule always balances '
    + 'exactly — a property asserted directly against the database in the test suite.'),
  ...code([
    '/** Shared rounding fix: force the sum of the parts to equal the total exactly. */',
    '_reconcile(rows, principal, totalInterest) {',
    '  const sumP = round2(rows.reduce((s, r) => s + r.principalDue, 0));',
    '  const sumI = round2(rows.reduce((s, r) => s + r.interestDue, 0));',
    '  const last = rows[rows.length - 1];',
    '  last.principalDue = round2(last.principalDue + round2(principal - sumP));',
    '  last.interestDue  = round2(last.interestDue  + round2(totalInterest - sumI));',
    '  last.totalDue = round2(last.principalDue + last.interestDue);',
    '  last.balance = 0;',
    '  return rows;',
    '}',
  ], 'server/src/services/interest/InterestStrategy.js'),

  /* ---- e. MySQL ---- */
  h2('1.1.6  Sample MySQL code'),
  body('The repayment schedule is the heart of the database. One row is one instalment, and the paid '
    + 'columns sit beside the due columns so a part payment is representable without a second table.'),
  ...code([
    'CREATE TABLE repayment_schedule (',
    '  id             INT AUTO_INCREMENT PRIMARY KEY,',
    '  loan_id        INT NOT NULL,',
    '  installment_no INT NOT NULL,',
    '  due_date       DATE NOT NULL,',
    '  principal_due  DECIMAL(12,2) NOT NULL DEFAULT 0,',
    '  interest_due   DECIMAL(12,2) NOT NULL DEFAULT 0,',
    '  penalty_due    DECIMAL(12,2) NOT NULL DEFAULT 0,',
    '  total_due      DECIMAL(12,2) NOT NULL DEFAULT 0,',
    '  principal_paid DECIMAL(12,2) NOT NULL DEFAULT 0,',
    '  interest_paid  DECIMAL(12,2) NOT NULL DEFAULT 0,',
    '  penalty_paid   DECIMAL(12,2) NOT NULL DEFAULT 0,',
    '  paid_at        DATETIME NULL,',
    "  status         ENUM('pending','partial','paid','overdue') NOT NULL DEFAULT 'pending',",
    '  UNIQUE KEY uq_schedule (loan_id, installment_no),',
    '  CONSTRAINT fk_sched_loan FOREIGN KEY (loan_id)',
    '    REFERENCES loans(id) ON DELETE CASCADE,',
    '  INDEX idx_sched_due (due_date, status)',
    ') ENGINE=InnoDB;',
  ], 'database/schema.sql'),
  body('Money is stored as DECIMAL(12,2), never FLOAT — binary floating point cannot represent 0.10 '
    + 'exactly and the error compounds across a twelve-instalment schedule. The unique key on '
    + '(loan_id, installment_no) makes a duplicated instalment impossible at the database level rather '
    + 'than relying on the application to be careful, and ON DELETE CASCADE means a removed loan '
    + 'cannot leave orphaned instalment rows behind.'),

  body('Reporting uses views, so the portfolio-at-risk definition lives in one place instead of being '
    + 'restated in every query that needs it:'),
  ...code([
    '-- Portfolio at Risk: outstanding balance of loans with any installment overdue',
    'CREATE OR REPLACE VIEW v_par AS',
    'SELECT l.id AS loan_id, l.loan_no, l.outstanding_balance,',
    '       DATEDIFF(CURDATE(), MIN(s.due_date)) AS days_overdue',
    'FROM loans l',
    'JOIN repayment_schedule s ON s.loan_id = l.id',
    "WHERE l.status = 'active' AND s.status <> 'paid' AND s.due_date < CURDATE()",
    'GROUP BY l.id, l.loan_no, l.outstanding_balance;',
  ], 'database/schema.sql'),

  body('Every query the application sends is parameterised. The values never become part of the SQL '
    + 'string, so a client whose surname contains a quotation mark is stored correctly and an injected '
    + 'payload is treated as data:'),
  ...code([
    'async search({ q = "", status = "", branchId = null, limit = 50 } = {}) {',
    "  const where = ['1=1'];",
    '  const params = [];',
    '  if (q) {',
    "    where.push('(c.first_name LIKE ? OR c.last_name LIKE ? OR c.client_no LIKE ?"
      + " OR c.phone LIKE ? OR c.national_id LIKE ?)');",
    '    const like = `%${q}%`;',
    '    params.push(like, like, like, like, like);',
    '  }',
    "  if (status) { where.push('c.status = ?'); params.push(status); }",
    '',
    '  return db.query(',
    '    `SELECT c.*, b.name AS branch_name, u.full_name AS officer_name',
    '       FROM clients c',
    '       JOIN branches b ON b.id = c.branch_id',
    '  LEFT JOIN users u    ON u.id = c.officer_id',
    "      WHERE ${where.join(' AND ')}",
    '      ORDER BY c.created_at DESC`,',
    '    params',
    '  );',
    '}',
  ], 'server/src/repositories/ClientRepository.js'),
  body('Note what is interpolated and what is not. The ${...} placeholders carry only column names and '
    + 'operators written by the developer; every value supplied by a user arrives through the params '
    + 'array as a bound parameter.'),

  new Paragraph({ children: [new PageBreak()] }),
];

module.exports = { cover, toc, s11, STUDENT, STUDENT_NO, PROJECT, SUBMITTED };
