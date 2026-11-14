/**
 * Sections 1.2 – 1.5 of Project Deliverable 2.
 */
const K = require('./build_deliverable2');
const {
  Paragraph, PageBreak,
  body, rich, h1, h2, h3, code, console_, bullets, figure, table,
} = K;

/* ====================================================================
   1.2  FULL-STACK INTEGRATION
   ==================================================================== */
const s12 = [
  h1('1.2  Full-Stack Integration (Frontend \u2194 Backend \u2194 DB)'),

  body('The application is a single-page-per-task front end talking to a REST API over JSON, with '
    + 'MySQL behind it. No page renders data on the server: every screen loads static HTML, then '
    + 'fetches what it needs. That keeps the boundary between the layers explicit, which is what makes '
    + 'the integration testable.'),

  h2('1.2.1  The request pipeline'),
  body('Every request passes through the same seven stages. Each has one responsibility, and no stage '
    + 'reaches past the next one:'),

  ...table(
    ['Stage', 'File', 'Responsibility'],
    [
      ['1. Browser', { t: 'public/*.html', mono: true }, 'Collects input, enforces basic HTML validation'],
      ['2. API client', { t: 'public/js/api.js', mono: true }, 'Attaches the bearer token, sends JSON, handles expiry'],
      ['3. Router', { t: 'src/routes/index.js', mono: true }, 'Maps the URL to a controller and declares who may call it'],
      ['4. Middleware', { t: 'src/middleware/auth.js', mono: true }, 'Verifies the JWT, attaches identity and role'],
      ['5. Controller', { t: 'src/controllers/', mono: true }, 'Validates the body, shapes the HTTP response'],
      ['6. Service', { t: 'src/services/', mono: true }, 'Applies the business rules, opens transactions'],
      ['7. Repository', { t: 'src/repositories/', mono: true }, 'Issues parameterised SQL; the only layer that knows SQL exists'],
    ],
    [1500, 2700, 4800]
  ),

  body('The rule the structure enforces is that SQL never appears above the repository layer and HTTP '
    + 'never appears below the controller layer. A service can therefore be reasoned about — and '
    + 'tested — without a request object, and the storage engine could be replaced by rewriting one '
    + 'layer.', { after: 200 }),

  h2('1.2.2  Worked example: taking a repayment at the counter'),
  body('The trace below was captured against the running system. It follows a single payment from the '
    + 'teller\u2019s screen through to the rows it changes in MySQL, and corresponds exactly to the '
    + 'receipt in Figure 9.'),

  ...console_([
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
    '# 3  POST /api/repayments           -- teller receives R5 115,00 in cash',
    '  receipt_no               RC-000032',
    '  amount                   5115',
    '  principal_component      3750',
    '  interest_component       900',
    '  penalty_component        465',
    '  balance_after            6200',
    '  loan_status              active',
    '',
    '# 4  Database after the request',
    'loans:       LN-000005   outstanding_balance R6200.00   amount_paid R12865.00',
    'repayments:  RC-000032   principal R3750.00  interest R900.00  penalty R465.00',
    'schedule:    instalment 6 now paid',
    'schedule:    instalment 7 now paid',
    'schedule:    instalment 8 now paid',
  ], 'Captured from the running application'),

  body('Three tables changed inside one transaction: the instalment rows in repayment_schedule were '
    + 'settled oldest-first, a numbered receipt was written to repayments, and the loan totals were '
    + 'updated. Either all three happen or none do.'),

  h3('What the figures prove'),
  body('The arithmetic in step 4 is worth following, because it demonstrates a distinction the system '
    + 'had to be corrected to get right:'),
  ...bullets([
    [{ t: 'Cash received ', b: true }, 'R7 750,00 + R5 115,00 = R12 865,00. amount_paid records every '
      + 'rand that crossed the counter, penalty included, because that is what a cash book needs.'],
    [{ t: 'Debt reduced ', b: true }, 'R10 850,00 \u2212 R3 750,00 \u2212 R900,00 = R6 200,00. The '
      + 'balance fell by principal and interest only. The R465,00 penalty did not reduce it.'],
  ]),
  body('An earlier version derived the balance as total_payable \u2212 amount_paid, which quietly let '
    + 'a penalty payment discount the loan itself. The balance is now read back from the schedule '
    + 'after each allocation, so the instalment rows and the loan total cannot disagree. This is '
    + 'asserted by two checks in the test suite.'),

  h2('1.2.3  Evidence of integration'),
  body('Integration is verified by a suite that drives the running API over HTTP exactly as the '
    + 'browser does, signing in as each of the four roles, then checks the result with direct SQL '
    + 'rather than trusting the API\u2019s own response. It rebuilds the database from schema.sql and '
    + 'seed.sql on every run, so it is repeatable.'),

  ...console_([
    'PS C:\\...\\mfms\\server> npm run e2e',
    '',
    'Database reset from schema.sql + seed.sql',
    '',
    'E2E-01  Authentication and access control',
    '  PASS  E2E-01a wrong password is refused',
    '  PASS  E2E-01b admin signs in',
    '  PASS  E2E-01c unauthenticated request is blocked',
    '  PASS  E2E-01d teller cannot create staff accounts',
    '',
    'E2E-05  Disbursement generates the schedule',
    '  PASS  E2E-05b funds disbursed',
    '  PASS  E2E-05c total payable is R12400',
    '  PASS  E2E-05d twelve instalment rows written',
    '  PASS  E2E-05e instalments sum exactly to total payable',
    '',
    'E2E-12  Credit life insurance',
    '  PASS  E2E-12a a policy is issued at disbursement',
    '  PASS  E2E-12j settlement clears the whole loan balance',
    '  PASS  E2E-12k the surplus is split across the nominated beneficiaries',
    '  PASS  E2E-12m every instalment is marked paid once the loan is cleared',
    '',
    '════════════════════════════════════════════════════════',
    '  61 passed, 0 failed',
    '════════════════════════════════════════════════════════',
  ], 'npm run e2e  (abridged — 61 checks in 12 groups)'),

  body('Two of these are worth singling out. E2E-05e reads the generated schedule back out of MySQL '
    + 'and asserts that the instalments sum to the total payable to the cent, which proves the '
    + 'rounding reconciliation in section 1.1.5 works end to end. E2E-12m asserts that no instalment '
    + 'is left unpaid once a loan reaches a zero balance, which is the regression guard for the defect '
    + 'described above.'),

  new Paragraph({ children: [new PageBreak()] }),
];

