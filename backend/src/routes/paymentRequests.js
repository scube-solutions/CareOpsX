const router = require('express').Router();
const { verifyToken, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/paymentRequestController');

router.post('/',            ctrl.createRequest); // patient may be unauthenticated
router.get('/',             verifyToken, requireRole([1, 5]), ctrl.getPendingRequests);
router.patch('/:id/approve',verifyToken, requireRole([1, 5]), ctrl.approveRequest);
router.get('/:id/status',   ctrl.checkStatus); // patient polls without auth

module.exports = router;
