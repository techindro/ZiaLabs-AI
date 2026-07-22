require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const DB      = require('./config/database');
const RedisService = require('./config/redis');
const KafkaConfig   = require('./config/kafka');
const KafkaConsumer = require('./services/KafkaConsumer');

async function startServer() {
  // db has to init before anything else because sql.js loads async
  await DB.init();

  // Initialize Redis Cache
  await RedisService.init();

  // Initialize Kafka producer
  await KafkaConfig.initProducer();

  // Start background Kafka consumer
  KafkaConsumer.startConsumer().catch(err => {
    console.error('Failed to start Kafka consumer:', err);
  });

  const authRoutes    = require('./routes/auth');
  const chatRoutes    = require('./routes/chat');
  const searchRoutes  = require('./routes/search');
  const papersRoutes  = require('./routes/papers');
  const paymentRoutes = require('./routes/payment');
  const uploadRoutes  = require('./routes/upload');
  const newsRoutes    = require('./routes/news');
  const blogRoutes    = require('./routes/blog');

  const app  = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());

  // stripe webhook needs the raw body — has to come before express.json()
  // spent 2 hours debugging this before i realized the order matters
  app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // serve the frontend
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // api routes
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

  // SPA fallback — anything that isn't an API route gets index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    }
  });

  app.use((err, req, res, next) => {
    console.error('server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(PORT, () => {
    console.log(`
  ZiaLabs AI Server running
  http://localhost:${PORT}
  Gemini: ${process.env.GEMINI_API_KEY ? 'configured' : 'NOT SET — add to .env'}
    `);
  });

  process.on('SIGINT', async () => {
    console.log('shutting down...');
    try {
      await KafkaConsumer.stopConsumer();
      await KafkaConfig.disconnectProducer();
    } catch (err) {
      console.error('Kafka cleanup error during shutdown:', err);
    }
    DB.close();
    process.exit(0);
  });
}

startServer().catch(err => {
  console.error('failed to start:', err);
  process.exit(1);
});
