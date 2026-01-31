const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Missing token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Normalize user shape for compatibility with routes expecting `req.user.id`
    req.user = {
      id: payload.sub || payload.id || payload.userId,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const role = req.user.role;
    if (!roles.includes(role)) {
      return res.status(403).json({ message: `Requires role: ${roles.join(', ')}` });
    }
    next();
  };
}

/**
 * Middleware to enforce that users with `mustChangePassword` set to true
 * must change their password before accessing protected endpoints.
 * Allows the `/api/auth/change-password` route to proceed so they can update it.
 */
async function enforceMustChangePassword(req, res, next) {
  try {
    if (!req.user || !req.user.id) return next();

    // Allow the password-change endpoint without blocking
    const isChangePasswordRoute = req.path === '/change-password' || req.originalUrl.endsWith('/auth/change-password');
    if (isChangePasswordRoute) return next();

    const user = await User.findById(req.user.id).select('mustChangePassword');
    if (user && user.mustChangePassword) {
      return res.status(403).json({ message: 'Password change required. Please change your password to continue.' });
    }

    return next();
  } catch (err) {
    console.error('enforceMustChangePassword error:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  requireAuth,
  requireRole,
  enforceMustChangePassword,
  // backward-compatible aliases used across the codebase
  authenticate: requireAuth,
  authorize: requireRole,
};

