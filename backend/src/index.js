const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// ── Core Routes ───────────────────────────────────────────────────────────────
app.use('/auth',          require('./routes/auth'));
app.use('/appointments',  require('./routes/appointments'));
app.use('/doctors',       require('./routes/doctors'));
app.use('/patients',      require('./routes/patients'));
app.use('/billing',       require('./routes/billing'));

// ── New Module Routes ─────────────────────────────────────────────────────────
app.use('/admin',         require('./routes/admin'));
app.use('/queue',         require('./routes/queue'));
app.use('/consultations', require('./routes/consultations'));
app.use('/lab',           require('./routes/lab'));
app.use('/pharmacy',      require('./routes/pharmacy'));
app.use('/notifications', require('./routes/notifications'));
app.use('/followups',     require('./routes/followups'));
app.use('/analytics',     require('./routes/analytics'));
app.use('/audit',         require('./routes/audit'));
app.use('/dropoff',       require('./routes/dropoff'));
app.use('/payment-requests', require('./routes/paymentRequests'));

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
