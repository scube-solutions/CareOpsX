const supabase = require('../utils/supabase');
const { auditLog } = require('../middlewares/audit');

const attachDoctorNames = async (rows) => {
  const doctorIds = [...new Set(rows.map(r => r.doctor_id).filter(Boolean))];
  if (!doctorIds.length) return {};
  const { data: doctors } = await supabase.from('doctors').select('id, user_id').in('id', doctorIds);
  const userIds = [...new Set((doctors || []).map(d => d.user_id).filter(Boolean))];
  const userMap = {};
  if (userIds.length) {
    const { data: users } = await supabase.from('users').select('id, first_name, last_name').in('id', userIds);
    (users || []).forEach(u => { userMap[u.id] = u; });
  }
  const nameMap = {};
  (doctors || []).forEach(d => { nameMap[d.id] = { users: userMap[d.user_id] || null }; });
  return nameMap;
};

// ── Create Consultation ───────────────────────────────────────────────────────
const createConsultation = async (req, res) => {
  try {
    const { patient_id, appointment_id, doctor_id, chief_complaint, symptoms, history, diagnosis, notes, advice, follow_up_required, follow_up_date, follow_up_notes } = req.body;
    if (!patient_id || !doctor_id) return res.status(400).json({ error: 'patient_id and doctor_id are required' });

    const { data, error } = await supabase.from('consultations').insert([{
      patient_id,
      appointment_id: appointment_id || null,
      doctor_id,
      chief_complaint: chief_complaint || null,
      symptoms: symptoms || null,
      history: history || null,
      diagnosis: diagnosis || null,
      notes: notes || null,
      advice: advice || null,
      follow_up_required: follow_up_required || false,
      follow_up_date: follow_up_date || null,
      follow_up_notes: follow_up_notes || null,
      consultation_status: 'completed',
      consultation_date: new Date().toISOString().split('T')[0],
      created_by: req.user.id,
      created_at: new Date().toISOString()
    }]).select('*').single();

    if (error) throw error;

    // Update appointment status to completed
    if (appointment_id) {
      await supabase.from('appointments').update({ queue_status: 'completed', status: 'completed', consultation_id: data.id }).eq('id', appointment_id);
      await supabase.from('queue_tokens').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('appointment_id', appointment_id);
    }

    // Auto-create follow-up plan if required
    if (follow_up_required && follow_up_date) {
      await supabase.from('follow_up_plans').insert([{
        patient_id,
        consultation_id: data.id,
        doctor_id,
        follow_up_date,
        notes: follow_up_notes || null,
        status: 'scheduled',
        created_by: req.user.id,
        created_at: new Date().toISOString()
      }]);
    }

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'CREATE_CONSULTATION', module: 'Consultation', entity_type: 'consultation', entity_id: data.id });
    return res.status(201).json({ message: 'Consultation created', consultation: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Update Consultation ───────────────────────────────────────────────────────
const updateConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: old } = await supabase.from('consultations').select('*').eq('id', id).single();
    const { data, error } = await supabase.from('consultations').update({ ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'UPDATE_CONSULTATION', module: 'Consultation', entity_type: 'consultation', entity_id: id, old_data: old, new_data: req.body });
    return res.json({ message: 'Consultation updated', consultation: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Consultation ──────────────────────────────────────────────────────────
const getConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('consultations').select('*').eq('id', id).single();
    if (error || !data) return res.status(404).json({ error: 'Consultation not found' });

    const nameMap = await attachDoctorNames([data]);

    // Fetch patient separately
    const { data: patient } = data.patient_id
      ? await supabase.from('patients').select('first_name, last_name, patient_uid, phone').eq('id', data.patient_id).single()
      : { data: null };

    const [prescriptions, labOrders] = await Promise.all([
      supabase.from('prescriptions').select('*, prescription_items(*)').eq('consultation_id', id),
      supabase.from('lab_orders').select('*, lab_reports(*)').eq('consultation_id', id)
    ]);

    return res.json({
      consultation: { ...data, patients: patient || null, doctors: nameMap[data.doctor_id] || null },
      prescriptions: prescriptions.data || [],
      lab_orders: labOrders.data || []
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Doctor's Today Queue ──────────────────────────────────────────────────
const getDoctorQueue = async (req, res) => {
  try {
    const doctor_id = req.params.doctor_id || req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase.from('queue_tokens')
      .select('*, appointments(id, booking_id, appointment_type, reason)')
      .eq('doctor_id', doctor_id)
      .eq('token_date', today)
      .order('priority', { ascending: false })
      .order('token_number', { ascending: true });

    if (error) throw error;

    // Attach patient info separately
    const patientIds = [...new Set((data || []).map(t => t.patient_id).filter(Boolean))];
    const patientMap = {};
    if (patientIds.length) {
      const { data: patients } = await supabase.from('patients').select('id, first_name, last_name, patient_uid, phone, date_of_birth, blood_group, allergies, chronic_disease_tag').in('id', patientIds);
      (patients || []).forEach(p => { patientMap[p.id] = p; });
    }

    const queue = (data || []).map(t => ({ ...t, patients: patientMap[t.patient_id] || null }));
    return res.json({ queue });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Patient Visit History ─────────────────────────────────────────────────
const getPatientHistory = async (req, res) => {
  try {
    const { patient_id } = req.params;

    const [{ data, error }, { data: labOrders }] = await Promise.all([
      supabase.from('consultations')
        .select('*, prescriptions(id, prescription_items(medicine_name, dosage, duration)), lab_orders(id, test_name, status)')
        .eq('patient_id', patient_id)
        .order('created_at', { ascending: false }),
      supabase.from('lab_orders')
        .select('*, lab_reports(*)')
        .eq('patient_id', patient_id)
        .order('ordered_at', { ascending: false }),
    ]);

    if (error) throw error;

    const nameMap = await attachDoctorNames(data || []);
    const history = (data || []).map(c => ({ ...c, doctors: nameMap[c.doctor_id] || null }));
    return res.json({ history, lab_orders: labOrders || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Create Prescription ───────────────────────────────────────────────────────
const createPrescription = async (req, res) => {
  try {
    const { patient_id, consultation_id, appointment_id, doctor_id, items, notes } = req.body;
    if (!patient_id || !doctor_id || !items?.length) return res.status(400).json({ error: 'patient_id, doctor_id, and items are required' });

    const { data: pres, error: presError } = await supabase.from('prescriptions').insert([{
      patient_id,
      consultation_id: consultation_id || null,
      appointment_id: appointment_id || null,
      doctor_id,
      notes: notes || null,
      created_by: req.user.id,
      created_at: new Date().toISOString()
    }]).select('*').single();

    if (presError) throw presError;

    const itemRows = items.map(item => ({
      prescription_id: pres.id,
      medicine_name: item.medicine_name,
      dosage: item.dosage || null,
      frequency: item.frequency || null,
      duration: item.duration || null,
      route: item.route || null,
      instructions: item.instructions || null
    }));

    const { data: itemData, error: itemError } = await supabase.from('prescription_items').insert(itemRows).select('*');
    if (itemError) throw itemError;

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'CREATE_PRESCRIPTION', module: 'Consultation', entity_type: 'prescription', entity_id: pres.id });
    return res.status(201).json({ message: 'Prescription created', prescription: { ...pres, items: itemData } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Create Lab Order ──────────────────────────────────────────────────────────
const createLabOrder = async (req, res) => {
  try {
    const { patient_id, consultation_id, appointment_id, doctor_id, tests, urgency, notes } = req.body;
    if (!patient_id || !doctor_id || !tests?.length) return res.status(400).json({ error: 'patient_id, doctor_id, and tests required' });

    const labOrderRows = tests.map(test => ({
      patient_id,
      consultation_id: consultation_id || null,
      appointment_id: appointment_id || null,
      doctor_id,
      test_name: test.test_name,
      test_code: test.test_code || null,
      urgency: urgency || 'normal',
      notes: notes || null,
      status: 'ordered',
      ordered_at: new Date().toISOString(),
      created_by: req.user.id
    }));

    const { data, error } = await supabase.from('lab_orders').insert(labOrderRows).select('*');
    if (error) throw error;

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'CREATE_LAB_ORDER', module: 'Consultation', entity_type: 'lab_order', entity_id: data[0]?.id });
    return res.status(201).json({ message: 'Lab orders created', lab_orders: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Patient: My Prescriptions ─────────────────────────────────────────────────
const getMyPrescriptions = async (req, res) => {
  try {
    const { data: patient } = await supabase.from('patients').select('id').eq('user_id', req.user.id).single();
    if (!patient) return res.json({ prescriptions: [] });

    const { data, error } = await supabase.from('prescriptions')
      .select('*, prescription_items(*)')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

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
      (doctors || []).forEach(d => { doctorMap[d.id] = { users: userMap[d.user_id] || null, specialization: d.specialization }; });
    }

    return res.json({ prescriptions: (data || []).map(p => ({ ...p, doctors: doctorMap[p.doctor_id] || null })) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { createConsultation, updateConsultation, getConsultation, getDoctorQueue, getPatientHistory, createPrescription, createLabOrder, getMyPrescriptions };
