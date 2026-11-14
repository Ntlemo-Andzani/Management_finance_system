const BaseRepository = require('./BaseRepository');
const db = require('../config/db');

class ClientRepository extends BaseRepository {
  constructor() {
    super('clients', [
      'client_no', 'branch_id', 'officer_id', 'first_name', 'last_name', 'national_id',
      'date_of_birth', 'gender', 'phone', 'email', 'address', 'occupation',
      'business_name', 'monthly_income', 'status',
    ]);
  }

  async search({ q = '', status = '', branchId = null, limit = 50, offset = 0 } = {}) {
    const where = ['1=1'];
    const params = [];
    if (q) {
      where.push('(c.first_name LIKE ? OR c.last_name LIKE ? OR c.client_no LIKE ? OR c.phone LIKE ? OR c.national_id LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }
    if (status) { where.push('c.status = ?'); params.push(status); }
    if (branchId) { where.push('c.branch_id = ?'); params.push(branchId); }

    return db.query(
      `SELECT c.*, b.name AS branch_name, u.full_name AS officer_name,
              (SELECT COUNT(*) FROM loans l WHERE l.client_id = c.id AND l.status = 'active') AS active_loans
         FROM clients c
         JOIN branches b ON b.id = c.branch_id
    LEFT JOIN users u    ON u.id = c.officer_id
        WHERE ${where.join(' AND ')}
        ORDER BY c.created_at DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );
  }

  findDetailed(id) {
    return db.queryOne(
      `SELECT c.*, b.name AS branch_name, u.full_name AS officer_name
         FROM clients c
         JOIN branches b ON b.id = c.branch_id
    LEFT JOIN users u    ON u.id = c.officer_id
        WHERE c.id = ?`,
      [id]
    );
  }

  findByNationalId(nationalId) {
    return db.queryOne('SELECT * FROM clients WHERE national_id = ? LIMIT 1', [nationalId]);
  }

  async nextClientNo() {
    const row = await db.queryOne("SELECT MAX(CAST(SUBSTRING(client_no, 4) AS UNSIGNED)) AS n FROM clients");
    return `CL-${String((Number(row.n) || 0) + 1).padStart(4, '0')}`;
  }
}

module.exports = new ClientRepository();
