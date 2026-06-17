const router = require('express').Router();
const { verifyToken } = require('../middlewares/auth');
const ctrl = require('../controllers/aiController');

// All AI routes require authentication; tool-level RBAC is enforced per query.
router.post('/chat',                       verifyToken, ctrl.chat);
router.post('/chat/stream',                verifyToken, ctrl.chatStream);
router.get('/summary',                     verifyToken, ctrl.dashboardSummary);
router.post('/report',                     verifyToken, ctrl.generateReport);
router.get('/conversations',               verifyToken, ctrl.listConversations);
router.get('/conversations/:id/messages',  verifyToken, ctrl.getMessages);
router.delete('/conversations/:id',        verifyToken, ctrl.deleteConversation);

module.exports = router;
