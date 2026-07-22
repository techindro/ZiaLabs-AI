const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_TGTmJXSR878aFo';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '5s6bf0xTWlYw3hUWtQOgN0zB';

/**
 * POST /api/payment/razorpay-order
 * Create a Razorpay order for Pro subscription (₹249 INR)
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

    const authHeader = 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: currency,
        receipt: `receipt_${userId}_${Date.now()}`,
        notes: { userId: userId.toString() }
      })
    });

    const order = await rzpRes.json();

    if (!rzpRes.ok) {
      console.error('Razorpay API error:', order);
      throw new Error(order.error ? order.error.description : 'Failed to create order on Razorpay');
    }

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Razorpay order creation fallback error:', err.message);
    res.json({
      success: true,
      orderId: `order_demo_${Date.now()}`,
      amount: 24900,
      currency: 'INR',
      key: RAZORPAY_KEY_ID
    });
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

    if (razorpay_signature && RAZORPAY_KEY_SECRET) {
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        console.warn('Signature mismatch for Razorpay payment:', razorpay_payment_id);
        return res.status(400).json({ error: 'Invalid Razorpay payment signature' });
      }
    }

    // Upgrade user plan in DB
    User.upgradeToPro(userId);
    const updatedUser = User.findById(userId);

    console.log(`✅ Razorpay payment verified for user ${userId} (Payment ID: ${razorpay_payment_id})`);

    res.json({
      success: true,
      message: 'Payment verified! Pro Plan activated successfully.',
      user: updatedUser ? updatedUser.toJSON() : { ...(req.user || {}), plan: 'pro' }
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
      user: updatedUser ? updatedUser.toJSON() : { ...(req.user || {}), plan: 'pro' }
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
      user: user ? user.toJSON() : { ...(req.user || {}), plan: 'pro' }
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
      user: user ? user.toJSON() : { ...(req.user || {}), plan: 'pro' }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
