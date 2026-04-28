const router = require('express').Router();
const ctrl = require('../controllers/patientController');
const { verifyToken, requireRole } = require('../middlewares/auth');

// 1=Admin, 5=Receptionist can read and create
// 2=Doctor can read only
// Patient: own profile (role 3)
router.get('/me',    verifyToken, ctrl.getMyProfile);
router.patch('/me',  verifyToken, ctrl.updateMyProfile);

router.post('/check-duplicates', verifyToken, requireRole([1, 5]), ctrl.checkDuplicates);
router.post('/merge', verifyToken, requireRole([1]), ctrl.mergePatients);

router.get('/', verifyToken, requireRole([1, 2, 5, 7, 8]), ctrl.getPatients);
router.get('/:id', verifyToken, requireRole([1, 2, 5, 7, 8]), ctrl.getPatientById);
router.post('/', verifyToken, requireRole([1, 5]), ctrl.createPatient);
router.put('/:id', verifyToken, requireRole([1, 5]), ctrl.updatePatient);
router.patch('/:id', verifyToken, requireRole([1, 5]), ctrl.updatePatient);
router.patch('/:id/archive', verifyToken, requireRole([1]), ctrl.archivePatient);
router.delete('/:id', verifyToken, requireRole([1]), ctrl.deletePatient);

module.exports = router;
