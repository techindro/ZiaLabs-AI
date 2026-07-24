require('dotenv').config();

const { app, ensureInitialized } = require('./app');
const KafkaConsumer = require('./services/KafkaConsumer');
const DailyBlogFetcher = require('./services/DailyBlogFetcher');

const PORT = process.env.PORT || 3000;

async function startServer() {
  await ensureInitialized();

  // Start daily autonomous blog fetcher scheduler
  DailyBlogFetcher.startDailyScheduler();

  // Start background Kafka consumer if enabled and not in serverless mode
  if (!process.env.VERCEL) {
    KafkaConsumer.startConsumer().catch(err => {
      console.error('Failed to start Kafka consumer:', err.message);
    });
  }

  app.listen(PORT, () => {
    console.log(`
  ZiaLabs AI Server running
  http://localhost:${PORT}
  Gemini: ${process.env.GEMINI_API_KEY ? 'configured' : 'NOT SET — add to .env'}
    `);
  });

  process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    try {
      await KafkaConsumer.stopConsumer();
    } catch (err) {
      console.error('Kafka cleanup error:', err.message);
    }
    const DB = require('./config/database');
    DB.close();
    process.exit(0);
  });
}

if (require.main === module) {
  startServer().catch(err => {
    console.error('Failed to start standalone server:', err);
    process.exit(1);
  });
}
