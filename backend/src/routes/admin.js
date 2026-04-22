const router = require('express').Router();
const { verifyToken, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/adminController');

const adminOnly = [verifyToken, requireRole([1])];

// Hospital profile
router.get('/hospital-profile', verifyToken, ctrl.getHospitalProfile);
router.post('/hospital-profile', ...adminOnly, ctrl.upsertHospitalProfile);

// Branches
router.get('/branches', verifyToken, ctrl.getBranches);
router.post('/branches', ...adminOnly, ctrl.createBranch);
router.put('/branches/:id', ...adminOnly, ctrl.updateBranch);
router.delete('/branches/:id', ...adminOnly, ctrl.deleteBranch);

// Departments
router.get('/departments', verifyToken, ctrl.getDepartments);
router.post('/departments', ...adminOnly, ctrl.createDepartment);
router.put('/departments/:id', ...adminOnly, ctrl.updateDepartment);
router.patch('/departments/:id/toggle', ...adminOnly, ctrl.toggleDepartment);

// Consultation types
router.get('/consultation-types', verifyToken, ctrl.getConsultationTypes);
router.post('/consultation-types', ...adminOnly, ctrl.createConsultationType);
router.put('/consultation-types/:id', ...adminOnly, ctrl.updateConsultationType);

// Doctor leaves
router.get('/doctor-leaves', verifyToken, ctrl.getDoctorLeaves);
router.post('/doctor-leaves', ...adminOnly, ctrl.createDoctorLeave);
router.delete('/doctor-leaves/:id', ...adminOnly, ctrl.deleteDoctorLeave);

// Users management
router.get('/users', ...adminOnly, ctrl.getUsers);
router.post('/users', ...adminOnly, ctrl.createUser);
router.put('/users/:id', ...adminOnly, ctrl.updateUser);
router.patch('/users/:id/toggle', ...adminOnly, ctrl.toggleUserActive);
router.delete('/users/:id', ...adminOnly, ctrl.deleteUser);
router.post('/users/:id/reset-password', ...adminOnly, ctrl.resetUserPassword);

// Lab test catalog
router.get('/lab-tests', verifyToken, ctrl.getLabTestCatalog);
router.post('/lab-tests', ...adminOnly, ctrl.createLabTest);
router.put('/lab-tests/:id', ...adminOnly, ctrl.updateLabTest);
router.delete('/lab-tests/:id', ...adminOnly, ctrl.deleteLabTest);

module.exports = router;
