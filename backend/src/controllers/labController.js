const supabase = require('../utils/supabase');
const { auditLog } = require('../middlewares/audit');

// ── Helpers ───────────────────────────────────────────────────────────────────
const attachLabRelated = async (rows) => {
  if (!rows.length) return rows;

  const patientIds = [...new Set(rows.map(r => r.patient_id).filter(Boolean))];
  const patientMap = {};
  if (patientIds.length) {
    const { data: patients } = await supabase.from('patients').select('id, first_name, last_name, patient_uid, phone, date_of_birth, gender, blood_group').in('id', patientIds);
    (patients || []).forEach(p => { patientMap[p.id] = p; });
  }

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
    (doctors || []).forEach(d => { doctorMap[d.id] = { users: userMap[d.user_id] || null }; });
  }

  return rows.map(r => ({
    ...r,
    patients: patientMap[r.patient_id] || null,
    doctors:  doctorMap[r.doctor_id]  || null,
  }));
};

// ── Get Lab Order Queue ───────────────────────────────────────────────────────
const getLabOrders = async (req, res) => {
  try {
    const { status, date, patient_id, urgency } = req.query;
    const today = date || new Date().toISOString().split('T')[0];

    let query = supabase.from('lab_orders').select('*').order('ordered_at', { ascending: false });

    if (status)     query = query.eq('status', status);
    if (patient_id) query = query.eq('patient_id', patient_id);
    if (urgency)    query = query.eq('urgency', urgency);

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ lab_orders: await attachLabRelated(data || []) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Single Lab Order ──────────────────────────────────────────────────────
const getLabOrderById = async (req, res) => {
  try {
    const { data: order, error } = await supabase.from('lab_orders').select('*').eq('id', req.params.id).single();
    if (error || !order) return res.status(404).json({ error: 'Lab order not found' });

    const [enriched] = await attachLabRelated([order]);

    const { data: lab_reports } = await supabase.from('lab_reports').select('*').eq('lab_order_id', req.params.id);
    return res.json({ lab_order: { ...enriched, lab_reports: lab_reports || [] } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Patient: My Lab Orders ────────────────────────────────────────────────────
const getMyLabOrders = async (req, res) => {
  try {
    const { data: patient } = await supabase.from('patients').select('id').eq('user_id', req.user.id).single();
    if (!patient) return res.json({ lab_orders: [] });

    const { data, error } = await supabase.from('lab_orders')
      .select('*, lab_reports(*)')
      .eq('patient_id', patient.id)
      .order('ordered_at', { ascending: false });
    if (error) throw error;

    const doctorIds = [...new Set((data || []).map(r => r.doctor_id).filter(Boolean))];
    const doctorMap = {};
    if (doctorIds.length) {
      const { data: doctors } = await supabase.from('doctors').select('id, user_id').in('id', doctorIds);
      const userIds = [...new Set((doctors || []).map(d => d.user_id).filter(Boolean))];
      const userMap = {};
      if (userIds.length) {
        const { data: users } = await supabase.from('users').select('id, first_name, last_name').in('id', userIds);
        (users || []).forEach(u => { userMap[u.id] = u; });
      }
      (doctors || []).forEach(d => { doctorMap[d.id] = { users: userMap[d.user_id] || null }; });
    }

    return res.json({ lab_orders: (data || []).map(r => ({ ...r, doctors: doctorMap[r.doctor_id] || null })) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Update Lab Order Status ───────────────────────────────────────────────────
const updateLabOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, sample_collection_notes } = req.body;
    const allowed = ['ordered', 'sample_collected', 'processing', 'ready', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const updates = { status, updated_by: req.user.id, updated_at: new Date().toISOString() };
    if (status === 'sample_collected') updates.sample_collected_at = new Date().toISOString();
    if (status === 'ready') updates.ready_at = new Date().toISOString();
    if (status === 'delivered') updates.delivered_at = new Date().toISOString();
    if (sample_collection_notes) updates.sample_collection_notes = sample_collection_notes;

    const { data, error } = await supabase.from('lab_orders').update(updates).eq('id', id).select('*').single();
    if (error) throw error;

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: `LAB_${status.toUpperCase()}`, module: 'Lab', entity_type: 'lab_order', entity_id: id });
    return res.json({ message: 'Lab order updated', lab_order: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Upload Lab Report ─────────────────────────────────────────────────────────
const uploadLabReport = async (req, res) => {
  try {
    const { lab_order_id, patient_id, doctor_id, consultation_id, report_data, report_url, findings, remarks, is_normal } = req.body;
    if (!lab_order_id || !patient_id) return res.status(400).json({ error: 'lab_order_id and patient_id required' });

    const { data, error } = await supabase.from('lab_reports').insert([{
      lab_order_id,
      patient_id,
      doctor_id: doctor_id || null,
      consultation_id: consultation_id || null,
      report_data: report_data || null,
      report_url: report_url || null,
      findings: findings || null,
      remarks: remarks || null,
      is_normal: is_normal !== undefined ? is_normal : null,
      status: 'ready',
      uploaded_by: req.user.id,
      uploaded_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }]).select('*').single();

    if (error) throw error;

    // Mark lab order as ready
    await supabase.from('lab_orders').update({ status: 'ready', ready_at: new Date().toISOString() }).eq('id', lab_order_id);

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'UPLOAD_LAB_REPORT', module: 'Lab', entity_type: 'lab_report', entity_id: data.id });
    return res.status(201).json({ message: 'Lab report uploaded', report: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Upload File to Supabase Storage ──────────────────────────────────────────
const uploadLabFile = async (req, res) => {
  try {
    const { base64, filename, content_type } = req.body;
    if (!base64 || !filename) return res.status(400).json({ error: 'base64 and filename required' });

    const buffer = Buffer.from(base64, 'base64');
    const ext    = filename.split('.').pop();
    const path   = `reports/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    // Ensure bucket exists
    await supabase.storage.createBucket('lab-reports', { public: true }).catch(() => {});

    const { data, error } = await supabase.storage
      .from('lab-reports')
      .upload(path, buffer, { contentType: content_type || 'application/octet-stream', upsert: true });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage.from('lab-reports').getPublicUrl(data.path);
    return res.json({ url: publicUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get All Lab Reports ───────────────────────────────────────────────────────
const getLabReports = async (req, res) => {
  try {
    const { patient_id, lab_order_id } = req.query;

    let query = supabase.from('lab_reports').select('*, lab_orders(test_name, test_code)').order('uploaded_at', { ascending: false });
    if (patient_id)   query = query.eq('patient_id', patient_id);
    if (lab_order_id) query = query.eq('lab_order_id', lab_order_id);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];

    // Attach patient info
    const patientIds = [...new Set(rows.map(r => r.patient_id).filter(Boolean))];
    const patientMap = {};
    if (patientIds.length) {
      const { data: patients } = await supabase.from('patients').select('id, first_name, last_name, patient_uid, phone').in('id', patientIds);
      (patients || []).forEach(p => { patientMap[p.id] = p; });
    }

    // Attach doctor info
    const doctorIds = [...new Set(rows.map(r => r.doctor_id).filter(Boolean))];
    const doctorMap = {};
    if (doctorIds.length) {
      const { data: doctors } = await supabase.from('doctors').select('id, user_id').in('id', doctorIds);
      const userIds = [...new Set((doctors || []).map(d => d.user_id).filter(Boolean))];
      const userMap = {};
      if (userIds.length) {
        const { data: users } = await supabase.from('users').select('id, first_name, last_name').in('id', userIds);
        (users || []).forEach(u => { userMap[u.id] = u; });
      }
      (doctors || []).forEach(d => { doctorMap[d.id] = { users: userMap[d.user_id] || null }; });
    }

    return res.json({
      lab_reports: rows.map(r => ({
        ...r,
        patients: patientMap[r.patient_id] || null,
        doctors:  doctorMap[r.doctor_id]  || null,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Correct Lab Report ────────────────────────────────────────────────────────
const correctLabReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: old } = await supabase.from('lab_reports').select('*').eq('id', id).single();
    const { data, error } = await supabase.from('lab_reports').update({ ...req.body, status: 'corrected', corrected_by: req.user.id, corrected_at: new Date().toISOString() }).eq('id', id).select('*').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'CORRECT_LAB_REPORT', module: 'Lab', entity_type: 'lab_report', entity_id: id, old_data: old, new_data: req.body });
    return res.json({ message: 'Lab report corrected', report: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Mark Report Delivered ─────────────────────────────────────────────────────
const markReportDelivered = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('lab_reports').update({ status: 'delivered', delivered_at: new Date().toISOString(), delivered_by: req.user.id }).eq('id', id).select('*').single();
    if (error) throw error;
    await supabase.from('lab_orders').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', data.lab_order_id);
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'DELIVER_LAB_REPORT', module: 'Lab', entity_type: 'lab_report', entity_id: id });
    return res.json({ message: 'Report marked delivered', report: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Test Catalog (role-aware — doctors don't see fees) ────────────────────────
const getTestCatalog = async (req, res) => {
  try {
    const { data, error } = await supabase.from('lab_test_catalog')
      .select('id, test_name, test_code, category, fee')
      .eq('is_active', true)
      .order('test_name', { ascending: true });
    if (error) throw error;
    const showFee = ![2, 3].includes(req.user?.role_id); // hide from doctors & patients
    return res.json({
      tests: (data || []).map(t =>
        showFee ? t : { id: t.id, test_name: t.test_name, test_code: t.test_code, category: t.category }
      ),
    });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Update Payment Status on Lab Order ───────────────────────────────────────
const updateLabOrderPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status, payment_source, payment_amount } = req.body;
    const { data, error } = await supabase.from('lab_orders')
      .update({ payment_status, payment_source: payment_source || 'lab', payment_amount: payment_amount || null, payment_collected_at: new Date().toISOString() })
      .eq('id', id).select('id, payment_status, payment_source').single();
    if (error) throw error;
    return res.json({ message: 'Payment status updated', order: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

module.exports = { getLabOrders, getLabOrderById, getMyLabOrders, getLabReports, uploadLabFile, updateLabOrderStatus, uploadLabReport, correctLabReport, markReportDelivered, getTestCatalog, updateLabOrderPayment };
