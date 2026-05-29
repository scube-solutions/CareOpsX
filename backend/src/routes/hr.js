const router = require('express').Router();
const ctrl   = require('../controllers/hrController');
const { verifyToken, requireRole } = require('../middlewares/auth');

const adminOnly = [verifyToken, requireRole([1])];
const hrAccess  = [verifyToken, requireRole([1])];

// Staff
router.get('/staff',           ...hrAccess, ctrl.getStaff);
router.post('/staff',          ...adminOnly, ctrl.createStaff);
router.put('/staff/:id',       ...adminOnly, ctrl.updateStaff);
router.patch('/staff/:id/toggle', ...adminOnly, ctrl.toggleStaff);

// Attendance
router.get('/attendance',      ...hrAccess, ctrl.getAttendance);
router.post('/attendance',     ...hrAccess, ctrl.markAttendance);
router.put('/attendance/:id',  ...adminOnly, ctrl.updateAttendance);

// Shifts
router.get('/shifts',          ...hrAccess, ctrl.getShifts);
router.post('/shifts',         ...adminOnly, ctrl.createShift);
router.put('/shifts/:id',      ...adminOnly, ctrl.updateShift);
router.delete('/shifts/:id',   ...adminOnly, ctrl.deleteShift);

// Leave requests
router.get('/leaves',          ...hrAccess, ctrl.getLeaves);
router.post('/leaves',         ...hrAccess, ctrl.createLeave);
router.patch('/leaves/:id/status', ...adminOnly, ctrl.updateLeaveStatus);

// Payroll
router.get('/payroll',         ...hrAccess, ctrl.getPayroll);
router.post('/payroll/run',    ...adminOnly, ctrl.runPayroll);
router.get('/payroll/:id/slip', ...hrAccess, ctrl.getPayslip);

// Salary structures
router.get('/salary-structures',      ...hrAccess,  ctrl.getSalaryStructures);
router.post('/salary-structures',     ...adminOnly, ctrl.createSalaryStructure);
router.put('/salary-structures/:id',  ...adminOnly, ctrl.updateSalaryStructure);

module.exports = router;
