// ─── ZiaLabs AI — Express Server Entry Point ───
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const DB = require('./config/database');

async function startServer() {
  // Initialize database (async for sql.js)
  await DB.init();

  // Import routes (after DB is ready)
  const authRoutes = require('./routes/auth');
  const chatRoutes = require('./routes/chat');
  const searchRoutes = require('./routes/search');
  const papersRoutes = require('./routes/papers');

  const app = express();
  const PORT = process.env.PORT || 3000;

  // ── Middleware ──
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── Static files ──
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // ── API Routes ──
  app.use('/api/auth', authRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/papers', papersRoutes);

  // ── Health check ──
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      name: 'ZiaLabs AI',
      version: '1.0.0',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // ── SPA fallback ──
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    }
  });

  // ── Global error handler ──
  app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // ── Start server ──
  app.listen(PORT, () => {
    console.log(`
  ╔══════════════════════════════════════════╗
  ║          ZiaLabs AI Server               ║
  ║──────────────────────────────────────────║
  ║  🌐  http://localhost:${PORT}              ║
  ║  📡  API: http://localhost:${PORT}/api      ║
  ║  🔑  Gemini: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '⚠️  Not set'}           ║
  ╚══════════════════════════════════════════╝
    `);
  });

  // ── Graceful shutdown ──
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    DB.close();
    process.exit(0);
  });
}

startServer().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
