const { auditLog } = require('../middlewares/audit');
const { getUserOrganizationId } = require('../utils/organizationAccess');
const storage = require('../utils/storage');

// ── Helpers ───────────────────────────────────────────────────────────────────
const attachLabRelated = async (rows, db) => {
  if (!rows.length) return rows;

  const patientIds = [...new Set(rows.map(r => r.patient_id).filter(Boolean))];
  const patientMap = {};
  if (patientIds.length) {
    const patientsResult = await db.query(
      'SELECT id, first_name, last_name, patient_uid, phone, date_of_birth, gender, blood_group FROM patients WHERE id = ANY($1)',
      [patientIds]
    );
    (patientsResult.rows || []).forEach(p => { patientMap[p.id] = p; });
  }

  const doctorIds = [...new Set(rows.map(r => r.doctor_id).filter(Boolean))];
  const doctorMap = {};
  if (doctorIds.length) {
    const doctorsResult = await db.query(
      'SELECT id, user_id, specialization FROM doctors WHERE id = ANY($1)',
      [doctorIds]
    );
    const userIds = [...new Set((doctorsResult.rows || []).map(d => d.user_id).filter(Boolean))];
    const userMap = {};
    if (userIds.length) {
      const usersResult = await db.query(
        'SELECT id, first_name, last_name FROM users WHERE id = ANY($1)',
        [userIds]
      );
      (usersResult.rows || []).forEach(u => { userMap[u.id] = u; });
    }
    (doctorsResult.rows || []).forEach(d => { doctorMap[d.id] = { users: userMap[d.user_id] || null }; });
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
    const db = req.db;
    const { status, date, patient_id, urgency } = req.query;
    const organizationId = getUserOrganizationId(req);

    let queryText = 'SELECT * FROM lab_orders';
    const params = [];
    const conditions = [];

    if (organizationId) {
      params.push(organizationId);
      conditions.push(`organization_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (patient_id) {
      params.push(patient_id);
      conditions.push(`patient_id = $${params.length}`);
    }
    if (urgency) {
      params.push(urgency);
      conditions.push(`urgency = $${params.length}`);
    }

    if (conditions.length) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }
    queryText += ' ORDER BY ordered_at DESC';

    const result = await db.query(queryText, params);
    return res.json({ lab_orders: await attachLabRelated(result.rows || [], db) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Single Lab Order ──────────────────────────────────────────────────────
const getLabOrderById = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = getUserOrganizationId(req);

    let orderQuery = 'SELECT * FROM lab_orders WHERE id = $1';
    const orderParams = [req.params.id];
    if (organizationId) {
      orderParams.push(organizationId);
      orderQuery += ' AND organization_id = $2';
    }
    orderQuery += ' LIMIT 1';

    const orderResult = await db.query(orderQuery, orderParams);
    const order = orderResult.rows[0];
    if (!order) return res.status(404).json({ error: 'Lab order not found' });

    const [enriched] = await attachLabRelated([order], db);

    const reportsResult = await db.query('SELECT * FROM lab_reports WHERE lab_order_id = $1', [req.params.id]);
    return res.json({ lab_order: { ...enriched, lab_reports: reportsResult.rows || [] } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Patient: My Lab Orders ────────────────────────────────────────────────────
const getMyLabOrders = async (req, res) => {
  try {
    const db = req.db;
    const patientResult = await db.query('SELECT id FROM patients WHERE user_id = $1 LIMIT 1', [req.user.id]);
    const patient = patientResult.rows[0];
    if (!patient) return res.json({ lab_orders: [] });

    const ordersResult = await db.query(
      'SELECT * FROM lab_orders WHERE patient_id = $1 ORDER BY ordered_at DESC',
      [patient.id]
    );
    const orders = ordersResult.rows || [];

    let reportsMap = {};
    if (orders.length) {
      const orderIds = orders.map(o => o.id);
      const reportsResult = await db.query(
        'SELECT * FROM lab_reports WHERE lab_order_id = ANY($1)',
        [orderIds]
      );
      (reportsResult.rows || []).forEach(r => {
        if (!reportsMap[r.lab_order_id]) reportsMap[r.lab_order_id] = [];
        reportsMap[r.lab_order_id].push(r);
      });
    }

    const doctorIds = [...new Set(orders.map(r => r.doctor_id).filter(Boolean))];
    const doctorMap = {};
    if (doctorIds.length) {
      const doctorsResult = await db.query('SELECT id, user_id FROM doctors WHERE id = ANY($1)', [doctorIds]);
      const userIds = [...new Set((doctorsResult.rows || []).map(d => d.user_id).filter(Boolean))];
      const userMap = {};
      if (userIds.length) {
        const usersResult = await db.query('SELECT id, first_name, last_name FROM users WHERE id = ANY($1)', [userIds]);
        (usersResult.rows || []).forEach(u => { userMap[u.id] = u; });
      }
      (doctorsResult.rows || []).forEach(d => { doctorMap[d.id] = { users: userMap[d.user_id] || null }; });
    }

    return res.json({
      lab_orders: orders.map(r => ({
        ...r,
        lab_reports: reportsMap[r.id] || [],
        doctors: doctorMap[r.doctor_id] || null
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Update Lab Order Status ───────────────────────────────────────────────────
const updateLabOrderStatus = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = getUserOrganizationId(req);
    const { id } = req.params;
    const { status, sample_collection_notes } = req.body;
    const allowed = ['ordered', 'sample_collected', 'processing', 'ready', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const fields = ['status = $1', 'updated_by = $2', 'updated_at = $3'];
    const params = [status, req.user.id, new Date().toISOString()];

    if (status === 'sample_collected') {
      params.push(new Date().toISOString());
      fields.push(`sample_collected_at = $${params.length}`);
    }
    if (status === 'ready') {
      params.push(new Date().toISOString());
      fields.push(`ready_at = $${params.length}`);
    }
    if (status === 'delivered') {
      params.push(new Date().toISOString());
      fields.push(`delivered_at = $${params.length}`);
    }
    if (sample_collection_notes) {
      params.push(sample_collection_notes);
      fields.push(`sample_collection_notes = $${params.length}`);
    }

    params.push(id);
    let queryText = `UPDATE lab_orders SET ${fields.join(', ')} WHERE id = $${params.length}`;
    if (organizationId) {
      params.push(organizationId);
      queryText += ` AND organization_id = $${params.length}`;
    }
    queryText += ' RETURNING *';

    const result = await db.query(queryText, params);
    const data = result.rows[0];
    if (!data) return res.status(404).json({ error: 'Lab order not found' });

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: `LAB_${status.toUpperCase()}`, module: 'Lab', entity_type: 'lab_order', entity_id: id });
    return res.json({ message: 'Lab order updated', lab_order: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Upload Lab Report ─────────────────────────────────────────────────────────
const uploadLabReport = async (req, res) => {
  try {
    const db = req.db;
    const { lab_order_id, patient_id, doctor_id, consultation_id, report_data, report_url, findings, remarks, is_normal } = req.body;
    if (!lab_order_id || !patient_id) return res.status(400).json({ error: 'lab_order_id and patient_id required' });

    const organizationId = getUserOrganizationId(req);
    const insertQuery = `
      INSERT INTO lab_reports (
        lab_order_id, patient_id, doctor_id, consultation_id, report_data,
        report_url, findings, remarks, is_normal, status,
        organization_id, uploaded_by, uploaded_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    const params = [
      lab_order_id,
      patient_id,
      doctor_id || null,
      consultation_id || null,
      report_data || null,
      report_url || null,
      findings || null,
      remarks || null,
      is_normal !== undefined ? is_normal : null,
      'ready',
      organizationId || null,
      req.user.id,
      new Date().toISOString(),
      new Date().toISOString()
    ];

    const insertResult = await db.query(insertQuery, params);
    const data = insertResult.rows[0];

    // Mark lab order as ready
    await db.query(
      'UPDATE lab_orders SET status = $1, ready_at = $2 WHERE id = $3',
      ['ready', new Date().toISOString(), lab_order_id]
    );

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'UPLOAD_LAB_REPORT', module: 'Lab', entity_type: 'lab_report', entity_id: data.id });
    return res.status(201).json({ message: 'Lab report uploaded', report: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Upload File to storage ──────────────────────────────────────────
const uploadLabFile = async (req, res) => {
  try {
    const { base64, filename, content_type } = req.body;
    if (!base64 || !filename) return res.status(400).json({ error: 'base64 and filename required' });

    const buffer = Buffer.from(base64, 'base64');
    const ext    = filename.split('.').pop();
    const filePath = `reports/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const publicUrl = await storage.upload('lab-reports', filePath, buffer, content_type);
    return res.json({ url: publicUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get All Lab Reports ───────────────────────────────────────────────────────
const getLabReports = async (req, res) => {
  try {
    const db = req.db;
    const { patient_id, lab_order_id } = req.query;
    const organizationId = getUserOrganizationId(req);

    let queryText = `
      SELECT lr.*, lo.test_name, lo.test_code
      FROM lab_reports lr
      LEFT JOIN lab_orders lo ON lr.lab_order_id = lo.id
    `;
    const params = [];
    const conditions = [];

    if (organizationId) {
      params.push(organizationId);
      conditions.push(`lr.organization_id = $${params.length}`);
    }
    if (patient_id) {
      params.push(patient_id);
      conditions.push(`lr.patient_id = $${params.length}`);
    }
    if (lab_order_id) {
      params.push(lab_order_id);
      conditions.push(`lr.lab_order_id = $${params.length}`);
    }

    if (conditions.length) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }
    queryText += ' ORDER BY lr.uploaded_at DESC';

    const result = await db.query(queryText, params);
    const rows = result.rows || [];

    // Attach patient info
    const patientIds = [...new Set(rows.map(r => r.patient_id).filter(Boolean))];
    const patientMap = {};
    if (patientIds.length) {
      const patientsResult = await db.query('SELECT id, first_name, last_name, patient_uid, phone FROM patients WHERE id = ANY($1)', [patientIds]);
      (patientsResult.rows || []).forEach(p => { patientMap[p.id] = p; });
    }

    // Attach doctor info
    const doctorIds = [...new Set(rows.map(r => r.doctor_id).filter(Boolean))];
    const doctorMap = {};
    if (doctorIds.length) {
      const doctorsResult = await db.query('SELECT id, user_id FROM doctors WHERE id = ANY($1)', [doctorIds]);
      const userIds = [...new Set((doctorsResult.rows || []).map(d => d.user_id).filter(Boolean))];
      const userMap = {};
      if (userIds.length) {
        const usersResult = await db.query('SELECT id, first_name, last_name FROM users WHERE id = ANY($1)', [userIds]);
        (usersResult.rows || []).forEach(u => { userMap[u.id] = u; });
      }
      (doctorsResult.rows || []).forEach(d => { doctorMap[d.id] = { users: userMap[d.user_id] || null }; });
    }

    return res.json({
      lab_reports: rows.map(r => {
        const { test_name, test_code, ...report } = r;
        return {
          ...report,
          lab_orders: test_name ? { test_name, test_code } : null,
          patients: patientMap[r.patient_id] || null,
          doctors:  doctorMap[r.doctor_id]  || null,
        };
      }),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Correct Lab Report ────────────────────────────────────────────────────────
const correctLabReport = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = getUserOrganizationId(req);
    const { id } = req.params;

    let oldQuery = 'SELECT * FROM lab_reports WHERE id = $1';
    const oldParams = [id];
    if (organizationId) {
      oldParams.push(organizationId);
      oldQuery += ' AND organization_id = $2';
    }
    oldQuery += ' LIMIT 1';

    const oldResult = await db.query(oldQuery, oldParams);
    const old = oldResult.rows[0];
    if (!old) return res.status(404).json({ error: 'Lab report not found' });

    const allowedKeys = ['findings', 'remarks', 'is_normal', 'report_data', 'report_url'];
    const fields = ['status = $1', 'corrected_by = $2', 'corrected_at = $3'];
    const params = ['corrected', req.user.id, new Date().toISOString()];

    allowedKeys.forEach(k => {
      if (req.body[k] !== undefined) {
        params.push(req.body[k]);
        fields.push(`${k} = $${params.length}`);
      }
    });

    params.push(id);
    let updateQuery = `UPDATE lab_reports SET ${fields.join(', ')} WHERE id = $${params.length}`;
    if (organizationId) {
      params.push(organizationId);
      updateQuery += ` AND organization_id = $${params.length}`;
    }
    updateQuery += ' RETURNING *';

    const updateResult = await db.query(updateQuery, params);
    const data = updateResult.rows[0];

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'CORRECT_LAB_REPORT', module: 'Lab', entity_type: 'lab_report', entity_id: id, old_data: old, new_data: req.body });
    return res.json({ message: 'Lab report corrected', report: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Mark Report Delivered ─────────────────────────────────────────────────────
const markReportDelivered = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = getUserOrganizationId(req);
    const { id } = req.params;

    let updateReportQuery = `
      UPDATE lab_reports
      SET status = $1, delivered_at = $2, delivered_by = $3
      WHERE id = $4
    `;
    const params = ['delivered', new Date().toISOString(), req.user.id, id];
    if (organizationId) {
      params.push(organizationId);
      updateReportQuery += ' AND organization_id = $5';
    }
    updateReportQuery += ' RETURNING *';

    const reportResult = await db.query(updateReportQuery, params);
    const data = reportResult.rows[0];
    if (!data) return res.status(404).json({ error: 'Lab report not found' });

    await db.query(
      'UPDATE lab_orders SET status = $1, delivered_at = $2 WHERE id = $3',
      ['delivered', new Date().toISOString(), data.lab_order_id]
    );

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'DELIVER_LAB_REPORT', module: 'Lab', entity_type: 'lab_report', entity_id: id });
    return res.json({ message: 'Report marked delivered', report: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Test Catalog (role-aware — doctors don't see fees) ────────────────────────
const getTestCatalog = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = getUserOrganizationId(req);

    let queryText = 'SELECT id, test_name, test_code, category, fee FROM lab_test_catalog WHERE is_active = true';
    const params = [];
    if (organizationId) {
      params.push(organizationId);
      queryText += ' AND organization_id = $1';
    }
    queryText += ' ORDER BY test_name ASC';

    const result = await db.query(queryText, params);
    const showFee = ![2, 3].includes(req.user?.role_id); // hide from doctors & patients
    return res.json({
      tests: (result.rows || []).map(t =>
        showFee ? t : { id: t.id, test_name: t.test_name, test_code: t.test_code, category: t.category }
      ),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Update Payment Status on Lab Order ───────────────────────────────────────
const updateLabOrderPayment = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = getUserOrganizationId(req);
    const { id } = req.params;
    const { payment_status, payment_source, payment_amount } = req.body;

    let queryText = `
      UPDATE lab_orders
      SET payment_status = $1, payment_source = $2, payment_amount = $3, payment_collected_at = $4
      WHERE id = $5
    `;
    const params = [
      payment_status,
      payment_source || 'lab',
      payment_amount !== undefined ? payment_amount : null,
      new Date().toISOString(),
      id
    ];
    if (organizationId) {
      params.push(organizationId);
      queryText += ' AND organization_id = $6';
    }
    queryText += ' RETURNING id, payment_status, payment_source';

    const result = await db.query(queryText, params);
    const data = result.rows[0];
    if (!data) return res.status(404).json({ error: 'Lab order not found' });
    return res.json({ message: 'Payment status updated', order: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getLabOrders, getLabOrderById, getMyLabOrders, getLabReports, uploadLabFile, updateLabOrderStatus, uploadLabReport, correctLabReport, markReportDelivered, getTestCatalog, updateLabOrderPayment };

