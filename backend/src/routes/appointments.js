const express = require('express');
const router  = express.Router();
const {
  setAvailability,
  getAvailability,
  getSlots,
  bookAppointment,
  getAppointments,
  updateStatus,
  rescheduleAppointment
} = require('../controllers/appointmentController');

const { verifyToken, requireRole } = require('../middlewares/auth');

// Slots — public (patient needs this without login for now)
router.get('/slots', getSlots);

// Appointments
router.post('/',         verifyToken, bookAppointment);
router.get('/',          verifyToken, getAppointments);
router.patch('/:id/status', verifyToken, requireRole([1, 2]), updateStatus);
router.put('/:id',       verifyToken, requireRole([1, 2]), rescheduleAppointment);

// Doctor availability — admin only
router.post('/doctors/:id/availability',  verifyToken, requireRole([1]), setAvailability);
router.get('/doctors/:id/availability',   verifyToken, getAvailability);

module.exports = router;