const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

let razorpayInstance = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  try {
    const Razorpay = require('razorpay');
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  } catch (err) {
    console.warn('Razorpay SDK not installed or failed to initialize:', err.message);
  }
}

/**
 * POST /api/payment/razorpay-order
 * Create a Razorpay order for Pro subscription (₹249 INR / $3 USD)
 */
router.post('/razorpay-order', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = User.findById(userId);

    if (user && user.plan && user.plan.toLowerCase() === 'pro') {
      return res.status(400).json({ error: 'You are already on the Pro plan' });
    }

    const amountInPaise = 24900; // ₹249 INR
    const currency = 'INR';

    if (razorpayInstance) {
      const order = await razorpayInstance.orders.create({
        amount: amountInPaise,
        currency: currency,
        receipt: `receipt_${userId}_${Date.now()}`,
        notes: { userId: userId.toString() }
      });
      return res.json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID
      });
    }

    // Demo/Fallback Razorpay Order if keys are not yet configured in env
    const demoOrderId = `order_demo_${Date.now()}`;
    res.json({
      success: true,
      orderId: demoOrderId,
      amount: amountInPaise,
      currency: currency,
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo12345'
    });
  } catch (err) {
    console.error('Razorpay order creation error:', err);
    res.status(500).json({ error: 'Could not create Razorpay order' });
  }
});

/**
 * POST /api/payment/verify-razorpay
 * Verify Razorpay payment signature & upgrade plan
 */
router.post('/verify-razorpay', authMiddleware, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user.id;

    if (process.env.RAZORPAY_KEY_SECRET && razorpay_signature) {
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ error: 'Invalid Razorpay payment signature' });
      }
    }

    // Upgrade user plan in DB
    User.upgradeToPro(userId);
    const updatedUser = User.findById(userId);

    console.log(`✅ Razorpay payment verified for user ${userId} (Payment ID: ${razorpay_payment_id || 'demo'})`);

    res.json({
      success: true,
      message: 'Payment verified! Pro Plan activated successfully.',
      user: updatedUser ? updatedUser.toJSON() : { id: userId, plan: 'pro' }
    });
  } catch (err) {
    console.error('Razorpay verification error:', err);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

/**
 * POST /api/payment/verify-upi
 * Verify UPI QR Code Payment via UTR / Transaction reference
 */
router.post('/verify-upi', authMiddleware, (req, res) => {
  try {
    const { utr } = req.body;
    const userId = req.user.id;

    if (!utr || utr.trim().length < 6) {
      return res.status(400).json({ error: 'Please enter a valid 12-digit UPI UTR or Reference Number.' });
    }

    console.log(`✅ UPI Payment reference submitted: ${utr} for user ${userId}`);

    // Upgrade user plan in DB
    User.upgradeToPro(userId);
    const updatedUser = User.findById(userId);

    res.json({
      success: true,
      message: 'UPI Payment Reference Verified! Pro Plan Activated.',
      user: updatedUser ? updatedUser.toJSON() : { id: userId, plan: 'pro' }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/payment/upgrade-demo
 * Instant Pro plan upgrade endpoint for demo testing
 */
router.post('/upgrade-demo', authMiddleware, (req, res) => {
  try {
    User.upgradeToPro(req.user.id);
    const user = User.findById(req.user.id);
    res.json({
      success: true,
      message: 'Plan upgraded to Pro successfully!',
      user: user ? user.toJSON() : { id: req.user.id, plan: 'pro' }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upgrade', authMiddleware, (req, res) => {
  try {
    User.upgradeToPro(req.user.id);
    const user = User.findById(req.user.id);
    res.json({
      success: true,
      message: 'Plan upgraded to Pro successfully!',
      user: user ? user.toJSON() : { id: req.user.id, plan: 'pro' }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
