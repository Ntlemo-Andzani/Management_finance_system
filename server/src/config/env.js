/**
 * Environment configuration (loaded once, read-only everywhere else).
 *
 * Two ways to point the application at a database, because hosting providers
 * are split on which they hand you:
 *
 *   1. Discrete variables — DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.
 *      This is what a local MySQL install uses.
 *   2. A single connection string in DATABASE_URL, e.g.
 *        mysql://user:pass@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/mfms
 *      Managed providers (TiDB Cloud, Clever Cloud, Railway) give you one of
 *      these. When it is set it wins, so deploying needs one variable, not five.
 *
 * TLS is the other difference between a laptop and a managed host: a local
 * MySQL speaks plaintext on the loopback interface, while every managed MySQL
 * refuses an unencrypted connection. DB_SSL controls it.
 */
const fs = require('fs');
const path = require('path');

require('dotenv').config();

/**
 * Parse DATABASE_URL into the same shape as the discrete variables.
 *
 * The password is decoded, because a provider-generated password routinely
 * contains characters that have to be percent-encoded inside a URL, and the
 * driver needs the decoded form.
 */
function fromUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(
      'DATABASE_URL is not a valid URL. Expected the form\n' +
      '  mysql://user:password@host:port/database'
    );
  }
  if (!/^mysqls?:$/.test(u.protocol)) {
    throw new Error(`DATABASE_URL must start with mysql:// (got "${u.protocol}//")`);
  }
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username || 'root'),
    password: decodeURIComponent(u.password || ''),
    database: u.pathname.replace(/^\//, '') || 'mfms',
  };
}

/**
 * Work out the ssl option mysql2 should receive.
 *
 *   unset / false / 0 / no   -> no TLS           (local MySQL)
 *   true / 1 / yes / require -> TLS, certificate verified   (managed MySQL)
 *   insecure                 -> TLS, certificate NOT verified
 *
 * DB_SSL_CA additionally supplies a certificate authority, either as a path to
 * a .pem file or as the PEM text itself. Providers that issue certificates from
 * their own CA (Aiven is one) need it; providers using a publicly trusted CA
 * (TiDB Cloud is one) do not.
 *
 * "insecure" exists because a TLS failure otherwise leaves you with no way to
 * tell a wrong password from an untrusted certificate. It encrypts the
 * connection but does not authenticate the server, so it is a diagnostic step,
 * not a destination — hence the warning rather than silent acceptance.
 */
function sslOption() {
  const mode = String(process.env.DB_SSL || '').trim().toLowerCase();
  const caRaw = (process.env.DB_SSL_CA || '').trim();

  const off = ['', 'false', '0', 'no', 'off', 'disable', 'disabled'];
  if (off.includes(mode) && !caRaw) return undefined;

  const ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: true };

  if (mode === 'insecure' || mode === 'skip-verify') {
    ssl.rejectUnauthorized = false;
    console.warn(
      '  ! DB_SSL=insecure — the connection is encrypted but the server\'s\n' +
      '    certificate is not checked. Use it to confirm a certificate problem,\n' +
      '    then set DB_SSL=true and supply DB_SSL_CA instead.'
    );
  }

  if (caRaw) {
    // A PEM blob pasted into the variable, or a path to a file holding one.
    if (caRaw.includes('BEGIN CERTIFICATE')) {
      ssl.ca = caRaw.replace(/\\n/g, '\n');
    } else {
      const file = path.isAbsolute(caRaw)
        ? caRaw
        : path.join(__dirname, '..', '..', '..', caRaw);
      if (!fs.existsSync(file)) {
        throw new Error(
          `DB_SSL_CA points at "${caRaw}" but no such file exists.\n` +
          '  Give either a path to the provider\'s .pem file or the PEM text itself.'
        );
      }
      ssl.ca = fs.readFileSync(file, 'utf8');
    }
  }

  return ssl;
}

const dbFromEnv = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mfms',
};

const url = (process.env.DATABASE_URL || '').trim();

const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    ...(url ? fromUrl(url) : dbFromEnv),
    ssl: sslOption(),
    // Recorded so start-up messages can say which variable to go and edit.
    source: url ? 'DATABASE_URL' : 'DB_HOST/DB_USER/DB_PASSWORD',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
};

env.isProduction = env.nodeEnv === 'production';

module.exports = env;
