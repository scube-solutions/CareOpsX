const router = require('express').Router();
const { verifyToken, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/labController');

// Patient: view own lab orders
router.get('/my-orders', verifyToken, ctrl.getMyLabOrders);

// Test catalog (all authenticated; fees hidden from doctors/patients by controller)
router.get('/test-catalog', verifyToken, ctrl.getTestCatalog);

// 1=Admin, 2=Doctor, 5=Receptionist, 6=LabStaff
router.get('/orders', verifyToken, requireRole([1, 2, 5, 6]), ctrl.getLabOrders);
router.get('/orders/:id', verifyToken, requireRole([1, 2, 5, 6]), ctrl.getLabOrderById);
router.patch('/orders/:id/status', verifyToken, requireRole([1, 5, 6]), ctrl.updateLabOrderStatus);
router.patch('/orders/:id/payment', verifyToken, requireRole([1, 5, 6]), ctrl.updateLabOrderPayment);
router.get('/reports',  verifyToken, requireRole([1, 2, 6]), ctrl.getLabReports);
router.post('/upload-file', verifyToken, requireRole([1, 6]), ctrl.uploadLabFile);
router.post('/reports', verifyToken, requireRole([1, 6]), ctrl.uploadLabReport);
router.patch('/reports/:id/correct', verifyToken, requireRole([1, 6]), ctrl.correctLabReport);
router.patch('/reports/:id/deliver', verifyToken, requireRole([1, 6]), ctrl.markReportDelivered);

module.exports = router;
