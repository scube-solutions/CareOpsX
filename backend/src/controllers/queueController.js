const { auditLog } = require('../middlewares/audit');
const { getUserOrganizationId } = require('../utils/organizationAccess');

// Attach patient + doctor names to queue token rows
const attachQueueRelated = async (rows, db) => {
  if (!rows.length) return rows;

  const patientIds = [...new Set(rows.map(r => r.patient_id).filter(Boolean))];
  const patientMap = {};
  if (patientIds.length) {
    const { data } = await db.from('patients').select('id, first_name, last_name, phone, patient_uid').in('id', patientIds);
    (data || []).forEach(p => { patientMap[p.id] = p; });
  }

  const doctorIds = [...new Set(rows.map(r => r.doctor_id).filter(Boolean))];
  const doctorMap = {};
  if (doctorIds.length) {
    const { data: doctors } = await db.from('doctors').select('id, user_id, room_number').in('id', doctorIds);
    const userIds = [...new Set((doctors || []).map(d => d.user_id).filter(Boolean))];
    const userMap = {};
    if (userIds.length) {
      const { data: users } = await db.from('users').select('id, first_name, last_name').in('id', userIds);
      (users || []).forEach(u => { userMap[u.id] = u; });
    }
    (doctors || []).forEach(d => {
      doctorMap[d.id] = { room_number: d.room_number, users: userMap[d.user_id] || null };
    });
  }

  return rows.map(r => ({
    ...r,
    patients: patientMap[r.patient_id] || null,
    doctors:  doctorMap[r.doctor_id]  || null,
  }));
};

// Generate token number for today per doctor
const generateToken = async (doctor_id, branch_id, db) => {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await db.from('queue_tokens').select('token_number').eq('doctor_id', doctor_id).eq('token_date', today).order('token_number', { ascending: false }).limit(1);
  return (data?.[0]?.token_number || 0) + 1;
};

