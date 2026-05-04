const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

/**
 * POST /api/payment/create-checkout-session
 * Create a Stripe Checkout session for Pro plan upgrade
 */
router.post('/create-checkout-session', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = User.findById(userId);

    if (user.plan === 'Pro') {
      return res.status(400).json({ error: 'You are already on the Pro plan' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID_PRO,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.protocol}://${req.get('host')}/?upgrade=success`,
      cancel_url: `${req.protocol}://${req.get('host')}/?upgrade=cancel`,
      customer_email: user.email,
      metadata: {
        userId: userId.toString(),
      },
    });

    res.json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: 'Could not create checkout session' });
  }
});

/**
 * POST /api/payment/webhook
 * Stripe Webhook handler
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;

    console.log(`✅ Payment successful for user ${userId}`);
    
    // Upgrade user plan in DB
    User.upgradePlan(userId, 'Pro');
  }

  res.json({ received: true });
});

module.exports = router;
