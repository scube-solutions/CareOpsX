const { auditLog } = require('../middlewares/audit');

// Full ordered cascade delete — keeps FK intact, deletes deps first
const hardDeleteDoctor = async (db, doctorId) => {
  // Collect all appointment IDs for this doctor
  const apptsResult = await db.query('SELECT id FROM appointments WHERE doctor_id = $1', [doctorId]);
  const apptIds = apptsResult.rows.map(a => a.id);

  // Collect all consultation IDs (by doctor_id + by appointment)
  const consultIdSet = new Set();
  const doctorConsultsResult = await db.query('SELECT id FROM consultations WHERE doctor_id = $1', [doctorId]);
  doctorConsultsResult.rows.forEach(c => consultIdSet.add(c.id));
  if (apptIds.length) {
    const apptConsultsResult = await db.query('SELECT id FROM consultations WHERE appointment_id = ANY($1)', [apptIds]);
    apptConsultsResult.rows.forEach(c => consultIdSet.add(c.id));
  }
  const consultIds = [...consultIdSet];

  // Collect all prescription IDs (by doctor_id + by consultation + by appointment)
  const prescIdSet = new Set();
  const doctorPrescsResult = await db.query('SELECT id FROM prescriptions WHERE doctor_id = $1', [doctorId]);
  doctorPrescsResult.rows.forEach(p => prescIdSet.add(p.id));
  if (consultIds.length) {
    const cPrescsResult = await db.query('SELECT id FROM prescriptions WHERE consultation_id = ANY($1)', [consultIds]);
    cPrescsResult.rows.forEach(p => prescIdSet.add(p.id));
  }
  if (apptIds.length) {
    const aPrescsResult = await db.query('SELECT id FROM prescriptions WHERE appointment_id = ANY($1)', [apptIds]);
    aPrescsResult.rows.forEach(p => prescIdSet.add(p.id));
  }
  const prescIds = [...prescIdSet];

  // Collect all lab order IDs
  const loIdSet = new Set();
  const doctorLosResult = await db.query('SELECT id FROM lab_orders WHERE doctor_id = $1', [doctorId]);
  doctorLosResult.rows.forEach(l => loIdSet.add(l.id));
  if (consultIds.length) {
    const cLosResult = await db.query('SELECT id FROM lab_orders WHERE consultation_id = ANY($1)', [consultIds]);
    cLosResult.rows.forEach(l => loIdSet.add(l.id));
  }
  if (apptIds.length) {
    const aLosResult = await db.query('SELECT id FROM lab_orders WHERE appointment_id = ANY($1)', [apptIds]);
    aLosResult.rows.forEach(l => loIdSet.add(l.id));
  }
  const loIds = [...loIdSet];

  // Collect pharmacy invoice IDs linked to this doctor's consultations or prescriptions
  const phInvIdSet = new Set();
  if (consultIds.length) {
    const cInvsResult = await db.query('SELECT id FROM pharmacy_invoices WHERE consultation_id = ANY($1)', [consultIds]);
    cInvsResult.rows.forEach(i => phInvIdSet.add(i.id));
  }
  if (prescIds.length) {
    const pInvsResult = await db.query('SELECT id FROM pharmacy_invoices WHERE prescription_id = ANY($1)', [prescIds]);
    pInvsResult.rows.forEach(i => phInvIdSet.add(i.id));
  }
  const phInvIds = [...phInvIdSet];

  // Step 1: prescription_items (FK → prescriptions)
  if (prescIds.length) await db.query('DELETE FROM prescription_items WHERE prescription_id = ANY($1)', [prescIds]);

  // Step 2: pharmacy_invoice_items then pharmacy_invoices (FK → consultations/prescriptions)
  if (phInvIds.length) await db.query('DELETE FROM pharmacy_invoice_items WHERE pharmacy_invoice_id = ANY($1)', [phInvIds]);
  if (phInvIds.length) await db.query('DELETE FROM pharmacy_invoices WHERE id = ANY($1)', [phInvIds]);

  // Step 3: lab_results (FK → lab_orders / appointments)
  if (loIds.length)   await db.query('DELETE FROM lab_results WHERE lab_order_id = ANY($1)', [loIds]);
  if (apptIds.length) await db.query('DELETE FROM lab_results WHERE appointment_id = ANY($1)', [apptIds]);
  await db.query('DELETE FROM lab_results WHERE doctor_id = $1', [doctorId]);

  // Step 4: queue_tokens (FK → appointments)
  if (apptIds.length) await db.query('DELETE FROM queue_tokens WHERE appointment_id = ANY($1)', [apptIds]);
  await db.query('DELETE FROM queue_tokens WHERE doctor_id = $1', [doctorId]);

  // Step 5: prescriptions (FK → consultations)
  if (prescIds.length) await db.query('DELETE FROM prescriptions WHERE id = ANY($1)', [prescIds]);

  // Step 6: lab_orders (FK → consultations)
  if (loIds.length) await db.query('DELETE FROM lab_orders WHERE id = ANY($1)', [loIds]);

  // Step 7: NULL appointments.consultation_id to break circular FK before deleting consultations
  if (apptIds.length) await db.query('UPDATE appointments SET consultation_id = NULL WHERE id = ANY($1)', [apptIds]);

  // Step 8: consultations (FK → appointments, now safe)
  if (consultIds.length) await db.query('DELETE FROM consultations WHERE id = ANY($1)', [consultIds]);

  // Step 8: follow_ups
  await db.query('DELETE FROM follow_ups WHERE doctor_id = $1', [doctorId]);

  // Step 9: appointments
  await db.query('DELETE FROM appointments WHERE doctor_id = $1', [doctorId]);

  // Step 10: doctor config tables
  await db.query('DELETE FROM doctor_leaves WHERE doctor_id = $1', [doctorId]);
  await db.query('DELETE FROM doctor_availability WHERE doctor_id = $1', [doctorId]);
  await db.query('DELETE FROM doctor_blocked_slots WHERE doctor_id = $1', [doctorId]);

  // Step 11: finally delete doctor
  await db.query('DELETE FROM doctors WHERE id = $1', [doctorId]);
};

