const supabase = require('../utils/supabase');
const { auditLog } = require('../middlewares/audit');

// ── Helpers ───────────────────────────────────────────────────────────────────
const attachRelated = async (rows) => {
  if (!rows.length) return rows;

  // Patients
  const patientIds = [...new Set(rows.map(r => r.patient_id).filter(Boolean))];
  const patientMap = {};
  if (patientIds.length) {
    const { data } = await supabase.from('patients').select('id, first_name, last_name, patient_uid, phone, chronic_disease_tag').in('id', patientIds);
    (data || []).forEach(p => { patientMap[p.id] = p; });
  }

  // Doctors → users
  const doctorIds = [...new Set(rows.map(r => r.doctor_id).filter(Boolean))];
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

  return rows.map(r => ({
    ...r,
    patients: patientMap[r.patient_id] || null,
    doctors:  doctorMap[r.doctor_id]  || null,
  }));
};

// ── Get Follow-up Plans ───────────────────────────────────────────────────────
const getFollowUps = async (req, res) => {
  try {
    const { patient_id, status, doctor_id, date_from, date_to, missed_only } = req.query;
    let query = supabase.from('follow_up_plans')
      .select('*')
      .order('follow_up_date', { ascending: true });

    if (patient_id)        query = query.eq('patient_id', patient_id);
    if (status)            query = query.eq('status', status);
    if (doctor_id)         query = query.eq('doctor_id', doctor_id);
    if (date_from)         query = query.gte('follow_up_date', date_from);
    if (date_to)           query = query.lte('follow_up_date', date_to);
    if (missed_only === 'true') query = query.eq('status', 'missed');

    const { data, error } = await query;
    if (error) throw error;
    const follow_ups = await attachRelated(data || []);
    return res.json({ follow_ups });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Single Follow-up ──────────────────────────────────────────────────────
const getFollowUpById = async (req, res) => {
  try {
    const { data, error } = await supabase.from('follow_up_plans')
      .select('*')
      .eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Follow-up not found' });
    const [follow_up] = await attachRelated([data]);
    return res.json({ follow_up });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Create Follow-up Plan ─────────────────────────────────────────────────────
const createFollowUp = async (req, res) => {
  try {
    const { patient_id, doctor_id, consultation_id, follow_up_date, required_tests, medication_refill, notes, disease_tag } = req.body;
    if (!patient_id || !follow_up_date) return res.status(400).json({ error: 'patient_id and follow_up_date are required' });

    const { data, error } = await supabase.from('follow_up_plans').insert([{
      patient_id,
      doctor_id: doctor_id || null,
      consultation_id: consultation_id || null,
      follow_up_date,
      required_tests: required_tests || null,
      medication_refill: medication_refill || false,
      notes: notes || null,
      disease_tag: disease_tag || null,
      status: 'scheduled',
      reminder_sent: false,
      created_by: req.user.id,
      created_at: new Date().toISOString()
    }]).select('*').single();

    if (error) throw error;

    if (disease_tag) {
      await supabase.from('patients').update({ chronic_disease_tag: disease_tag, updated_by: req.user.id }).eq('id', patient_id);
    }

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'CREATE_FOLLOWUP', module: 'FollowUp', entity_type: 'follow_up_plan', entity_id: data.id });
    return res.status(201).json({ message: 'Follow-up plan created', follow_up: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Update Follow-up Status ───────────────────────────────────────────────────
const updateFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: old } = await supabase.from('follow_up_plans').select('*').eq('id', id).single();
    const { data, error } = await supabase.from('follow_up_plans').update({ ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'UPDATE_FOLLOWUP', module: 'FollowUp', entity_type: 'follow_up_plan', entity_id: id, old_data: old, new_data: req.body });
    return res.json({ message: 'Follow-up updated', follow_up: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Missed Follow-ups ─────────────────────────────────────────────────────
const getMissedFollowUps = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase.from('follow_up_plans')
      .select('*')
      .eq('status', 'scheduled')
      .lt('follow_up_date', today)
      .order('follow_up_date', { ascending: true });

    if (error) throw error;
    const missed_follow_ups = await attachRelated(data || []);
    return res.json({ missed_follow_ups, count: missed_follow_ups.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Upcoming Follow-ups (next 90 days) ────────────────────────────────────
const getUpcomingFollowUps = async (req, res) => {
  try {
    const today   = new Date().toISOString().split('T')[0];
    const end     = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data, error } = await supabase.from('follow_up_plans')
      .select('*')
      .eq('status', 'scheduled')
      .gte('follow_up_date', today)
      .lte('follow_up_date', end)
      .order('follow_up_date', { ascending: true });

    if (error) throw error;
    const upcoming = await attachRelated(data || []);
    return res.json({ upcoming });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Patient: My Follow-ups ────────────────────────────────────────────────────
const getMyFollowUps = async (req, res) => {
  try {
    const { data: patient } = await supabase.from('patients').select('id').eq('user_id', req.user.id).single();
    if (!patient) return res.json({ follow_ups: [] });

    const { data, error } = await supabase.from('follow_up_plans')
      .select('*')
      .eq('patient_id', patient.id)
      .order('follow_up_date', { ascending: true });
    if (error) throw error;

    // Attach doctor names
    const doctorIds = [...new Set((data || []).map(r => r.doctor_id).filter(Boolean))];
    const doctorMap = {};
    if (doctorIds.length) {
      const { data: doctors } = await supabase.from('doctors').select('id, user_id, specialization').in('id', doctorIds);
      const userIds = [...new Set((doctors || []).map(d => d.user_id).filter(Boolean))];
      const userMap = {};
      if (userIds.length) {
        const { data: users } = await supabase.from('users').select('id, first_name, last_name').in('id', userIds);
        (users || []).forEach(u => { userMap[u.id] = u; });
      }
      (doctors || []).forEach(d => { doctorMap[d.id] = { specialization: d.specialization, users: userMap[d.user_id] || null }; });
    }

    return res.json({
      follow_ups: (data || []).map(f => ({ ...f, doctors: doctorMap[f.doctor_id] || null })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getFollowUps, getFollowUpById, createFollowUp, updateFollowUp, getMissedFollowUps, getUpcomingFollowUps, getMyFollowUps };
