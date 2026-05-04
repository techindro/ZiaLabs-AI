const express = require('express');
const router = express.Router();
const AuthService = require('../services/AuthService');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

/**
 * POST /api/auth/register
 * Create a new account with email/password
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const result = await AuthService.register(name, email, password);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/auth/login
 * Sign in with email/password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

/**
 * POST /api/auth/google
 * Google sign-in (simulated)
 */
router.post('/google', (req, res) => {
  try {
    const { name, email } = req.body;
    const result = AuthService.googleSignIn(name, email);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile (protected)
 */
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: user.toJSON() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
