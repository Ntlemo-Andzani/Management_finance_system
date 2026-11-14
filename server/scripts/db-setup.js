/**
 * db-setup.js — load schema.sql and seed.sql into whichever database the
 * environment points at, local or managed.
 *
 *   node scripts/db-setup.js              schema + demo data
 *   node scripts/db-setup.js --schema     schema only, no demo data
 *   node scripts/db-setup.js --no-create  skip DROP/CREATE DATABASE
 *   node scripts/db-setup.js --dry-run    print what would run, change nothing
 *
 * Why this exists rather than "mysql -u root -p < schema.sql":
 *
 *   1. The mysql command-line client has to be given a certificate authority,
 *      a TLS mode and a hostname before it will talk to a managed database,
 *      and PowerShell mangles the "<" redirect the usual instructions rely on.
 *      This script reuses the connection settings the application itself uses,
 *      so if the app can reach the database, so can this.
 *   2. mysql2 sends one statement per round trip, so a file has to be split on
 *      statement boundaries — and the DELIMITER keyword that MySQL's own client
 *      understands is a client feature the driver knows nothing about.
 *   3. The schema hard-codes the name "mfms". Several providers hand you a
 *      database whose name they chose and will not let you create another, so
 *      the name is rewritten to match DB_NAME on the way through.
 *
 * Statements run one at a time, in order, and the script stops at the first
 * failure with the statement printed — a half-loaded schema is worse than a
 * failure you can see.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const env = require('../src/config/env');

const DB_DIR = path.join(__dirname, '..', '..', 'database');

const args = process.argv.slice(2);
const SCHEMA_ONLY = args.includes('--schema');
const NO_CREATE = args.includes('--no-create');
const DRY_RUN = args.includes('--dry-run');

/* ------------------------------------------------------------------ parse ---
 * Split a script into statements.
 *
 * A naive split on ";" breaks on a semicolon inside a string literal or a
 * comment, so the file is scanned one character at a time, tracking whether the
 * cursor is inside a quoted string, a backtick-quoted identifier, a line
 * comment or a block comment. Only a semicolon in open code ends a statement.
 */
function splitStatements(sql) {
  const out = [];
  let buf = '';
  let quote = null;          // "'", '"' or '`' while inside one
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (lineComment) {
      if (ch === '\n') { lineComment = false; buf += ch; }
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') { blockComment = false; i += 1; }
      continue;
    }
    if (quote) {
      buf += ch;
      // A backslash escapes the next character inside a string, but not inside
      // a backtick-quoted identifier, where MySQL has no escape character.
      if (ch === '\\' && quote !== '`' && next !== undefined) {
        buf += next;
        i += 1;
      } else if (ch === quote) {
        // A doubled quote is a literal quote, not the end of the string.
        if (next === quote) { buf += next; i += 1; } else { quote = null; }
      }
      continue;
    }

    // -- comment, but only when followed by whitespace, which is what MySQL
    // requires; "--" inside an expression such as "a--b" is not a comment.
    if (ch === '-' && next === '-' && /[\s]/.test(sql[i + 2] ?? ' ')) {
      lineComment = true;
      i += 1;
      continue;
    }
    if (ch === '#') { lineComment = true; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i += 1; continue; }

    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; buf += ch; continue; }

    if (ch === ';') {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/**
 * Pull DELIMITER-wrapped routines out of a script.
 *
 * DELIMITER is understood by the mysql command-line client, not by the server
 * and not by the driver. A stored procedure body contains semicolons, so the
 * block has to be lifted out whole before the rest of the file is split on
 * semicolons, then sent as a single statement of its own.
 */
function extractRoutines(sql) {
  const routines = [];
  const body = sql.replace(
    /DELIMITER\s+(\S+)\s*([\s\S]*?)\1\s*DELIMITER\s*;/gi,
    (_match, _delim, inner) => { routines.push(inner.trim()); return ''; }
  );
  return { body, routines };
}

/**
 * Retarget the script at the configured database name.
 *
 * The .sql files say "mfms" because that is what a local install uses and what
 * the documentation shows. A managed provider often dictates the name instead,
 * so the DROP/CREATE/USE statements are rewritten here rather than the files
 * being edited — the files stay readable and match the report.
 */
function retarget(sql, dbName) {
  let out = sql
    .replace(/DROP\s+DATABASE\s+IF\s+EXISTS\s+`?mfms`?/gi,
             `DROP DATABASE IF EXISTS \`${dbName}\``)
    .replace(/CREATE\s+DATABASE\s+`?mfms`?/gi, `CREATE DATABASE \`${dbName}\``)
    .replace(/USE\s+`?mfms`?/gi, `USE \`${dbName}\``);

  if (NO_CREATE) {
    out = out
      .replace(/DROP\s+DATABASE\s+IF\s+EXISTS\s+`[^`]+`\s*;/gi, '')
      .replace(/CREATE\s+DATABASE\s+`[^`]+`[^;]*;/gi, '');
  }
  return out;
}

/**
 * Empty the target schema without dropping the schema itself.
 *
 * schema.sql opens with DROP DATABASE, which is what makes a reload repeatable:
 * run it twice and the second run starts from nothing. With --no-create that
 * statement is removed, so a second run would hit "table already exists" and
 * stop half way. Dropping the contents restores the same clean slate using only
 * the privileges a managed provider actually grants on a database it owns.
 *
 * Views are dropped before tables because a view over a dropped table is left
 * invalid, and foreign key checks are suspended for the duration so the tables
 * can go in any order rather than requiring a dependency sort.
 */
async function emptySchema(conn, dbName) {
  const [objects] = await conn.query(
    `SELECT table_name AS name, table_type AS type
       FROM information_schema.tables
      WHERE table_schema = ?`, [dbName]
  );
  if (!objects.length) return 0;

  const views = objects.filter((o) => o.type === 'VIEW').map((o) => o.name);
  const tables = objects.filter((o) => o.type !== 'VIEW').map((o) => o.name);

  if (DRY_RUN) {
    console.log(`\n  would empty "${dbName}" first — ` +
                `${tables.length} table(s), ${views.length} view(s)`);
    return objects.length;
  }

  console.log(`\n  Emptying "${dbName}" — ${tables.length} table(s), ` +
              `${views.length} view(s) to drop`);

  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const v of views) await conn.query(`DROP VIEW IF EXISTS \`${v}\``);
    for (const t of tables) await conn.query(`DROP TABLE IF EXISTS \`${t}\``);
  } finally {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  // Routines too, so a reload does not report the procedure as already
  // existing. Tolerantly: dropping one needs ALTER ROUTINE, which a restricted
  // provider account may not have, and a server that cannot hold procedures in
  // the first place has none to drop. Neither case is worth failing over.
  try {
    const [routines] = await conn.query(
      `SELECT routine_name AS name, routine_type AS type
         FROM information_schema.routines
        WHERE routine_schema = ?`, [dbName]
    );
    for (const r of routines) {
      const kind = r.type === 'FUNCTION' ? 'FUNCTION' : 'PROCEDURE';
      await conn.query(`DROP ${kind} IF EXISTS \`${r.name}\``);
    }
  } catch {
    // Left in place; CREATE will report it as already existing, which the
    // routine loader already treats as a non-failure.
  }

  return objects.length;
}

