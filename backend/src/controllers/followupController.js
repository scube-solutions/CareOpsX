const { auditLog } = require('../middlewares/audit');

// ── Helpers ───────────────────────────────────────────────────────────────────
const attachRelated = async (rows, db) => {
  if (!rows.length) return rows;

  // Patients
  const patientIds = [...new Set(rows.map(r => r.patient_id).filter(Boolean))];
  const patientMap = {};
  if (patientIds.length) {
    const res = await db.query(
      `SELECT id, first_name, last_name, patient_uid, phone, chronic_disease_tag FROM patients WHERE id = ANY($1)`,
      [patientIds]
    );
    (res.rows || []).forEach(p => { patientMap[p.id] = p; });
  }

  // Doctors → users
  const doctorIds = [...new Set(rows.map(r => r.doctor_id).filter(Boolean))];
  const doctorMap = {};
  if (doctorIds.length) {
    const docRes = await db.query(
      `SELECT id, user_id, specialization FROM doctors WHERE id = ANY($1)`,
      [doctorIds]
    );
    const doctors = docRes.rows || [];
    const userIds = [...new Set(doctors.map(d => d.user_id).filter(Boolean))];
    const userMap = {};
    if (userIds.length) {
      const userRes = await db.query(
        `SELECT id, first_name, last_name FROM users WHERE id = ANY($1)`,
        [userIds]
      );
      (userRes.rows || []).forEach(u => { userMap[u.id] = u; });
    }
    doctors.forEach(d => {
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
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const { patient_id, status, doctor_id, date_from, date_to, missed_only } = req.query;

    const params = [];
    const where = [];
    if (organizationId) { params.push(organizationId); where.push(`organization_id = $${params.length}`); }
    if (patient_id)     { params.push(patient_id);     where.push(`patient_id = $${params.length}`); }
    if (missed_only === 'true') {
      where.push(`status = 'missed'`);
    } else if (status) {
      params.push(status); where.push(`status = $${params.length}`);
    }
    if (doctor_id) { params.push(doctor_id); where.push(`doctor_id = $${params.length}`); }
    if (date_from)  { params.push(date_from); where.push(`follow_up_date >= $${params.length}`); }
    if (date_to)    { params.push(date_to);   where.push(`follow_up_date <= $${params.length}`); }

    const result = await db.query(
      `SELECT * FROM follow_up_plans${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY follow_up_date ASC`,
      params
    );
    const follow_ups = await attachRelated(result.rows || [], db);
    return res.json({ follow_ups });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Single Follow-up ──────────────────────────────────────────────────────
const getFollowUpById = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const params = [req.params.id];
    let orgClause = '';
    if (organizationId) { params.push(organizationId); orgClause = ` AND organization_id = $${params.length}`; }

    const result = await db.query(
      `SELECT * FROM follow_up_plans WHERE id = $1${orgClause}`,
      params
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Follow-up not found' });
    const [follow_up] = await attachRelated([result.rows[0]], db);
    return res.json({ follow_up });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Create Follow-up Plan ─────────────────────────────────────────────────────
const createFollowUp = async (req, res) => {
  try {
    const db = req.db;
    const { patient_id, doctor_id, consultation_id, follow_up_date, required_tests, medication_refill, notes, disease_tag } = req.body;
    if (!patient_id || !follow_up_date) return res.status(400).json({ error: 'patient_id and follow_up_date are required' });

    const insertRes = await db.query(
      `INSERT INTO follow_up_plans
         (patient_id, doctor_id, consultation_id, follow_up_date, required_tests,
          medication_refill, notes, disease_tag, status, reminder_sent,
          organization_id, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'scheduled',false,$9,$10,$11)
       RETURNING *`,
      [
        patient_id, doctor_id || null, consultation_id || null, follow_up_date,
        required_tests || null, medication_refill || false, notes || null, disease_tag || null,
        req.user?.organization_id ?? null, req.user.id, new Date().toISOString()
      ]
    );
    const data = insertRes.rows[0];

    if (disease_tag) {
      await db.query(
        `UPDATE patients SET chronic_disease_tag=$1, updated_by=$2 WHERE id=$3`,
        [disease_tag, req.user.id, patient_id]
      );
    }

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'CREATE_FOLLOWUP', module: 'FollowUp', entity_type: 'follow_up_plan', entity_id: data.id });
    return res.status(201).json({ message: 'Follow-up plan created', follow_up: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Update Follow-up Status ───────────────────────────────────────────────────
const updateFollowUp = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const { id } = req.params;

    // Fetch old
    const oldParams = [id];
    let orgClauseOld = '';
    if (organizationId) { oldParams.push(organizationId); orgClauseOld = ` AND organization_id = $${oldParams.length}`; }
    const oldRes = await db.query(`SELECT * FROM follow_up_plans WHERE id = $1${orgClauseOld}`, oldParams);
    const old = oldRes.rows[0];
    if (!old) return res.status(404).json({ error: 'Follow-up not found' });

    const body = { ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() };
    const keys = Object.keys(body);
    const values = Object.values(body);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(id);
    const idParam = values.length;
    let sql = `UPDATE follow_up_plans SET ${setClauses} WHERE id = $${idParam}`;
    if (organizationId) { values.push(organizationId); sql += ` AND organization_id = $${values.length}`; }
    sql += ' RETURNING *';

    const result = await db.query(sql, values);
    const data = result.rows[0];
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'UPDATE_FOLLOWUP', module: 'FollowUp', entity_type: 'follow_up_plan', entity_id: id, old_data: old, new_data: req.body });
    return res.json({ message: 'Follow-up updated', follow_up: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Missed Follow-ups ─────────────────────────────────────────────────────
const getMissedFollowUps = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const today = new Date().toISOString().split('T')[0];

    const params = [today];
    const where = [`status = 'scheduled'`, `follow_up_date < $1`];
    if (organizationId) { params.push(organizationId); where.push(`organization_id = $${params.length}`); }

    const result = await db.query(
      `SELECT * FROM follow_up_plans WHERE ${where.join(' AND ')} ORDER BY follow_up_date ASC`,
      params
    );
    const missed_follow_ups = await attachRelated(result.rows || [], db);
    return res.json({ missed_follow_ups, count: missed_follow_ups.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Upcoming Follow-ups (next 90 days) ────────────────────────────────────
const getUpcomingFollowUps = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const today = new Date().toISOString().split('T')[0];
    const end   = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const params = [today, end];
    const where = [`status = 'scheduled'`, `follow_up_date >= $1`, `follow_up_date <= $2`];
    if (organizationId) { params.push(organizationId); where.push(`organization_id = $${params.length}`); }

    const result = await db.query(
      `SELECT * FROM follow_up_plans WHERE ${where.join(' AND ')} ORDER BY follow_up_date ASC`,
      params
    );
    const upcoming = await attachRelated(result.rows || [], db);
    return res.json({ upcoming });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Patient: My Follow-ups ────────────────────────────────────────────────────
const getMyFollowUps = async (req, res) => {
  try {
    const db = req.db;
    const patRes = await db.query(`SELECT id FROM patients WHERE user_id = $1 LIMIT 1`, [req.user.id]);
    const patient = patRes.rows[0];
    if (!patient) return res.json({ follow_ups: [] });

    const result = await db.query(
      `SELECT * FROM follow_up_plans WHERE patient_id = $1 ORDER BY follow_up_date ASC`,
      [patient.id]
    );
    const rows = result.rows || [];

    // Attach doctor names
    const doctorIds = [...new Set(rows.map(r => r.doctor_id).filter(Boolean))];
    const doctorMap = {};
    if (doctorIds.length) {
      const docRes = await db.query(`SELECT id, user_id, specialization FROM doctors WHERE id = ANY($1)`, [doctorIds]);
      const doctors = docRes.rows || [];
      const userIds = [...new Set(doctors.map(d => d.user_id).filter(Boolean))];
      const userMap = {};
      if (userIds.length) {
        const userRes = await db.query(`SELECT id, first_name, last_name FROM users WHERE id = ANY($1)`, [userIds]);
        (userRes.rows || []).forEach(u => { userMap[u.id] = u; });
      }
      doctors.forEach(d => { doctorMap[d.id] = { specialization: d.specialization, users: userMap[d.user_id] || null }; });
    }

    return res.json({
      follow_ups: rows.map(f => ({ ...f, doctors: doctorMap[f.doctor_id] || null })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getFollowUps, getFollowUpById, createFollowUp, updateFollowUp, getMissedFollowUps, getUpcomingFollowUps, getMyFollowUps };
