const router = require('express').Router();
const { verifyToken, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/auditController');

// Admin only
router.get('/', verifyToken, requireRole([1]), ctrl.getAuditLogs);
router.get('/summary', verifyToken, requireRole([1]), ctrl.getActivitySummary);
router.get('/:id', verifyToken, requireRole([1]), ctrl.getAuditLogById);

module.exports = router;