/** One-line summary of a statement, for progress output. */
function describe(stmt) {
  const flat = stmt.replace(/\s+/g, ' ').trim();
  // "IF EXISTS" / "IF NOT EXISTS" sits between the verb and the name, so it is
  // skipped rather than captured as the name.
  const m = flat.match(
    /^(CREATE TABLE|CREATE OR REPLACE VIEW|CREATE VIEW|CREATE INDEX|CREATE DATABASE|DROP DATABASE|DROP TABLE|ALTER TABLE|INSERT INTO|USE|SET)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?`?([\w$]+)`?/i
  );
  if (m) return `${m[1].toUpperCase()} ${m[2]}`;
  return flat.slice(0, 58) + (flat.length > 58 ? '…' : '');
}

/* ------------------------------------------------------------------- run --- */
async function loadFile(conn, file, dbName) {
  const raw = fs.readFileSync(file, 'utf8');
  const { body, routines } = extractRoutines(retarget(raw, dbName));
  const statements = splitStatements(body);

  console.log(`\n  ${path.basename(file)} — ${statements.length} statements` +
              (routines.length ? `, ${routines.length} routine(s)` : ''));

  let done = 0;
  for (const stmt of statements) {
    if (DRY_RUN) { console.log(`      would run: ${describe(stmt)}`); continue; }
    try {
      await conn.query(stmt);
      done += 1;
      // Tables and views are the milestones worth seeing; the hundred-odd
      // INSERTs in the seed file would only bury them.
      if (/^\s*(CREATE|DROP|ALTER)/i.test(stmt)) console.log(`      ${describe(stmt)}`);
    } catch (err) {
      console.error(`\n  ✗ Failed on: ${describe(stmt)}`);
      console.error(`    ${err.code || ''} ${err.sqlMessage || err.message}\n`);
      console.error('    Statement:');
      console.error('      ' + stmt.replace(/\s+/g, ' ').slice(0, 300));
      throw err;
    }
  }
  if (!DRY_RUN) console.log(`      ${done} statements applied`);

  // Routines last, and tolerantly. A stored procedure is a nicety here —
  // sp_flag_overdue duplicates what ScheduleRepository.markOverdue() already
  // does in JavaScript, and nothing in the application calls it. MySQL-
  // compatible services such as TiDB reject CREATE PROCEDURE outright, and the
  // system is fully functional without it, so a refusal is reported and the
  // load continues rather than failing the deployment over it.
  for (const routine of routines) {
    const name = (routine.match(/CREATE\s+PROCEDURE\s+`?(\w+)`?/i) || [])[1] || 'routine';
    if (DRY_RUN) { console.log(`      would run: CREATE PROCEDURE ${name}`); continue; }
    try {
      await conn.query(routine);
      console.log(`      CREATE PROCEDURE ${name}`);
    } catch (err) {
      console.log(`      ! CREATE PROCEDURE ${name} refused by this server ` +
                  `(${err.code || err.message}).`);
      console.log('        Not a problem: no application code calls it.');
    }
  }
}

