const router = require('express').Router();
const { verifyToken, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/notificationController');

// 1=Admin only for template management
router.get('/templates', verifyToken, requireRole([1]), ctrl.getTemplates);
router.post('/templates', verifyToken, requireRole([1]), ctrl.createTemplate);
router.put('/templates/:id', verifyToken, requireRole([1]), ctrl.updateTemplate);

// Sending/logs accessible to admin + receptionist
router.post('/send', verifyToken, requireRole([1, 5]), ctrl.sendNotification);
router.get('/logs', verifyToken, requireRole([1]), ctrl.getNotificationLogs);
router.post('/logs/:id/retry', verifyToken, requireRole([1]), ctrl.retryNotification);

module.exports = router;
