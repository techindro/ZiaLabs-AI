const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const AuthService = require('../services/AuthService');
const authMiddleware = require('../middleware/auth');
const { publishEvent } = require('../config/kafka');

// register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const { user, token } = await AuthService.register(name, email, password);

    // Publish registration event to Kafka
    publishEvent('user-activity', { event: 'register', userId: user.id, email: user.email, name: user.name }).catch(err => {
      console.warn('Failed to publish user-activity register event:', err.message);
    });

    res.json({ user, token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// login with email/password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { user, token } = await AuthService.login(email, password);

    // Publish login event to Kafka
    publishEvent('user-activity', { event: 'login', userId: user.id, email: user.email, name: user.name }).catch(err => {
      console.warn('Failed to publish user-activity login event:', err.message);
    });

    res.json({ user, token });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// guest demo sign-in — returns a REAL valid JWT token so guest sessions never get 401 Invalid Token errors
router.post('/demo', async (req, res) => {
  try {
    const { user, token } = await AuthService.googleSignIn('Guest Researcher', 'guest@zialabs.ai');
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
    const { user, token } = await AuthService.googleSignIn(name, email);

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

// forgot password handler
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    publishEvent('user-activity', { event: 'forgot-password', email }).catch(() => {});
    res.json({ message: `Password reset instructions have been sent to ${email}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
