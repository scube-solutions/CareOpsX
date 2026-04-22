const router = require('express').Router();
const { verifyToken, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/pharmacyController');

// 1=Admin, 7=Pharmacist
router.get('/inventory', verifyToken, requireRole([1, 7]), ctrl.getInventory);
router.get('/inventory/alerts', verifyToken, requireRole([1, 7]), ctrl.getStockAlerts);
router.get('/inventory/:id', verifyToken, requireRole([1, 7]), ctrl.getMedicineById);
router.post('/inventory', verifyToken, requireRole([1, 7]), ctrl.addMedicine);
router.put('/inventory/:id', verifyToken, requireRole([1, 7]), ctrl.updateMedicine);
router.post('/inventory/:id/stock', verifyToken, requireRole([1, 7]), ctrl.addStock);

router.get('/invoices', verifyToken, requireRole([1, 7]), ctrl.getPharmacyInvoices);
router.post('/invoices', verifyToken, requireRole([1, 7]), ctrl.createPharmacyInvoice);
router.patch('/invoices/:id/dispense', verifyToken, requireRole([1, 7]), ctrl.dispensePharmacyInvoice);

module.exports = router;
