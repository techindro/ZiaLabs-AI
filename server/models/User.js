const DB = require('../config/database');
const bcrypt = require('bcryptjs');

// Simple User model with basic CRUD and bcrypt auth
class User {
  constructor(row) {
    this.id = row.id;
    this.name = row.name;
    this.email = row.email;
    this.password = row.password;
    this.plan = row.plan;
    this.api_calls = row.api_calls;
    this.created_at = row.created_at;
  }

  static create({ name, email, password }) {
    const salt = bcrypt.genSaltSync(10);
    const hashed = bcrypt.hashSync(password, salt);
    
    DB.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashed]);
    DB.save();
    return this.findByEmail(email);
  }

  static findByEmail(email) {
    const res = DB.exec('SELECT * FROM users WHERE email = ?', [email]);
    return res.length ? new User(res[0]) : null;
  }

  static findById(id) {
    const res = DB.exec('SELECT * FROM users WHERE id = ?', [id]);
    return res.length ? new User(res[0]) : null;
  }

  static verifyPassword(user, password) {
    return bcrypt.compareSync(password, user.password);
  }

  static hasApiCallsRemaining(userId) {
    const user = this.findById(userId);
    if (!user) return false;
    if (user.plan === 'pro') return true; // unlimited for pro
    return user.api_calls < 50; // 50 call limit for free users
  }

  static incrementApiCalls(userId) {
    DB.run('UPDATE users SET api_calls = api_calls + 1 WHERE id = ?', [userId]);
    DB.save();
  }

  static upgradeToPro(userId) {
    DB.run("UPDATE users SET plan = 'pro' WHERE id = ?", [userId]);
    DB.save();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      plan: this.plan,
      api_calls: this.api_calls,
      created_at: this.created_at
    };
  }
}

module.exports = User;
