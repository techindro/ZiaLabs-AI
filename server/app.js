require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const DB      = require('./config/database');
const RedisService = require('./config/redis');
const KafkaConfig   = require('./config/kafka');

const authRoutes    = require('./routes/auth');
const chatRoutes    = require('./routes/chat');
const searchRoutes  = require('./routes/search');
const papersRoutes  = require('./routes/papers');
const paymentRoutes = require('./routes/payment');
const uploadRoutes  = require('./routes/upload');
const newsRoutes    = require('./routes/news');
const blogRoutes    = require('./routes/blog');

const app = express();

app.use(cors());

// Stripe webhook raw body handling
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Lazy DB and services initialization for Serverless / Express
let initPromise = null;
async function ensureInitialized() {
  if (!initPromise) {
    initPromise = (async () => {
      await DB.init();
      try {
        await RedisService.init();
      } catch (err) {
        console.warn('⚠️ Redis initialization bypassed:', err.message);
      }
      try {
        await KafkaConfig.initProducer();
      } catch (err) {
        console.warn('⚠️ Kafka initialization bypassed:', err.message);
      }
    })();
  }
  return initPromise;
}

app.use(async (req, res, next) => {
  try {
    await ensureInitialized();
    next();
  } catch (err) {
    console.error('Initialization error:', err);
    res.status(500).json({ error: 'Internal server initialization failed' });
  }
});

// Serve frontend static assets
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/auth',    authRoutes);
app.use('/api/chat',    chatRoutes);
app.use('/api/search',  searchRoutes);
app.use('/api/papers',  papersRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/upload',  uploadRoutes);
app.use('/api/news',    newsRoutes);
app.use('/api/blog',    blogRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'ZiaLabs AI',
    uptime: Math.floor(process.uptime()),
  });
});

// SPA fallback — non-API requests serve index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'API route not found' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

module.exports = { app, ensureInitialized };
