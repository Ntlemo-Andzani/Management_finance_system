/**
 * Build a realistic demonstration portfolio.
 *
 *   cd server
 *   npm run seed:demo        (the server must be running in another terminal)
 *
 * Loading schema.sql and seed.sql alone leaves the dashboard showing zeros,
 * because loans only come into existence through the application. This script
 * drives the real API — signing in as the real roles — to capture, approve,
 * disburse and repay a spread of loans, so every figure on the dashboard is
 * produced by the same code paths a user exercises. Nothing is inserted behind
 * the application's back.
 *
 * Safe to re-run: it rebuilds the database from schema.sql and seed.sql first.
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

const iso = (d) => new Date(d).toISOString().slice(0, 10);
const daysAgo = (n) => iso(Date.now() - n * 86400000);

async function api(method, route, { token, body } = {}) {
  const res = await fetch(BASE + '/api' + route, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.success && json.message) {
    throw new Error(`${method} ${route} → ${json.message}`);
  }
  return json;
}

const login = async (email, password) =>
  (await api('POST', '/auth/login', { body: { email, password } })).token;

/** Run a .sql file, lifting out any DELIMITER-wrapped routine. */
async function runSqlFile(conn, file) {
  const text = fs.readFileSync(file, 'utf8');
  const routines = [];
  const stripped = text.replace(
    /DELIMITER\s+(\S+)\s*([\s\S]*?)\1\s*DELIMITER\s*;/gi,
    (_m, _d, body) => { routines.push(body.trim()); return ''; }
  );
  if (stripped.trim()) await conn.query(stripped);
  if (routines.length) {
    const solo = await mysql.createConnection({ ...DB, multipleStatements: false });
    try {
      await solo.query(`USE \`${process.env.DB_NAME || 'mfms'}\``);
      for (const r of routines) await solo.query(r);
    } finally { await solo.end(); }
  }
}

async function main() {
  try {
    const health = await (await fetch(BASE + '/health')).json();
    if (!health.database) throw new Error('database not connected');
  } catch {
    console.error(`\n  ✗ No server responding at ${BASE}`);
    console.error('    Run "npm start" in another terminal first, then try again.\n');
    process.exit(1);
  }

  const sqlDir = path.join(__dirname, '..', '..', 'database');
  const conn = await mysql.createConnection(DB);
  await runSqlFile(conn, path.join(sqlDir, 'schema.sql'));
  await runSqlFile(conn, path.join(sqlDir, 'seed.sql'));
  await conn.end();
  console.log('\nDatabase rebuilt from schema.sql + seed.sql');

  const officer = await login('officer@mfms.co.za', 'Officer@123');
  const manager = await login('manager@mfms.co.za', 'Manager@123');
  const teller = await login('teller@mfms.co.za', 'Teller@123');

  /**
   * Capture, approve, disburse, then pay every instalment that fell due before
   * the cut-off. A later cut-off leaves the loan in arrears.
   */
  async function buildLoan({ clientId, productId, principal, term, purpose, disbursedDaysAgo, payUntilDaysAgo }) {
    const { data: loan } = await api('POST', '/loans', {
      token: officer,
      body: { client_id: clientId, product_id: productId, principal, term_months: term, purpose },
    });
    await api('POST', `/loans/${loan.id}/approve`, { token: manager, body: {} });
    await api('POST', `/loans/${loan.id}/disburse`, {
      token: manager, body: { disbursement_date: daysAgo(disbursedDaysAgo) },
    });

    const { data: detail } = await api('GET', `/loans/${loan.id}`, { token: officer });
    const cutoff = new Date(daysAgo(payUntilDaysAgo));
    let paid = 0;

    for (const inst of detail.schedule) {
      if (new Date(inst.due_date) > cutoff) break;
      const { data: statement } = await api('GET', `/loans/${loan.id}/statement`, { token: teller });
      if (statement.status !== 'active' || statement.total_due_now <= 0) break;
      // Pay what the counter would quote on the due date itself.
      const owed = Math.min(
        Number(inst.total_due) + Number(inst.penalty_due || 0),
        statement.payoff_amount
      );
      if (owed <= 0) break;
      await api('POST', '/repayments', {
        token: teller,
        body: { loan_id: loan.id, amount: owed, payment_date: inst.due_date, method: 'cash' },
      });
      paid += 1;
    }
    console.log(`  ${detail.loan_no}  ${detail.client_name.padEnd(16)} ${String(principal).padStart(7)}  ${paid} instalments paid`);
    return loan.id;
  }

  console.log('\nBuilding the demonstration portfolio through the API');

  // Jabu keeps the seeded pending application, so the approval queue is never empty
  console.log('  LN-000001  (left pending for the approval demonstration)');

  // Nomsa is still pending KYC; activating her also exercises that path
  await api('PATCH', '/clients/5/status', { token: manager, body: { status: 'active' } });

  // A healthy reducing-balance enterprise loan with declining cover, paid up to date
  await buildLoan({
    clientId: 4, productId: 2, principal: 30000, term: 24,
    purpose: 'Workshop equipment and a diagnostic scanner',
    disbursedDaysAgo: 400, payUntilDaysAgo: 0,
  });

  // A weekly market-trader loan on the one uninsured product
  await buildLoan({
    clientId: 3, productId: 3, principal: 6000, term: 3,
    purpose: 'Salon stock and supplies',
    disbursedDaysAgo: 70, payUntilDaysAgo: 0,
  });

  // A small emergency loan, so all four products appear in the product mix
  await buildLoan({
    clientId: 5, productId: 4, principal: 3000, term: 6,
    purpose: 'Replacing a damaged vending trolley',
    disbursedDaysAgo: 120, payUntilDaysAgo: 0,
  });

  // Lerato stopped paying three months ago — this is the arrears case
  await buildLoan({
    clientId: 1, productId: 1, principal: 15000, term: 12,
    purpose: 'Bulk vegetable stock for the stall',
    disbursedDaysAgo: 260, payUntilDaysAgo: 100,
  });

  // Savings movement so the passbook has history
  const { data: accounts } = await api('GET', '/savings', { token: teller });
  for (const a of accounts.slice(0, 2)) {
    await api('POST', '/savings/transactions', {
      token: teller,
      body: { account_id: a.id, type: 'deposit', amount: 450, txn_date: daysAgo(20), reference: 'Monthly saving' },
    });
  }

  const { data: dash } = await api('GET', '/reports/dashboard', { token: manager });
  const { data: ins } = await api('GET', '/insurance/summary', { token: manager });

  console.log('\nPortfolio now reads:');
  console.log(`  Outstanding       R${Number(dash.summary.outstanding).toFixed(2)}`);
  console.log(`  Disbursed         R${Number(dash.summary.total_disbursed).toFixed(2)}`);
  console.log(`  Collected         R${Number(dash.summary.total_collected).toFixed(2)}`);
  console.log(`  Portfolio at risk ${dash.par.ratio}% across ${dash.par.loans_in_arrears} loans`);
  console.log(`  Cover in force    R${Number(ins.cover_in_force).toFixed(2)} on ${ins.active_policies} policies`);
  console.log('\nOpen http://localhost:4000 and sign in.\n');
}

main().catch((err) => {
  console.error('\n  ✗ Seeding stopped:', err.message, '\n');
  process.exit(1);
});
