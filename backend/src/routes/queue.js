const router = require('express').Router();
const { verifyToken, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/queueController');

// 1=Admin, 2=Doctor, 5=Receptionist, 6=LabStaff, 7=Pharmacist
router.post('/token', verifyToken, requireRole([1, 5]), ctrl.generateQueueToken);
router.get('/live/:doctor_id', verifyToken, ctrl.getLiveQueue);
router.get('/lobby', ctrl.getLobbyDisplay); // public for display screen
router.post('/next/:doctor_id', verifyToken, requireRole([1, 2]), ctrl.callNext);
router.patch('/token/:id/status', verifyToken, requireRole([1, 2, 5]), ctrl.updateTokenStatus);
router.post('/journey', verifyToken, ctrl.logPatientJourney);
router.get('/journey', verifyToken, ctrl.getPatientJourney);

module.exports = router;
