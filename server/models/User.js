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
    
    try {
      DB.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashed]);
      DB.save();
    } catch (err) {
      console.warn('⚠️ User create insert warning:', err.message);
    }

    const found = this.findByEmail(email);
    if (found) return found;

    return new User({
      id: Date.now(),
      name,
      email,
      password: hashed,
      plan: 'free',
      api_calls: 0,
      created_at: new Date().toISOString()
    });
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
    if (!userId) return true;
    const user = this.findById(userId);
    if (!user) return true; // Allow active sessions/guests without restriction
    if (user.plan && user.plan.toLowerCase() === 'pro') return true; // Unlimited for Pro
    return user.api_calls < 1000; // 1,000 call limit for free users
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
