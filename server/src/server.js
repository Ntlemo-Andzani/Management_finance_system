const app = require('./app');
const env = require('./config/env');
const db = require('./config/db');

/**
 * Preflight: check the database before accepting traffic, and if something is
 * wrong say exactly which line of .env to fix. A misconfigured install should
 * fail at start-up with an actionable message, not at the login screen with a
 * confusing one.
 */
async function preflight() {
  try {
    await db.healthCheck();
    const [{ n: users }] = await db.query('SELECT COUNT(*) AS n FROM users');
    const [{ n: products }] = await db.query('SELECT COUNT(*) AS n FROM loan_products');
    console.log(`\n  ✓ Database "${env.db.database}" connected — ${users} staff accounts, ${products} loan products`);
    if (users === 0) {
      console.log('  ! No staff accounts found. Load the demo data:');
      console.log('      mysql -u root -p mfms < database/seed.sql');
    }
    return true;
  } catch (err) {
    const hints = {
      ECONNREFUSED: [
        'MySQL is not accepting connections on ' + env.db.host + ':' + env.db.port + '.',
        '  1. Start MySQL (Windows: net start MySQL80 · macOS: brew services start mysql · Linux: sudo service mysql start)',
        '  2. If MySQL IS running, set DB_HOST=127.0.0.1 in server/.env.',
        '     On Node 18+ "localhost" can resolve to IPv6, where MySQL usually is not listening.',
      ],
      ER_ACCESS_DENIED_NO_PASSWORD_ERROR: [
        'MySQL rejected a blank password for user "' + env.db.user + '".',
        '  Set DB_PASSWORD in server/.env to that account\'s password.',
      ],
      ER_ACCESS_DENIED_ERROR: [
        'MySQL refused the username or password in server/.env.',
        '  Set DB_USER and DB_PASSWORD to the account you use for MySQL.',
        '  If MySQL was installed without a password, leave DB_PASSWORD blank.',
      ],
      ER_BAD_DB_ERROR: [
        `The database "${env.db.database}" does not exist yet. Create it:`,
        '      npm run db:setup',
      ],
      ER_NO_SUCH_TABLE: [
        'The database exists but its tables are missing. Load the schema:',
        '      npm run db:setup',
      ],
      // The faults below only show up against a managed database, where the
      // connection crosses the internet and is encrypted.
      ETIMEDOUT: [
        `No answer from ${env.db.host}:${env.db.port} before the timeout.`,
        '  1. A managed provider has to be told which addresses may connect.',
        '     In TiDB Cloud that is Cluster -> Settings -> Networking.',
        '  2. Check DB_HOST and DB_PORT — a managed MySQL is often not on 3306.',
      ],
      ENOTFOUND: [
        `The hostname "${env.db.host}" does not resolve.`,
        '  Copy it again from the provider\'s connection details; it is easy to',
        '  truncate a long one.',
      ],
      HANDSHAKE_SSL_ERROR: [
        'The database refused the TLS handshake.',
        '  1. If DB_SSL is unset, set DB_SSL=true — a managed MySQL requires it.',
        '  2. If it is already true, the certificate authority is missing:',
        '     set DB_SSL_CA to the provider\'s .pem file.',
      ],
      ER_DBACCESS_DENIED_ERROR: [
        `The account may not use the database "${env.db.database}".`,
        '  Set DB_NAME to the database the provider created for you.',
      ],
    };

    console.error('\n  ✗ Cannot start: the database is not ready.\n');
    (hints[err.code] || [`  ${err.message}`]).forEach((line) => console.error('  ' + line));
    console.error(`\n  (driver said: ${err.code || 'unknown'} — ${err.message})`);
    console.error('  Edit server/.env, then run "npm start" again.\n');
    return false;
  }
}

async function start() {
  const ready = await preflight();
  if (!ready) {
    await db.close().catch(() => {});
    process.exit(1);
  }

  // A JWT is only as trustworthy as the key that signed it. The placeholder is
  // published in .env.example and in the report, so on a public deployment
  // anyone could mint a token for any role — including admin. That is a refusal
  // to start rather than a warning, because a warning scrolls past in a host's
  // build log and nobody sees it.
  const placeholder = env.jwt.secret === 'dev-only-secret-change-me'
    || env.jwt.secret.includes('replace-this');

  if (placeholder && env.isProduction) {
    console.error('\n  ✗ Refusing to start: JWT_SECRET is still the placeholder.\n');
    console.error('    The placeholder value is published in .env.example and in the');
    console.error('    project report, so anyone could forge an admin session.');
    console.error('    Set JWT_SECRET to a long random string in the host\'s environment');
    console.error('    variables. Generate one with:\n');
    console.error('        node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"\n');
    await db.close().catch(() => {});
    process.exit(1);
  }
  if (placeholder) {
    console.log('  ! JWT_SECRET is still the placeholder. Fine locally; it is refused when NODE_ENV=production.');
  }

  // Bind to every interface in production: a hosting platform routes traffic in
  // from outside the container, and a process listening only on loopback is
  // unreachable there — which the platform reports as a failed health check
  // rather than as a binding problem.
  const host = env.isProduction ? '0.0.0.0' : undefined;

  const server = app.listen(env.port, host, () => {
    if (env.isProduction) {
      console.log(`\n  MFMS listening on port ${env.port} (production)`);
      console.log(`  Database ${env.db.host}:${env.db.port}/${env.db.database}` +
                  `${env.db.ssl ? ' over TLS' : ' unencrypted'}\n`);
    } else {
      console.log(`\n  MFMS running at http://localhost:${env.port}  (${env.nodeEnv})`);
      console.log('  Sign in with admin@mfms.co.za / Admin@123\n');
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n  ✗ Port ${env.port} is already in use.`);
      console.error('    Either stop the other program, or set a different PORT in server/.env.\n');
      process.exit(1);
    }
    throw err;
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} received — closing gracefully`);
    server.close(async () => { await db.close(); process.exit(0); });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
