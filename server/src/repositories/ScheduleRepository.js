const BaseRepository = require('./BaseRepository');
const db = require('../config/db');

class ScheduleRepository extends BaseRepository {
  constructor() {
    super('repayment_schedule', [
      'loan_id', 'installment_no', 'due_date', 'principal_due', 'interest_due', 'penalty_due',
      'total_due', 'principal_paid', 'interest_paid', 'penalty_paid', 'paid_at', 'status',
    ]);
  }

  /** Bulk insert — one round trip for the whole schedule. */
  async createMany(loanId, rows, tx) {
    const conn = this._conn(tx);
    const values = [];
    const placeholders = rows
      .map((r) => {
        values.push(loanId, r.installmentNo, r.dueDate, r.principalDue, r.interestDue, r.totalDue);
        return '(?, ?, ?, ?, ?, ?)';
      })
      .join(', ');
    await conn.query(
      `INSERT INTO repayment_schedule
         (loan_id, installment_no, due_date, principal_due, interest_due, total_due)
       VALUES ${placeholders}`,
      values
    );
    return rows.length;
  }

  forLoan(loanId, tx) {
    return this._conn(tx).query(
      'SELECT * FROM repayment_schedule WHERE loan_id = ? ORDER BY installment_no',
      [loanId]
    );
  }

  /** Instalments still owing, oldest first — the order payments are applied in. */
  outstandingForLoan(loanId, tx) {
    return this._conn(tx).query(
      `SELECT * FROM repayment_schedule
        WHERE loan_id = ? AND status <> 'paid'
        ORDER BY installment_no`,
      [loanId]
    );
  }

  dueBetween(from, to) {
    return db.query(
      `SELECT s.*, l.loan_no, CONCAT(c.first_name,' ',c.last_name) AS client_name, c.phone
         FROM repayment_schedule s
         JOIN loans l   ON l.id = s.loan_id
         JOIN clients c ON c.id = l.client_id
        WHERE s.due_date BETWEEN ? AND ? AND s.status <> 'paid' AND l.status = 'active'
        ORDER BY s.due_date`,
      [from, to]
    );
  }

  arrears() {
    return db.query(
      `SELECT s.*, l.loan_no, l.outstanding_balance,
              CONCAT(c.first_name,' ',c.last_name) AS client_name, c.phone,
              u.full_name AS officer_name,
              DATEDIFF(CURDATE(), s.due_date) AS days_overdue,
              (s.total_due + s.penalty_due - s.principal_paid - s.interest_paid - s.penalty_paid) AS amount_overdue
         FROM repayment_schedule s
         JOIN loans l   ON l.id = s.loan_id
         JOIN clients c ON c.id = l.client_id
         JOIN users u   ON u.id = l.officer_id
        WHERE s.due_date < CURDATE() AND s.status <> 'paid' AND l.status = 'active'
        ORDER BY days_overdue DESC`
    );
  }

  markOverdue() {
    return db.query(
      `UPDATE repayment_schedule SET status='overdue'
        WHERE status IN ('pending','partial') AND due_date < CURDATE()`
    );
  }
}

module.exports = new ScheduleRepository();
