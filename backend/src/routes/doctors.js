const express = require('express');
const router = express.Router();
const { getDoctors, getDoctorById, createDoctor, deleteDoctor } = require('../controllers/doctorController');
const { setAvailability, getAvailability } = require('../controllers/appointmentController');
const { verifyToken, requireRole } = require('../middlewares/auth');

// Public endpoints for browsing doctors (used by booking flow)
router.get('/', getDoctors);
router.get('/:id', getDoctorById);

// Admin-only endpoints for creating and deleting doctor profiles
router.post('/',    verifyToken, requireRole([1]), createDoctor);
router.delete('/:id', verifyToken, requireRole([1]), deleteDoctor);

// Availability management
router.get('/:id/availability', verifyToken, requireRole([1]), getAvailability);
router.post('/:id/availability', verifyToken, requireRole([1]), setAvailability);

module.exports = router;
