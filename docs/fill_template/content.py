"""
The content inserted under each of the template's existing headings.

Nothing here alters the template: each block is appended beneath the heading
and guidance text that were already there.
"""
import os
from ooxml import (
    body, rich, h2, h3, bullets, code, table, run, para, Media,
)

IMG = '/tmp/claude-0/-home-claude/8cb83916-4b53-5580-b498-72a397551dbf/scratchpad/docimg'


def img(name):
    return os.path.join(IMG, name)


# =====================================================================
# 1.1  CODING
# =====================================================================
def section_coding(m):
    return ''.join([
        h2('1.1.1  The delivered application'),
        body('The system is KhupFin, a branch-level microfinance management system built with '
             'HTML, CSS and JavaScript at the front end, Node.js with Express at the back end, and '
             'MySQL 8 for storage. It registers clients, prices and approves loans, generates '
             'repayment schedules, receipts payments at the counter, runs passbook savings, issues '
             'credit life cover and reports on the portfolio.'),
        body('Every screenshot below was taken from the running application, signed in as a real '
             'role, with data produced by the system itself rather than typed into the database by '
             'hand.'),

        m.figure(img('01-login.jpg'),
                 'Figure 1 \u2014 Sign-in screen. One message is returned for a wrong email and a '
                 'wrong password, so the form cannot be used to discover which accounts exist.'),
        m.figure(img('02-dashboard.jpg'),
                 'Figure 2 \u2014 Dashboard. Outstanding portfolio, amount disbursed, portfolio at '
                 'risk, the approval queue and active clients, with disbursement and collection '
                 'trends beneath.'),
        m.figure(img('03-clients.jpg'),
                 'Figure 3 \u2014 Client register. One search box matches name, client number, '
                 'phone or ID number.'),
        m.figure(img('04-client-profile.jpg'),
                 'Figure 4 \u2014 Client profile, showing loans, savings and the nominated '
                 'beneficiaries. The green bar confirms the nomination totals 100%.'),
        m.figure(img('05-loans.jpg'),
                 'Figure 5 \u2014 Loan register, with a repayment progress meter on each row.'),
        m.figure(img('06-loan-quote.jpg'),
                 'Figure 6 \u2014 Loan application. Pricing the loan shows the instalment, '
                 'interest, fees, credit life premium, the net amount the client receives and the '
                 'full schedule, before anything is committed.'),
        m.figure(img('07-loan-detail.jpg'),
                 'Figure 7 \u2014 Loan detail with the repayment schedule rendered as a passbook: '
                 'a status rail down the left edge and a stamped state on each instalment.'),
        m.figure(img('08-repayment-statement.jpg'),
                 'Figure 8 \u2014 Repayment counter. The teller sees what is due today including '
                 'penalty, the full settlement figure and the next due date before taking money.'),
        m.figure(img('09-receipt.jpg'),
                 'Figure 9 \u2014 Receipt issued after posting a payment, showing how the money was '
                 'split across penalty, interest and principal, and the resulting balance.'),
        m.figure(img('10-savings.jpg'), 'Figure 10 \u2014 Passbook savings accounts.'),
        m.figure(img('11-insurance.jpg'),
                 'Figure 11 \u2014 Credit life. Cover in force, premiums written, open claims and '
                 'the policy book. Declining cover tracks the loan balance; flat cover stays fixed.'),
        m.figure(img('12-reports.jpg'),
                 'Figure 12 \u2014 Reports. The arrears register is sorted worst-first and names '
                 'the responsible officer.'),
        m.figure(img('13-users.jpg'),
                 'Figure 13 \u2014 Staff and access, with the permission matrix the back end '
                 'enforces.'),

        # ---- a. HTML ----
        h2('1.1.2  (a)  Sample HTML code'),
        body('The loan application form. Every control is a real form element with a label bound to '
             'it by id, so the form is usable with a keyboard and readable by assistive technology. '
             'The browser enforces type, step and min before a request is ever sent, which catches '
             'ordinary mistakes without a round trip; the server then validates the same fields '
             'again, because anything arriving over HTTP can be forged.'),
        code([
            '<div class="field">',
            '  <label for="client_id">Client</label>',
            '  <select id="client_id" name="client_id" required></select>',
            '  <div class="help">Only active clients without an open loan can borrow.</div>',
            '  <div class="err"></div>',
            '</div>',
            '',
            '<div class="field">',
            '  <label for="principal">Amount (R)</label>',
            '  <input id="principal" name="principal" type="number"',
            '         step="100" min="1" required>',
            '  <div class="err"></div>',
            '</div>',
            '',
            '<button type="button" class="btn is-ghost" id="previewBtn">',
            '  Price this loan',
            '</button>',
        ], 'public/loans.html'),
        body('The empty div with class "err" beside each input is the slot the JavaScript fills when '
             'the server rejects a field, so a validation message appears under the field it belongs '
             'to rather than as one banner at the top of the form.'),

        # ---- b. JavaScript ----
        h2('1.1.3  (b)  Sample JavaScript code'),
        body('All browser-to-server traffic goes through one function. Centralising it means the '
             'bearer token is attached in exactly one place, an expired session is handled '
             'identically on every page, and a server that is not running produces a sentence a user '
             'can act on instead of an unhandled error in the console.'),
        code([
            'async function request(method, path, body) {',
            "  const options = { method, headers: { 'Content-Type': 'application/json' } };",
            '  if (Session.token) options.headers.Authorization = `Bearer ${Session.token}`;',
            '  if (body !== undefined) options.body = JSON.stringify(body);',
            '',
            '  let response;',
            '  try {',
            '    response = await fetch(API_BASE + path, options);',
            '  } catch {',
            "    throw new ApiError('The server is not responding.', 0);",
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
            "    throw new ApiError(payload.message, response.status, payload.errors);",
            '  }',
            '  return payload;',
            '}',
        ], 'public/js/api.js'),
        body('A 401 on any route other than the login route means the token has expired, so the '
             'session is cleared and the user is returned to the sign-in page automatically. Without '
             'this the user would see a screen of empty tables and no explanation.'),

        # ---- c. CSS ----
        h2('1.1.4  (c)  Sample CSS code'),
        body('The stylesheet opens with a single block of custom properties. Defining the palette, '
             'the type and the radius once means a change to the brand colour is a one-line edit '
             'rather than a find-and-replace across nine pages.'),
        code([
            ':root {',
            '  --paper:      #EDF0EC;',
            '  --ink:        #10201C;',
            '  --brand:      #0C4A3E;',
            '  --gold:       #A8780C;   /* sampled from the KhupFin swoosh */',
            '  --rust:       #A5301C;',
            '',
            "  --font-body: 'Public Sans', 'Segoe UI', system-ui, sans-serif;",
            "  --font-data: 'IBM Plex Mono', 'Consolas', ui-monospace, monospace;",
            '}',
            '',
            '/* Every figure is set in a monospaced face with tabular numerals,',
            '   so columns of money line up as in a written cash book. */',
            '.num, .money, td.num, th.num {',
            '  font-family: var(--font-data);',
            '  font-variant-numeric: tabular-nums;',
            "  font-feature-settings: 'tnum' 1;",
            '}',
        ], 'public/css/app.css'),
        body('The second rule is the one that matters in a financial system. Proportional digits '
             'make a column of rand amounts ragged and hard to scan; tabular numerals give every '
             'digit the same width so the decimal points align down the column.'),

        # ---- d. Node.js ----
        h2('1.1.5  (d)  Sample Node.js code'),
        body('Microfinance products price money in two different ways, and the rest of the system '
             'should not have to know which. Each method is therefore an interchangeable object '
             'exposing the same method \u2014 the Strategy pattern. Adding a new pricing method means '
             'adding one class and registering it; no existing code changes.'),
        code([
            '/**',
            ' * FLAT RATE - interest is charged on the original principal for the',
            ' * full term. The most common method for small, short micro-loans',
            ' * because it is easy to explain to a client at the counter.',
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
        body('The closing call is the important one. Dividing R10 000 into twelve parts leaves a '
             'remainder of fractions of a cent, and twelve rounded instalments will not sum back to '
             'the total payable. _reconcile() pushes that remainder into the final instalment so the '
             'schedule always balances exactly \u2014 a property asserted directly against the '
             'database in the test suite.'),
        code([
            '/** Force the sum of the parts to equal the total exactly. */',
            '_reconcile(rows, principal, totalInterest) {',
            '  const sumP = round2(rows.reduce((s, r) => s + r.principalDue, 0));',
            '  const sumI = round2(rows.reduce((s, r) => s + r.interestDue, 0));',
            '  const last = rows[rows.length - 1];',
            '  last.principalDue = round2(last.principalDue + round2(principal - sumP));',
            '  last.interestDue  = round2(last.interestDue + round2(totalInterest - sumI));',
            '  last.totalDue = round2(last.principalDue + last.interestDue);',
            '  last.balance = 0;',
            '  return rows;',
            '}',
        ], 'server/src/services/interest/InterestStrategy.js'),

        # ---- e. MySQL ----
        h2('1.1.6  (e)  Sample MySQL code'),
        body('The repayment schedule is the heart of the database. One row is one instalment, and '
             'the paid columns sit beside the due columns so a part payment is representable without '
             'a second table.'),
        code([
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
            "  status         ENUM('pending','partial','paid','overdue')",
            "                 NOT NULL DEFAULT 'pending',",
            '  UNIQUE KEY uq_schedule (loan_id, installment_no),',
            '  CONSTRAINT fk_sched_loan FOREIGN KEY (loan_id)',
            '    REFERENCES loans(id) ON DELETE CASCADE,',
            '  INDEX idx_sched_due (due_date, status)',
            ') ENGINE=InnoDB;',
        ], 'database/schema.sql'),
        body('Money is stored as DECIMAL(12,2), never FLOAT \u2014 binary floating point cannot '
             'represent 0.10 exactly and the error compounds across a twelve-instalment schedule. '
             'The unique key on (loan_id, installment_no) makes a duplicated instalment impossible at '
             'the database level rather than relying on the application to be careful, and ON DELETE '
             'CASCADE means a removed loan cannot leave orphaned instalment rows behind.'),
        body('Reporting uses views, so the portfolio-at-risk definition lives in one place instead of '
             'being restated in every query that needs it:'),
        code([
            '-- Portfolio at Risk: outstanding balance of loans with any',
            '-- installment overdue',
            'CREATE OR REPLACE VIEW v_par AS',
            'SELECT l.id AS loan_id, l.loan_no, l.outstanding_balance,',
            '       DATEDIFF(CURDATE(), MIN(s.due_date)) AS days_overdue',
            'FROM loans l',
            'JOIN repayment_schedule s ON s.loan_id = l.id',
            "WHERE l.status = 'active' AND s.status <> 'paid'",
            '  AND s.due_date < CURDATE()',
            'GROUP BY l.id, l.loan_no, l.outstanding_balance;',
        ], 'database/schema.sql'),
    ])


# =====================================================================
# 1.2  FULL-STACK INTEGRATION
# =====================================================================
def section_integration(m):
    return ''.join([
        body('The application is a single-page-per-task front end talking to a REST API over JSON, '
             'with MySQL behind it. No page renders data on the server: every screen loads static '
             'HTML, then fetches what it needs. That keeps the boundary between the layers explicit, '
             'which is what makes the integration testable.'),

        h2('1.2.1  The request pipeline'),
        body('Every request passes through the same seven stages. Each has one responsibility, and '
             'no stage reaches past the next one:'),
        table(
            ['Stage', 'File', 'Responsibility'],
            [
                ['1. Browser', {'t': 'public/*.html', 'mono': True},
                 'Collects input, enforces basic HTML validation'],
                ['2. API client', {'t': 'public/js/api.js', 'mono': True},
                 'Attaches the bearer token, sends JSON, handles expiry'],
                ['3. Router', {'t': 'src/routes/index.js', 'mono': True},
                 'Maps the URL to a controller and declares who may call it'],
                ['4. Middleware', {'t': 'src/middleware/auth.js', 'mono': True},
                 'Verifies the JWT, attaches identity and role'],
                ['5. Controller', {'t': 'src/controllers/', 'mono': True},
                 'Validates the body, shapes the HTTP response'],
                ['6. Service', {'t': 'src/services/', 'mono': True},
                 'Applies the business rules, opens transactions'],
                ['7. Repository', {'t': 'src/repositories/', 'mono': True},
                 'Issues parameterised SQL; the only layer that knows SQL exists'],
            ],
            [1750, 2900, 5600]
        ),
        body('The rule the structure enforces is that SQL never appears above the repository layer '
             'and HTTP never appears below the controller layer. A service can therefore be reasoned '
             'about \u2014 and tested \u2014 without a request object, and the storage engine could '
             'be replaced by rewriting one layer.'),

        h2('1.2.2  Worked example: taking a repayment at the counter'),
        body('The trace below was captured against the running system. It follows a single payment '
             'from the teller\u2019s screen through to the rows it changes in MySQL, and corresponds '
             'exactly to the receipt in Figure 9.'),
        code([
            '# 1  Database before the request',
            'loans:  LN-000005   outstanding_balance R10850.00   amount_paid R7750.00',
            '',
            '# 2  GET /api/loans/5/statement     -- what the teller is shown',
            '  loan_no                  LN-000005',
            '  client_name              Lerato Mahlangu',
            '  outstanding_balance      10850',
            '  instalments_remaining    7',
            '  amount_due_now           4650',
            '  penalty_due_now          465',
            '  total_due_now            5115',
            '  payoff_amount            11315',
            '',
            '# 3  POST /api/repayments        -- teller receives R5 115,00 in cash',
            '  receipt_no               RC-000032',
            '  amount                   5115',
            '  principal_component      3750',
            '  interest_component       900',
            '  penalty_component        465',
            '  balance_after            6200',
            '  loan_status              active',
            '',
            '# 4  Database after the request',
            'loans:       LN-000005  outstanding_balance R6200.00  amount_paid R12865.00',
            'repayments:  RC-000032  principal R3750.00  interest R900.00  penalty R465.00',
            'schedule:    instalment 6 now paid',
            'schedule:    instalment 7 now paid',
            'schedule:    instalment 8 now paid',
        ], 'Captured from the running application'),
        body('Three tables changed inside one transaction: the instalment rows in '
             'repayment_schedule were settled oldest-first, a numbered receipt was written to '
             'repayments, and the loan totals were updated. Either all three happen or none do.'),

        h3('What the figures prove'),
        body('The arithmetic in step 4 is worth following, because it demonstrates a distinction the '
             'system had to be corrected to get right:'),
        bullets([
            [{'t': 'Cash received. ', 'b': True},
             'R7 750,00 + R5 115,00 = R12 865,00. amount_paid records every rand that crossed the '
             'counter, penalty included, because that is what a cash book needs.'],
            [{'t': 'Debt reduced. ', 'b': True},
             'R10 850,00 \u2212 R3 750,00 \u2212 R900,00 = R6 200,00. The balance fell by principal '
             'and interest only. The R465,00 penalty did not reduce it.'],
        ]),
        body('An earlier version derived the balance as total_payable minus amount_paid, which '
             'quietly let a penalty payment discount the loan itself. The balance is now read back '
             'from the schedule after each allocation, so the instalment rows and the loan total '
             'cannot disagree. This is asserted by two checks in the test suite.'),

        h2('1.2.3  Evidence of integration'),
        body('Integration is verified by a suite that drives the running API over HTTP exactly as '
             'the browser does, signing in as each of the four roles, then checks the result with '
             'direct SQL rather than trusting the API\u2019s own response. It rebuilds the database '
             'from schema.sql and seed.sql on every run, so it is repeatable.'),
        code([
            'PS C:\\...\\mfms\\server> npm run e2e',
            '',
            'Database reset from schema.sql + seed.sql',
            '',
            'E2E-01  Authentication and access control',
            '  PASS  E2E-01a wrong password is refused',
            '  PASS  E2E-01c unauthenticated request is blocked',
            '  PASS  E2E-01d teller cannot create staff accounts',
            '',
            'E2E-05  Disbursement generates the schedule',
            '  PASS  E2E-05c total payable is R12400',
            '  PASS  E2E-05d twelve instalment rows written',
            '  PASS  E2E-05e instalments sum exactly to total payable',
            '',
            'E2E-12  Credit life insurance',
            '  PASS  E2E-12a a policy is issued at disbursement',
            '  PASS  E2E-12j settlement clears the whole loan balance',
            '  PASS  E2E-12k the surplus is split across the beneficiaries',
            '  PASS  E2E-12m every instalment is paid once the loan is cleared',
            '',
            '  61 passed, 0 failed',
        ], 'npm run e2e   (abridged \u2014 61 checks in 12 groups)'),
        body('Two of these are worth singling out. E2E-05e reads the generated schedule back out of '
             'MySQL and asserts that the instalments sum to the total payable to the cent, which '
             'proves the rounding reconciliation in section 1.1.5 works end to end. E2E-12m asserts '
             'that no instalment is left unpaid once a loan reaches a zero balance, which is the '
             'regression guard for the defect described above.'),
    ])


# =====================================================================
# 1.3  CODE QUALITY & BEST PRACTICES
# =====================================================================
def section_quality(m):
    return ''.join([
        h2('1.3.1  Modular structure'),
        body('The back end is organised by responsibility rather than by feature, so a developer '
             'looking for a rule knows which directory to open. No file exceeds a few hundred lines.'),
        table(
            ['Directory', 'Files', 'Holds'],
            [
                [{'t': 'config/', 'mono': True}, '2', 'Environment loading and the connection pool'],
                [{'t': 'middleware/', 'mono': True}, '2', 'Authentication, role guards, error translation'],
                [{'t': 'repositories/', 'mono': True}, '10', 'All SQL, one repository per table'],
                [{'t': 'services/', 'mono': True}, '12', 'Business rules, transactions, domain events'],
                [{'t': 'controllers/', 'mono': True}, '8', 'Request validation and response shaping'],
                [{'t': 'routes/', 'mono': True}, '1', 'The whole permission model on one screen'],
                [{'t': 'utils/', 'mono': True}, '4', 'Money rounding, validation, error types'],
            ],
            [2600, 1200, 6450]
        ),
        table(
            ['Measure', 'Value'],
            [
                ['Node.js source', '3 049 lines across 41 files'],
                ['Front-end JavaScript', '215 shared lines plus per-page logic'],
                ['CSS', '351 lines, one stylesheet'],
                ['HTML', '9 pages'],
                ['SQL', '551 lines (schema, seed, verification)'],
                ['Automated tests', '601 lines \u2014 14 unit checks, 61 end-to-end checks'],
                ['Comment density (server)', '267 comment lines of 2 691 non-blank (9%)'],
            ],
            [4000, 6250]
        ),

        h2('1.3.2  Design patterns'),
        body('Seven patterns are used \u2014 Strategy twice, for two unrelated calculations \u2014 '
             'and each was adopted because it solved a problem the code actually had:'),
        table(
            ['Pattern', 'Where', 'Why'],
            [
                ['Singleton', {'t': 'config/db.js', 'mono': True},
                 'One connection pool shared by the whole process'],
                ['Repository', {'t': 'repositories/', 'mono': True},
                 'SQL never leaks into services or controllers'],
                ['Strategy', {'t': 'interest/InterestStrategy.js', 'mono': True},
                 'Flat and reducing-balance interest are interchangeable'],
                ['Strategy (again)', {'t': 'insurance/PremiumStrategy.js', 'mono': True},
                 'Flat, declining and no-cover credit life pricing'],
                ['Factory', {'t': 'interest/ScheduleFactory.js', 'mono': True},
                 'Builds a dated schedule from loan terms'],
                ['Observer', {'t': 'services/EventBus.js', 'mono': True},
                 'SMS queue and audit trail subscribe to loan events'],
                ['Null Object', {'t': 'NoCoverStrategy', 'mono': True},
                 'An uninsured product prices at zero, not null'],
                ['Facade', {'t': 'services/LoanService.js', 'mono': True},
                 'Controllers stay thin'],
            ],
            [2100, 3600, 4600]
        ),
        body('The second use of Strategy is the strongest evidence the pattern was a design decision '
             'rather than a label applied afterwards: the same shape was reused unchanged for an '
             'unrelated calculation, months after the first one was written.'),

        h2('1.3.3  Conventions followed'),
        bullets([
            [{'t': 'Separation of concerns. ', 'b': True},
             'A controller never contains a business rule; a service never contains SQL; a '
             'repository never contains an HTTP status code.'],
            [{'t': 'Single source of truth. ', 'b': True},
             'The colour palette exists once as CSS custom properties; the permission model once in '
             'the route table; the portfolio-at-risk definition once as a database view.'],
            [{'t': 'Naming. ', 'b': True},
             'Tables and columns are snake_case, JavaScript is camelCase, classes are PascalCase. '
             'Repository methods say what they return, not how they do it.'],
            [{'t': 'Explicit error handling. ', 'b': True},
             'Every async route handler is wrapped in asyncHandler, so a rejected promise reaches '
             'the error middleware instead of hanging the request.'],
            [{'t': 'Comments explain why, not what. ', 'b': True},
             'The code says what it does; comments are reserved for decisions a reader would '
             'otherwise have to reverse-engineer.'],
            [{'t': 'No secrets in source. ', 'b': True},
             'Credentials live in .env, excluded by .gitignore, with a .env.example committed in '
             'its place.'],
        ]),

        h2('1.3.4  Documentation'),
        body('Every module opens with a block comment stating its job and the reasoning behind it. '
             'The example below is the top of the database module, and is typical:'),
        code([
            '/**',
            ' * Database.js - SINGLETON design pattern.',
            ' *',
            ' * The whole application shares exactly one MySQL connection pool.',
            ' * The pool is created the first time getInstance() is called and',
            ' * re-used afterwards, which keeps connection usage predictable and',
            ' * makes transactions easy to reason about.',
            ' */',
        ], 'server/src/config/db.js'),
        body('Alongside the code the repository carries a README with setup instructions, a full '
             'project report, a setup and demonstration guide, nine annotated wireframes, 29 CRC '
             'cards and seven diagrams (context, data flow, entity relationship, two class diagrams, '
             'state and sequence).'),

        h2('1.3.5  Testing'),
        body('Testing is in two layers. Unit tests cover the money arithmetic and need no database, '
             'so they run in under a second. End-to-end tests drive the live API and verify against '
             'MySQL.'),
        code([
            'PS C:\\...\\mfms\\server> npm test',
            '',
            'TC-01..TC-06  Interest and schedule calculations',
            '  PASS  TC-01 flat rate: R10 000 at 24% for 12 months gives R2 400',
            '  PASS  TC-02 flat rate: instalments sum exactly to the total payable',
            '  PASS  TC-03 reducing balance: closing balance is zero, EMI is level',
            '  PASS  TC-04 reducing charges less interest than flat at same rate',
            '  PASS  TC-05 weekly product over 3 months gives 13 dated instalments',
            '  PASS  TC-06 unknown interest method is rejected',
            '',
            'TC-07..TC-09  Penalty rules',
            '  PASS  TC-07 no penalty before the due date',
            '  PASS  TC-08 5% penalty applies once for the first month overdue',
            '  PASS  TC-09 penalty never exceeds the unpaid instalment',
            '',
            'TC-10..TC-14  Credit life premium strategies',
            '  PASS  TC-10 flat cover is the full amount repayable',
            '  PASS  TC-11 flat premium scales with the term',
            '  PASS  TC-12 declining cover is cheaper than flat at the same rate',
            '  PASS  TC-13 an uninsured product prices at zero without throwing',
            '  PASS  TC-14 an unknown insurance method is rejected',
            '',
            '14/14 checks passed',
        ], 'npm test'),
        body('A third script, npm run seed:demo, builds a realistic demonstration portfolio by '
             'calling the same API a user does \u2014 capturing, approving, disbursing and repaying '
             'loans \u2014 so every figure on the dashboard is produced by the real code path rather '
             'than inserted behind the application\u2019s back.'),
    ])


# =====================================================================
# 1.4  SECURITY & PERFORMANCE
# =====================================================================
def section_security(m):
    return ''.join([
        h2('1.4.1  Input validation'),
        body('Validation happens twice: in the browser for immediate feedback, and again on the '
             'server because anything arriving over HTTP can be forged. The server-side validator '
             'takes a schema and returns a cleaned object or throws with field-level messages.'),
        code([
            'const data = validate(req.body, {',
            "  client_id:   { type: 'integer', required: true, label: 'Client' },",
            "  product_id:  { type: 'integer', required: true, label: 'Product' },",
            "  principal:   { type: 'number',  required: true, min: 1 },",
            "  term_months: { type: 'integer', required: true, min: 1 },",
            "  purpose:     { type: 'string',  maxLength: 255 },",
            '});',
        ], 'server/src/controllers/loanController.js'),
        body('Only fields named in the schema survive, so an attacker cannot smuggle extra columns '
             'into an insert by adding keys to the JSON body. The repository layer applies the same '
             'principle again with an explicit list of writable columns per table.'),

        h2('1.4.2  Password hashing'),
        body('Passwords are hashed with bcrypt at a cost factor of 10 and are never stored, logged '
             'or returned. A failed sign-in gives one message whether the email is unknown or the '
             'password is wrong, so the form cannot be used to enumerate accounts.'),
        code([
            'static async login(email, password) {',
            '  const user = await userRepository.findByEmail(email.toLowerCase());',
            '  // Same message either way, so the form cannot reveal valid emails.',
            "  if (!user) throw ApiError.unauthorized('Email or password is incorrect');",
            '',
            '  const ok = await bcrypt.compare(password, user.password_hash);',
            "  if (!ok) throw ApiError.unauthorized('Email or password is incorrect');",
            '',
            '  const payload = { id: user.id, role: user.role };',
            '  const token = jwt.sign(payload, env.jwt.secret, {',
            '    expiresIn: env.jwt.expiresIn,',
            '  });',
            '  return { token, user: { /* no hash, ever */ } };',
            '}',
        ], 'server/src/services/AuthService.js'),

        h2('1.4.3  Environment variables'),
        body('No credential or secret appears in source. Configuration is read once at start-up and '
             'exposed as a read-only object; the .env file is excluded from version control and a '
             '.env.example is committed in its place.'),
        code([
            '# server/.env.example   (copied to .env and filled in per machine)',
            'PORT=4000',
            'DB_HOST=127.0.0.1',
            'DB_USER=root',
            '# If your password contains # or a space, wrap it in double quotes:',
            '#   DB_PASSWORD="my#pass word"',
            'DB_PASSWORD=',
            'DB_NAME=mfms',
            'JWT_SECRET=replace-this-with-a-long-random-string',
            'JWT_EXPIRES_IN=8h',
        ], 'server/.env.example'),
        body('The server refuses to start if the database cannot be reached, and names the exact '
             'line of .env to correct rather than starting in a broken state and failing later at '
             'the login screen.'),

        h2('1.4.4  SQL injection'),
        body('Every value that originates with a user is bound as a parameter, never concatenated '
             'into SQL. The driver sends values separately from the statement, so the payload below '
             'is stored and searched for as a literal string:'),
        code([
            'async search({ q = "", status = "" } = {}) {',
            "  const where = ['1=1'];",
            '  const params = [];',
            '  if (q) {',
            "    where.push('(c.first_name LIKE ? OR c.last_name LIKE ?)');",
            '    const like = `%${q}%`;',
            '    params.push(like, like);',
            '  }',
            "  if (status) { where.push('c.status = ?'); params.push(status); }",
            '',
            '  return db.query(',
            "    `SELECT c.* FROM clients c WHERE ${where.join(' AND ')}`,",
            '    params',
            '  );',
            '}',
        ], 'server/src/repositories/ClientRepository.js'),
        body('Note what is interpolated and what is not. The placeholders carry only column names '
             'and operators written by the developer; every value supplied by a user arrives through '
             'the params array as a bound parameter.'),
        code([
            "Search term entered:   '; DROP TABLE loans; --",
            '',
            'SQL actually sent:     SELECT ... WHERE (c.first_name LIKE ?',
            '                                         OR c.last_name LIKE ?)',
            "Parameter bound:       %'; DROP TABLE loans; --%",
            '',
            'Result:                0 rows. No table is dropped; it is data.',
        ]),

        h2('1.4.5  Authentication and authorisation'),
        body('Every route except sign-in and the health check requires a valid JSON Web Token. '
             'Authorisation is declared per route in one file, so the entire permission model can be '
             'read on one screen:'),
        code([
            '/* ---- everything below requires a valid token ---- */',
            'router.use(requireAuth);',
            '',
            "router.post('/loans',",
            "  requireRole('admin', 'manager', 'officer'), loans.apply);",
            '',
            "router.post('/loans/:id/approve',",
            "  requireRole('admin', 'manager'), loans.approve);",
            '',
            "router.post('/loans/:id/write-off',",
            "  requireRole('admin'), loans.writeOff);",
            '',
            "router.post('/repayments',",
            "  requireRole('admin', 'manager', 'officer', 'teller'),",
            '  repayments.record);',
        ], 'server/src/routes/index.js'),
        body('Authorisation is enforced on the server, not by hiding buttons. The two figures below '
             'show the same report requested by two different roles.'),
        m.figure(img('role-admin.jpg'),
                 'Figure 14 \u2014 Officer performance as an administrator.',
                 max_h_in=2.0),
        m.figure(img('role-teller.jpg'),
                 'Figure 15 \u2014 The same panel as a teller. The data is never sent.',
                 max_h_in=2.0),
        body('Separation of duties is enforced in the domain as well as at the route. A loan cannot '
             'be approved by the officer who captured it; only an administrator can settle an '
             'insurance claim, because settling writes down a loan and pays money out.'),

        h2('1.4.6  Safe error handling'),
        body('A clean-install rehearsal exposed a flaw worth recording: with a misconfigured .env, '
             'the login endpoint returned the driver\u2019s message together with a full stack '
             'trace, exposing internal file paths and the database username. Infrastructure faults '
             'are now mapped to one plain sentence for the user, with the detail written to the '
             'server console only.'),
        code([
            'const DB_FAULTS = {',
            "  ECONNREFUSED:           'The system cannot reach its database.',",
            "  ER_ACCESS_DENIED_ERROR: 'The system cannot sign in to its database.',",
            '};',
            '',
            '// The response never carries a stack trace, an internal path or a',
            '// driver message, in any environment. Unexpected 500s are vague.',
            'if (status >= 500 && !DB_FAULTS[err.code]) {',
            "  message = 'Something went wrong on our side.';",
            '}',
        ], 'server/src/middleware/errorHandler.js'),
        body('All dynamic text rendered into the page is escaped before it reaches innerHTML, so a '
             'client whose business name contains a script tag is displayed rather than executed.'),

        h2('1.4.7  Performance'),
        bullets([
            [{'t': 'Connection pooling. ', 'b': True},
             'A single pool of ten connections is shared process-wide through the Singleton, so no '
             'request pays the cost of opening a connection.'],
            [{'t': 'Indexing. ', 'b': True},
             'Twenty-eight foreign keys and targeted indexes support the queries that run most '
             'often \u2014 idx_sched_due on (due_date, status) for the arrears register, '
             'idx_client_status for the register filter.'],
            [{'t': 'Bulk insert. ', 'b': True},
             'A generated schedule is written in one statement rather than one per instalment, so '
             'disbursing a 24-month loan is a single round trip instead of 24.'],
            [{'t': 'Transactions. ', 'b': True},
             'Multi-table operations run inside one transaction, which is both correct and faster '
             'than separate statements.'],
            [{'t': 'Views for reporting. ', 'b': True},
             'Aggregations the dashboard needs are expressed as SQL views and computed by the '
             'database rather than by looping in JavaScript.'],
            [{'t': 'Debounced search. ', 'b': True},
             'Typing in a search box waits 250 ms before issuing a request, so a ten-character '
             'query sends one request instead of ten.'],
        ]),
        body('Measured response times, averaged over ten consecutive calls against the seeded '
             'portfolio:'),
        table(
            ['Endpoint', 'Average', 'Slowest'],
            [
                [{'t': 'GET /api/reports/dashboard', 'mono': True}, '3.1 ms', '5.8 ms'],
                [{'t': 'GET /api/insurance/policies', 'mono': True}, '2.0 ms', '4.1 ms'],
                [{'t': 'GET /api/loans', 'mono': True}, '1.7 ms', '3.2 ms'],
                [{'t': 'GET /api/clients', 'mono': True}, '1.5 ms', '2.0 ms'],
            ],
            [4650, 2800, 2800]
        ),
        body('The dashboard is the heaviest endpoint because it computes portfolio at risk, a '
             'six-month trend and a fourteen-day collection series in one call; at roughly three '
             'milliseconds it is well inside the budget for an interactive screen.'),
    ])


# =====================================================================
# USER MANUAL  (the template's contents page lists one)
# =====================================================================
def section_manual(m):
    return ''.join([
        h2('1.5.1  Installing the system'),
        body('Requirements: Node.js 18 or newer and MySQL 8 or newer.'),
        code([
            '# 1. Create the database (from the folder containing README.md)',
            'cmd /c "mysql -u root -p < database\\schema.sql"',
            'cmd /c "mysql -u root -p < database\\seed.sql"',
            'cmd /c "mysql -u root -p < database\\verify.sql"   # prints ten OK lines',
            '',
            '# 2. Install dependencies and configure',
            'cd server',
            'npm install',
            'copy .env.example .env        # then set DB_PASSWORD and JWT_SECRET',
            '',
            '# 3. Start the server',
            'npm start                     # leave this window open',
            '',
            '# 4. In a second window, build the demonstration portfolio',
            'npm run seed:demo',
        ], 'Windows PowerShell'),
        rich([
            'The ', {'t': 'cmd /c', 'mono': True},
            ' wrapper on the first three lines is needed because PowerShell reserves the ',
            {'t': '<', 'mono': True},
            ' character and will not use it to redirect a file into a command. On macOS, Linux or '
            'Git Bash the three lines are run directly. Two further points are worth noting: a '
            'password containing a ', {'t': '#', 'mono': True},
            ' must be wrapped in double quotes inside ', {'t': '.env', 'mono': True},
            ', because everything after an unquoted ', {'t': '#', 'mono': True},
            ' is read as a comment; and ', {'t': 'DB_HOST', 'mono': True},
            ' should stay as ', {'t': '127.0.0.1', 'mono': True},
            ' rather than ', {'t': 'localhost', 'mono': True},
            ', which on Node 18 and later can resolve to IPv6 where MySQL is usually not listening.',
        ]),
        code([
            'PS C:\\...\\mfms> cmd /c "mysql -u root -p < database\\verify.sql"',
            '',
            '--- MFMS installation check ---',
            'OK      Tables: 18 of 18 expected',
            'OK      Reporting views: 3 of 3 expected',
            'OK      Staff accounts: 4 of 4 expected',
            'OK      Clients: 5 of 5 expected',
            'OK      Loan products: 4 of 4 expected',
            'OK      Savings accounts: 3 of 3 expected',
            'OK      Pending loan application: 1 (needed for the approval demo)',
            'OK      Foreign keys: 28 (20 or more expected)',
            'OK      Nominated beneficiaries: 5 of 5 expected',
            'OK      Insured loan products: 3 of 3 expected',
        ], 'Verifying the installation'),
        body('Once the server reports that it is running, open http://localhost:4000 and sign in.'),

        h2('1.5.2  Signing in'),
        body('Four roles are supplied for demonstration. Each sees a different system.'),
        table(
            ['Email', 'Password', 'Role', 'May do'],
            [
                [{'t': 'admin@mfms.co.za', 'mono': True}, {'t': 'Admin@123', 'mono': True},
                 'Administrator', 'Everything, plus staff accounts, write-offs, claim settlement '
                 'and the audit trail'],
                [{'t': 'manager@mfms.co.za', 'mono': True}, {'t': 'Manager@123', 'mono': True},
                 'Branch manager', 'Approve, reject and disburse loans; assess claims; all reports'],
                [{'t': 'officer@mfms.co.za', 'mono': True}, {'t': 'Officer@123', 'mono': True},
                 'Loan officer', 'Register clients, capture and price applications, lodge claims'],
                [{'t': 'teller@mfms.co.za', 'mono': True}, {'t': 'Teller@123', 'mono': True},
                 'Teller', 'Take repayments and savings transactions'],
            ],
            [2800, 1900, 2000, 3550]
        ),
        body('These accounts must be removed from seed.sql before any real deployment.'),

        h2('1.5.3  Registering a client'),
        body('Clients \u2192 Register a client. The ID number must be unique; the system refuses a '
             'duplicate and names the existing client. A new client is created with status pending '
             'and cannot borrow until a manager activates the profile, which is the KYC control.'),

        h2('1.5.4  Granting a loan'),
        bullets([
            'Loans \u2192 New application. Choose the client and a product; the product\u2019s '
            'limits are printed beneath the selector.',
            'Enter the amount and term, then press Price this loan. The quote shows the instalment, '
            'total interest, fees, the credit life premium and the net amount the client receives, '
            'together with the full schedule. Nothing is committed at this point.',
            'Submit for approval. The application appears in the manager\u2019s queue.',
            'A manager opens it and approves or rejects it. A loan cannot be approved by the officer '
            'who captured it.',
            'The manager then disburses it. The repayment schedule and, on an insured product, the '
            'credit life policy are both generated at this moment, inside one transaction.',
        ]),

        h2('1.5.5  Taking a repayment'),
        body('Repayments \u2192 select the loan. The screen shows what is due today including any '
             'penalty, the full settlement figure and the next due date. The amount field is '
             'pre-filled with what is owed but remains editable, because part payments are normal in '
             'microfinance. After posting, a receipt appears showing how the money was split across '
             'penalty, interest and principal, and can be printed for the client.'),

        h2('1.5.6  Nominating beneficiaries'),
        body('Open a client and scroll to Nominated beneficiaries. Shares must total exactly 100%; '
             'the bar turns red and names the shortfall until they do, because a payout cannot be '
             'split against shares that do not add up. Withdrawing a nomination retires it rather '
             'than deleting it, so a claim assessed years later can still show who was nominated at '
             'the time.'),

        h2('1.5.7  Lodging an insurance claim'),
        body('Insurance \u2192 Lodge a claim. Choose a policy with cover in force, the claim type '
             'and the date of the incident. An officer lodges, a manager assesses, and an '
             'administrator settles. Settlement clears whatever the loan still owes and splits any '
             'surplus across the nominated beneficiaries by their exact shares.'),

        h2('1.5.8  Resetting the demonstration data'),
        body('If a rehearsal leaves the data untidy, running npm run seed:demo again rebuilds the '
             'database from the setup scripts and reconstructs the portfolio. It should not be run '
             'during a live demonstration, as it clears anything created on screen.'),
    ])
