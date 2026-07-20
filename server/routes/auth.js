const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const jwt     = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const { publishEvent } = require('../config/kafka');

const JWT_SECRET = process.env.JWT_SECRET || 'zialabs-dev-secret-change-me';

// register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (User.findByEmail(email)) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const user = User.create({ name, email, password });
    const token = jwt.sign({ id: user.id }, JWT_SECRET);

    // Publish registration event to Kafka
    publishEvent('user-activity', { event: 'register', userId: user.id, email: user.email, name: user.name }).catch(err => {
      console.warn('Failed to publish user-activity register event:', err.message);
    });

    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// login with email/password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = User.findByEmail(email);

    if (!user || !User.verifyPassword(user, password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET);

    // Publish login event to Kafka
    publishEvent('user-activity', { event: 'login', userId: user.id, email: user.email, name: user.name }).catch(err => {
      console.warn('Failed to publish user-activity login event:', err.message);
    });

    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// mock google sign-in for local dev
// i'll swap this for real passport-google-oauth20 later
router.post('/google', async (req, res) => {
  try {
    const { email, name } = req.body;
    let user = User.findByEmail(email);

    if (!user) {
      user = User.create({ name, email, password: Math.random().toString(36) });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET);

    // Publish google-login event to Kafka
    publishEvent('user-activity', { event: 'google-login', userId: user.id, email: user.email, name: user.name }).catch(err => {
      console.warn('Failed to publish user-activity google-login event:', err.message);
    });

    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get current logged in user details
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
