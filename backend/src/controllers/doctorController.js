const supabase = require('../utils/supabase');

const attachUsers = async (doctors) => {
  if (!doctors.length) return doctors;
  const userIds = [...new Set(doctors.map(d => d.user_id).filter(Boolean))];
  const { data: users } = await supabase.from('users').select('id, first_name, last_name, email, phone').in('id', userIds);
  const userMap = {};
  (users || []).forEach(u => { userMap[u.id] = u; });
  return doctors.map(d => ({ ...d, users: userMap[d.user_id] || null }));
};

// GET /doctors
const getDoctors = async (req, res) => {
  try {
    const { specialty } = req.query;
    let query = supabase.from('doctors').select('id, user_id, specialization, consultation_fee, experience_years, is_active');
    if (specialty) query = query.ilike('specialization', `%${specialty}%`);
    const { data, error } = await query;
    if (error) throw error;
    const doctors = await attachUsers(data || []);
    return res.status(200).json({ doctors });
  } catch (err) {
    console.error('getDoctors error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// GET /doctors/:id
const getDoctorById = async (req, res) => {
  try {
    const { data, error } = await supabase.from('doctors').select('id, user_id, specialization, consultation_fee, experience_years, is_active').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Doctor not found' });
    const [doctor] = await attachUsers([data]);
    return res.status(200).json({ doctor });
  } catch (err) {
    console.error('getDoctorById error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// POST /doctors
const createDoctor = async (req, res) => {
  try {
    const { user_id, specialization, consultation_fee, experience } = req.body;
    if (!user_id || !specialization || consultation_fee === undefined) {
      return res.status(400).json({ error: 'user_id, specialization, and consultation_fee are required' });
    }
    const { data: userRecord, error: userErr } = await supabase.from('users').select('id, role_id').eq('id', user_id).single();
    if (userErr || !userRecord) return res.status(404).json({ error: 'User not found' });
    if (userRecord.role_id !== 2) return res.status(400).json({ error: 'User must have doctor role (role_id=2)' });

    const { data, error } = await supabase.from('doctors').insert({ user_id, specialization, consultation_fee: Number(consultation_fee), experience_years: experience || null }).select('id, user_id, specialization, consultation_fee, experience_years').single();
    if (error) throw error;
    const [doctor] = await attachUsers([data]);
    return res.status(201).json({ message: 'Doctor created', doctor });
  } catch (err) {
    console.error('createDoctor error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// DELETE /doctors/:id
const deleteDoctor = async (req, res) => {
  try {
    const id = req.params.id;
    const { data: appts, error: apptErr } = await supabase
      .from('appointments')
      .select('id, appointment_date, appointment_time, status, patient_id')
      .eq('doctor_id', id)
      .not('status', 'in', '("cancelled","completed")');
    if (apptErr) throw apptErr;
    if (appts && appts.length > 0) {
      const patientIds = [...new Set(appts.map(a => a.patient_id).filter(Boolean))];
      const { data: patients } = await supabase.from('patients').select('id, user_id').in('id', patientIds);
      const userIds = (patients || []).map(p => p.user_id).filter(Boolean);
      const { data: users } = await supabase.from('users').select('id, first_name, last_name').in('id', userIds);
      const userMap = {};
      (users || []).forEach(u => { userMap[u.id] = u; });
      const patMap = {};
      (patients || []).forEach(p => { patMap[p.id] = userMap[p.user_id] || null; });
      const appointments = appts.map(a => ({
        id: a.id, appointment_date: a.appointment_date,
        appointment_time: a.appointment_time, status: a.status,
        patient_name: patMap[a.patient_id] ? `${patMap[a.patient_id].first_name} ${patMap[a.patient_id].last_name}` : 'Unknown Patient'
      }));
      return res.status(409).json({ error: 'Doctor has active appointments', appointments });
    }
    const { data: labOrders } = await supabase.from('lab_orders').select('id').eq('doctor_id', id);
    const loIds = (labOrders || []).map(l => l.id);
    if (loIds.length) await supabase.from('lab_results').delete().in('lab_order_id', loIds);
    await supabase.from('prescriptions').delete().eq('doctor_id', id);
    await supabase.from('lab_orders').delete().eq('doctor_id', id);
    await supabase.from('consultations').delete().eq('doctor_id', id);
    await supabase.from('follow_ups').delete().eq('doctor_id', id);
    await supabase.from('queue_tokens').delete().eq('doctor_id', id);
    await supabase.from('appointments').delete().eq('doctor_id', id);
    await supabase.from('doctor_leaves').delete().eq('doctor_id', id);
    await supabase.from('doctor_availability').delete().eq('doctor_id', id);
    await supabase.from('doctor_blocked_slots').delete().eq('doctor_id', id);
    const { error } = await supabase.from('doctors').delete().eq('id', id);
    if (error) throw error;
    return res.status(200).json({ message: 'Doctor deleted' });
  } catch (err) {
    console.error('deleteDoctor error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// GET /doctors/me/schedule?date=YYYY-MM-DD
const getDoctorSchedule = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required' });

    const { data: doctor } = await supabase.from('doctors').select('id').eq('user_id', req.user.id).single();
    if (!doctor) return res.status(404).json({ error: 'Doctor profile not found' });
    const doctor_id = doctor.id;

    const { data: avail } = await supabase.from('doctor_availability').select('*').eq('doctor_id', doctor_id).single();
    if (!avail) return res.status(200).json({ slots: [], message: 'Availability not configured' });

    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    if (!avail.working_days.includes(dayName)) {
      return res.status(200).json({ slots: [], message: `Not a working day (${dayName})` });
    }

    const [startH, startM] = avail.start_time.split(':').map(Number);
    const [endH, endM]     = avail.end_time.split(':').map(Number);
    const allTimes = [];
    for (let m = startH * 60 + startM; m < endH * 60 + endM; m += avail.slot_duration) {
      allTimes.push(`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`);
    }

    const { data: booked } = await supabase
      .from('appointments').select('appointment_time, patients(first_name, last_name)')
      .eq('doctor_id', doctor_id).eq('appointment_date', date).in('status', ['booked', 'confirmed']);

    const bookedMap = {};
    (booked || []).forEach(b => { bookedMap[String(b.appointment_time).slice(0,5)] = b.patients; });

    const { data: blocked } = await supabase
      .from('doctor_blocked_slots').select('blocked_time').eq('doctor_id', doctor_id).eq('blocked_date', date);
    const blockedSet = new Set((blocked || []).map(b => String(b.blocked_time).slice(0,5)));

    return res.json({
      slots: allTimes.map(time => ({
        time,
        status: bookedMap[time] ? 'booked' : blockedSet.has(time) ? 'blocked' : 'available',
        patient: bookedMap[time] || null,
      })),
      date, doctor_id, working_day: dayName,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /doctors/me/schedule/block  — body: { date, slot_time, action: 'block'|'unblock' }
const toggleBlockSlot = async (req, res) => {
  try {
    const { date, slot_time, action } = req.body;
    if (!date || !slot_time || !action) return res.status(400).json({ error: 'date, slot_time, action required' });

    const { data: doctor } = await supabase.from('doctors').select('id').eq('user_id', req.user.id).single();
    if (!doctor) return res.status(404).json({ error: 'Doctor profile not found' });

    if (action === 'block') {
      const { error } = await supabase.from('doctor_blocked_slots').upsert(
        { doctor_id: doctor.id, blocked_date: date, blocked_time: slot_time, created_by: req.user.id, created_at: new Date().toISOString() },
        { onConflict: 'doctor_id,blocked_date,blocked_time' }
      );
      if (error) throw error;
    } else {
      const { error } = await supabase.from('doctor_blocked_slots')
        .delete().eq('doctor_id', doctor.id).eq('blocked_date', date).eq('blocked_time', slot_time);
      if (error) throw error;
    }
    return res.json({ message: action === 'block' ? 'Slot blocked' : 'Slot unblocked', date, slot_time });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getDoctors, getDoctorById, createDoctor, deleteDoctor, getDoctorSchedule, toggleBlockSlot };
