const express = require('express');
const router = express.Router();
const { getDoctors, getDoctorById, createDoctor, deleteDoctor, getDoctorSchedule, toggleBlockSlot } = require('../controllers/doctorController');
const { setAvailability, getAvailability } = require('../controllers/appointmentController');
const { verifyToken, requireRole } = require('../middlewares/auth');

// Public endpoints for browsing doctors (used by booking flow)
router.get('/specializations', async (req, res) => {
  const supabase = require('../utils/supabase');
  try {
    const { data, error } = await supabase
      .from('specializations')
      .select('name')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return res.json({ specializations: (data || []).map(s => s.name) });
  } catch (err) { return res.status(500).json({ error: err.message }); }
});
router.get('/', getDoctors);
router.get('/:id', getDoctorById);

// Admin-only endpoints for creating and deleting doctor profiles
router.post('/',    verifyToken, requireRole([1]), createDoctor);
router.delete('/:id', verifyToken, requireRole([1]), deleteDoctor);

// Availability management (admin only)
router.get('/:id/availability', verifyToken, requireRole([1]), getAvailability);
router.post('/:id/availability', verifyToken, requireRole([1]), setAvailability);

// Doctor self-service schedule management (doctor only)
router.get('/me/schedule',        verifyToken, requireRole([2]), getDoctorSchedule);
router.post('/me/schedule/block', verifyToken, requireRole([2]), toggleBlockSlot);

module.exports = router;
