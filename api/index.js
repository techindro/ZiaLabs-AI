let app = null;
let initError = null;

try {
  const serverApp = require('../server/app');
  app = serverApp.app;
} catch (err) {
  console.error('❌ Serverless module initialization error:', err);
  initError = err;
}

module.exports = (req, res) => {
  if (initError) {
    return res.status(500).json({
      error: 'Vercel Serverless Function Initialization Error',
      message: initError.message,
      stack: initError.stack
    });
  }
  return app(req, res);
};
