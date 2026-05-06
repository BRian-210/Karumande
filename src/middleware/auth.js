const jwt = require('jsonwebtoken');
const { users } = require('../data/repositories');

async function requireAuth(req, res, next) {
  // Check Authorization header first
  let token = null;
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Fallback to query param (for file downloads)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ message: 'Missing token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Normalize user shape for compatibility with routes expecting `req.user.id`
    req.user = {
      id: payload.sub || payload.id || payload.userId,
      sub: payload.sub || payload.id || payload.userId,
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
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const role = req.user.role;

    // 👇 Admin bypass
    if (role === 'admin') {
      return next();
    }

    if (!roles.includes(role)) {
      return res.status(403).json({ message: `Requires role: ${roles.join(', ')}` });
    }

    next();
  };
}
async function enforceMustChangePassword(req, res, next) {
  try {
    if (!req.user || !req.user.id) return next();

    // Allow the password-change endpoint without blocking
    const isChangePasswordRoute = req.path === '/change-password' || req.originalUrl.endsWith('/auth/change-password');
    if (isChangePasswordRoute) return next();

    const user = await users.findById(req.user.id);
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
  authenticate: requireAuth,
  authorize: requireRole,
};