/* ====================================================================
   1.3  CODE QUALITY & BEST PRACTICES
   ==================================================================== */
const s13 = [
  h1('1.3  Code Quality & Best Practices'),

  h2('1.3.1  Modular structure'),
  body('The back end is organised by responsibility rather than by feature, so a developer looking for '
    + 'a rule knows which directory to open. No file exceeds a few hundred lines.'),

  ...table(
    ['Directory', 'Files', 'Holds'],
    [
      [{ t: 'config/', mono: true }, '2', 'Environment loading and the database connection pool'],
      [{ t: 'middleware/', mono: true }, '2', 'Authentication, role guards, error translation'],
      [{ t: 'repositories/', mono: true }, '10', 'All SQL, one repository per table'],
      [{ t: 'services/', mono: true }, '12', 'Business rules, transactions, domain events'],
      [{ t: 'controllers/', mono: true }, '8', 'Request validation and response shaping'],
      [{ t: 'routes/', mono: true }, '1', 'The whole permission model on one screen'],
      [{ t: 'utils/', mono: true }, '4', 'Shared helpers: money rounding, validation, errors'],
    ],
    [2400, 1100, 5500]
  ),

  body('', { after: 60 }),
  ...table(
    ['Measure', 'Value'],
    [
      ['Node.js source', '3 049 lines across 41 files'],
      ['Front-end JavaScript', '215 shared lines plus per-page logic'],
      ['CSS', '351 lines, one stylesheet'],
      ['HTML', '9 pages'],
      ['SQL', '551 lines (schema, seed, verification)'],
      ['Automated tests', '601 lines — 14 unit checks, 61 end-to-end checks'],
      ['Comment density (server)', '267 comment lines of 2 691 non-blank (9%)'],
    ],
    [3600, 5400]
  ),

  h2('1.3.2  Design patterns'),
  body('Seven patterns are used — Strategy twice, for two unrelated calculations — and each was '
    + 'adopted because it solved a problem the code actually had:'),

  ...table(
    ['Pattern', 'Where', 'Why'],
    [
      ['Singleton', { t: 'config/db.js', mono: true }, 'One connection pool shared by the whole process'],
      ['Repository', { t: 'repositories/', mono: true }, 'SQL never leaks into services or controllers'],
      ['Strategy', { t: 'interest/InterestStrategy.js', mono: true }, 'Flat and reducing-balance interest are interchangeable'],
      ['Strategy (again)', { t: 'insurance/PremiumStrategy.js', mono: true }, 'Flat, declining and no-cover credit life pricing'],
      ['Factory', { t: 'interest/ScheduleFactory.js', mono: true }, 'Builds a dated schedule from loan terms'],
      ['Observer', { t: 'services/EventBus.js', mono: true }, 'SMS queue and audit trail subscribe to loan events'],
      ['Null Object', { t: 'NoCoverStrategy', mono: true }, 'An uninsured product prices at zero instead of returning null'],
      ['Facade', { t: 'services/LoanService.js', mono: true }, 'Controllers stay thin'],
    ],
    [1900, 3200, 3900]
  ),

  body('The second use of Strategy is the strongest evidence the pattern was a design decision rather '
    + 'than a label applied afterwards: the same shape was reused unchanged for an unrelated '
    + 'calculation, months after the first one was written.'),

  h2('1.3.3  Conventions followed'),
  ...bullets([
    [{ t: 'Separation of concerns. ', b: true }, 'A controller never contains a business rule; a '
      + 'service never contains SQL; a repository never contains an HTTP status code.'],
    [{ t: 'Single source of truth. ', b: true }, 'The colour palette exists once as CSS custom '
      + 'properties; the permission model exists once in the route table; the portfolio-at-risk '
      + 'definition exists once as a database view.'],
    [{ t: 'Naming. ', b: true }, 'Tables and columns are snake_case, JavaScript is camelCase, classes '
      + 'are PascalCase. Repository methods say what they return (findDetailed, outstandingForLoan) '
      + 'rather than how they do it.'],
    [{ t: 'Explicit error handling. ', b: true }, 'Every async route handler is wrapped in '
      + 'asyncHandler, so a rejected promise reaches the error middleware instead of hanging the '
      + 'request.'],
    [{ t: 'Comments explain why, not what. ', b: true }, 'The code says what it does; comments are '
      + 'reserved for decisions a reader would otherwise have to reverse-engineer — why penalties are '
      + 'capped, why the balance is read back from the schedule.'],
    [{ t: 'No secrets in source. ', b: true }, 'Credentials live in .env, which is excluded by '
      + '.gitignore. A .env.example is committed in its place.'],
  ]),

  h2('1.3.4  Documentation'),
  body('Every module opens with a block comment stating its job and the reasoning behind it. The '
    + 'example below is the top of the database module, and is typical:'),
  ...code([
    '/**',
    ' * Database.js — SINGLETON design pattern.',
    ' *',
    ' * The whole application shares exactly one MySQL connection pool. The pool',
    ' * is created the first time getInstance() is called and re-used afterwards,',
    ' * which keeps connection usage predictable and makes transactions easy to',
    ' * reason about.',
    ' */',
  ], 'server/src/config/db.js'),

  body('Alongside the code the repository carries a README with setup instructions, a full project '
    + 'report, a setup and demonstration guide, nine annotated wireframes, 29 CRC cards and seven '
    + 'diagrams (context, data flow, entity relationship, two class diagrams, state and sequence).'),

  h2('1.3.5  Testing'),
  body('Testing is in two layers. Unit tests cover the money arithmetic and need no database, so they '
    + 'run in under a second. End-to-end tests drive the live API and verify against MySQL.'),

  ...console_([
    'PS C:\\...\\mfms\\server> npm test',
    '',
    'TC-01..TC-06  Interest and schedule calculations',
    '  PASS  TC-01 flat rate: R10 000 at 24% for 12 months yields R2 400 interest',
    '  PASS  TC-02 flat rate: instalments sum exactly to the total payable',
    '  PASS  TC-03 reducing balance: closing balance is zero and EMI is level',
    '  PASS  TC-04 reducing balance charges less interest than flat at the same rate',
    '  PASS  TC-05 weekly product over 3 months produces 13 dated instalments',
    '  PASS  TC-06 unknown interest method is rejected',
    '',
    'TC-07..TC-09  Penalty rules',
    '  PASS  TC-07 no penalty before the due date',
    '  PASS  TC-08 5% penalty applies once for the first month overdue',
    '  PASS  TC-09 penalty never exceeds the unpaid instalment',
    '',
    'TC-10..TC-14  Credit life premium strategies',
    '  PASS  TC-10 flat cover is the full amount repayable, not just the principal',
    '  PASS  TC-11 flat premium scales with the term',
    '  PASS  TC-12 declining cover is cheaper than flat at the same rate',
    '  PASS  TC-13 an uninsured product prices at zero without throwing',
    '  PASS  TC-14 an unknown insurance method is rejected',
    '',
    '14/14 checks passed',
  ], 'npm test'),

  body('A third script, npm run seed:demo, builds a realistic demonstration portfolio by calling the '
    + 'same API a user does — capturing, approving, disbursing and repaying loans — so every figure '
    + 'on the dashboard is produced by the real code path rather than inserted behind the '
    + 'application\u2019s back.'),

  new Paragraph({ children: [new PageBreak()] }),
];

