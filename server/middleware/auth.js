const AuthService = require('../services/AuthService');

/**
 * Express middleware to verify JWT token from Authorization header.
 * Attaches decoded user payload to req.user with automatic guest session fallback.
 */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (header && header.startsWith('Bearer ')) {
    const token = header.split(' ')[1];
    try {
      const decoded = AuthService.verifyToken(token);
      req.user = decoded; // { id, email, name }
      return next();
    } catch (err) {
      // Token invalid/expired -> fall through to guest session
    }
  }

  // Automatic Guest Session Fallback so guest researchers can use ZiaLabs AI seamlessly
  req.user = {
    id: 'guest_user_session',
    email: 'guest@zialabs.ai',
    name: 'Guest Researcher'
  };
  next();
}

module.exports = authMiddleware;
