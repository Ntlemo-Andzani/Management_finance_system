/**
 * Database.js — SINGLETON design pattern.
 *
 * The whole application shares exactly one MySQL connection pool. The pool is
 * created the first time getInstance() is called and re-used afterwards, which
 * keeps connection usage predictable and makes transactions easy to reason about.
 */
const mysql = require('mysql2/promise');
const env = require('./env');

class Database {
  constructor() {
    if (Database._instance) return Database._instance;

    this.pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      // Present only when DB_SSL asks for it. A local MySQL speaks plaintext on
      // the loopback interface; every managed MySQL refuses an unencrypted
      // connection, so this is what makes the same build run in both places.
      ...(env.db.ssl ? { ssl: env.db.ssl } : {}),
      waitForConnections: true,
      // A managed free tier caps how many connections it will accept, and the
      // pool must stay under that cap or the host starts refusing them. Local
      // MySQL has no such limit, so the default stays at 10.
      connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
      queueLimit: 0,
      // A connection crossing the internet can hang where a loopback one fails
      // fast, which would otherwise leave a request waiting indefinitely.
      connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 15000),
      decimalNumbers: true,
      dateStrings: ['DATE'],
      timezone: 'Z',
    });

    Database._instance = this;
  }

  static getInstance() {
    if (!Database._instance) Database._instance = new Database();
    return Database._instance;
  }

  /** Run a query and return rows. */
  async query(sql, params = []) {
    const [rows] = await this.pool.execute(sql, params);
    return rows;
  }

  /** Return the first row or null. */
  async queryOne(sql, params = []) {
    const rows = await this.query(sql, params);
    return rows.length ? rows[0] : null;
  }

  /**
   * Run work inside a transaction. `work` receives a connection whose
   * .query()/.queryOne() mirror the pool API so repositories can be reused.
   */
  async transaction(work) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const tx = {
        query: async (sql, params = []) => {
          const [rows] = await conn.execute(sql, params);
          return rows;
        },
        queryOne: async (sql, params = []) => {
          const [rows] = await conn.execute(sql, params);
          return rows.length ? rows[0] : null;
        },
      };
      const result = await work(tx);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async healthCheck() {
    const row = await this.queryOne('SELECT 1 AS ok');
    return row && row.ok === 1;
  }

  async close() {
    await this.pool.end();
    Database._instance = null;
  }
}

module.exports = Database.getInstance();