// ── Generate Token (check-in) ─────────────────────────────────────────────────
const generateQueueToken = async (req, res) => {
  try {
    const supabase = req.db;
    const { appointment_id, patient_id, doctor_id, branch_id, priority } = req.body;
    if (!patient_id || !doctor_id) return res.status(400).json({ error: 'patient_id and doctor_id required' });
    const organizationId = getUserOrganizationId(req);

    const token_number = await generateToken(doctor_id, branch_id, supabase);
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase.from('queue_tokens').insert([{
      appointment_id: appointment_id || null,
      patient_id,
      doctor_id,
      branch_id: branch_id || null,
      token_number,
      token_date: today,
      status: 'waiting',
      priority: priority || 'normal',
      organization_id: organizationId || null,
      checked_in_at: new Date().toISOString(),
      created_by: req.user.id
    }]).select('*').single();

    if (error) throw error;

    // Update appointment status to checked_in if appointment_id provided
    if (appointment_id) {
      await supabase.from('appointments').update({ queue_status: 'checked_in', token_number, checked_in_at: new Date().toISOString() }).eq('id', appointment_id);
    }

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'GENERATE_TOKEN', module: 'Queue', entity_type: 'queue_token', entity_id: data.id });
    return res.status(201).json({ message: 'Token generated', token: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Live Queue for a Doctor ───────────────────────────────────────────────
const getLiveQueue = async (req, res) => {
  try {
    const supabase = req.db;
    const { doctor_id } = req.params;
    const today = new Date().toISOString().split('T')[0];
    const organizationId = getUserOrganizationId(req);

    let queueQuery = supabase.from('queue_tokens')
      .select('*')
      .eq('doctor_id', doctor_id)
      .eq('token_date', today)
      .in('status', ['waiting', 'called', 'in_consultation'])
      .order('priority', { ascending: false })
      .order('token_number', { ascending: true });

    if (organizationId) queueQuery = queueQuery.eq('organization_id', organizationId);
    const { data, error } = await queueQuery;

    if (error) throw error;
    const queue = await attachQueueRelated(data || [], supabase);
    return res.json({ queue, total: queue.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Lobby Display (all doctors, current day) ──────────────────────────────────
const getLobbyDisplay = async (req, res) => {
  try {
    const supabase = req.db;
    const { branch_id, doctor_id } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const organizationId = getUserOrganizationId(req);

    let query = supabase.from('queue_tokens')
      .select('*')
      .eq('token_date', today)
      .in('status', ['called', 'in_consultation', 'waiting'])
      .order('token_number', { ascending: true });

    if (organizationId) query = query.eq('organization_id', organizationId);
    if (branch_id)      query = query.eq('branch_id', branch_id);
    if (doctor_id)      query = query.eq('doctor_id', doctor_id);

    const { data, error } = await query;
    if (error) throw error;

    const rows = await attachQueueRelated(data || [], supabase);
    const called = rows.filter(t => t.status === 'called' || t.status === 'in_consultation');
    const waiting = rows.filter(t => t.status === 'waiting');

    return res.json({ called, waiting, total_waiting: waiting.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Doctor: Call Next Patient ─────────────────────────────────────────────────
const callNext = async (req, res) => {
  try {
    const supabase = req.db;
    const { doctor_id } = req.params;
    const today = new Date().toISOString().split('T')[0];
    const organizationId = getUserOrganizationId(req);

    // Mark current in_consultation as completed
    let finishQuery = supabase.from('queue_tokens').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('doctor_id', doctor_id).eq('token_date', today).eq('status', 'in_consultation');
    if (organizationId) finishQuery = finishQuery.eq('organization_id', organizationId);
    await finishQuery;

    // Mark current called as in_consultation
    let callQuery = supabase.from('queue_tokens').update({ status: 'in_consultation' }).eq('doctor_id', doctor_id).eq('token_date', today).eq('status', 'called');
    if (organizationId) callQuery = callQuery.eq('organization_id', organizationId);
    await callQuery;

    // Get next waiting (priority first, then token order)
    let nextQuery = supabase.from('queue_tokens').select('*').eq('doctor_id', doctor_id).eq('token_date', today).eq('status', 'waiting').order('priority', { ascending: false }).order('token_number', { ascending: true }).limit(1);
    if (organizationId) nextQuery = nextQuery.eq('organization_id', organizationId);
    const { data: nextTokens } = await nextQuery;

    if (!nextTokens?.length) return res.json({ message: 'No more patients waiting', next_token: null });

    const next = nextTokens[0];
    const { data: updatedRaw, error } = await supabase.from('queue_tokens').update({ status: 'called', called_at: new Date().toISOString() }).eq('id', next.id).select('*').single();
    if (error) throw error;
    const [data] = await attachQueueRelated([updatedRaw], supabase);

    if (next.appointment_id) {
      await supabase.from('appointments').update({ queue_status: 'called', called_at: new Date().toISOString() }).eq('id', next.appointment_id);
    }

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'CALL_NEXT', module: 'Queue', entity_type: 'queue_token', entity_id: next.id });
    return res.json({ message: 'Next patient called', token: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Update Token Status ───────────────────────────────────────────────────────
const updateTokenStatus = async (req, res) => {
  try {
    const supabase = req.db;
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['waiting', 'called', 'in_consultation', 'completed', 'missed', 'skipped'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const updates = { status, updated_at: new Date().toISOString() };
    if (status === 'called') updates.called_at = new Date().toISOString();
    if (status === 'completed') updates.completed_at = new Date().toISOString();

    const { data, error } = await supabase.from('queue_tokens').update(updates).eq('id', id).select('*').single();
    if (error) throw error;

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'UPDATE_TOKEN_STATUS', module: 'Queue', entity_type: 'queue_token', entity_id: id, new_data: { status } });
    return res.json({ message: 'Token status updated', token: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Log Patient Journey Step ──────────────────────────────────────────────────
const logPatientJourney = async (req, res) => {
  try {
    const supabase = req.db;
    const { patient_id, appointment_id, location, notes } = req.body;
    if (!patient_id || !location) return res.status(400).json({ error: 'patient_id and location required' });
    const organizationId = getUserOrganizationId(req);

    const { data, error } = await supabase.from('patient_journey_log').insert([{
      patient_id,
      appointment_id: appointment_id || null,
      location,
      notes: notes || null,
      organization_id: organizationId || null,
      logged_by: req.user.id,
      logged_at: new Date().toISOString()
    }]).select('*').single();

    if (error) throw error;
    return res.status(201).json({ message: 'Journey logged', log: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Patient Journey ───────────────────────────────────────────────────────
const getPatientJourney = async (req, res) => {
  try {
    const supabase = req.db;
    const { patient_id, appointment_id } = req.query;
    const organizationId = getUserOrganizationId(req);
    let query = supabase.from('patient_journey_log').select('*').order('logged_at', { ascending: true });
    if (organizationId)  query = query.eq('organization_id', organizationId);
    if (patient_id)      query = query.eq('patient_id', patient_id);
    if (appointment_id)  query = query.eq('appointment_id', appointment_id);
    const { data, error } = await query;
    if (error) throw error;
    return res.json({ journey: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { generateQueueToken, getLiveQueue, getLobbyDisplay, callNext, updateTokenStatus, logPatientJourney, getPatientJourney };
