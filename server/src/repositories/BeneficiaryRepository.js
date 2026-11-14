const BaseRepository = require('./BaseRepository');
const db = require('../config/db');

class BeneficiaryRepository extends BaseRepository {
  constructor() {
    super('beneficiaries', [
      'client_id', 'full_name', 'relationship', 'national_id', 'phone',
      'address', 'date_of_birth', 'share_pct', 'is_active',
    ]);
  }

  forClient(clientId, { includeInactive = false } = {}, tx) {
    const filter = includeInactive ? '' : ' AND is_active = 1';
    return this._conn(tx).query(
      `SELECT * FROM beneficiaries WHERE client_id = ?${filter} ORDER BY share_pct DESC, full_name`,
      [clientId]
    );
  }

  /** Total of the active shares, used to enforce the 100% rule. */
  async activeShare(clientId, { excludeId = null } = {}, tx) {
    const params = [clientId];
    let clause = 'client_id = ? AND is_active = 1';
    if (excludeId) { clause += ' AND id <> ?'; params.push(excludeId); }
    const row = await this._conn(tx).queryOne(
      `SELECT IFNULL(SUM(share_pct),0) AS total FROM beneficiaries WHERE ${clause}`, params
    );
    return Number(row.total);
  }

  /** Clients with money at stake but nobody nominated — a compliance gap. */
  missingNominations() {
    return db.query(
      `SELECT c.id, c.client_no, CONCAT(c.first_name,' ',c.last_name) AS client_name, c.phone,
              u.full_name AS officer_name,
              IFNULL(s.balance,0) AS savings_balance,
              IFNULL(l.exposure,0) AS loan_exposure
         FROM clients c
    LEFT JOIN users u ON u.id = c.officer_id
    LEFT JOIN (SELECT client_id, SUM(balance) AS balance FROM savings_accounts
                WHERE status = 'active' GROUP BY client_id) s ON s.client_id = c.id
    LEFT JOIN (SELECT client_id, SUM(outstanding_balance) AS exposure FROM loans
                WHERE status = 'active' GROUP BY client_id) l ON l.client_id = c.id
        WHERE c.status = 'active'
          AND NOT EXISTS (SELECT 1 FROM beneficiaries b
                           WHERE b.client_id = c.id AND b.is_active = 1)
          AND (IFNULL(s.balance,0) > 0 OR IFNULL(l.exposure,0) > 0)
        ORDER BY (IFNULL(s.balance,0) + IFNULL(l.exposure,0)) DESC`
    );
  }
}

module.exports = new BeneficiaryRepository();
