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

// In-memory store for OTPs (with 5-min expiration)
const otpStore = new Map();

// Send OTP to Global Mobile Phone Number
router.post('/send-otp', async (req, res) => {
  try {
    const { phone, countryCode } = req.body;
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Valid mobile phone number is required' });
    }

    const fullPhone = `${countryCode || '+1'}${phone.replace(/\D/g, '')}`;
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

    otpStore.set(fullPhone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    console.log(`📱 [GLOBAL OTP SENT] Phone: ${fullPhone} | OTP Code: ${otp}`);

    res.json({
      message: `OTP code sent to ${fullPhone}`,
      fullPhone,
      demoOtp: otp // Always return demoOtp for seamless user testing
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify OTP & Sign In / Register Global User
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, countryCode, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone number and 6-digit OTP are required' });
    }

    const fullPhone = `${countryCode || '+1'}${phone.replace(/\D/g, '')}`;
    const record = otpStore.get(fullPhone);

    // Allow 123456 as master test OTP or verify generated OTP
    if (otp.trim() !== '123456') {
      if (!record || record.expiresAt < Date.now()) {
        return res.status(400).json({ error: 'OTP expired or not found. Please request a new code.' });
      }
      if (record.otp !== otp.trim()) {
        return res.status(400).json({ error: 'Invalid OTP code. Please try again.' });
      }
    }

    otpStore.delete(fullPhone);

    const email = `user_${fullPhone.replace(/\+/g, '')}@zialabs.ai`;
    const name = `Global Researcher (${fullPhone})`;
    const { user, token } = await AuthService.googleSignIn(name, email);

    user.phone = fullPhone;

    publishEvent('user-activity', { event: 'otp-login', userId: user.id, phone: fullPhone }).catch(() => {});

    res.json({ user, token, message: 'Global Phone Authentication Successful!' });
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
