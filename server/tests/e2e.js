/**
 * MFMS — end-to-end test suite (cross-platform).
 *
 *   cd server
 *   npm run e2e
 *
 * Runs on Windows, macOS and Linux using only Node and the packages already
 * installed for the server. No bash, no curl, no mysql client needed.
 *
 * The suite rebuilds the database from schema.sql and seed.sql, then drives the
 * running API over HTTP exactly as the browser does, signing in as each of the
 * four roles. Results are checked against the database directly with SQL, so the
 * tests verify what was actually written rather than only what the API reported.
 *
 * The server must be running (npm start) in another terminal.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const BASE = `http://127.0.0.1:${process.env.PORT || 4000}`;
const DB = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
};

let passed = 0;
let failed = 0;
const failures = [];

/* ---------- tiny assertion helpers ------------------------------------ */
function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL  ${name}`);
    if (detail !== undefined) console.log(`        got: ${trim(detail)}`);
  }
}

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const trim = (v) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s && s.length > 220 ? s.slice(0, 220) + '…' : s;
};

/** True when the JSON response contains the given text anywhere. */
const has = (payload, text) => JSON.stringify(payload).toLowerCase().includes(String(text).toLowerCase());

/* ---------- HTTP ------------------------------------------------------- */
async function api(method, route, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + '/api' + route, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json;
  try { json = await res.json(); } catch { json = { parseError: true }; }
  return { status: res.status, body: json };
}

const GET = (route, token) => api('GET', route, { token });
const POST = (route, body, token) => api('POST', route, { body, token });
const PATCH = (route, body, token) => api('PATCH', route, { body, token });

const login = async (email, password) => {
  const res = await POST('/auth/login', { email, password });
  return res.body.token;
};

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);


/**
 * Execute a .sql file through the driver.
 *
 * DELIMITER is a command the mysql command-line client understands, not the
 * server, so a routine wrapped in DELIMITER $$ ... $$ has to be pulled out and
 * sent on its own connection with multi-statement mode off — otherwise the
 * routine body gets split at its internal semicolons.
 */
async function runSqlFile(conn, file) {
  const text = fs.readFileSync(file, 'utf8');
  const routines = [];

  // Strip each DELIMITER x ... DELIMITER ; section out of the main script.
  const stripped = text.replace(
    /DELIMITER\s+(\S+)\s*([\s\S]*?)\1\s*DELIMITER\s*;/gi,
    (_match, _delim, body) => { routines.push(body.trim()); return ''; }
  );

  if (stripped.trim()) await conn.query(stripped);

  if (routines.length) {
    const solo = await mysql.createConnection({ ...DB, multipleStatements: false });
    try {
      await solo.query(`USE \`${process.env.DB_NAME || 'mfms'}\``);
      for (const routine of routines) await solo.query(routine);
    } finally {
      await solo.end();
    }
  }
}

