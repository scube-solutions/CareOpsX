const crypto   = require('crypto');
const { notifyBookingConfirmed, notifyBookingCancelled } = require('../utils/notify');
const { getUserOrganizationId } = require('../utils/organizationAccess');

const toDbDateTime = (date, time) => {
  if (!date || !time) return null;
  const t = String(time).slice(0, 5);
  return `${date}T${t}:00.000Z`;
};

const toHHMM = (value) => {
  if (!value) return '';
  const str = String(value);
  if (/^\d{2}:\d{2}$/.test(str)) return str;
  const match = str.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : str.slice(0, 5);
};

/* ─────────────────────────────────────────
   GENERATE BOOKING ID  →  CX-2025-XXXX
───────────────────────────────────────── */
const generateBookingId = () => {
  const year   = new Date().getFullYear();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CX-${year}-${suffix}`;
};

/* ─────────────────────────────────────────
   SET DOCTOR AVAILABILITY
   POST /doctors/:id/availability
───────────────────────────────────────── */
const setAvailability = async (req, res) => {
  try {
    const db = req.db;
    const { id } = req.params;
    const { working_days, start_time, end_time, slot_duration } = req.body;

    if (!working_days || !start_time || !end_time || !slot_duration) {
      return res.status(400).json({ error: 'working_days, start_time, end_time and slot_duration are required' });
    }

    const result = await db.query(
      `INSERT INTO doctor_availability (doctor_id, working_days, start_time, end_time, slot_duration, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (doctor_id) 
       DO UPDATE SET working_days = EXCLUDED.working_days, start_time = EXCLUDED.start_time, 
                     end_time = EXCLUDED.end_time, slot_duration = EXCLUDED.slot_duration, 
                     updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [id, working_days, start_time, end_time, slot_duration, new Date().toISOString()]
    );
    const data = result.rows[0];

    return res.status(200).json({
      message : 'Availability updated successfully',
      data
    });

  } catch (err) {
    console.error('Set availability error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/* ─────────────────────────────────────────
   GET DOCTOR AVAILABILITY
   GET /doctors/:id/availability
───────────────────────────────────────── */
const getAvailability = async (req, res) => {
  try {
    const db = req.db;
    const { id } = req.params;

    const result = await db.query('SELECT * FROM doctor_availability WHERE doctor_id = $1 LIMIT 1', [id]);
    const data = result.rows[0];

    return res.status(200).json({ data: data || null });

  } catch (err) {
    console.error('Get availability error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/* ─────────────────────────────────────────
   GET AVAILABLE SLOTS
   GET /slots?doctor_id=&date=
───────────────────────────────────────── */
const getSlots = async (req, res) => {
  try {
    const db = req.db;
    const { doctor_id, date } = req.query;

    if (!doctor_id || !date) {
      return res.status(400).json({ error: 'doctor_id and date are required' });
    }

    const availResult = await db.query('SELECT * FROM doctor_availability WHERE doctor_id = $1 LIMIT 1', [doctor_id]);
    const avail = availResult.rows[0];

    if (!avail) {
      return res.status(404).json({ error: 'Doctor availability not configured' });
    }

    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    if (!avail.working_days.includes(dayName)) {
      return res.status(200).json({ slots: [], message: 'Doctor not available on this day' });
    }

    const slots = [];
    const [startH, startM] = avail.start_time.split(':').map(Number);
    const [endH,   endM]   = avail.end_time.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins   = endH   * 60 + endM;

    for (let m = startMins; m < endMins; m += avail.slot_duration) {
      const hh   = String(Math.floor(m / 60)).padStart(2, '0');
      const mm   = String(m % 60).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }

    const bookedResult = await db.query(
      `SELECT appointment_time FROM appointments 
       WHERE doctor_id = $1 AND appointment_date = $2 AND status IN ('booked', 'confirmed')`,
      [doctor_id, date]
    );
    const bookedTimes = new Set(bookedResult.rows.map(b => toHHMM(b.appointment_time)));

    const blockedResult = await db.query(
      'SELECT blocked_time FROM doctor_blocked_slots WHERE doctor_id = $1 AND blocked_date = $2',
      [doctor_id, date]
    );
    const blockedTimes = new Set(blockedResult.rows.map(b => String(b.blocked_time).slice(0, 5)));

    const result = slots.map(slot => ({
      time      : slot,
      available : !bookedTimes.has(slot) && !blockedTimes.has(slot)
    }));

    return res.status(200).json({ slots: result, date, doctor_id });

  } catch (err) {
    console.error('Get slots error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/* ─────────────────────────────────────────
   BOOK APPOINTMENT
   POST /appointments
───────────────────────────────────────── */
const bookAppointment = async (req, res) => {
  try {
    const db = req.db;
    let { patient_id, doctor_id, appointment_date, appointment_time, reason } = req.body;
    const organizationId = getUserOrganizationId(req);

    if (!patient_id || !doctor_id || !appointment_date || !appointment_time) {
      return res.status(400).json({ error: 'patient_id, doctor_id, appointment_date and appointment_time are required' });
    }

    const patCheckResult = await db.query('SELECT id FROM patients WHERE id = $1 LIMIT 1', [patient_id]);
    let patCheck = patCheckResult.rows[0];
    if (!patCheck) {
      const patByUserResult = await db.query('SELECT id FROM patients WHERE user_id = $1 LIMIT 1', [patient_id]);
      const patByUser = patByUserResult.rows[0];
      if (patByUser) {
        patient_id = patByUser.id;
      } else {
        const userRecResult = await db.query('SELECT first_name, last_name, phone, email FROM users WHERE id = $1 LIMIT 1', [patient_id]);
        const userRec = userRecResult.rows[0];
        
        const firstName = req.body.patient_name ? req.body.patient_name.split(' ')[0] : (userRec?.first_name || 'Patient');
        const lastName = req.body.patient_name ? req.body.patient_name.split(' ').slice(1).join(' ') : (userRec?.last_name || '');
        const phone = req.body.patient_phone || userRec?.phone || null;
        const email = userRec?.email || null;

        const newPatResult = await db.query(
          `INSERT INTO patients (user_id, first_name, last_name, phone, email, organization_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [patient_id, firstName, lastName, phone, email, organizationId || null, new Date().toISOString()]
        );
        patient_id = newPatResult.rows[0].id;
      }
    }

    const dbDateTime = toDbDateTime(appointment_date, appointment_time);
    const existingResult = await db.query(
      `SELECT id FROM appointments 
       WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3 AND status IN ('booked', 'confirmed') 
       LIMIT 1`,
      [doctor_id, appointment_date, dbDateTime]
    );
    if (existingResult.rows[0]) {
      return res.status(409).json({ error: 'This slot is already booked. Please choose another.' });
    }

    const booking_id = generateBookingId();

    const countResult = await db.query(
      `SELECT COUNT(*)::int FROM appointments 
       WHERE doctor_id = $1 AND appointment_date = $2 AND status IN ('booked', 'confirmed')`,
      [doctor_id, appointment_date]
    );
    const token_number = (countResult.rows[0].count || 0) + 1;

    let data;
    try {
      const insertResult = await db.query(
        `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, booking_id, token_number, status, organization_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          patient_id,
          doctor_id,
          appointment_date,
          dbDateTime,
          reason || null,
          booking_id,
          token_number,
          'booked',
          organizationId || null,
          new Date().toISOString()
        ]
      );
      data = insertResult.rows[0];
    } catch (insertErr) {
      if (insertErr.code === '23505') {
        return res.status(409).json({ error: 'This slot is already booked. Please choose another.' });
      }
      throw insertErr;
    }

    const [patientRes, doctorRes] = await Promise.all([
      db.query('SELECT first_name, last_name, phone, email FROM patients WHERE id = $1 LIMIT 1', [patient_id]),
      db.query('SELECT specialization, user_id FROM doctors WHERE id = $1 LIMIT 1', [doctor_id])
    ]);

    const patient = patientRes.rows[0];
    const doctor = doctorRes.rows[0];

    const patientName = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() || 'Patient';
    const patientPhone = patient?.phone || null;
    const patientEmail = patient?.email || null;
    const specialty = doctor?.specialization || 'General';

    let doctorName = 'Doctor';
    if (doctor?.user_id) {
      const userRes = await db.query('SELECT first_name, last_name FROM users WHERE id = $1 LIMIT 1', [doctor.user_id]);
      const du = userRes.rows[0];
      if (du) doctorName = `${du.first_name || ''} ${du.last_name || ''}`.trim() || 'Doctor';
    }

    notifyBookingConfirmed({
      patientName,
      patientPhone,
      patientEmail,
      doctorName,
      specialty,
      date: appointment_date,
      time: appointment_time,
      bookingId: data.booking_id,
    });

    return res.status(201).json({
      message    : 'Appointment booked successfully',
      booking_id : data.booking_id,
      data
    });

  } catch (err) {
    console.error('Book appointment error:', err.message);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
};

/* ─────────────────────────────────────────
   GET ALL APPOINTMENTS
   GET /appointments
───────────────────────────────────────── */
const getAppointments = async (req, res) => {
  try {
    const db = req.db;
    const { date, doctor_id, status, date_from, date_to } = req.query;
    const limit  = Math.min(Number(req.query.limit)  || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const organizationId = getUserOrganizationId(req);

    const userRoles = Array.isArray(req.user.roles) && req.user.roles.length
      ? req.user.roles : [req.user.role_id];
    const isAdmin   = userRoles.includes(1);
    const isDoctor  = userRoles.includes(2) && !isAdmin;
    const isPatient = userRoles.includes(3) && !isAdmin;

    let queryText = 'SELECT * FROM appointments';
    const conditions = [];
    const params = [];

    if (organizationId) {
      params.push(organizationId);
      conditions.push(`organization_id = $${params.length}`);
    }

    if (isPatient) {
      const patResult = await db.query('SELECT id FROM patients WHERE user_id = $1 LIMIT 1', [req.user.id]);
      const patRec = patResult.rows[0];
      if (!patRec) return res.status(404).json({ error: 'Patient profile not found' });
      
      params.push(patRec.id);
      conditions.push(`patient_id = $${params.length}`);
    }

    if (isDoctor) {
      const docResult = await db.query('SELECT id FROM doctors WHERE user_id = $1 LIMIT 1', [req.user.id]);
      const docRec = docResult.rows[0];
      if (docRec) {
        params.push(docRec.id);
        conditions.push(`doctor_id = $${params.length}`);
      }
    }

    if (date) {
      params.push(date);
      conditions.push(`appointment_date = $${params.length}`);
    }
    if (doctor_id && !isDoctor) {
      params.push(doctor_id);
      conditions.push(`doctor_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (date_from) {
      params.push(date_from);
      conditions.push(`appointment_date >= $${params.length}`);
    }
    if (date_to) {
      params.push(date_to);
      conditions.push(`appointment_date <= $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY appointment_date ASC, appointment_time ASC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await db.query(queryText, params);
    const rows = result.rows || [];

    const patientIds = [...new Set(rows.map(a => a.patient_id).filter(Boolean))];
    const patientMap = {};
    if (patientIds.length) {
      const patientsResult = await db.query('SELECT id, first_name, last_name, phone, email FROM patients WHERE id = ANY($1)', [patientIds]);
      patientsResult.rows.forEach(p => { patientMap[p.id] = p; });
    }

    const doctorIds = [...new Set(rows.map(a => a.doctor_id).filter(Boolean))];
    const doctorMap = {};
    if (doctorIds.length) {
      const doctorsResult = await db.query('SELECT id, user_id, specialization FROM doctors WHERE id = ANY($1)', [doctorIds]);
      const userIds = [...new Set((doctorsResult.rows || []).map(d => d.user_id).filter(Boolean))];
      const userMap = {};
      if (userIds.length) {
        const usersResult = await db.query('SELECT id, first_name, last_name FROM users WHERE id = ANY($1)', [userIds]);
        usersResult.rows.forEach(u => { userMap[u.id] = u; });
      }
      doctorsResult.rows.forEach(d => {
        doctorMap[d.id] = { specialization: d.specialization, users: userMap[d.user_id] || null };
      });
    }

    return res.status(200).json({
      data: rows.map(a => ({
        ...a,
        appointment_time: toHHMM(a.appointment_time),
        patients: patientMap[a.patient_id] || null,
        doctors:  doctorMap[a.doctor_id]  || null,
      })),
    });

  } catch (err) {
    console.error('Get appointments error:', err.message);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
};

/* ─────────────────────────────────────────
   UPDATE APPOINTMENT STATUS
   PATCH /appointments/:id/status
───────────────────────────────────────── */
const updateStatus = async (req, res) => {
  try {
    const db = req.db;
    const { id }     = req.params;
    const { status } = req.body;
    const organizationId = getUserOrganizationId(req);

    const allowed = ['booked', 'confirmed', 'completed', 'cancelled', 'no_show'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` });
    }

    let existingQueryText = 'SELECT id, status, booking_id, appointment_date, appointment_time FROM appointments WHERE id = $1';
    const params = [id];
    if (organizationId) {
      params.push(organizationId);
      existingQueryText += ' AND organization_id = $2';
    }
    existingQueryText += ' LIMIT 1';

    const existingResult = await db.query(existingQueryText, params);
    const existingAppt = existingResult.rows[0];

    if (!existingAppt) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const transitions = {
      booked: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'cancelled', 'no_show'],
      completed: [],
      cancelled: [],
      no_show: [],
    };

    if (existingAppt.status !== status && !transitions[existingAppt.status].includes(status)) {
      return res.status(400).json({
        error: `Invalid transition from ${existingAppt.status} to ${status}`,
      });
    }

    const updateResult = await db.query(
      'UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    const data = updateResult.rows[0];

    if (status === 'cancelled') {
      const joinedResult = await db.query(
        `SELECT a.booking_id, a.appointment_date, a.appointment_time,
                p.first_name as pat_first_name, p.last_name as pat_last_name, p.phone as pat_phone, p.email as pat_email,
                u.first_name as doc_first_name, u.last_name as doc_last_name
         FROM appointments a
         LEFT JOIN patients p ON a.patient_id = p.id
         LEFT JOIN doctors d ON a.doctor_id = d.id
         LEFT JOIN users u ON d.user_id = u.id
         WHERE a.id = $1 LIMIT 1`,
        [id]
      );
      const joined = joinedResult.rows[0];

      if (joined) {
        const doctorName = `${joined.doc_first_name || ''} ${joined.doc_last_name || ''}`.trim() || 'Doctor';
        const patientName = `${joined.pat_first_name || ''} ${joined.pat_last_name || ''}`.trim() || 'Patient';

        notifyBookingCancelled({
          patientName,
          patientPhone: joined.pat_phone,
          patientEmail: joined.pat_email,
          doctorName,
          date: joined.appointment_date,
          time: toHHMM(joined.appointment_time),
          bookingId: joined.booking_id,
        });
      }
    }

    return res.status(200).json({ message: 'Status updated', data });

  } catch (err) {
    console.error('Update status error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/* ─────────────────────────────────────────
   RESCHEDULE APPOINTMENT
   PUT /appointments/:id
───────────────────────────────────────── */
const rescheduleAppointment = async (req, res) => {
  try {
    const db = req.db;
    const { id } = req.params;
    const { appointment_date, appointment_time } = req.body;

    if (!appointment_date || !appointment_time) {
      return res.status(400).json({ error: 'New appointment_date and appointment_time are required' });
    }

    const dbDateTime = toDbDateTime(appointment_date, appointment_time);
    const existingResult = await db.query(
      `SELECT id FROM appointments 
       WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3 AND status IN ('booked', 'confirmed')
       LIMIT 1`,
      [req.body.doctor_id, appointment_date, dbDateTime]
    );

    if (existingResult.rows[0]) {
      return res.status(409).json({ error: 'New slot is already booked. Please choose another.' });
    }

    const result = await db.query(
      `UPDATE appointments SET appointment_date = $1, appointment_time = $2, status = 'booked' 
       WHERE id = $3 
       RETURNING *`,
      [appointment_date, dbDateTime, id]
    );
    const data = result.rows[0];
    if (!data) return res.status(404).json({ error: 'Appointment not found' });

    return res.status(200).json({
      message: 'Appointment rescheduled',
      data: { ...data, appointment_time: toHHMM(data.appointment_time) },
    });

  } catch (err) {
    console.error('Reschedule error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/* ─────────────────────────────────────────
   GET SINGLE APPOINTMENT WITH VISIT DETAILS
   GET /appointments/:id
───────────────────────────────────────── */
const getAppointmentById = async (req, res) => {
  try {
    const db = req.db;
    const { id } = req.params;
    const organizationId = getUserOrganizationId(req);
    
    let apptQuery = 'SELECT * FROM appointments WHERE id = $1';
    const params = [id];
    if (organizationId) {
      params.push(organizationId);
      apptQuery += ' AND organization_id = $2';
    }
    apptQuery += ' LIMIT 1';

    const apptResult = await db.query(apptQuery, params);
    const data = apptResult.rows[0];

    if (!data) return res.status(404).json({ error: 'Appointment not found' });

    const patientResult = data.patient_id
      ? await db.query('SELECT id, first_name, last_name, phone, email, patient_uid FROM patients WHERE id = $1 LIMIT 1', [data.patient_id])
      : { rows: [] };
    const patient = patientResult.rows[0];

    const doctorResult = data.doctor_id
      ? await db.query('SELECT id, user_id, specialization FROM doctors WHERE id = $1 LIMIT 1', [data.doctor_id])
      : { rows: [] };
    const doctor = doctorResult.rows[0];

    let doctorUser = null;
    if (doctor?.user_id) {
      const userResult = await db.query('SELECT first_name, last_name FROM users WHERE id = $1 LIMIT 1', [doctor.user_id]);
      doctorUser = userResult.rows[0];
    }

    let consultation = null;
    let prescriptions = [];
    let labOrders = [];

    if (data.consultation_id) {
      const consultResult = await db.query('SELECT * FROM consultations WHERE id = $1 LIMIT 1', [data.consultation_id]);
      consultation = consultResult.rows[0];
      
      if (consultation) {
        const [presRes, labRes] = await Promise.all([
          db.query('SELECT * FROM prescriptions WHERE consultation_id = $1', [data.consultation_id]),
          db.query('SELECT * FROM lab_orders WHERE consultation_id = $1', [data.consultation_id])
        ]);
        
        prescriptions = presRes.rows || [];
        labOrders = labRes.rows || [];
        
        if (prescriptions.length > 0) {
          const prescIds = prescriptions.map(p => p.id);
          const itemsResult = await db.query('SELECT * FROM prescription_items WHERE prescription_id = ANY($1)', [prescIds]);
          const itemsMap = {};
          itemsResult.rows.forEach(item => {
            if (!itemsMap[item.prescription_id]) itemsMap[item.prescription_id] = [];
            itemsMap[item.prescription_id].push(item);
          });
          prescriptions = prescriptions.map(p => ({ ...p, prescription_items: itemsMap[p.id] || [] }));
        }

        if (labOrders.length > 0) {
          const orderIds = labOrders.map(o => o.id);
          const reportsResult = await db.query('SELECT * FROM lab_reports WHERE lab_order_id = ANY($1)', [orderIds]);
          const reportsMap = {};
          reportsResult.rows.forEach(report => {
            if (!reportsMap[report.lab_order_id]) reportsMap[report.lab_order_id] = [];
            reportsMap[report.lab_order_id].push(report);
          });
          labOrders = labOrders.map(o => ({ ...o, lab_reports: reportsMap[o.id] || [] }));
        }
      }
    }

    return res.json({
      appointment: {
        ...data,
        appointment_time: toHHMM(data.appointment_time),
        patients: patient || null,
        doctors: { specialization: doctor?.specialization, users: doctorUser }
      },
      consultation,
      prescriptions,
      lab_orders: labOrders
    });
  } catch (err) {
    console.error('Get appointment by id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  setAvailability,
  getAvailability,
  getSlots,
  bookAppointment,
  getAppointments,
  getAppointmentById,
  updateStatus,
  rescheduleAppointment
};
