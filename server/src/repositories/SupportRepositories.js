/** Small repositories that do not need their own file. */
const BaseRepository = require('./BaseRepository');
const db = require('../config/db');

class LoanProductRepository extends BaseRepository {
  constructor() {
    super('loan_products', [
      'code', 'name', 'interest_rate', 'interest_method', 'repayment_frequency',
      'min_amount', 'max_amount', 'min_term_months', 'max_term_months',
      'processing_fee_pct', 'penalty_rate_pct', 'insurance_rate_pct', 'insurance_method', 'is_active',
    ]);
  }
  active() { return db.query('SELECT * FROM loan_products WHERE is_active = 1 ORDER BY name'); }
}

class BranchRepository extends BaseRepository {
  constructor() { super('branches', ['code', 'name', 'address', 'phone']); }
  all() { return db.query('SELECT * FROM branches ORDER BY name'); }
}

class NotificationRepository extends BaseRepository {
  constructor() { super('notifications', ['client_id', 'loan_id', 'channel', 'subject', 'message', 'status']); }
  latest(limit = 25) {
    return db.query(
      `SELECT n.*, CONCAT(c.first_name,' ',c.last_name) AS client_name
         FROM notifications n LEFT JOIN clients c ON c.id = n.client_id
        ORDER BY n.id DESC LIMIT ${Number(limit)}`
    );
  }
}

class AuditRepository extends BaseRepository {
  constructor() { super('audit_logs', ['user_id', 'action', 'entity', 'entity_id', 'details', 'ip_address']); }
  latest(limit = 100) {
    return db.query(
      `SELECT a.*, u.full_name AS user_name
         FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.id DESC LIMIT ${Number(limit)}`
    );
  }
}

module.exports = {
  loanProductRepository: new LoanProductRepository(),
  branchRepository: new BranchRepository(),
  notificationRepository: new NotificationRepository(),
  auditRepository: new AuditRepository(),
};
