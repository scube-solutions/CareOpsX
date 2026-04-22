const router = require('express').Router();
const { verifyToken, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/analyticsController');

// 1=Admin, 8=Reporting
const allowed = [verifyToken, requireRole([1, 5, 8])];

router.get('/dashboard', ...allowed, ctrl.getDashboard);
router.get('/revenue', ...allowed, ctrl.getRevenueAnalytics);
router.get('/patient-volume', ...allowed, ctrl.getPatientVolume);
router.get('/doctor-performance', ...allowed, ctrl.getDoctorPerformance);
router.get('/lab', ...allowed, ctrl.getLabSummary);
router.get('/pharmacy', ...allowed, ctrl.getPharmacySummary);
router.get('/followup', ...allowed, ctrl.getFollowUpSummary);

module.exports = router;
