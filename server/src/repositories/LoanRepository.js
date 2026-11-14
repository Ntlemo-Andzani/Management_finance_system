const BaseRepository = require('./BaseRepository');
const db = require('../config/db');

class LoanRepository extends BaseRepository {
  constructor() {
    super('loans', [
      'loan_no', 'client_id', 'product_id', 'officer_id', 'branch_id', 'principal',
      'interest_rate', 'interest_method', 'repayment_frequency', 'term_months', 'installments',
      'purpose', 'application_date', 'approved_by', 'approved_at', 'rejection_reason',
      'disbursed_at', 'first_due_date', 'maturity_date', 'processing_fee', 'insurance_premium',
      'total_interest',
      'total_payable', 'amount_paid', 'outstanding_balance', 'status',
    ]);
  }

  async search({ status = '', clientId = null, q = '', limit = 100, offset = 0 } = {}) {
    const where = ['1=1'];
    const params = [];
    if (status) { where.push('l.status = ?'); params.push(status); }
    if (clientId) { where.push('l.client_id = ?'); params.push(clientId); }
    if (q) {
      where.push('(l.loan_no LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.client_no LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    return db.query(
      `SELECT l.*, CONCAT(c.first_name,' ',c.last_name) AS client_name, c.client_no, c.phone,
              p.name AS product_name, u.full_name AS officer_name
         FROM loans l
         JOIN clients c        ON c.id = l.client_id
         JOIN loan_products p  ON p.id = l.product_id
         JOIN users u          ON u.id = l.officer_id
        WHERE ${where.join(' AND ')}
        ORDER BY l.created_at DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );
  }

  findDetailed(id, tx) {
    return this._conn(tx).queryOne(
      `SELECT l.*, CONCAT(c.first_name,' ',c.last_name) AS client_name, c.client_no, c.phone,
              c.id AS client_id, p.name AS product_name, p.penalty_rate_pct,
              u.full_name AS officer_name, a.full_name AS approver_name
         FROM loans l
         JOIN clients c       ON c.id = l.client_id
         JOIN loan_products p ON p.id = l.product_id
         JOIN users u         ON u.id = l.officer_id
    LEFT JOIN users a         ON a.id = l.approved_by
        WHERE l.id = ?`,
      [id]
    );
  }

  async nextLoanNo(tx) {
    const row = await this._conn(tx).queryOne(
      "SELECT MAX(CAST(SUBSTRING(loan_no, 4) AS UNSIGNED)) AS n FROM loans"
    );
    return `LN-${String((Number(row.n) || 0) + 1).padStart(6, '0')}`;
  }

  portfolioSummary() {
    return db.queryOne(
      `SELECT
         (SELECT COUNT(*) FROM clients WHERE status='active')                    AS active_clients,
         (SELECT COUNT(*) FROM loans WHERE status='pending')                     AS pending_loans,
         (SELECT COUNT(*) FROM loans WHERE status='active')                      AS active_loans,
         (SELECT IFNULL(SUM(principal),0) FROM loans WHERE status IN ('active','closed')) AS total_disbursed,
         (SELECT IFNULL(SUM(outstanding_balance),0) FROM loans WHERE status='active')     AS outstanding,
         (SELECT IFNULL(SUM(amount),0) FROM repayments)                          AS total_collected,
         (SELECT IFNULL(SUM(balance),0) FROM savings_accounts WHERE status='active')      AS total_savings`
    );
  }

  monthlyDisbursementTrend() {
    return db.query(
      `SELECT DATE_FORMAT(disbursed_at, '%Y-%m') AS period,
              SUM(principal) AS disbursed, COUNT(*) AS loans
         FROM loans
        WHERE disbursed_at IS NOT NULL
          AND disbursed_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY period ORDER BY period`
    );
  }
}

module.exports = new LoanRepository();
