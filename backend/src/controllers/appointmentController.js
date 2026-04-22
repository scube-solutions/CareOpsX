const supabase = require('../utils/supabase');
const { notifyBookingConfirmed, notifyBookingCancelled } = require('../utils/notify');

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
  const random = Math.floor(1000 + Math.random() * 9000);
  return `CX-${year}-${random}`;
};

/* ─────────────────────────────────────────
   SET DOCTOR AVAILABILITY
   POST /doctors/:id/availability
───────────────────────────────────────── */
const setAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { working_days, start_time, end_time, slot_duration } = req.body;

    if (!working_days || !start_time || !end_time || !slot_duration) {
      return res.status(400).json({ error: 'working_days, start_time, end_time and slot_duration are required' });
    }

    const { data, error } = await supabase
      .from('doctor_availability')
      .upsert({
        doctor_id     : id,
        working_days,        // array e.g. ["Monday","Tuesday","Wednesday"]
        start_time,          // e.g. "09:00"
        end_time,            // e.g. "17:00"
        slot_duration,       // minutes e.g. 15
        updated_at    : new Date().toISOString()
      }, { onConflict: 'doctor_id' })
      .select()
      .single();

    if (error) throw error;

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
    const { id } = req.params;

    const { data, error } = await supabase
      .from('doctor_availability')
      .select('*')
      .eq('doctor_id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

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
    const { doctor_id, date } = req.query;

    if (!doctor_id || !date) {
      return res.status(400).json({ error: 'doctor_id and date are required' });
    }

    // Get doctor availability config
    const { data: avail, error: availError } = await supabase
      .from('doctor_availability')
      .select('*')
      .eq('doctor_id', doctor_id)
      .single();

    if (availError || !avail) {
      return res.status(404).json({ error: 'Doctor availability not configured' });
    }

    // Check if selected date is a working day
    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    if (!avail.working_days.includes(dayName)) {
      return res.status(200).json({ slots: [], message: 'Doctor not available on this day' });
    }

    // Generate all slots for the day
    const slots    = [];
    const [startH, startM] = avail.start_time.split(':').map(Number);
    const [endH,   endM]   = avail.end_time.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins   = endH   * 60 + endM;

    for (let m = startMins; m < endMins; m += avail.slot_duration) {
      const hh   = String(Math.floor(m / 60)).padStart(2, '0');
      const mm   = String(m % 60).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }

    // Get already booked slots for this doctor on this date
    const { data: booked } = await supabase
      .from('appointments')
      .select('appointment_time')
      .eq('doctor_id', doctor_id)
      .eq('appointment_date', date)
      .in('status', ['booked', 'confirmed']);

    const bookedTimes = (booked || []).map(b => toHHMM(b.appointment_time));

    // Mark each slot as available or booked
    const result = slots.map(slot => ({
      time      : slot,
      available : !bookedTimes.includes(slot)
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
    let { patient_id, doctor_id, appointment_date, appointment_time, reason } = req.body;

    if (!patient_id || !doctor_id || !appointment_date || !appointment_time) {
      return res.status(400).json({ error: 'patient_id, doctor_id, appointment_date and appointment_time are required' });
    }

    // patient_id may be a users.id — resolve to patients.id
    const { data: patCheck } = await supabase.from('patients').select('id').eq('id', patient_id).maybeSingle();
    if (!patCheck) {
      const { data: patByUser } = await supabase.from('patients').select('id').eq('user_id', patient_id).maybeSingle();
      if (patByUser) {
        patient_id = patByUser.id;
      } else {
        // Auto-create patient record for this user
        const { data: userRec } = await supabase.from('users').select('first_name, last_name, phone, email').eq('id', patient_id).maybeSingle();
        const { data: newPat, error: patErr } = await supabase.from('patients').insert([{
          user_id:    patient_id,
          first_name: req.body.patient_name ? req.body.patient_name.split(' ')[0] : (userRec?.first_name || 'Patient'),
          last_name:  req.body.patient_name ? req.body.patient_name.split(' ').slice(1).join(' ') : (userRec?.last_name || ''),
          phone:      req.body.patient_phone || userRec?.phone || null,
          email:      userRec?.email || null,
          created_at: new Date().toISOString(),
        }]).select('id').single();
        if (patErr) return res.status(400).json({ error: 'Could not resolve patient record: ' + patErr.message });
        patient_id = newPat.id;
      }
    }

    // Check slot is still available
    const { data: existing } = await supabase
      .from('appointments')
      .select('id')
      .eq('doctor_id', doctor_id)
      .eq('appointment_date', appointment_date)
      .eq('appointment_time', toDbDateTime(appointment_date, appointment_time))
      .in('status', ['booked', 'confirmed'])
      .single();

    if (existing) {
      return res.status(409).json({ error: 'This slot is already booked. Please choose another.' });
    }

    const booking_id = generateBookingId();

    const { data, error } = await supabase
      .from('appointments')
      .insert([{
        patient_id,
        doctor_id,
        appointment_date,
        appointment_time: toDbDateTime(appointment_date, appointment_time),
        reason       : reason || null,
        booking_id,
        status       : 'booked',
        created_at   : new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    // Fire-and-forget notifications
    const [patientRes, doctorRes] = await Promise.all([
      supabase.from('patients').select('first_name, last_name, phone, email').eq('id', patient_id).single(),
      supabase.from('doctors').select('specialization, user_id').eq('id', doctor_id).single(),
    ]);

    const patientName = `${patientRes.data?.first_name || ''} ${patientRes.data?.last_name || ''}`.trim() || 'Patient';
    const patientPhone = patientRes.data?.phone || null;
    const patientEmail = patientRes.data?.email || null;
    const specialty = doctorRes.data?.specialization || 'General';

    let doctorName = 'Doctor';
    if (doctorRes.data?.user_id) {
      const { data: du } = await supabase.from('users').select('first_name, last_name').eq('id', doctorRes.data.user_id).single();
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
    const { date, doctor_id, status, date_from, date_to } = req.query;

    let query = supabase
      .from('appointments')
      .select('*')
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true });

    if (date)      query = query.eq('appointment_date', date);
    if (doctor_id) query = query.eq('doctor_id', doctor_id);
    if (status)    query = query.eq('status', status);
    if (date_from) query = query.gte('appointment_date', date_from);
    if (date_to)   query = query.lte('appointment_date', date_to);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];

    // Attach patients separately
    const patientIds = [...new Set(rows.map(a => a.patient_id).filter(Boolean))];
    const patientMap = {};
    if (patientIds.length) {
      const { data: patients } = await supabase.from('patients').select('id, first_name, last_name, phone, email').in('id', patientIds);
      (patients || []).forEach(p => { patientMap[p.id] = p; });
    }

    // Attach doctor names separately (avoid multiple-relationship join error)
    const doctorIds = [...new Set(rows.map(a => a.doctor_id).filter(Boolean))];
    const doctorMap = {};
    if (doctorIds.length) {
      const { data: doctors } = await supabase.from('doctors').select('id, user_id, specialization').in('id', doctorIds);
      const userIds = [...new Set((doctors || []).map(d => d.user_id).filter(Boolean))];
      const userMap = {};
      if (userIds.length) {
        const { data: users } = await supabase.from('users').select('id, first_name, last_name').in('id', userIds);
        (users || []).forEach(u => { userMap[u.id] = u; });
      }
      (doctors || []).forEach(d => {
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
    const { id }     = req.params;
    const { status } = req.body;

    const allowed = ['booked', 'confirmed', 'completed', 'cancelled', 'no_show'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` });
    }

    const { data: existingAppt, error: existingErr } = await supabase
      .from('appointments')
      .select('id, status, booking_id, appointment_date, appointment_time')
      .eq('id', id)
      .single();

    if (existingErr || !existingAppt) {
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

    const { data, error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (status === 'cancelled') {
      const { data: joined } = await supabase
        .from('appointments')
        .select(`
          booking_id,
          appointment_date,
          appointment_time,
          patients ( * ),
          doctors ( users ( first_name, last_name, name ) )
        `)
        .eq('id', id)
        .single();

      if (joined) {
        const doctorName =
          `${joined.doctors?.users?.first_name || ''} ${joined.doctors?.users?.last_name || ''}`.trim() ||
          joined.doctors?.users?.name ||
          'Doctor';

        notifyBookingCancelled({
          patientName:
            joined.patients?.name ||
            `${joined.patients?.first_name || ''} ${joined.patients?.last_name || ''}`.trim(),
          patientPhone: joined.patients?.phone,
          patientEmail: joined.patients?.email,
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
    const { id } = req.params;
    const { appointment_date, appointment_time } = req.body;

    if (!appointment_date || !appointment_time) {
      return res.status(400).json({ error: 'New appointment_date and appointment_time are required' });
    }

    // Check new slot is available
    const { data: existing } = await supabase
      .from('appointments')
      .select('id')
      .eq('doctor_id', req.body.doctor_id)
      .eq('appointment_date', appointment_date)
      .eq('appointment_time', toDbDateTime(appointment_date, appointment_time))
      .in('status', ['booked', 'confirmed'])
      .single();

    if (existing) {
      return res.status(409).json({ error: 'New slot is already booked. Please choose another.' });
    }

    const { data, error } = await supabase
      .from('appointments')
      .update({
        appointment_date,
        appointment_time: toDbDateTime(appointment_date, appointment_time),
        status: 'booked'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      message: 'Appointment rescheduled',
      data: { ...data, appointment_time: toHHMM(data.appointment_time) },
    });

  } catch (err) {
    console.error('Reschedule error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  setAvailability,
  getAvailability,
  getSlots,
  bookAppointment,
  getAppointments,
  updateStatus,
  rescheduleAppointment
};
