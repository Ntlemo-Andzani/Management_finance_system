const BaseRepository = require('./BaseRepository');
const db = require('../config/db');

class UserRepository extends BaseRepository {
  constructor() {
    super('users', ['branch_id', 'full_name', 'email', 'password_hash', 'role', 'phone', 'is_active']);
  }

  findByEmail(email) {
    return db.queryOne('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  }

  listWithBranch() {
    return db.query(
      `SELECT u.id, u.full_name, u.email, u.role, u.phone, u.is_active, u.last_login_at,
              b.name AS branch_name
         FROM users u JOIN branches b ON b.id = u.branch_id
        ORDER BY u.full_name`
    );
  }

  touchLogin(id) {
    return db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [id]);
  }
}

module.exports = new UserRepository();
