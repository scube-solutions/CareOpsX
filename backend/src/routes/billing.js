const router = require('express').Router();
const ctrl = require('../controllers/billingController');
const { verifyToken, requireRole } = require('../middlewares/auth');

// 1=Admin, 5=Receptionist, 7=Pharmacist
const billingRoles = [verifyToken, requireRole([1, 5, 7])];
const adminReceptionist = [verifyToken, requireRole([1, 5])];

router.get('/invoices', ...billingRoles, ctrl.getInvoices);
router.get('/invoices/:id', ...billingRoles, ctrl.getInvoiceById);
router.post('/invoices', ...adminReceptionist, ctrl.createInvoice);
router.post('/payments', ...adminReceptionist, ctrl.recordPayment);
router.post('/refund', verifyToken, requireRole([1]), ctrl.processRefund);
router.get('/payment-register', verifyToken, requireRole([1, 8]), ctrl.getPaymentRegister);
router.get('/reception-payments', ...adminReceptionist, ctrl.getReceptionPayments);

module.exports = router;
