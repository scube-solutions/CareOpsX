const supabase = require('../utils/supabase');
const { auditLog } = require('../middlewares/audit');

// ── Helpers ───────────────────────────────────────────────────────────────────
const generatePatientId = () => {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `PAT-${year}-${rand}`;
};

// ── Duplicate Detection ───────────────────────────────────────────────────────
const checkDuplicates = async (req, res) => {
  try {
    const { phone, email, first_name, last_name, date_of_birth } = req.body;
    const matches = [];

    if (phone) {
      const { data } = await supabase.from('patients').select('id, patient_uid, first_name, last_name, phone, email, date_of_birth').eq('phone', phone).eq('is_archived', false);
      if (data?.length) matches.push(...data.map(d => ({ ...d, match_reason: 'phone' })));
    }
    if (email) {
      const { data } = await supabase.from('patients').select('id, patient_uid, first_name, last_name, phone, email, date_of_birth').eq('email', email).eq('is_archived', false);
      if (data?.length) {
        data.forEach(d => { if (!matches.find(m => m.id === d.id)) matches.push({ ...d, match_reason: 'email' }); });
      }
    }
    if (first_name && last_name && date_of_birth) {
      const { data } = await supabase.from('patients').select('id, patient_uid, first_name, last_name, phone, email, date_of_birth').ilike('first_name', first_name).ilike('last_name', last_name).eq('date_of_birth', date_of_birth).eq('is_archived', false);
      if (data?.length) {
        data.forEach(d => { if (!matches.find(m => m.id === d.id)) matches.push({ ...d, match_reason: 'name+dob' }); });
      }
    }

    return res.json({ duplicates: matches, has_duplicates: matches.length > 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Patients ──────────────────────────────────────────────────────────────
const getPatients = async (req, res) => {
  try {
    const { search, page = 1, limit = 20, chronic_only } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase.from('patients').select('id, patient_uid, first_name, last_name, gender, date_of_birth, phone, email, blood_group, chronic_disease_tag, is_archived, created_at', { count: 'exact' }).eq('is_archived', false).order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1);

    if (search) query = query.or(`phone.ilike.%${search}%,email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,patient_uid.ilike.%${search}%`);
    if (chronic_only === 'true') query = query.not('chronic_disease_tag', 'is', null);

    const { data, error, count } = await query;
    if (error) throw error;
    return res.json({ patients: data, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Patient By ID ─────────────────────────────────────────────────────────
const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: patient, error } = await supabase.from('patients').select('*').eq('id', id).single();
    if (error || !patient) return res.status(404).json({ error: 'Patient not found' });

    const [appts, consultations, labOrders, prescriptions, invoices, followups] = await Promise.all([
      supabase.from('appointments').select('id, booking_id, appointment_date, appointment_time, status, appointment_type, token_number, created_at').eq('patient_id', id).order('appointment_date', { ascending: false }).limit(20),
      supabase.from('consultations').select('id, consultation_date, chief_complaint, diagnosis, consultation_status, created_at').eq('patient_id', id).order('created_at', { ascending: false }).limit(10),
      supabase.from('lab_orders').select('id, test_name, status, ordered_at').eq('patient_id', id).order('ordered_at', { ascending: false }).limit(10),
      supabase.from('prescriptions').select('id, created_at').eq('patient_id', id).order('created_at', { ascending: false }).limit(10),
      supabase.from('invoices').select('id, invoice_number, total_amount, status, invoice_type, created_at').eq('patient_id', id).order('created_at', { ascending: false }).limit(10),
      supabase.from('follow_up_plans').select('id, follow_up_date, status, notes').eq('patient_id', id).order('follow_up_date', { ascending: false }).limit(10),
    ]);

    return res.json({
      patient,
      appointments: appts.data || [],
      consultations: consultations.data || [],
      lab_orders: labOrders.data || [],
      prescriptions: prescriptions.data || [],
      invoices: invoices.data || [],
      follow_ups: followups.data || [],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Create Patient ────────────────────────────────────────────────────────────
const createPatient = async (req, res) => {
  try {
    const { first_name, last_name, phone, gender, date_of_birth } = req.body;
    if (!first_name || !phone) return res.status(400).json({ error: 'first_name and phone are required' });

    const patient_uid = generatePatientId();
    const { data, error } = await supabase.from('patients').insert([{
      ...req.body,
      patient_uid,
      is_archived: false,
      created_by: req.user.id,
      created_at: new Date().toISOString()
    }]).select('*').single();

    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'CREATE_PATIENT', module: 'Patient', entity_type: 'patient', entity_id: data.id, new_data: req.body });
    return res.status(201).json({ message: 'Patient created', patient: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Update Patient ────────────────────────────────────────────────────────────
const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: old } = await supabase.from('patients').select('*').eq('id', id).single();

    const { data, error } = await supabase.from('patients').update({ ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'UPDATE_PATIENT', module: 'Patient', entity_type: 'patient', entity_id: id, old_data: old, new_data: req.body });
    return res.json({ message: 'Patient updated', patient: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Archive Patient ───────────────────────────────────────────────────────────
const archivePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('patients').update({ is_archived: true, updated_by: req.user.id, updated_at: new Date().toISOString() }).eq('id', id).select('id, patient_uid, is_archived').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'ARCHIVE_PATIENT', module: 'Patient', entity_type: 'patient', entity_id: id });
    return res.json({ message: 'Patient archived', patient: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Merge Patients (Admin only) ───────────────────────────────────────────────
const mergePatients = async (req, res) => {
  try {
    const { primary_patient_id, duplicate_patient_id } = req.body;
    if (!primary_patient_id || !duplicate_patient_id) return res.status(400).json({ error: 'primary_patient_id and duplicate_patient_id required' });

    // Reassign all records from duplicate to primary
    const tables = ['appointments', 'consultations', 'lab_orders', 'prescriptions', 'invoices', 'follow_up_plans'];
    for (const table of tables) {
      await supabase.from(table).update({ patient_id: primary_patient_id }).eq('patient_id', duplicate_patient_id);
    }

    // Archive the duplicate
    await supabase.from('patients').update({ is_archived: true, merged_into: primary_patient_id, updated_by: req.user.id }).eq('id', duplicate_patient_id);

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'MERGE_PATIENT', module: 'Patient', entity_type: 'patient', entity_id: primary_patient_id, description: `Merged patient ${duplicate_patient_id} into ${primary_patient_id}` });
    return res.json({ message: 'Patients merged successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Delete Patient ────────────────────────────────────────────────────────────
const deletePatient = async (req, res) => {
  try {
    const { error } = await supabase.from('patients').update({ is_archived: true, updated_by: req.user.id }).eq('id', req.params.id);
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'DELETE_PATIENT', module: 'Patient', entity_type: 'patient', entity_id: req.params.id });
    return res.json({ message: 'Patient archived/deleted' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { checkDuplicates, getPatients, getPatientById, createPatient, updatePatient, archivePatient, mergePatients, deletePatient };
