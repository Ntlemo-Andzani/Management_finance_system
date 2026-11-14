/**
 * REPOSITORY design pattern.
 *
 * Every table is reached through a repository object, so SQL never leaks into
 * controllers or services. Swapping MySQL for another store would mean rewriting
 * this layer only.
 */
const db = require('../config/db');

class BaseRepository {
  /**
   * @param {string} table       physical table name
   * @param {string[]} fillable  columns that may be written from user input
   */
  constructor(table, fillable = []) {
    this.table = table;
    this.fillable = fillable;
  }

  /** Allows a repository call to join an open transaction. */
  _conn(tx) { return tx || db; }

  _pick(data) {
    const out = {};
    for (const key of this.fillable) if (data[key] !== undefined) out[key] = data[key];
    return out;
  }

  async findById(id, tx) {
    return this._conn(tx).queryOne(`SELECT * FROM ${this.table} WHERE id = ? LIMIT 1`, [id]);
  }

  async findAll({ limit = 100, offset = 0 } = {}, tx) {
    return this._conn(tx).query(
      `SELECT * FROM ${this.table} ORDER BY id DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`
    );
  }

  async findWhere(clause, params = [], tx) {
    return this._conn(tx).query(`SELECT * FROM ${this.table} WHERE ${clause}`, params);
  }

  async create(data, tx) {
    const payload = this._pick(data);
    const cols = Object.keys(payload);
    if (!cols.length) throw new Error(`No writable columns supplied for ${this.table}`);
    const sql = `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
    const result = await this._conn(tx).query(sql, Object.values(payload));
    return result.insertId;
  }

  async update(id, data, tx) {
    const payload = this._pick(data);
    const cols = Object.keys(payload);
    if (!cols.length) return 0;
    const sql = `UPDATE ${this.table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`;
    const result = await this._conn(tx).query(sql, [...Object.values(payload), id]);
    return result.affectedRows;
  }

  async remove(id, tx) {
    const result = await this._conn(tx).query(`DELETE FROM ${this.table} WHERE id = ?`, [id]);
    return result.affectedRows;
  }

  async count(clause = '1=1', params = [], tx) {
    const row = await this._conn(tx).queryOne(`SELECT COUNT(*) AS n FROM ${this.table} WHERE ${clause}`, params);
    return Number(row.n);
  }
}

module.exports = BaseRepository;
