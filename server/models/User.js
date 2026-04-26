// ─── ZiaLabs AI — User Model ───
const DB = require('../config/database');

class User {
  constructor(row) {
    this.id = row.id;
    this.name = row.name;
    this.email = row.email;
    this.passwordHash = row.password_hash;
    this.authProvider = row.auth_provider;
    this.plan = row.plan;
    this.apiCallsUsed = row.api_calls_used;
    this.apiCallsLimit = row.api_calls_limit;
    this.createdAt = row.created_at;
  }

  static create({ name, email, passwordHash = null, authProvider = 'email' }) {
    const { lastId } = DB.run(
      'INSERT INTO users (name, email, password_hash, auth_provider) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, authProvider]
    );
    return User.findById(lastId);
  }

  static findByEmail(email) {
    const row = DB.get('SELECT * FROM users WHERE email = ?', [email]);
    return row ? new User(row) : null;
  }

  static findById(id) {
    const row = DB.get('SELECT * FROM users WHERE id = ?', [id]);
    return row ? new User(row) : null;
  }

  static incrementApiCalls(id) {
    DB.run('UPDATE users SET api_calls_used = api_calls_used + 1 WHERE id = ?', [id]);
  }

  static hasApiCallsRemaining(id) {
    const user = User.findById(id);
    return user ? user.apiCallsUsed < user.apiCallsLimit : false;
  }

  static updatePlan(id, plan, newLimit = 500) {
    DB.run('UPDATE users SET plan = ?, api_calls_limit = ? WHERE id = ?', [plan, newLimit, id]);
  }

  toJSON() {
    return {
      id: this.id, name: this.name, email: this.email,
      authProvider: this.authProvider, plan: this.plan,
      apiCallsUsed: this.apiCallsUsed, apiCallsLimit: this.apiCallsLimit,
      createdAt: this.createdAt,
    };
  }
}

module.exports = User;
