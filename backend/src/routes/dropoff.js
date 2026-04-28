const router = require('express').Router();
const { verifyToken, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/dropoffController');

// 1=Admin, 2=Doctor, 5=Receptionist, 8=Reporting
router.get('/watchlist', verifyToken, requireRole([1, 2, 5, 8]), ctrl.getWatchlist);
router.post('/watchlist', verifyToken, requireRole([1, 5]), ctrl.addToWatchlist);
router.patch('/watchlist/:id/action', verifyToken, requireRole([1, 2, 5]), ctrl.recordAction);
router.get('/outcomes', verifyToken, requireRole([1, 8]), ctrl.getOutcomeSummary);
router.get('/rules', verifyToken, requireRole([1]), ctrl.getRules);
router.post('/rules', verifyToken, requireRole([1]), ctrl.createRule);
router.put('/rules/:id', verifyToken, requireRole([1]), ctrl.updateRule);

module.exports = router;
