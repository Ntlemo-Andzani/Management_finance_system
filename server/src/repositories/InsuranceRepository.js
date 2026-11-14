const BaseRepository = require('./BaseRepository');
const db = require('../config/db');

class PolicyRepository extends BaseRepository {
  constructor() {
    super('insurance_policies', [
      'policy_no', 'loan_id', 'client_id', 'cover_method', 'cover_amount',
      'premium', 'premium_rate_pct', 'start_date', 'end_date', 'status',
    ]);
  }

  async nextPolicyNo(tx) {
    const row = await this._conn(tx).queryOne(
      "SELECT MAX(CAST(SUBSTRING(policy_no, 4) AS UNSIGNED)) AS n FROM insurance_policies"
    );
    return `PL-${String((Number(row.n) || 0) + 1).padStart(6, '0')}`;
  }

  forLoan(loanId, tx) {
    return this._conn(tx).queryOne('SELECT * FROM insurance_policies WHERE loan_id = ?', [loanId]);
  }

  /**
   * The live book. Cover on a declining policy follows the loan balance, so the
   * current exposure is computed rather than stored.
   */
  search({ status = '', q = '', limit = 200 } = {}) {
    const where = ['1=1'];
    const params = [];
    if (status) { where.push('p.status = ?'); params.push(status); }
    if (q) {
      where.push('(p.policy_no LIKE ? OR l.loan_no LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    return db.query(
      `SELECT p.*, l.loan_no, l.outstanding_balance, l.status AS loan_status,
              CONCAT(c.first_name,' ',c.last_name) AS client_name, c.client_no, c.phone,
              CASE WHEN p.cover_method = 'declining' THEN l.outstanding_balance
                   ELSE p.cover_amount END AS current_cover,
              (SELECT COUNT(*) FROM insurance_claims k WHERE k.policy_id = p.id) AS claim_count
         FROM insurance_policies p
         JOIN loans l   ON l.id = p.loan_id
         JOIN clients c ON c.id = p.client_id
        WHERE ${where.join(' AND ')}
        ORDER BY p.created_at DESC
        LIMIT ${Number(limit)}`,
      params
    );
  }

  bookSummary() {
    return db.queryOne(
      `SELECT
         (SELECT COUNT(*) FROM insurance_policies WHERE status='active')        AS active_policies,
         (SELECT IFNULL(SUM(premium),0) FROM insurance_policies)                AS premiums_written,
         (SELECT IFNULL(SUM(CASE WHEN p.cover_method='declining' THEN l.outstanding_balance
                                 ELSE p.cover_amount END),0)
            FROM insurance_policies p JOIN loans l ON l.id = p.loan_id
           WHERE p.status='active')                                             AS cover_in_force,
         (SELECT COUNT(*) FROM insurance_claims WHERE status IN ('lodged','assessing')) AS open_claims,
         (SELECT IFNULL(SUM(approved_amount),0) FROM insurance_claims WHERE status='settled') AS claims_paid`
    );
  }
}

class ClaimRepository extends BaseRepository {
  constructor() {
    super('insurance_claims', [
      'claim_no', 'policy_id', 'claim_type', 'incident_date', 'lodged_at', 'lodged_by',
      'claimed_amount', 'approved_amount', 'loan_settled', 'paid_to_family',
      'assessed_by', 'assessed_at', 'decision_notes', 'status',
    ]);
  }

  async nextClaimNo(tx) {
    const row = await this._conn(tx).queryOne(
      "SELECT MAX(CAST(SUBSTRING(claim_no, 4) AS UNSIGNED)) AS n FROM insurance_claims"
    );
    return `CM-${String((Number(row.n) || 0) + 1).padStart(6, '0')}`;
  }

  search({ status = '', limit = 200 } = {}) {
    const where = ['1=1'];
    const params = [];
    if (status) { where.push('k.status = ?'); params.push(status); }
    return db.query(
      `SELECT k.*, p.policy_no, p.cover_method, p.cover_amount,
              l.loan_no, l.outstanding_balance,
              CONCAT(c.first_name,' ',c.last_name) AS client_name, c.client_no,
              u.full_name AS lodged_by_name, a.full_name AS assessed_by_name
         FROM insurance_claims k
         JOIN insurance_policies p ON p.id = k.policy_id
         JOIN loans l   ON l.id = p.loan_id
         JOIN clients c ON c.id = p.client_id
         JOIN users u   ON u.id = k.lodged_by
    LEFT JOIN users a   ON a.id = k.assessed_by
        WHERE ${where.join(' AND ')}
        ORDER BY k.created_at DESC
        LIMIT ${Number(limit)}`,
      params
    );
  }

  findDetailed(id, tx) {
    return this._conn(tx).queryOne(
      `SELECT k.*, p.policy_no, p.cover_method, p.cover_amount, p.client_id, p.loan_id,
              l.loan_no, l.outstanding_balance,
              CONCAT(c.first_name,' ',c.last_name) AS client_name
         FROM insurance_claims k
         JOIN insurance_policies p ON p.id = k.policy_id
         JOIN loans l   ON l.id = p.loan_id
         JOIN clients c ON c.id = p.client_id
        WHERE k.id = ?`,
      [id]
    );
  }
}

module.exports = {
  policyRepository: new PolicyRepository(),
  claimRepository: new ClaimRepository(),
};
