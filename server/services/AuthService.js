const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');

const JWT_SECRET  = process.env.JWT_SECRET || 'zialabs-dev-secret-change-me';
const JWT_EXPIRES = '7d';

class AuthService {
  static async register(name, email, password) {
    const existing = User.findByEmail(email);
    if (existing) throw new Error('An account with this email already exists');

    if (!name || name.trim().length < 2)  throw new Error('Name must be at least 2 characters');
    if (!email || !email.includes('@'))   throw new Error('Valid email is required');
    if (!password || password.length < 8) throw new Error('Password must be at least 8 characters');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
    });

    const token = AuthService.#makeToken(user);
    return { user: user.toJSON(), token };
  }

  static async login(email, password) {
    if (!email || !password) throw new Error('Email and password are required');

    const user = User.findByEmail(email.toLowerCase().trim());
    if (!user) throw new Error('Invalid email or password');
    if (!user.passwordHash) throw new Error('This account uses Google sign-in. Please sign in with Google.');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new Error('Invalid email or password');

    const token = AuthService.#makeToken(user);
    return { user: user.toJSON(), token };
  }

  // creates account if it doesn't exist yet, then signs in
  static googleSignIn(name, email) {
    if (!email) throw new Error('Email is required for Google sign-in');

    let user = User.findByEmail(email.toLowerCase().trim());
    if (!user) {
      user = User.create({
        name: name || email.split('@')[0],
        email: email.toLowerCase().trim(),
        passwordHash: null,
        authProvider: 'google',
      });
    }

    const token = AuthService.#makeToken(user);
    return { user: user.toJSON(), token };
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch {
      throw new Error('Invalid or expired token');
    }
  }

  static #makeToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );
  }
}

module.exports = AuthService;
