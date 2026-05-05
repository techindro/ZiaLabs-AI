require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const DB      = require('./config/database');

async function startServer() {
  await DB.init();

  // load routes after db is ready (sql.js needs to init first)
  const authRoutes    = require('./routes/auth');
  const chatRoutes    = require('./routes/chat');
  const searchRoutes  = require('./routes/search');
  const papersRoutes  = require('./routes/papers');
  const paymentRoutes = require('./routes/payment');
  const uploadRoutes  = require('./routes/upload');
  const newsRoutes    = require('./routes/news');

  const app  = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());

  // stripe webhook needs raw body — must be before express.json
  app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/api/auth',    authRoutes);
  app.use('/api/chat',    chatRoutes);
  app.use('/api/search',  searchRoutes);
  app.use('/api/papers',  papersRoutes);
  app.use('/api/payment', paymentRoutes);
  app.use('/api/upload',  uploadRoutes);
  app.use('/api/news',    newsRoutes);

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      name: 'ZiaLabs AI',
      uptime: Math.floor(process.uptime()),
    });
  });

  // spa fallback — anything not /api goes to index.html
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

  process.on('SIGINT', () => {
    console.log('shutting down...');
    DB.close();
    process.exit(0);
  });
}

startServer().catch(err => {
  console.error('failed to start:', err);
  process.exit(1);
});
