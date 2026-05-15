const jwt        = require('jsonwebtoken');
const { getDb }  = require('../utils/orgClient');

// Verifies JWT and resolves the tenant DB client in one pass.
// After this middleware runs:
//   req.user → decoded JWT payload
//   req.db   → Supabase client for the user's organization
//             (falls back to control-plane DB for super admin / no org)
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token      = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role_id, organization_id, … }
    req.db   = await getDb(req); // resolve tenant DB (cached after first hit)
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// Role guard — pass allowed role_ids as array
// Usage: requireRole([1]) for admin only
//        requireRole([1, 2]) for admin + doctor
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    const userRoles = Array.isArray(req.user.roles) && req.user.roles.length
      ? req.user.roles
      : [req.user.role_id];
    if (!allowedRoles.some(r => userRoles.includes(r))) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

module.exports = { verifyToken, requireRole };