const attachUsers = async (doctors, db) => {
  if (!doctors.length) return doctors;
  const userIds = [...new Set(doctors.map(d => d.user_id).filter(Boolean))];
  
  const result = await db.query(
    'SELECT id, first_name, last_name, email, phone FROM users WHERE id = ANY($1)',
    [userIds]
  );
  
  const userMap = {};
  result.rows.forEach(u => { userMap[u.id] = u; });
  return doctors.map(d => ({ ...d, users: userMap[d.user_id] || null }));
};

// GET /doctors
const getDoctors = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const { specialty } = req.query;
    
    let queryText = 'SELECT id, user_id, specialization, consultation_fee, experience_years, is_active, organization_id FROM doctors';
    const conditions = [];
    const params = [];

    if (organizationId) {
      params.push(organizationId);
      conditions.push(`organization_id = $${params.length}`);
    }
    if (specialty) {
      params.push(`%${specialty}%`);
      conditions.push(`specialization ILIKE $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    const result = await db.query(queryText, params);
    const doctors = await attachUsers(result.rows || [], db);
    return res.status(200).json({ doctors });
  } catch (err) {
    console.error('getDoctors error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// GET /doctors/:id
const getDoctorById = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    let queryText = 'SELECT id, user_id, specialization, consultation_fee, experience_years, is_active, organization_id FROM doctors WHERE id = $1';
    const params = [req.params.id];
    if (organizationId) {
      params.push(organizationId);
      queryText += ' AND organization_id = $2';
    }
    queryText += ' LIMIT 1';

    const result = await db.query(queryText, params);
    const data = result.rows[0];
    if (!data) return res.status(404).json({ error: 'Doctor not found' });
    const [doctor] = await attachUsers([data], db);
    return res.status(200).json({ doctor });
  } catch (err) {
    console.error('getDoctorById error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// POST /doctors
const createDoctor = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const { user_id, specialization, consultation_fee, experience } = req.body;
    if (!user_id || !specialization || consultation_fee === undefined) {
      return res.status(400).json({ error: 'user_id, specialization, and consultation_fee are required' });
    }
    
    // User must belong to the same org
    let userQuery = 'SELECT id, role_id, organization_id FROM users WHERE id = $1';
    const userParams = [user_id];
    if (organizationId) {
      userParams.push(organizationId);
      userQuery += ' AND organization_id = $2';
    }
    userQuery += ' LIMIT 1';

    const userResult = await db.query(userQuery, userParams);
    const userRecord = userResult.rows[0];
    if (!userRecord) return res.status(404).json({ error: 'User not found in this organization' });
    if (userRecord.role_id !== 2) return res.status(400).json({ error: 'User must have doctor role (role_id=2)' });

    const insertResult = await db.query(
      `INSERT INTO doctors (user_id, specialization, consultation_fee, experience_years, organization_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, specialization, consultation_fee, experience_years`,
      [user_id, specialization, Number(consultation_fee), experience || null, organizationId]
    );
    const data = insertResult.rows[0];
    const [doctor] = await attachUsers([data], db);
    return res.status(201).json({ message: 'Doctor created', doctor });
  } catch (err) {
    console.error('createDoctor error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// PUT /doctors/:id
const updateDoctor = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const { id } = req.params;
    const { first_name, last_name, email, phone, specialization, consultation_fee, experience_years } = req.body;

    let docQuery = 'SELECT id, user_id, organization_id FROM doctors WHERE id = $1';
    const docParams = [id];
    if (organizationId) {
      docParams.push(organizationId);
      docQuery += ' AND organization_id = $2';
    }
    docQuery += ' LIMIT 1';

    const docResult = await db.query(docQuery, docParams);
    const doctor = docResult.rows[0];
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    const userPayload = {};
    if (first_name !== undefined) userPayload.first_name = first_name;
    if (last_name !== undefined) userPayload.last_name = last_name;
    if (email !== undefined) userPayload.email = email;
    if (phone !== undefined) userPayload.phone = phone || null;

    if (Object.keys(userPayload).length > 0) {
      const userKeys = Object.keys(userPayload);
      const userValues = Object.values(userPayload);
      const userSetClause = userKeys.map((key, idx) => `${key} = $${idx + 1}`).join(', ');
      await db.query(`UPDATE users SET ${userSetClause} WHERE id = $${userKeys.length + 1}`, [...userValues, doctor.user_id]);
    }

    const doctorPayload = {};
    if (specialization !== undefined) doctorPayload.specialization = specialization;
    if (consultation_fee !== undefined) doctorPayload.consultation_fee = Number(consultation_fee);
    if (experience_years !== undefined) doctorPayload.experience_years = experience_years !== '' ? Number(experience_years) : null;

    if (Object.keys(doctorPayload).length > 0) {
      const docKeys = Object.keys(doctorPayload);
      const docValues = Object.values(doctorPayload);
      const docSetClause = docKeys.map((key, idx) => `${key} = $${idx + 1}`).join(', ');
      await db.query(`UPDATE doctors SET ${docSetClause} WHERE id = $${docKeys.length + 1}`, [...docValues, id]);
    }

    const finalResult = await db.query('SELECT id, user_id, specialization, consultation_fee, experience_years, is_active FROM doctors WHERE id = $1 LIMIT 1', [id]);
    const updated = finalResult.rows[0];
    const [result] = await attachUsers([updated], db);
    return res.status(200).json({ message: 'Doctor updated', doctor: result });
  } catch (err) {
    console.error('updateDoctor error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// DELETE /doctors/:id
const deleteDoctor = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const id = req.params.id;

    // Verify the doctor belongs to this org before any delete work
    let docQuery = 'SELECT id, organization_id FROM doctors WHERE id = $1';
    const docParams = [id];
    if (organizationId) {
      docParams.push(organizationId);
      docQuery += ' AND organization_id = $2';
    }
    docQuery += ' LIMIT 1';
    const docResult = await db.query(docQuery, docParams);
    const docRow = docResult.rows[0];
    if (!docRow) return res.status(404).json({ error: 'Doctor not found' });

    // Check if there are active appointments (status not in cancelled or completed)
    const apptsResult = await db.query(
      "SELECT id, appointment_date, appointment_time, status, patient_id FROM appointments WHERE doctor_id = $1 AND status NOT IN ('cancelled', 'completed')",
      [id]
    );
    const appts = apptsResult.rows;

    if (appts && appts.length > 0) {
      const patientIds = [...new Set(appts.map(a => a.patient_id).filter(Boolean))];
      const patientsResult = await db.query('SELECT id, user_id FROM patients WHERE id = ANY($1)', [patientIds]);
      const userIds = patientsResult.rows.map(p => p.user_id).filter(Boolean);
      
      const usersResult = await db.query('SELECT id, first_name, last_name FROM users WHERE id = ANY($1)', [userIds]);
      const userMap = {};
      usersResult.rows.forEach(u => { userMap[u.id] = u; });
      
      const patMap = {};
      patientsResult.rows.forEach(p => { patMap[p.id] = userMap[p.user_id] || null; });
      
      const appointments = appts.map(a => ({
        id: a.id, appointment_date: a.appointment_date,
        appointment_time: a.appointment_time, status: a.status,
        patient_name: patMap[a.patient_id] ? `${patMap[a.patient_id].first_name} ${patMap[a.patient_id].last_name}` : 'Unknown Patient'
      }));
      return res.status(409).json({ error: 'Doctor has active appointments', appointments });
    }
    
    await hardDeleteDoctor(db, id);
    return res.status(200).json({ message: 'Doctor deleted' });
  } catch (err) {
    console.error('deleteDoctor error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// GET /doctors/me/schedule?date=YYYY-MM-DD
const getDoctorSchedule = async (req, res) => {
  try {
    const db = req.db;
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required' });

    const docResult = await db.query('SELECT id FROM doctors WHERE user_id = $1 LIMIT 1', [req.user.id]);
    const doctor = docResult.rows[0];
    if (!doctor) return res.status(404).json({ error: 'Doctor profile not found' });
    const doctor_id = doctor.id;

    const availResult = await db.query('SELECT * FROM doctor_availability WHERE doctor_id = $1 LIMIT 1', [doctor_id]);
    const avail = availResult.rows[0];
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

    const bookedResult = await db.query(
      `SELECT a.appointment_time, p.first_name, p.last_name 
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       WHERE a.doctor_id = $1 AND a.appointment_date = $2 AND a.status IN ('booked', 'confirmed')`,
      [doctor_id, date]
    );

    const bookedMap = {};
    bookedResult.rows.forEach(b => {
      bookedMap[String(b.appointment_time).slice(0,5)] = { first_name: b.first_name, last_name: b.last_name };
    });

    const blockedResult = await db.query(
      'SELECT blocked_time FROM doctor_blocked_slots WHERE doctor_id = $1 AND blocked_date = $2',
      [doctor_id, date]
    );
    const blockedSet = new Set(blockedResult.rows.map(b => String(b.blocked_time).slice(0,5)));

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
    const db = req.db;
    const { date, slot_time, action } = req.body;
    if (!date || !slot_time || !action) return res.status(400).json({ error: 'date, slot_time, action required' });

    const docResult = await db.query('SELECT id FROM doctors WHERE user_id = $1 LIMIT 1', [req.user.id]);
    const doctor = docResult.rows[0];
    if (!doctor) return res.status(404).json({ error: 'Doctor profile not found' });

    if (action === 'block') {
      await db.query(
        `INSERT INTO doctor_blocked_slots (doctor_id, blocked_date, blocked_time, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (doctor_id, blocked_date, blocked_time) 
         DO UPDATE SET created_by = EXCLUDED.created_by, created_at = EXCLUDED.created_at`,
        [doctor.id, date, slot_time, req.user.id, new Date().toISOString()]
      );
    } else {
      await db.query(
        'DELETE FROM doctor_blocked_slots WHERE doctor_id = $1 AND blocked_date = $2 AND blocked_time = $3',
        [doctor.id, date, slot_time]
      );
    }
    return res.json({ message: action === 'block' ? 'Slot blocked' : 'Slot unblocked', date, slot_time });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getDoctors, getDoctorById, createDoctor, updateDoctor, deleteDoctor, getDoctorSchedule, toggleBlockSlot };
