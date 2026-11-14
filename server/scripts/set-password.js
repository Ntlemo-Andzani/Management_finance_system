/**
 * set-password.js — change a staff account's password directly in the database.
 *
 *   node scripts/set-password.js admin@mfms.co.za "a new password"
 *   node scripts/set-password.js --list
 *
 * The demo passwords are printed in seed.sql, in the project report and in the
 * setup instructions, which is right for a local demonstration and wrong the
 * moment the application has a public URL: anyone who reads the report can sign
 * in as the administrator. This script exists so the deployed copy can be given
 * passwords that were never written down anywhere.
 *
 * The hash is produced by the same bcrypt call AuthService uses, at the same
 * cost factor, so an account changed here behaves exactly like one changed
 * through the application.
 */
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const env = require('../src/config/env');

const BCRYPT_COST = 10;        // matches AuthService.register()
const MIN_LENGTH = 8;

async function connect() {
  return mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    ...(env.db.ssl ? { ssl: env.db.ssl } : {}),
    connectTimeout: 20000,
  });
}

async function list(conn) {
  const [rows] = await conn.query(
    'SELECT email, full_name, role, is_active FROM users ORDER BY role, email'
  );
  console.log('\n  Staff accounts');
  console.log('  ' + '─'.repeat(64));
  rows.forEach((r) => {
    const state = r.is_active ? '' : '  (inactive)';
    console.log(`  ${r.email.padEnd(26)} ${String(r.role).padEnd(9)} ${r.full_name}${state}`);
  });
  console.log('');
}

async function main() {
  const [email, password] = process.argv.slice(2);

  const conn = await connect();
  try {
    if (!email || email === '--list') {
      await list(conn);
      if (!email) {
        console.log('  Usage: node scripts/set-password.js <email> "<new password>"\n');
        process.exitCode = 1;
      }
      return;
    }

    if (!password) {
      console.error('\n  ✗ No password given.');
      console.error('    Usage: node scripts/set-password.js <email> "<new password>"');
      console.error('    Quote the password, or the shell will split it on spaces.\n');
      process.exitCode = 1;
      return;
    }

    if (password.length < MIN_LENGTH) {
      console.error(`\n  ✗ Too short — use at least ${MIN_LENGTH} characters.\n`);
      process.exitCode = 1;
      return;
    }

    const [[user]] = await conn.query(
      'SELECT id, email, full_name, role FROM users WHERE email = ?', [email]
    );
    if (!user) {
      console.error(`\n  ✗ No account with the email "${email}".`);
      console.error('    Run "node scripts/set-password.js --list" to see them.\n');
      process.exitCode = 1;
      return;
    }

    const hash = await bcrypt.hash(password, BCRYPT_COST);
    const [res] = await conn.query(
      'UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]
    );
    if (res.affectedRows !== 1) throw new Error('the update changed no rows');

    // Confirm by the same route the login endpoint takes, so a success message
    // here means the new password genuinely works rather than merely that an
    // UPDATE was accepted.
    const [[check]] = await conn.query(
      'SELECT password_hash FROM users WHERE id = ?', [user.id]
    );
    const verified = await bcrypt.compare(password, check.password_hash);
    if (!verified) throw new Error('the stored hash does not match the new password');

    console.log(`\n  ✓ Password changed for ${user.full_name} (${user.email}, ${user.role})`);
    console.log('    Verified against the stored hash.');
    console.log('    The password is not written to any file — keep your own note of it.\n');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(`\n  ✗ ${err.code || ''} ${err.message}\n`);
  process.exit(1);
});