/* ---------- run --------------------------------------------------------- */
async function main() {
  console.log('\nMFMS end-to-end tests');
  console.log('─'.repeat(56));

  // ---- preflight: is the server up? -----------------------------------
  try {
    const health = await fetch(BASE + '/health');
    const body = await health.json();
    if (!body.database) {
      console.error(`\n  ✗ The server is running but cannot reach its database.`);
      console.error('    Fix server/.env, restart with "npm start", then try again.\n');
      process.exit(1);
    }
  } catch {
    console.error(`\n  ✗ No server responding at ${BASE}`);
    console.error('    Open a second terminal, run "npm start" there, leave it running,');
    console.error('    then run "npm run e2e" again in this one.\n');
    process.exit(1);
  }

  // ---- reset the database so the run is repeatable ---------------------
  const sqlDir = path.join(__dirname, '..', '..', 'database');
  const conn = await mysql.createConnection(DB);
  await runSqlFile(conn, path.join(sqlDir, 'schema.sql'));
  await runSqlFile(conn, path.join(sqlDir, 'seed.sql'));
  await conn.query(`USE \`${process.env.DB_NAME || 'mfms'}\``);
  console.log('Database reset from schema.sql + seed.sql\n');

  const sql = async (query, params = []) => {
    const [rows] = await conn.query(query, params);
    return rows;
  };
  const one = async (query, params) => (await sql(query, params))[0];

  /* ================= E2E-01 authentication ========================== */
  console.log('E2E-01  Authentication and access control');

  const bad = await POST('/auth/login', { email: 'admin@mfms.co.za', password: 'wrongpass' });
  check('E2E-01a wrong password is refused', has(bad.body, 'incorrect'), bad.body.message);

  const adminRes = await POST('/auth/login', { email: 'admin@mfms.co.za', password: 'Admin@123' });
  check('E2E-01b admin signs in', adminRes.body.success === true, adminRes.body.message);

  const AT = adminRes.body.token;
  const MT = await login('manager@mfms.co.za', 'Manager@123');
  const OT = await login('officer@mfms.co.za', 'Officer@123');
  const TT = await login('teller@mfms.co.za', 'Teller@123');

  const noauth = await GET('/clients');
  check('E2E-01c unauthenticated request is blocked', has(noauth.body, 'sign in to continue'), noauth.body.message);

  const deny = await POST('/users',
    { full_name: 'Test User', email: 't@t.com', password: 'Password1', role: 'admin', branch_id: 1 }, TT);
  check('E2E-01d teller cannot create staff accounts', has(deny.body, 'limited to'), deny.body.message);

  /* ================= E2E-02 clients ================================= */
  console.log('\nE2E-02  Client registration');

  const newClient = await POST('/clients', {
    first_name: 'Thabo', last_name: 'Molefe', national_id: '9001015800086',
    phone: '0731234567', monthly_income: 7500, occupation: 'Welder',
  }, OT);
  check('E2E-02a client registered', has(newClient.body, 'registered as CL-'), newClient.body.message);
  const clientId = newClient.body.data && newClient.body.data.id;

  const dup = await POST('/clients', {
    first_name: 'Copy', last_name: 'Cat', national_id: '9001015800086', phone: '0730000000',
  }, OT);
  check('E2E-02b duplicate ID number is rejected', has(dup.body, 'already registered'), dup.body.message);

  const invalid = await POST('/clients', { first_name: 'A', last_name: 'B', national_id: '123', phone: '1' }, OT);
  check('E2E-02c short fields fail validation', has(invalid.body, 'highlighted fields'), invalid.body.message);

  const pendingBorrow = await POST('/loans',
    { client_id: clientId, product_id: 1, principal: 10000, term_months: 12 }, OT);
  check('E2E-02d pending client cannot borrow', has(pendingBorrow.body, 'activate the client'), pendingBorrow.body.message);

  const activate = await PATCH(`/clients/${clientId}/status`, { status: 'active' }, MT);
  check('E2E-02e manager activates the client', has(activate.body, 'set to active'), activate.body.message);

  /* ================= E2E-03 pricing and application ================= */
  console.log('\nE2E-03  Loan pricing and application');

  const quote = await POST('/loans/preview', { product_id: 1, principal: 10000, term_months: 12 }, OT);
  check('E2E-03a quote returns R2400 interest on flat product',
    quote.body.data && quote.body.data.totals.totalInterest === 2400,
    quote.body.data && quote.body.data.totals);
  check('E2E-03b quote returns 12 instalments',
    quote.body.data && quote.body.data.totals.installments === 12);

  const over = await POST('/loans/preview', { product_id: 1, principal: 900000, term_months: 12 }, OT);
  check('E2E-03c amount above product ceiling is refused', has(over.body, 'lends between'), over.body);

  const app = await POST('/loans', {
    client_id: clientId, product_id: 1, principal: 10000, term_months: 12,
    purpose: 'Welding equipment',
    guarantors: [{ full_name: 'Sarah Molefe', phone: '0739998888', relationship: 'Sister' }],
  }, OT);
  check('E2E-03d application captured', has(app.body, 'sent for approval'), app.body.message);
  const loanId = app.body.data && app.body.data.id;

  const second = await POST('/loans',
    { client_id: clientId, product_id: 1, principal: 5000, term_months: 6 }, OT);
  check('E2E-03e second open application is blocked', has(second.body, 'already has an open loan'), second.body.message);

  /* ================= E2E-04 approval ================================ */
  console.log('\nE2E-04  Approval and separation of duties');

  const selfApprove = await POST(`/loans/${loanId}/approve`, {}, OT);
  check('E2E-04a officer cannot approve (no permission)', has(selfApprove.body, 'limited to'), selfApprove.body.message);

  const approve = await POST(`/loans/${loanId}/approve`, {}, MT);
  check('E2E-04b manager approves the loan', has(approve.body, 'approved'), approve.body.message);

  const twice = await POST(`/loans/${loanId}/approve`, {}, MT);
  check('E2E-04c a loan cannot be approved twice', has(twice.body, 'only pending'), twice.body.message);

  /* ================= E2E-05 disbursement ============================ */
  console.log('\nE2E-05  Disbursement generates the schedule');

  const early = await POST('/repayments', { loan_id: loanId, amount: 500 }, TT);
  check('E2E-05a payment before disbursement is refused', has(early.body, 'only be posted to active'), early.body.message);

  const disburse = await POST(`/loans/${loanId}/disburse`, { disbursement_date: daysAgo(40) }, MT);
  check('E2E-05b funds disbursed', has(disburse.body, 'schedule generated'), disburse.body.message);

  const detail = await GET(`/loans/${loanId}`, OT);
  check('E2E-05c total payable is R12400', Number(detail.body.data.total_payable) === 12400, detail.body.data.total_payable);

  const rows = await one('SELECT COUNT(*) AS n FROM repayment_schedule WHERE loan_id = ?', [loanId]);
  check('E2E-05d twelve instalment rows written', Number(rows.n) === 12, rows.n);

  const sum = await one('SELECT ROUND(SUM(total_due),2) AS total FROM repayment_schedule WHERE loan_id = ?', [loanId]);
  check('E2E-05e instalments sum exactly to total payable', Number(sum.total) === 12400, sum.total);

  /* ================= E2E-06 repayment allocation ==================== */
  console.log('\nE2E-06  Repayment allocation');

  const statement = await GET(`/loans/${loanId}/statement`, TT);
  check('E2E-06a statement shows arrears with penalty accrued',
    statement.body.data && statement.body.data.penalty_due_now > 0, statement.body.data);

  // Pay exactly what the counter would quote today — instalment plus its penalty.
  const dueToday = statement.body.data.total_due_now;
  const pay = await POST('/repayments',
    { loan_id: loanId, amount: dueToday, method: 'cash' }, TT);
  check('E2E-06b teller posts a payment and gets a receipt', has(pay.body, 'receipt rc-'), pay.body.message);
  check('E2E-06c payment split into principal and interest',
    pay.body.data && pay.body.data.principal_component !== undefined
      && pay.body.data.interest_component !== undefined);

  const afterPay = await one('SELECT ROUND(outstanding_balance,2) AS bal FROM loans WHERE id = ?', [loanId]);
  const applied = round2(pay.body.data.principal_component + pay.body.data.interest_component);
  check('E2E-06d balance falls by principal and interest, not by the penalty',
    Number(afterPay.bal) === round2(12400 - applied),
    { balance: afterPay.bal, applied, penalty: pay.body.data.penalty_component });

  const firstInst = await one(
    'SELECT status FROM repayment_schedule WHERE loan_id = ? AND installment_no = 1', [loanId]);
  check('E2E-06e first instalment cleared, penalty included', firstInst.status === 'paid', firstInst.status);

  const zero = await POST('/repayments', { loan_id: loanId, amount: 0 }, TT);
  check('E2E-06f zero-value payment is rejected',
    has(zero.body, 'highlighted fields') || has(zero.body, 'greater than zero'), zero.body.message);

  /* ================= E2E-07 settlement ============================== */
  console.log('\nE2E-07  Settlement closes the loan');

  const settle = await POST('/repayments',
    { loan_id: loanId, amount: 30000, payment_date: daysAgo(1), method: 'bank', reference: 'Early settlement' }, TT);
  check('E2E-07a overpayment settles the loan',
    settle.body.data && settle.body.data.loan_status === 'closed', settle.body.data && settle.body.data.loan_status);
  check('E2E-07b surplus is returned, not banked',
    settle.body.data && settle.body.data.overpayment_returned > 0, settle.body.data && settle.body.data.overpayment_returned);

  const closed = await one('SELECT status, ROUND(outstanding_balance,2) AS bal FROM loans WHERE id = ?', [loanId]);
  check('E2E-07c loan closed with a zero balance',
    closed.status === 'closed' && Number(closed.bal) === 0, closed);

  /* ================= E2E-08 savings ================================= */
  console.log('\nE2E-08  Savings');

  const account = await POST('/savings', { client_id: clientId, opening_deposit: 500 }, OT);
  check('E2E-08a account opened', has(account.body, 'opened'), account.body.message);
  const accountId = account.body.data && account.body.data.id;

  const deposit = await POST('/savings/transactions',
    { account_id: accountId, type: 'deposit', amount: 250 }, TT);
  check('E2E-08b deposit posted, balance R750',
    deposit.body.data && Number(deposit.body.data.balance) === 750, deposit.body.data && deposit.body.data.balance);

  const overdraw = await POST('/savings/transactions',
    { account_id: accountId, type: 'withdrawal', amount: 5000 }, TT);
  check('E2E-08c overdrawing is prevented', has(overdraw.body, 'overdraw'), overdraw.body.message);

  /* ================= E2E-09 observers and reporting ================= */
  console.log('\nE2E-09  Observers and reporting');

  await new Promise((r) => setTimeout(r, 400));   // observers run asynchronously
  const notes = await one('SELECT COUNT(*) AS n FROM notifications WHERE loan_id = ?', [loanId]);
  check('E2E-09a event observer queued client messages', Number(notes.n) > 0, notes.n);

  const audit = await one('SELECT COUNT(*) AS n FROM audit_logs');
  check('E2E-09b audit observer wrote the trail', Number(audit.n) > 0, audit.n);

  const dash = await GET('/reports/dashboard', AT);
  check('E2E-09c dashboard returns portfolio and PAR',
    dash.body.data && dash.body.data.par !== undefined && dash.body.data.summary !== undefined);

  const arrears = await GET('/reports/arrears', MT);
  check('E2E-09d arrears report responds', arrears.body.success === true);

  /* ================= E2E-10 settlement quote regression (D-01) ====== */
  console.log('\nE2E-10  Settlement quote matches what actually settles (regression for D-01)');

  // The seeded application is disbursed with a back-dated start so penalties accrue.
  await POST('/loans/1/approve', {}, MT);
  await POST('/loans/1/disburse', { disbursement_date: daysAgo(330) }, MT);

  const quoted = await GET('/loans/1/statement', TT);
  const payoff = quoted.body.data.payoff_amount;
  check('E2E-10a quote includes accrued penalty, not just the balance',
    quoted.body.data.penalty_due_now > 0, quoted.body.data.penalty_due_now);

  const settle2 = await POST('/repayments',
    { loan_id: 1, amount: payoff, payment_date: new Date().toISOString().slice(0, 10), method: 'cash' }, TT);
  check('E2E-10b paying exactly the quoted figure closes the loan',
    settle2.body.data && settle2.body.data.loan_status === 'closed', settle2.body.data && settle2.body.data.loan_status);
  check('E2E-10c nothing is returned to the client',
    settle2.body.data && Number(settle2.body.data.overpayment_returned) === 0,
    settle2.body.data && settle2.body.data.overpayment_returned);

  const final = await one('SELECT status, ROUND(outstanding_balance,2) AS bal FROM loans WHERE id = 1');
  check('E2E-10d balance is exactly zero', final.status === 'closed' && Number(final.bal) === 0, final);

  /* ================= E2E-11 beneficiaries =========================== */
  console.log('\nE2E-11  Beneficiaries (next of kin)');

  const benList = await GET('/clients/1/beneficiaries', OT);
  check('E2E-11a seeded client has a complete 100% nomination',
    benList.body.data.is_complete === true && benList.body.data.allocated === 100,
    benList.body.data && benList.body.data.allocated);

  const overAllocate = await POST('/clients/1/beneficiaries',
    { full_name: 'Extra Person', relationship: 'sibling', share_pct: 30 }, OT);
  check('E2E-11b shares beyond 100% are refused',
    has(overAllocate.body, 'cannot exceed 100'), overAllocate.body.message);

  const addBen = await POST(`/clients/${clientId}/beneficiaries`,
    { full_name: 'Naledi Molefe', relationship: 'spouse', share_pct: 70, phone: '0731110000' }, OT);
  check('E2E-11c first nomination accepted', has(addBen.body, 'nominated for'), addBen.body.message);

  await POST(`/clients/${clientId}/beneficiaries`,
    { full_name: 'Tumi Molefe', relationship: 'child', share_pct: 30 }, OT);
  const split = await GET(`/clients/${clientId}/beneficiaries/preview?amount=1000`, OT);
  const shares = split.body.data.map((b) => b.amount);
  check('E2E-11d a payout splits exactly across the shares',
    shares.length === 2 && shares[0] === 700 && shares[1] === 300
      && round2(shares[0] + shares[1]) === 1000, shares);

  const teller_denied = await POST(`/clients/${clientId}/beneficiaries`,
    { full_name: 'Someone Else', relationship: 'other', share_pct: 1 }, TT);
  check('E2E-11e a teller cannot change nominations',
    has(teller_denied.body, 'limited to'), teller_denied.body.message);

  /* ================= E2E-12 credit life ============================= */
  console.log('\nE2E-12  Credit life insurance');

  // A fresh insured loan for the client registered earlier in this run.
  const insLoan = await POST('/loans',
    { client_id: clientId, product_id: 1, principal: 12000, term_months: 12, purpose: 'Cover test' }, OT);
  const insLoanId = insLoan.body.data.id;
  await POST(`/loans/${insLoanId}/approve`, {}, MT);
  const insDisb = await POST(`/loans/${insLoanId}/disburse`, { disbursement_date: daysAgo(200) }, MT);

  check('E2E-12a a policy is issued at disbursement',
    insDisb.body.data.policy && insDisb.body.data.policy.policy_no.startsWith('PL-'),
    insDisb.body.data.policy);
  check('E2E-12b cover equals the full amount repayable',
    Number(insDisb.body.data.policy.coverAmount) === Number(insDisb.body.data.total_payable),
    insDisb.body.data.policy && insDisb.body.data.policy.coverAmount);
  check('E2E-12c the premium is recorded against the loan',
    Number(insDisb.body.data.insurance_premium) > 0, insDisb.body.data.insurance_premium);

  const uninsured = await POST('/loans/preview', { product_id: 3, principal: 5000, term_months: 3 }, OT);
  check('E2E-12d an uninsured product carries no premium',
    uninsured.body.data.insurance.insured === false
      && uninsured.body.data.insurance.premium === 0, uninsured.body.data.insurance);

  const policyId = insDisb.body.data.policy.id;

  const future = await POST('/insurance/claims',
    { policy_id: policyId, claim_type: 'death', incident_date: '2099-01-01' }, OT);
  check('E2E-12e a claim dated in the future is refused',
    has(future.body, 'future'), future.body.message);

  // Pay some instalments so cover exceeds the balance and a surplus arises.
  for (const amount of [1240, 1240, 1240, 1240]) {
    await POST('/repayments', { loan_id: insLoanId, amount, payment_date: daysAgo(100) }, TT);
  }

  const lodged = await POST('/insurance/claims',
    { policy_id: policyId, claim_type: 'death', incident_date: daysAgo(30), notes: 'Certificate filed' }, OT);
  check('E2E-12f claim lodged against live cover', has(lodged.body, 'lodged'), lodged.body.message);
  const claimId = lodged.body.data.id;

  const dupClaim = await POST('/insurance/claims',
    { policy_id: policyId, claim_type: 'death', incident_date: daysAgo(29) }, OT);
  check('E2E-12g a second open claim is blocked', has(dupClaim.body, 'already open'), dupClaim.body.message);

  const officerAssess = await POST(`/insurance/claims/${claimId}/assess`, { decision: 'approve' }, OT);
  check('E2E-12h an officer cannot assess a claim', has(officerAssess.body, 'limited to'), officerAssess.body.message);

  const approveClaim = await POST(`/insurance/claims/${claimId}/assess`,
    { decision: 'approve', notes: 'Documents verified' }, MT);
  check('E2E-12i manager approves the claim', has(approveClaim.body, 'approved'), approveClaim.body.message);

  const balanceBefore = Number(
    (await one('SELECT outstanding_balance AS b FROM loans WHERE id = ?', [insLoanId])).b);

  const settled = await POST(`/insurance/claims/${claimId}/settle`, {}, AT);
  check('E2E-12j settlement clears the whole loan balance',
    Number(settled.body.data.loan_settled) === round2(balanceBefore),
    settled.body.data && settled.body.data.loan_settled);
  check('E2E-12k the surplus is split across the nominated beneficiaries',
    settled.body.data.distribution.length === 2
      && round2(settled.body.data.distribution.reduce((t, b) => t + b.amount, 0))
         === round2(settled.body.data.paid_to_family),
    settled.body.data && settled.body.data.distribution);

  const afterClaim = await one(
    'SELECT status, ROUND(outstanding_balance,2) AS bal FROM loans WHERE id = ?', [insLoanId]);
  check('E2E-12l the loan closes with a zero balance',
    afterClaim.status === 'closed' && Number(afterClaim.bal) === 0, afterClaim);

  // The schedule must agree with the balance — the defect found while building this.
  const unpaidRows = await one(
    "SELECT COUNT(*) AS n FROM repayment_schedule WHERE loan_id = ? AND status <> 'paid'", [insLoanId]);
  check('E2E-12m every instalment is marked paid once the loan is cleared',
    Number(unpaidRows.n) === 0, unpaidRows.n);

  const policyAfter = await one('SELECT status FROM insurance_policies WHERE id = ?', [policyId]);
  check('E2E-12n the policy is marked claimed', policyAfter.status === 'claimed', policyAfter.status);

  /* ---- summary --------------------------------------------------- */
  await conn.end();
  console.log('\n' + '═'.repeat(56));
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(56) + '\n');
  if (failed) {
    console.log('Failed checks:');
    failures.forEach((f) => console.log('  · ' + f));
    console.log('');
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('\n  ✗ The test run stopped unexpectedly:', err.message);
  if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('    The tests read server/.env for the database password.');
    console.error('    If your password contains # or spaces, wrap it in double quotes there.\n');
  } else if (err.code === 'ECONNREFUSED') {
    console.error('    MySQL is not reachable. Start it, then try again.\n');
  } else {
    console.error('');
  }
  process.exit(1);
});
