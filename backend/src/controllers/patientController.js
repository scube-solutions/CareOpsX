const { auditLog } = require('../middlewares/audit');
const { getUserOrganizationId } = require('../utils/organizationAccess');

// ── Helpers ───────────────────────────────────────────────────────────────────
const generatePatientId = () => {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `PAT-${year}-${rand}`;
};

// ── Duplicate Detection ───────────────────────────────────────────────────────
const checkDuplicates = async (req, res) => {
  try {
    const db = req.db;
    const { phone, email, first_name, last_name, date_of_birth } = req.body;
    const organizationId = getUserOrganizationId(req);
    const matches = [];

    let queryText = 'SELECT id, patient_uid, first_name, last_name, phone, email, date_of_birth FROM patients WHERE is_archived = false';
    const params = [];
    if (organizationId) {
      params.push(organizationId);
      queryText += ` AND organization_id = $${params.length}`;
    }

    const orConditions = [];
    if (phone) {
      params.push(phone);
      orConditions.push(`phone = $${params.length}`);
    }
    if (email) {
      params.push(email);
      orConditions.push(`email = $${params.length}`);
    }
    if (first_name && last_name && date_of_birth) {
      params.push(first_name, last_name, date_of_birth);
      orConditions.push(`(first_name ILIKE $${params.length - 2} AND last_name ILIKE $${params.length - 1} AND date_of_birth = $${params.length})`);
    }

    if (orConditions.length > 0) {
      queryText += ' AND (' + orConditions.join(' OR ') + ')';
      const result = await db.query(queryText, params);
      
      for (const row of result.rows) {
        let match_reason = 'other';
        if (phone && row.phone === phone) {
          match_reason = 'phone';
        } else if (email && row.email === email) {
          match_reason = 'email';
        } else if (first_name && last_name && date_of_birth && 
                   row.first_name.toLowerCase() === first_name.toLowerCase() && 
                   row.last_name.toLowerCase() === last_name.toLowerCase() &&
                   row.date_of_birth === date_of_birth) {
          match_reason = 'name+dob';
        }
        matches.push({ ...row, match_reason });
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
    const db = req.db;
    const { search, page = 1, limit = 20, chronic_only } = req.query;
    const parsedLimit = parseInt(limit) || 20;
    const offset = (parseInt(page) - 1) * parsedLimit;
    const organizationId = getUserOrganizationId(req);

    let queryText = 'SELECT id, patient_uid, first_name, last_name, gender, date_of_birth, phone, email, blood_group, chronic_disease_tag, is_archived, created_at FROM patients WHERE is_archived = false';
    let countQueryText = 'SELECT COUNT(*)::int FROM patients WHERE is_archived = false';

    const conditions = [];
    const params = [];

    if (organizationId) {
      params.push(organizationId);
      conditions.push(`organization_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(phone ILIKE $${params.length} OR email ILIKE $${params.length} OR first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR patient_uid ILIKE $${params.length})`);
    }
    if (chronic_only === 'true') {
      conditions.push('chronic_disease_tag IS NOT NULL');
    }

    if (conditions.length > 0) {
      const whereClause = ' AND ' + conditions.join(' AND ');
      queryText += whereClause;
      countQueryText += whereClause;
    }

    const countResult = await db.query(countQueryText, params);
    const count = countResult.rows[0].count;

    queryText += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parsedLimit, offset);

    const result = await db.query(queryText, params);
    return res.json({ patients: result.rows, total: count, page: parseInt(page), limit: parsedLimit });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Patient By ID ─────────────────────────────────────────────────────────
const getPatientById = async (req, res) => {
  try {
    const db = req.db;
    const { id } = req.params;
    const organizationId = getUserOrganizationId(req);
    
    let patQuery = 'SELECT * FROM patients WHERE id = $1';
    const patParams = [id];
    if (organizationId) {
      patParams.push(organizationId);
      patQuery += ' AND organization_id = $2';
    }
    patQuery += ' LIMIT 1';
    
    const patResult = await db.query(patQuery, patParams);
    const patient = patResult.rows[0];
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Parallel queries
    const [appts, consultations, labOrders, prescriptions, invoices, followups] = await Promise.all([
      db.query(
        'SELECT id, booking_id, appointment_date, appointment_time, status, appointment_type, token_number, created_at FROM appointments WHERE patient_id = $1 ORDER BY appointment_date DESC LIMIT 20',
        [id]
      ),
      db.query(
        'SELECT id, consultation_date, chief_complaint, diagnosis, consultation_status, created_at FROM consultations WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 10',
        [id]
      ),
      db.query(
        'SELECT id, test_name, status, ordered_at FROM lab_orders WHERE patient_id = $1 ORDER BY ordered_at DESC LIMIT 10',
        [id]
      ),
      db.query(
        'SELECT id, created_at FROM prescriptions WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 10',
        [id]
      ),
      db.query(
        'SELECT id, invoice_number, total_amount, status, invoice_type, created_at FROM invoices WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 10',
        [id]
      ),
      db.query(
        'SELECT id, follow_up_date, status, notes FROM follow_up_plans WHERE patient_id = $1 ORDER BY follow_up_date DESC LIMIT 10',
        [id]
      ),
    ]);

    return res.json({
      patient,
      appointments: appts.rows,
      consultations: consultations.rows,
      lab_orders: labOrders.rows,
      prescriptions: prescriptions.rows,
      invoices: invoices.rows,
      follow_ups: followups.rows,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Create Patient ────────────────────────────────────────────────────────────
const createPatient = async (req, res) => {
  try {
    const db = req.db;
    const { first_name, phone } = req.body;
    if (!first_name || !phone) return res.status(400).json({ error: 'first_name and phone are required' });
    const organizationId = getUserOrganizationId(req);
    const patient_uid = generatePatientId();

    const record = {
      ...req.body,
      patient_uid,
      organization_id: organizationId || null,
      is_archived: false,
      created_by: req.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const keys = Object.keys(record);
    const values = Object.values(record);
    const valuePlaceholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');

    const queryText = `INSERT INTO patients (${keys.join(', ')}) VALUES (${valuePlaceholders}) RETURNING *`;
    const result = await db.query(queryText, values);
    const data = result.rows[0];

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'CREATE_PATIENT', module: 'Patient', entity_type: 'patient', entity_id: data.id, new_data: req.body });
    return res.status(201).json({ message: 'Patient created', patient: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Update Patient ────────────────────────────────────────────────────────────
const updatePatient = async (req, res) => {
  try {
    const db = req.db;
    const { id } = req.params;
    const organizationId = getUserOrganizationId(req);

    // Fetch old patient for audit logging
    let oldQuery = 'SELECT * FROM patients WHERE id = $1';
    const oldParams = [id];
    if (organizationId) {
      oldParams.push(organizationId);
      oldQuery += ' AND organization_id = $2';
    }
    const oldResult = await db.query(oldQuery, oldParams);
    const old = oldResult.rows[0];
    if (!old) return res.status(404).json({ error: 'Patient not found' });

    const updates = {
      ...req.body,
      updated_by: req.user.id,
      updated_at: new Date().toISOString()
    };

    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((key, idx) => `${key} = $${idx + 1}`).join(', ');
    
    let updateQueryText = `UPDATE patients SET ${setClause} WHERE id = $${keys.length + 1}`;
    const updateParams = [...values, id];
    if (organizationId) {
      updateParams.push(organizationId);
      updateQueryText += ` AND organization_id = $${updateParams.length}`;
    }
    updateQueryText += ' RETURNING *';

    const updateResult = await db.query(updateQueryText, updateParams);
    const data = updateResult.rows[0];
    
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'UPDATE_PATIENT', module: 'Patient', entity_type: 'patient', entity_id: id, old_data: old, new_data: req.body });
    return res.json({ message: 'Patient updated', patient: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Archive Patient ───────────────────────────────────────────────────────────
const archivePatient = async (req, res) => {
  try {
    const db = req.db;
    const { id } = req.params;
    const organizationId = getUserOrganizationId(req);
    
    let queryText = 'UPDATE patients SET is_archived = true, updated_by = $1, updated_at = $2 WHERE id = $3';
    const params = [req.user.id, new Date().toISOString(), id];
    if (organizationId) {
      params.push(organizationId);
      queryText += ' AND organization_id = $4';
    }
    queryText += ' RETURNING id, patient_uid, is_archived';

    const result = await db.query(queryText, params);
    const data = result.rows[0];
    if (!data) return res.status(404).json({ error: 'Patient not found' });

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'ARCHIVE_PATIENT', module: 'Patient', entity_type: 'patient', entity_id: id });
    return res.json({ message: 'Patient archived', patient: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Merge Patients (Admin only) ───────────────────────────────────────────────
const mergePatients = async (req, res) => {
  try {
    const db = req.db;
    const { primary_patient_id, duplicate_patient_id } = req.body;
    if (!primary_patient_id || !duplicate_patient_id) return res.status(400).json({ error: 'primary_patient_id and duplicate_patient_id required' });

    // Reassign all records from duplicate to primary
    const tables = ['appointments', 'consultations', 'lab_orders', 'prescriptions', 'invoices', 'follow_up_plans'];
    for (const table of tables) {
      await db.query(`UPDATE ${table} SET patient_id = $1 WHERE patient_id = $2`, [primary_patient_id, duplicate_patient_id]);
    }

    // Archive the duplicate
    await db.query('UPDATE patients SET is_archived = true, merged_into = $1, updated_by = $2 WHERE id = $3', [primary_patient_id, req.user.id, duplicate_patient_id]);

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'MERGE_PATIENT', module: 'Patient', entity_type: 'patient', entity_id: primary_patient_id, description: `Merged patient ${duplicate_patient_id} into ${primary_patient_id}` });
    return res.json({ message: 'Patients merged successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Delete Patient ────────────────────────────────────────────────────────────
const deletePatient = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = getUserOrganizationId(req);
    
    let queryText = 'UPDATE patients SET is_archived = true, updated_by = $1 WHERE id = $2';
    const params = [req.user.id, req.params.id];
    if (organizationId) {
      params.push(organizationId);
      queryText += ' AND organization_id = $3';
    }

    const result = await db.query(queryText, params);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Patient not found' });

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'DELETE_PATIENT', module: 'Patient', entity_type: 'patient', entity_id: req.params.id });
    return res.json({ message: 'Patient archived/deleted' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Patient: get own profile ──────────────────────────────────────────────────
const getMyProfile = async (req, res) => {
  try {
    const db = req.db;
    
    const patResult = await db.query('SELECT * FROM patients WHERE user_id = $1 LIMIT 1', [req.user.id]);
    const patient = patResult.rows[0];
    if (!patient) return res.status(404).json({ error: 'Patient profile not found' });
    
    const userResult = await db.query('SELECT first_name, last_name, email FROM users WHERE id = $1 LIMIT 1', [req.user.id]);
    const user = userResult.rows[0];
    
    return res.json({ patient: { ...patient, email: user?.email || patient.email } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Patient: update own profile ───────────────────────────────────────────────
const updateMyProfile = async (req, res) => {
  try {
    const db = req.db;
    const { first_name, last_name, phone, date_of_birth, gender, address, blood_group, emergency_contact_name, emergency_contact_phone } = req.body;
    
    const patResult = await db.query('SELECT id FROM patients WHERE user_id = $1 LIMIT 1', [req.user.id]);
    const patient = patResult.rows[0];
    if (!patient) return res.status(404).json({ error: 'Patient profile not found' });

    const updates = {};
    if (first_name !== undefined) updates.first_name = first_name;
    if (last_name  !== undefined) updates.last_name  = last_name;
    if (phone      !== undefined) updates.phone      = phone;
    if (date_of_birth !== undefined) updates.date_of_birth = date_of_birth;
    if (gender     !== undefined) updates.gender     = gender;
    if (address    !== undefined) updates.address    = address;
    if (blood_group !== undefined) updates.blood_group = blood_group;
    if (emergency_contact_name  !== undefined) updates.emergency_contact_name  = emergency_contact_name;
    if (emergency_contact_phone !== undefined) updates.emergency_contact_phone = emergency_contact_phone;
    updates.updated_at = new Date().toISOString();

    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((key, idx) => `${key} = $${idx + 1}`).join(', ');

    const updateQueryText = `UPDATE patients SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;
    const updateResult = await db.query(updateQueryText, [...values, patient.id]);
    const data = updateResult.rows[0];

    // Also update users.first_name / last_name if provided
    if (first_name || last_name) {
      const nameUpd = {};
      if (first_name) nameUpd.first_name = first_name;
      if (last_name)  nameUpd.last_name  = last_name;
      
      const userKeys = Object.keys(nameUpd);
      const userValues = Object.values(nameUpd);
      const userSetClause = userKeys.map((key, idx) => `${key} = $${idx + 1}`).join(', ');
      await db.query(`UPDATE users SET ${userSetClause} WHERE id = $${userKeys.length + 1}`, [...userValues, req.user.id]);
    }

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'UPDATE_MY_PROFILE', module: 'Patient', entity_type: 'patient', entity_id: patient.id });
    return res.json({ message: 'Profile updated', patient: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { checkDuplicates, getPatients, getPatientById, createPatient, updatePatient, archivePatient, mergePatients, deletePatient, getMyProfile, updateMyProfile };
