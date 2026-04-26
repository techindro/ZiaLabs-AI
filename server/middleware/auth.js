// ─── ZiaLabs AI — JWT Auth Middleware ───
const AuthService = require('../services/AuthService');

/**
 * Express middleware to verify JWT token from Authorization header.
 * Attaches decoded user payload to req.user
 */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = AuthService.verifyToken(token);
    req.user = decoded; // { id, email, name }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please sign in again.' });
  }
}

module.exports = authMiddleware;