/* ====================================================================
   1.4  SECURITY & PERFORMANCE
   ==================================================================== */
const s14 = [
  h1('1.4  Security & Performance'),

  h2('1.4.1  Input validation'),
  body('Validation happens twice: in the browser for immediate feedback, and again on the server '
    + 'because anything arriving over HTTP can be forged. The server-side validator takes a schema and '
    + 'returns a cleaned object or throws with field-level messages.'),
  ...code([
    'const data = validate(req.body, {',
    "  client_id:    { type: 'integer', required: true, label: 'Client' },",
    "  product_id:   { type: 'integer', required: true, label: 'Loan product' },",
    "  principal:    { type: 'number',  required: true, min: 1, label: 'Amount' },",
    "  term_months:  { type: 'integer', required: true, min: 1, label: 'Term' },",
    "  purpose:      { type: 'string',  maxLength: 255, label: 'Purpose' },",
    '});',
  ], 'server/src/controllers/loanController.js'),
  body('Only fields named in the schema survive, so an attacker cannot smuggle extra columns into an '
    + 'insert by adding keys to the JSON body. The repository layer applies the same principle again '
    + 'with an explicit list of writable columns per table.'),

  h2('1.4.2  Password hashing'),
  body('Passwords are hashed with bcrypt at a cost factor of 10 and are never stored, logged or '
    + 'returned. A failed sign-in gives one message whether the email is unknown or the password is '
    + 'wrong, so the form cannot be used to enumerate accounts.'),
  ...code([
    'static async login(email, password) {',
    '  const user = await userRepository.findByEmail(String(email).toLowerCase());',
    '  // Same message either way so the form cannot be used to discover valid emails.',
    "  if (!user) throw ApiError.unauthorized('Email or password is incorrect');",
    '  if (!user.is_active) throw ApiError.forbidden(',
    "    'This account has been deactivated. Ask an administrator to restore it.');",
    '',
    '  const ok = await bcrypt.compare(password, user.password_hash);',
    "  if (!ok) throw ApiError.unauthorized('Email or password is incorrect');",
    '',
    '  await userRepository.touchLogin(user.id);',
    '  const payload = { id: user.id, role: user.role, branchId: user.branch_id };',
    '  const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });',
    '  return { token, user: { /* no hash, ever */ } };',
    '}',
  ], 'server/src/services/AuthService.js'),

  h2('1.4.3  Environment variables'),
  body('No credential or secret appears in source. Configuration is read once at start-up and exposed '
    + 'as a read-only object; the .env file is excluded from version control and a .env.example is '
    + 'committed in its place.'),
  ...code([
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
  body('The server refuses to start if the database cannot be reached and names the exact line of '
    + '.env to correct, rather than starting in a broken state and failing later at the login screen.'),

  h2('1.4.4  SQL injection'),
  body('Every value that originates with a user is bound as a parameter, never concatenated into SQL '
    + '(section 1.1.6 shows the pattern). The driver sends values separately from the statement, so a '
    + 'payload such as the one below is stored and searched for as a literal string:'),
  ...code([
    "Search term entered:   '; DROP TABLE loans; --",
    '',
    'SQL actually sent:     SELECT ... WHERE (c.first_name LIKE ?',
    '                                         OR c.last_name LIKE ? ...)',
    "Parameter bound:       %'; DROP TABLE loans; --%",
    '',
    'Result:                0 rows. No table is dropped; the string is treated as data.',
  ]),

  h2('1.4.5  Authentication and authorisation'),
  body('Every route except sign-in and the health check requires a valid JSON Web Token. Authorisation '
    + 'is declared per route in one file, so the entire permission model can be read on one screen:'),
  ...code([
    '/* ---- everything below requires a valid token ---- */',
    'router.use(requireAuth);',
    '',
    "router.post('/loans',",
    "  requireRole('admin', 'manager', 'officer'), loans.apply);",
    '',
    "router.post('/loans/:id/approve',",
    "  requireRole('admin', 'manager'), loans.approve);",
    '',
    "router.post('/loans/:id/disburse',",
    "  requireRole('admin', 'manager'), loans.disburse);",
    '',
    "router.post('/loans/:id/write-off',",
    "  requireRole('admin'), loans.writeOff);",
    '',
    "router.post('/repayments',",
    "  requireRole('admin', 'manager', 'officer', 'teller'), repayments.record);",
  ], 'server/src/routes/index.js'),

  body('Authorisation is enforced on the server, not by hiding buttons. The two figures below show the '
    + 'same report requested by two different roles.'),
  ...figure('role-admin.jpg', 'Figure 14 — Officer performance as an administrator.'),
  ...figure('role-teller.jpg', 'Figure 15 — The same panel as a teller. The data is never sent.'),

  body('Separation of duties is enforced in the domain as well as at the route. A loan cannot be '
    + 'approved by the officer who captured it; only an administrator can settle an insurance claim, '
    + 'because settling writes down a loan and pays money out.'),

  h2('1.4.6  Safe error handling'),
  body('A clean-install rehearsal exposed a flaw worth recording: with a misconfigured .env, the login '
    + 'endpoint returned the driver\u2019s message together with a full stack trace, exposing internal '
    + 'file paths and the database username. Infrastructure faults are now mapped to one plain '
    + 'sentence for the user, with the detail written to the server console only.'),
  ...code([
    'const DB_FAULTS = {',
    "  ECONNREFUSED:           'The system cannot reach its database. Ask your",
    "                           administrator to check that MySQL is running.',",
    "  ER_ACCESS_DENIED_ERROR: 'The system cannot sign in to its database. Ask your",
    "                           administrator to check the database credentials.',",
    '};',
    '',
    '// The response never carries a stack trace, an internal path or a driver',
    '// message, in any environment. Unexpected 500s are deliberately vague.',
    'if (status >= 500 && !DB_FAULTS[err.code]) {',
    "  message = 'Something went wrong on our side. The problem has been logged.';",
    '}',
  ], 'server/src/middleware/errorHandler.js'),

  body('All dynamic text rendered into the page is escaped before it reaches innerHTML, so a client '
    + 'whose business name contains a script tag is displayed rather than executed.'),

  h2('1.4.7  Performance'),
  ...bullets([
    [{ t: 'Connection pooling. ', b: true }, 'A single pool of ten connections is shared process-wide '
      + 'through the Singleton, so no request pays the cost of opening a connection.'],
    [{ t: 'Indexing. ', b: true }, 'Twenty-eight foreign keys and targeted indexes support the queries '
      + 'that run most often — idx_sched_due on (due_date, status) for the arrears register, '
      + 'idx_client_status for the register filter, idx_policy_status for the insurance book.'],
    [{ t: 'Bulk insert. ', b: true }, 'A generated schedule is written in one statement rather than '
      + 'one per instalment, so disbursing a 24-month loan is a single round trip instead of 24.'],
    [{ t: 'Transactions. ', b: true }, 'Multi-table operations run inside one transaction, which is '
      + 'both correct and faster than separate statements.'],
    [{ t: 'Views for reporting. ', b: true }, 'Aggregations the dashboard needs are expressed as SQL '
      + 'views and computed by the database rather than by looping in JavaScript.'],
    [{ t: 'Debounced search. ', b: true }, 'Typing in a search box waits 250 ms before issuing a '
      + 'request, so a ten-character query sends one request instead of ten.'],
  ]),

  body('Measured response times, averaged over ten consecutive calls against the seeded portfolio:'),
  ...table(
    ['Endpoint', 'Average', 'Slowest'],
    [
      [{ t: 'GET /api/reports/dashboard', mono: true }, '3.1 ms', '5.8 ms'],
      [{ t: 'GET /api/insurance/policies', mono: true }, '2.0 ms', '4.1 ms'],
      [{ t: 'GET /api/loans', mono: true }, '1.7 ms', '3.2 ms'],
      [{ t: 'GET /api/clients', mono: true }, '1.5 ms', '2.0 ms'],
    ],
    [4200, 2400, 2400]
  ),
  body('The dashboard is the heaviest endpoint because it computes portfolio at risk, a six-month '
    + 'trend and a fourteen-day collection series in one call; at roughly three milliseconds it is '
    + 'well inside the budget for an interactive screen.'),

  new Paragraph({ children: [new PageBreak()] }),
];

/* ====================================================================
   1.5  USER MANUAL
   ==================================================================== */
const s15 = [
  h1('1.5  User Manual'),
  body('The template\u2019s contents page lists a user manual, so one is included here. It covers '
    + 'installation and the four daily workflows.'),

  h2('1.5.1  Installing the system'),
  body('Requirements: Node.js 18 or newer and MySQL 8 or newer.'),
  ...code([
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
    'The ',
    { t: 'cmd /c', code: true },
    ' wrapper on the first three lines is needed because PowerShell reserves the ',
    { t: '<', code: true },
    ' character and will not use it to redirect a file into a command. On macOS, Linux or Git '
      + 'Bash the three lines are run directly, as ',
    { t: 'mysql -u root -p < database/schema.sql', code: true },
    '. Two further points are worth noting: a password containing a ',
    { t: '#', code: true },
    ' must be wrapped in double quotes inside ',
    { t: '.env', code: true },
    ', because everything after an unquoted ',
    { t: '#', code: true },
    ' is read as a comment; and ',
    { t: 'DB_HOST', code: true },
    ' should stay as ',
    { t: '127.0.0.1', code: true },
    ' rather than ',
    { t: 'localhost', code: true },
    ', which on Node 18 and later can resolve to IPv6 where MySQL is usually not listening.',
  ]),
  body('Once the server reports that it is running, open http://localhost:4000 and sign in.'),

  ...console_([
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

  h2('1.5.2  Signing in'),
  body('Four roles are supplied for demonstration. Each sees a different system.'),
  ...table(
    ['Email', 'Password', 'Role', 'May do'],
    [
      [{ t: 'admin@mfms.co.za', mono: true }, { t: 'Admin@123', mono: true }, 'Administrator', 'Everything, plus staff accounts, write-offs, claim settlement and the audit trail'],
      [{ t: 'manager@mfms.co.za', mono: true }, { t: 'Manager@123', mono: true }, 'Branch manager', 'Approve, reject and disburse loans; assess claims; all reports'],
      [{ t: 'officer@mfms.co.za', mono: true }, { t: 'Officer@123', mono: true }, 'Loan officer', 'Register clients, capture and price applications, lodge claims'],
      [{ t: 'teller@mfms.co.za', mono: true }, { t: 'Teller@123', mono: true }, 'Teller', 'Take repayments and savings transactions'],
    ],
    [2500, 1700, 1800, 3000]
  ),
  body('These accounts must be removed from seed.sql before any real deployment.'),

  h2('1.5.3  Registering a client'),
  body('Clients \u2192 Register a client. The ID number must be unique; the system refuses a duplicate '
    + 'and names the existing client. A new client is created with status pending and cannot borrow '
    + 'until a manager activates the profile, which is the KYC control.'),

  h2('1.5.4  Granting a loan'),
  ...bullets([
    'Loans \u2192 New application. Choose the client and a product; the product\u2019s limits are '
      + 'printed beneath the selector.',
    'Enter the amount and term, then press Price this loan. The quote shows the instalment, total '
      + 'interest, fees, the credit life premium and the net amount the client receives, together with '
      + 'the full schedule. Nothing is committed at this point.',
    'Submit for approval. The application appears in the manager\u2019s queue.',
    'A manager opens it and approves or rejects it. A loan cannot be approved by the officer who '
      + 'captured it.',
    'The manager then disburses it. The repayment schedule and, on an insured product, the credit life '
      + 'policy are both generated at this moment, inside one transaction.',
  ]),

  h2('1.5.5  Taking a repayment'),
  body('Repayments \u2192 select the loan. The screen shows what is due today including any penalty, '
    + 'the full settlement figure and the next due date. The amount field is pre-filled with what is '
    + 'owed but remains editable, because part payments are normal in microfinance. After posting, a '
    + 'receipt appears showing how the money was split across penalty, interest and principal, and can '
    + 'be printed for the client.'),

  h2('1.5.6  Nominating beneficiaries'),
  body('Open a client and scroll to Nominated beneficiaries. Shares must total exactly 100%; the bar '
    + 'turns red and names the shortfall until they do, because a payout cannot be split against '
    + 'shares that do not add up. Withdrawing a nomination retires it rather than deleting it, so a '
    + 'claim assessed years later can still show who was nominated at the time.'),

  h2('1.5.7  Lodging an insurance claim'),
  body('Insurance \u2192 Lodge a claim. Choose a policy with cover in force, the claim type and the '
    + 'date of the incident. An officer lodges, a manager assesses, and an administrator settles. '
    + 'Settlement clears whatever the loan still owes and splits any surplus across the nominated '
    + 'beneficiaries by their exact shares.'),

  h2('1.5.8  Resetting the demonstration data'),
  body('If a rehearsal leaves the data untidy, running npm run seed:demo again rebuilds the database '
    + 'from the setup scripts and reconstructs the portfolio. It should not be run during a live '
    + 'demonstration, as it clears anything created on screen.'),
];

module.exports = { s12, s13, s14, s15 };
