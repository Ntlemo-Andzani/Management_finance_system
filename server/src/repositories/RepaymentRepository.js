const BaseRepository = require('./BaseRepository');
const db = require('../config/db');

class RepaymentRepository extends BaseRepository {
  constructor() {
    super('repayments', [
      'receipt_no', 'loan_id', 'amount', 'principal_component', 'interest_component',
      'penalty_component', 'payment_date', 'method', 'received_by', 'reference', 'notes',
    ]);
  }

  async nextReceiptNo(tx) {
    const row = await this._conn(tx).queryOne(
      "SELECT MAX(CAST(SUBSTRING(receipt_no, 4) AS UNSIGNED)) AS n FROM repayments"
    );
    return `RC-${String((Number(row.n) || 0) + 1).padStart(6, '0')}`;
  }

  forLoan(loanId) {
    return db.query(
      `SELECT r.*, u.full_name AS received_by_name
         FROM repayments r JOIN users u ON u.id = r.received_by
        WHERE r.loan_id = ? ORDER BY r.payment_date DESC, r.id DESC`,
      [loanId]
    );
  }

  recent({ from = null, to = null, limit = 100 } = {}) {
    const where = ['1=1'];
    const params = [];
    if (from) { where.push('r.payment_date >= ?'); params.push(from); }
    if (to)   { where.push('r.payment_date <= ?'); params.push(to); }
    return db.query(
      `SELECT r.*, l.loan_no, CONCAT(c.first_name,' ',c.last_name) AS client_name,
              u.full_name AS received_by_name
         FROM repayments r
         JOIN loans l   ON l.id = r.loan_id
         JOIN clients c ON c.id = l.client_id
         JOIN users u   ON u.id = r.received_by
        WHERE ${where.join(' AND ')}
        ORDER BY r.payment_date DESC, r.id DESC
        LIMIT ${Number(limit)}`,
      params
    );
  }

  collectionsByDay(days = 14) {
    return db.query(
      `SELECT payment_date AS day, SUM(amount) AS collected, COUNT(*) AS receipts
         FROM repayments
        WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY payment_date ORDER BY payment_date`,
      [days]
    );
  }
}

module.exports = new RepaymentRepository();