async function main() {
  const dbName = env.db.database;
  const tls = env.db.ssl
    ? (env.db.ssl.rejectUnauthorized === false ? 'on (certificate not verified)' : 'on')
    : 'off';

  console.log('\nMFMS database setup');
  console.log('─'.repeat(60));
  console.log(`  host      ${env.db.host}:${env.db.port}`);
  console.log(`  user      ${env.db.user}`);
  console.log(`  database  ${dbName}`);
  console.log(`  TLS       ${tls}`);
  console.log(`  settings  ${env.db.source}`);
  if (DRY_RUN) console.log('  mode      DRY RUN — nothing will be changed');

  if (!env.db.ssl && !['localhost', '127.0.0.1', '::1'].includes(env.db.host)) {
    console.log('\n  ! TLS is off but the host is not local. A managed database will');
    console.log('    refuse this connection. Set DB_SSL=true in server/.env.');
  }

  // Connect without selecting a database, so the schema's own CREATE DATABASE
  // can run. With --no-create there is nothing to create, so the target is
  // selected up front instead.
  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    ...(NO_CREATE ? { database: dbName } : {}),
    ...(env.db.ssl ? { ssl: env.db.ssl } : {}),
    multipleStatements: false,
    connectTimeout: 20000,
  });

  const [[ver]] = await conn.query('SELECT VERSION() AS v');
  console.log(`  server    ${ver.v}`);

  try {
    // Only when the schema's own DROP DATABASE has been removed, and only
    // alongside a schema load — never when just re-seeding.
    if (NO_CREATE) await emptySchema(conn, dbName);

    await loadFile(conn, path.join(DB_DIR, 'schema.sql'), dbName);
    if (!SCHEMA_ONLY) {
      await loadFile(conn, path.join(DB_DIR, 'seed.sql'), dbName);
    }

    if (!DRY_RUN) {
      await conn.query(`USE \`${dbName}\``);
      const [[t]] = await conn.query(
        'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ?',
        [dbName]
      );
      const [[u]] = await conn.query('SELECT COUNT(*) AS n FROM users');
      const [[p]] = await conn.query('SELECT COUNT(*) AS n FROM loan_products');

      console.log('\n  ✓ Database ready');
      console.log(`      ${t.n} tables and views, ${u.n} staff accounts, ${p.n} loan products`);

      if (!SCHEMA_ONLY && env.isProduction) {
        console.log('\n  ! The demo accounts are loaded and their passwords are printed');
        console.log('    in seed.sql and in the project report. On a public URL, change');
        console.log('    them before sharing the link:');
        console.log('        node scripts/set-password.js admin@mfms.co.za "<a new password>"');
      }
    }
  } finally {
    await conn.end();
  }
  console.log('');
}

main().catch((err) => {
  const hints = {
    ECONNREFUSED: [
      `Nothing is accepting connections on ${env.db.host}:${env.db.port}.`,
      'Check the host and port, and that a local MySQL is actually running.',
    ],
    ETIMEDOUT: [
      'The connection timed out.',
      'A managed provider usually has to be told which addresses may connect.',
      'In TiDB Cloud this is Cluster → Settings → Networking; allow 0.0.0.0/0',
      'while setting up, then narrow it afterwards.',
    ],
    ER_ACCESS_DENIED_ERROR: [
      'The username or password was refused.',
      'A provider-generated password often contains characters that need',
      'quoting in .env — wrap the value in double quotes.',
    ],
    ER_ACCESS_DENIED_NO_PASSWORD_ERROR: [
      `The server refused a blank password for "${env.db.user}".`,
      'Set DB_PASSWORD in server/.env, or DATABASE_URL if you are using one.',
      'A local MySQL can accept a passwordless root over its socket while',
      'still requiring a password over TCP, which is the usual cause.',
    ],
    ER_DBACCESS_DENIED_ERROR: [
      `The account may not use the database "${env.db.database}".`,
      'Set DB_NAME to the database the provider created for you, and re-run',
      'with --no-create.',
    ],
    ER_SPECIFIC_ACCESS_DENIED_ERROR: [
      'The account lacks a privilege this statement needs.',
      'Creating a database is the usual one: set DB_NAME to the database the',
      'provider already created for you and re-run with --no-create.',
    ],
    HANDSHAKE_SSL_ERROR: [
      'TLS handshake failed.',
      'Set DB_SSL_CA to the provider\'s .pem file. To confirm that is the',
      'cause, try DB_SSL=insecure once — if it connects, the certificate',
      'authority is what is missing.',
    ],
  };

  console.error(`\n  ✗ Setup failed: ${err.code || ''} ${err.message}`);
  (hints[err.code] || []).forEach((line) => console.error('    ' + line));
  console.error('');
  process.exit(1);
});
