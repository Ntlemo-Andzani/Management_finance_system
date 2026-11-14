const BaseRepository = require('./BaseRepository');
const db = require('../config/db');

class SavingsRepository extends BaseRepository {
  constructor() {
    super('savings_accounts', ['account_no', 'client_id', 'interest_rate', 'balance', 'status']);
  }

  async nextAccountNo(tx) {
    const row = await this._conn(tx).queryOne(
      "SELECT MAX(CAST(SUBSTRING(account_no, 4) AS UNSIGNED)) AS n FROM savings_accounts"
    );
    return `SA-${String((Number(row.n) || 0) + 1).padStart(4, '0')}`;
  }

  listWithClients({ q = '' } = {}) {
    const params = [];
    let where = '1=1';
    if (q) {
      where = '(c.first_name LIKE ? OR c.last_name LIKE ? OR a.account_no LIKE ? OR c.client_no LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    return db.query(
      `SELECT a.*, CONCAT(c.first_name,' ',c.last_name) AS client_name, c.client_no, c.phone
         FROM savings_accounts a JOIN clients c ON c.id = a.client_id
        WHERE ${where}
        ORDER BY a.account_no`,
      params
    );
  }

  findForClient(clientId) {
    return db.query('SELECT * FROM savings_accounts WHERE client_id = ?', [clientId]);
  }

  transactions(accountId, limit = 50) {
    return db.query(
      `SELECT t.*, u.full_name AS performed_by_name
         FROM savings_transactions t JOIN users u ON u.id = t.performed_by
        WHERE t.account_id = ?
        ORDER BY t.txn_date DESC, t.id DESC LIMIT ${Number(limit)}`,
      [accountId]
    );
  }

  addTransaction(data, tx) {
    const conn = tx || db;
    return conn.query(
      `INSERT INTO savings_transactions
         (account_id, type, amount, balance_after, txn_date, performed_by, reference, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.account_id, data.type, data.amount, data.balance_after, data.txn_date,
       data.performed_by, data.reference || null, data.notes || null]
    );
  }
}

module.exports = new SavingsRepository();
