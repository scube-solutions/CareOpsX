const router = require('express').Router();
const { verifyToken, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/followupController');

// Patient: view own follow-ups (no role restriction, just auth)
router.get('/my-followups', verifyToken, ctrl.getMyFollowUps);

// 1=Admin, 2=Doctor, 5=Receptionist, 8=Reporting
router.get('/', verifyToken, requireRole([1, 2, 5, 8]), ctrl.getFollowUps);
router.get('/missed', verifyToken, requireRole([1, 2, 5]), ctrl.getMissedFollowUps);
router.get('/upcoming', verifyToken, requireRole([1, 2, 5]), ctrl.getUpcomingFollowUps);
router.get('/:id', verifyToken, requireRole([1, 2, 5]), ctrl.getFollowUpById);
router.post('/', verifyToken, requireRole([1, 2]), ctrl.createFollowUp);
router.put('/:id', verifyToken, requireRole([1, 2, 5]), ctrl.updateFollowUp);

module.exports = router;
