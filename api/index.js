// Polyfill browser globals at the absolute entrypoint before any module imports run
class DOMMatrixPolyfill {
  constructor(init) {
    this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    if (Array.isArray(init) && init.length >= 6) {
      this.a = init[0]; this.b = init[1]; this.c = init[2];
      this.d = init[3]; this.e = init[4]; this.f = init[5];
    }
  }
  multiply() { return this; }
  translate() { return this; }
  scale() { return this; }
  rotate() { return this; }
  inverse() { return this; }
  transformPoint(p) { return p || { x: 0, y: 0 }; }
}

if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = DOMMatrixPolyfill;
}
if (typeof global.DOMMatrix === 'undefined') {
  global.DOMMatrix = DOMMatrixPolyfill;
}

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
