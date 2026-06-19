const { auditLog } = require('../middlewares/audit');
const { getUserOrganizationId } = require('../utils/organizationAccess');

const attachDoctorNames = async (rows, db) => {
  const doctorIds = [...new Set(rows.map(r => r.doctor_id).filter(Boolean))];
  if (!doctorIds.length) return {};
  
  const result = await db.query('SELECT id, user_id FROM doctors WHERE id = ANY($1)', [doctorIds]);
  const doctors = result.rows || [];
  
  const userIds = [...new Set(doctors.map(d => d.user_id).filter(Boolean))];
  const userMap = {};
  if (userIds.length) {
    const usersResult = await db.query('SELECT id, first_name, last_name FROM users WHERE id = ANY($1)', [userIds]);
    (usersResult.rows || []).forEach(u => { userMap[u.id] = u; });
  }
  
  const nameMap = {};
  doctors.forEach(d => { nameMap[d.id] = { users: userMap[d.user_id] || null }; });
  return nameMap;
};

// ── Create Consultation ───────────────────────────────────────────────────────
const createConsultation = async (req, res) => {
  try {
    const db = req.db;
    const { patient_id, appointment_id, doctor_id, chief_complaint, symptoms, history, diagnosis, notes, advice, follow_up_required, follow_up_date, follow_up_notes } = req.body;
    if (!patient_id || !doctor_id) return res.status(400).json({ error: 'patient_id and doctor_id are required' });
    const organizationId = getUserOrganizationId(req);

    const result = await db.query(
      `INSERT INTO consultations (patient_id, appointment_id, doctor_id, chief_complaint, symptoms, history, diagnosis, notes, advice, follow_up_required, follow_up_date, follow_up_notes, consultation_status, consultation_date, organization_id, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        patient_id,
        appointment_id || null,
        doctor_id,
        chief_complaint || null,
        symptoms || null,
        history || null,
        diagnosis || null,
        notes || null,
        advice || null,
        follow_up_required || false,
        follow_up_date || null,
        follow_up_notes || null,
        'completed',
        new Date().toISOString().split('T')[0],
        organizationId || null,
        req.user.id,
        new Date().toISOString()
      ]
    );
    const data = result.rows[0];

    // Update appointment status to completed
    if (appointment_id) {
      await db.query(
        "UPDATE appointments SET queue_status = 'completed', status = 'completed', consultation_id = $1 WHERE id = $2",
        [data.id, appointment_id]
      );
      await db.query(
        "UPDATE queue_tokens SET status = 'completed', completed_at = $1 WHERE appointment_id = $2",
        [new Date().toISOString(), appointment_id]
      );
    }

    // Auto-create follow-up plan if required
    if (follow_up_required && follow_up_date) {
      await db.query(
        `INSERT INTO follow_up_plans (patient_id, consultation_id, doctor_id, follow_up_date, notes, status, organization_id, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          patient_id,
          data.id,
          doctor_id,
          follow_up_date,
          follow_up_notes || null,
          'scheduled',
          organizationId || null,
          req.user.id,
          new Date().toISOString()
        ]
      );
    }

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'CREATE_CONSULTATION', module: 'Consultation', entity_type: 'consultation', entity_id: data.id });
    return res.status(201).json({ message: 'Consultation created', consultation: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Update Consultation ───────────────────────────────────────────────────────
const updateConsultation = async (req, res) => {
  try {
    const db = req.db;
    const { id } = req.params;
    const organizationId = getUserOrganizationId(req);

    let oldQuery = 'SELECT * FROM consultations WHERE id = $1';
    const oldParams = [id];
    if (organizationId) {
      oldParams.push(organizationId);
      oldQuery += ' AND organization_id = $2';
    }
    oldQuery += ' LIMIT 1';
    const oldResult = await db.query(oldQuery, oldParams);
    const old = oldResult.rows[0];
    if (!old) return res.status(404).json({ error: 'Consultation not found' });

    const updates = {
      ...req.body,
      updated_by: req.user.id,
      updated_at: new Date().toISOString()
    };
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((k, idx) => `${k} = $${idx + 1}`).join(', ');

    let updateQueryText = `UPDATE consultations SET ${setClause} WHERE id = $${keys.length + 1}`;
    const updateParams = [...values, id];
    if (organizationId) {
      updateParams.push(organizationId);
      updateQueryText += ` AND organization_id = $${updateParams.length}`;
    }
    updateQueryText += ' RETURNING *';

    const result = await db.query(updateQueryText, updateParams);
    const data = result.rows[0];
    if (!data) return res.status(404).json({ error: 'Consultation not found' });

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'UPDATE_CONSULTATION', module: 'Consultation', entity_type: 'consultation', entity_id: id, old_data: old, new_data: req.body });
    return res.json({ message: 'Consultation updated', consultation: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Consultation ──────────────────────────────────────────────────────────
const getConsultation = async (req, res) => {
  try {
    const db = req.db;
    const { id } = req.params;
    const organizationId = getUserOrganizationId(req);
    
    let queryText = 'SELECT * FROM consultations WHERE id = $1';
    const params = [id];
    if (organizationId) {
      params.push(organizationId);
      queryText += ' AND organization_id = $2';
    }
    queryText += ' LIMIT 1';
    const result = await db.query(queryText, params);
    const data = result.rows[0];
    if (!data) return res.status(404).json({ error: 'Consultation not found' });

    const nameMap = await attachDoctorNames([data], db);

    const patientResult = data.patient_id
      ? await db.query('SELECT first_name, last_name, patient_uid, phone FROM patients WHERE id = $1 LIMIT 1', [data.patient_id])
      : { rows: [] };
    const patient = patientResult.rows[0];

    const [prescriptionsResult, labOrdersResult] = await Promise.all([
      db.query('SELECT * FROM prescriptions WHERE consultation_id = $1', [id]),
      db.query('SELECT * FROM lab_orders WHERE consultation_id = $1', [id])
    ]);
    let prescriptions = prescriptionsResult.rows || [];
    let labOrders = labOrdersResult.rows || [];

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

    return res.json({
      consultation: { ...data, patients: patient || null, doctors: nameMap[data.doctor_id] || null },
      prescriptions,
      lab_orders: labOrders
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Doctor's Today Queue ──────────────────────────────────────────────────
const getDoctorQueue = async (req, res) => {
  try {
    const db = req.db;
    const doctor_id = req.params.doctor_id || req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const organizationId = getUserOrganizationId(req);

    let queryText = `
      SELECT q.*, 
             a.id as appt_id, a.booking_id, a.appointment_type, a.reason
      FROM queue_tokens q
      LEFT JOIN appointments a ON q.appointment_id = a.id
      WHERE q.doctor_id = $1 AND q.token_date = $2
    `;
    const params = [doctor_id, today];
    if (organizationId) {
      params.push(organizationId);
      queryText += ` AND q.organization_id = $3`;
    }
    queryText += ' ORDER BY q.priority DESC, q.token_number ASC';

    const result = await db.query(queryText, params);
    const data = result.rows || [];

    const patientIds = [...new Set(data.map(t => t.patient_id).filter(Boolean))];
    const patientMap = {};
    if (patientIds.length) {
      const patientsResult = await db.query(
        'SELECT id, first_name, last_name, patient_uid, phone, date_of_birth, blood_group, allergies, chronic_disease_tag FROM patients WHERE id = ANY($1)',
        [patientIds]
      );
      patientsResult.rows.forEach(p => { patientMap[p.id] = p; });
    }

    const queue = data.map(t => ({
      ...t,
      appointments: t.appt_id ? { id: t.appt_id, booking_id: t.booking_id, appointment_type: t.appointment_type, reason: t.reason } : null,
      patients: patientMap[t.patient_id] || null
    }));
    return res.json({ queue });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Patient Visit History ─────────────────────────────────────────────────
const getPatientHistory = async (req, res) => {
  try {
    const db = req.db;
    const { patient_id } = req.params;
    const organizationId = getUserOrganizationId(req);

    let consultQueryText = 'SELECT * FROM consultations WHERE patient_id = $1';
    let labQueryText = 'SELECT * FROM lab_orders WHERE patient_id = $1';
    const params = [patient_id];

    if (organizationId) {
      params.push(organizationId);
      consultQueryText += ` AND organization_id = $2`;
      labQueryText += ` AND organization_id = $2`;
    }
    consultQueryText += ' ORDER BY created_at DESC';
    labQueryText += ' ORDER BY ordered_at DESC';

    const [consultResult, labResult] = await Promise.all([
      db.query(consultQueryText, params),
      db.query(labQueryText, params)
    ]);
    const consults = consultResult.rows || [];
    let labOrders = labResult.rows || [];

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

    let prescriptionsMap = {};
    if (consults.length > 0) {
      const consultIds = consults.map(c => c.id);
      const presResult = await db.query('SELECT * FROM prescriptions WHERE consultation_id = ANY($1)', [consultIds]);
      let prescriptions = presResult.rows || [];
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
      prescriptions.forEach(p => {
        if (!prescriptionsMap[p.consultation_id]) prescriptionsMap[p.consultation_id] = [];
        prescriptionsMap[p.consultation_id].push(p);
      });
    }

    let consultLabOrdersMap = {};
    if (consults.length > 0) {
      const consultIds = consults.map(c => c.id);
      const clResult = await db.query('SELECT * FROM lab_orders WHERE consultation_id = ANY($1)', [consultIds]);
      clResult.rows.forEach(o => {
        if (!consultLabOrdersMap[o.consultation_id]) consultLabOrdersMap[o.consultation_id] = [];
        consultLabOrdersMap[o.consultation_id].push(o);
      });
    }

    const nameMap = await attachDoctorNames(consults, db);
    const history = consults.map(c => ({
      ...c,
      prescriptions: prescriptionsMap[c.id] || [],
      lab_orders: consultLabOrdersMap[c.id] || [],
      doctors: nameMap[c.doctor_id] || null
    }));

    return res.json({ history, lab_orders: labOrders });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Create Prescription ───────────────────────────────────────────────────────
const createPrescription = async (req, res) => {
  try {
    const db = req.db;
    const { patient_id, consultation_id, appointment_id, doctor_id, items, notes } = req.body;
    if (!patient_id || !doctor_id || !items?.length) return res.status(400).json({ error: 'patient_id, doctor_id, and items are required' });

    const organizationId = getUserOrganizationId(req);
    const presResult = await db.query(
      `INSERT INTO prescriptions (patient_id, consultation_id, appointment_id, doctor_id, notes, organization_id, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        patient_id,
        consultation_id || null,
        appointment_id || null,
        doctor_id,
        notes || null,
        organizationId || null,
        req.user.id,
        new Date().toISOString()
      ]
    );
    const pres = presResult.rows[0];

    const itemRows = [];
    const values = [];
    items.forEach((item, idx) => {
      const baseIdx = idx * 7;
      itemRows.push(`($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}, $${baseIdx + 6}, $${baseIdx + 7})`);
      values.push(
        pres.id,
        item.medicine_name,
        item.dosage || null,
        item.frequency || null,
        item.duration || null,
        item.route || null,
        item.instructions || null
      );
    });

    const itemQueryText = `
      INSERT INTO prescription_items (prescription_id, medicine_name, dosage, frequency, duration, route, instructions)
      VALUES ${itemRows.join(', ')}
      RETURNING *
    `;
    const itemResult = await db.query(itemQueryText, values);
    const itemData = itemResult.rows;

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'CREATE_PRESCRIPTION', module: 'Consultation', entity_type: 'prescription', entity_id: pres.id });
    return res.status(201).json({ message: 'Prescription created', prescription: { ...pres, items: itemData } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Create Lab Order ──────────────────────────────────────────────────────────
const createLabOrder = async (req, res) => {
  try {
    const db = req.db;
    const { patient_id, consultation_id, appointment_id, doctor_id, tests, urgency, notes } = req.body;
    if (!patient_id || !doctor_id || !tests?.length) return res.status(400).json({ error: 'patient_id, doctor_id, and tests required' });

    const organizationId = getUserOrganizationId(req);
    
    const rows = [];
    const values = [];
    tests.forEach((test, idx) => {
      const baseIdx = idx * 11;
      rows.push(`($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}, $${baseIdx + 6}, $${baseIdx + 7}, $${baseIdx + 8}, $${baseIdx + 9}, $${baseIdx + 10}, $${baseIdx + 11})`);
      values.push(
        patient_id,
        consultation_id || null,
        appointment_id || null,
        doctor_id,
        test.test_name,
        test.test_code || null,
        urgency || 'normal',
        notes || null,
        'ordered',
        organizationId || null,
        new Date().toISOString()
      );
    });

    const queryText = `
      INSERT INTO lab_orders (patient_id, consultation_id, appointment_id, doctor_id, test_name, test_code, urgency, notes, status, organization_id, ordered_at)
      VALUES ${rows.join(', ')}
      RETURNING *
    `;
    const result = await db.query(queryText, values);
    const data = result.rows;

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'CREATE_LAB_ORDER', module: 'Consultation', entity_type: 'lab_order', entity_id: data[0]?.id });
    return res.status(201).json({ message: 'Lab orders created', lab_orders: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Patient: My Prescriptions ─────────────────────────────────────────────────
const getMyPrescriptions = async (req, res) => {
  try {
    const db = req.db;
    const patResult = await db.query('SELECT id FROM patients WHERE user_id = $1 LIMIT 1', [req.user.id]);
    const patient = patResult.rows[0];
    if (!patient) return res.json({ prescriptions: [] });

    const presResult = await db.query(
      'SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY created_at DESC',
      [patient.id]
    );
    let data = presResult.rows || [];

    if (data.length > 0) {
      const prescIds = data.map(p => p.id);
      const itemsResult = await db.query('SELECT * FROM prescription_items WHERE prescription_id = ANY($1)', [prescIds]);
      const itemsMap = {};
      itemsResult.rows.forEach(item => {
        if (!itemsMap[item.prescription_id]) itemsMap[item.prescription_id] = [];
        itemsMap[item.prescription_id].push(item);
      });
      data = data.map(p => ({ ...p, prescription_items: itemsMap[p.id] || [] }));
    }

    const doctorIds = [...new Set(data.map(r => r.doctor_id).filter(Boolean))];
    const doctorMap = {};
    if (doctorIds.length) {
      const doctorsResult = await db.query('SELECT id, user_id, specialization FROM doctors WHERE id = ANY($1)', [doctorIds]);
      const userIds = [...new Set((doctorsResult.rows || []).map(d => d.user_id).filter(Boolean))];
      const userMap = {};
      if (userIds.length) {
        const usersResult = await db.query('SELECT id, first_name, last_name FROM users WHERE id = ANY($1)', [userIds]);
        usersResult.rows.forEach(u => { userMap[u.id] = u; });
      }
      doctorsResult.rows.forEach(d => { doctorMap[d.id] = { users: userMap[d.user_id] || null, specialization: d.specialization }; });
    }

    return res.json({ prescriptions: data.map(p => ({ ...p, doctors: doctorMap[p.doctor_id] || null })) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { createConsultation, updateConsultation, getConsultation, getDoctorQueue, getPatientHistory, createPrescription, createLabOrder, getMyPrescriptions };
