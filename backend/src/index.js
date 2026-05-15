const express = require('express');
const cors    = require('cors');
require('dotenv').config();
const { verifyToken } = require('./middlewares/auth');
const { getOrganizationContext, ensureOrganizationOperational } = require('./utils/organizationAccess');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '2mb' }));

const requirePortal = (portalKey) => async (req, res, next) => {
  verifyToken(req, res, async () => {
    try {
      const { isSuperAdmin, organization, portalAccess } = await getOrganizationContext(req);
      if (isSuperAdmin && !organization) return next();
      // Org admin (role 1) always gets through — they manage everything in their hospital
      const userRoles = Array.isArray(req.user?.roles) && req.user.roles.length
        ? req.user.roles : [req.user?.role_id];
      if (userRoles.includes(1)) {
        const orgCheck = ensureOrganizationOperational(organization);
        if (!orgCheck.ok) return res.status(403).json({ error: orgCheck.message });
        return next();
      }
      const orgCheck = ensureOrganizationOperational(organization);
      if (!orgCheck.ok) return res.status(403).json({ error: orgCheck.message });
      if (portalAccess[portalKey] === false) {
        return res.status(403).json({ error: `Portal "${portalKey}" is disabled for this organization.` });
      }
      next();
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
};

// ── Core Routes ───────────────────────────────────────────────────────────────
app.use('/auth',          require('./routes/auth'));
app.use('/appointments',  requirePortal('doctor'),    require('./routes/appointments'));
app.use('/doctors',       requirePortal('doctor'),    require('./routes/doctors'));
app.use('/patients',      requirePortal('reception'), require('./routes/patients'));
app.use('/billing',       requirePortal('admin'),     require('./routes/billing'));

// ── New Module Routes ─────────────────────────────────────────────────────────
app.use('/admin',         requirePortal('admin'),     require('./routes/admin'));
app.use('/queue',         requirePortal('reception'), require('./routes/queue'));
app.use('/consultations', requirePortal('doctor'),    require('./routes/consultations'));
app.use('/lab',           requirePortal('lab'),       require('./routes/lab'));
app.use('/pharmacy',      requirePortal('pharmacy'),  require('./routes/pharmacy'));
app.use('/notifications', require('./routes/notifications'));
app.use('/followups',     require('./routes/followups'));
app.use('/analytics',     requirePortal('analytics'), require('./routes/analytics'));
app.use('/audit',         require('./routes/audit'));
app.use('/dropoff',       require('./routes/dropoff'));
app.use('/payment-requests', require('./routes/paymentRequests'));
app.use('/super-admin',   require('./routes/superAdmin'));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', app: 'CareOpsX API v2' }));

// ── Background Jobs ───────────────────────────────────────────────────────────
require('./jobs/reminders');
require('./jobs/followupScanner');
require('./jobs/dropoffEngine');
require('./jobs/stockAlerts');

// Global JSON error handler — must be last middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`CareOpsX backend running on port ${PORT}`));
