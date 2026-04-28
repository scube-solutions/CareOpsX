const router = require('express').Router();
const { verifyToken, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/consultationController');

// Patient: view own prescriptions
router.get('/my-prescriptions', verifyToken, ctrl.getMyPrescriptions);

// 1=Admin, 2=Doctor
router.post('/', verifyToken, requireRole([1, 2]), ctrl.createConsultation);
router.get('/doctor-queue/:doctor_id', verifyToken, requireRole([1, 2]), ctrl.getDoctorQueue);
router.get('/patient-history/:patient_id', verifyToken, requireRole([1, 2]), ctrl.getPatientHistory);
router.get('/:id', verifyToken, requireRole([1, 2, 5]), ctrl.getConsultation);
router.put('/:id', verifyToken, requireRole([1, 2]), ctrl.updateConsultation);

// Prescriptions
router.post('/prescriptions', verifyToken, requireRole([1, 2]), ctrl.createPrescription);

// Lab orders
router.post('/lab-orders', verifyToken, requireRole([1, 2]), ctrl.createLabOrder);

module.exports = router;
