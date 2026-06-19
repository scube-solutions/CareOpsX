const crypto = require('crypto');
const { auditLog } = require('../middlewares/audit');
const {
  getOrganizationContext, ensurePortalEnabled, ensureSeatAvailable, ROLE_LABELS,
  normalizeFeatureFlags,
} = require('../utils/organizationAccess');
const { sendInvitationEmail } = require('../utils/notify');
const { MODULES, ACTIONS, getEffectivePermissions, getEffectivePermissionsForRoles, rolesOf } = require('../utils/permissions');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ── Hospital Profile ──────────────────────────────────────────────────────────
const getHospitalProfile = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId, organization } = await getOrganizationContext(req);
    const result = await db.query(
      `SELECT * FROM hospital_profile WHERE organization_id = $1 LIMIT 1`,
      [organizationId]
    );
    return res.json({
      profile: result.rows[0] || {},
      organization: organization ? {
        id: organization.id,
        organization_name: organization.organization_name,
        created_at: organization.created_at,
        billing_status: organization.billing_status,
        payment_status: organization.payment_status,
        trial_ends_at: organization.trial_ends_at || null,
      } : null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const upsertHospitalProfile = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId, organization } = await getOrganizationContext(req);
    const payload = { ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() };

    const existRes = await db.query(
      `SELECT id FROM hospital_profile WHERE organization_id = $1 LIMIT 1`,
      [organizationId]
    );

    let result;
    if (existRes.rows.length) {
      const keys = Object.keys(payload);
      const values = Object.values(payload);
      const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      values.push(existRes.rows[0].id);
      const qRes = await db.query(
        `UPDATE hospital_profile SET ${setClauses} WHERE id = $${values.length} RETURNING *`,
        values
      );
      result = qRes.rows[0];
    } else {
      if (!payload.hospital_name || !String(payload.hospital_name).trim()) {
        payload.hospital_name = organization?.organization_name || 'Hospital';
      }
      const insertPayload = { ...payload, organization_id: organizationId, created_by: req.user.id };
      const keys = Object.keys(insertPayload);
      const values = Object.values(insertPayload);
      const cols = keys.join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const qRes = await db.query(
        `INSERT INTO hospital_profile (${cols}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      result = qRes.rows[0];
    }

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'UPSERT', module: 'Admin', entity_type: 'hospital_profile', entity_id: result.id });
    return res.json({ message: 'Hospital profile saved', profile: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Logo Upload (MinIO via storage.js) ───────────────────────────────────────
const uploadLogo = async (req, res) => {
  try {
    const { organizationId } = await getOrganizationContext(req);
    const { base64, filename, content_type } = req.body;
    if (!base64 || !filename) return res.status(400).json({ error: 'base64 and filename required' });

    const { uploadFile, getPublicUrl } = require('../utils/storage');
    const buffer = Buffer.from(base64, 'base64');
    const ext    = (filename.split('.').pop() || 'png').toLowerCase();
    const path   = `org_${organizationId}/logo_${Date.now()}.${ext}`;

    await uploadFile('hospital-assets', path, buffer, content_type || 'image/png');
    const publicUrl = getPublicUrl('hospital-assets', path);
    return res.json({ url: publicUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Branches ─────────────────────────────────────────────────────────────────
const getBranches = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const result = await db.query(
      `SELECT * FROM branches WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId]
    );
    return res.json({ branches: result.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createBranch = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const insertPayload = { ...req.body, organization_id: organizationId, created_by: req.user.id };
    const keys = Object.keys(insertPayload);
    const values = Object.values(insertPayload);
    const result = await db.query(
      `INSERT INTO branches (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i+1}`).join(', ')}) RETURNING *`,
      values
    );
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'CREATE', module: 'Admin', entity_type: 'branch', entity_id: result.rows[0].id });
    return res.status(201).json({ message: 'Branch created', branch: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateBranch = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const body = { ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() };
    const keys = Object.keys(body);
    const values = Object.values(body);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(req.params.id, organizationId);
    const result = await db.query(
      `UPDATE branches SET ${setClauses} WHERE id = $${values.length - 1} AND organization_id = $${values.length} RETURNING *`,
      values
    );
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'UPDATE', module: 'Admin', entity_type: 'branch', entity_id: req.params.id });
    return res.json({ message: 'Branch updated', branch: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const deleteBranch = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    await db.query(
      `UPDATE branches SET is_active=false, updated_by=$1 WHERE id=$2 AND organization_id=$3`,
      [req.user.id, req.params.id, organizationId]
    );
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'DEACTIVATE', module: 'Admin', entity_type: 'branch', entity_id: req.params.id });
    return res.json({ message: 'Branch deactivated' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Departments ───────────────────────────────────────────────────────────────
const getDepartments = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { active_only } = req.query;
    const params = [organizationId];
    let extra = '';
    if (active_only === 'true') { params.push(true); extra = ` AND is_active = $${params.length}`; }
    const result = await db.query(
      `SELECT * FROM departments WHERE organization_id = $1${extra} ORDER BY department_name`,
      params
    );
    return res.json({ departments: result.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createDepartment = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { department_name, department_code } = req.body;
    // Check uniqueness
    const existRes = await db.query(
      `SELECT id FROM departments WHERE organization_id=$1 AND (department_name=$2 OR department_code=$3) LIMIT 1`,
      [organizationId, department_name, department_code]
    );
    if (existRes.rows.length) return res.status(409).json({ error: 'Department name or code already exists' });
    const insertPayload = { ...req.body, organization_id: organizationId, is_active: true, created_by: req.user.id };
    const keys = Object.keys(insertPayload);
    const values = Object.values(insertPayload);
    const result = await db.query(
      `INSERT INTO departments (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i+1}`).join(', ')}) RETURNING *`,
      values
    );
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'CREATE', module: 'Admin', entity_type: 'department', entity_id: result.rows[0].id });
    return res.status(201).json({ message: 'Department created', department: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const body = { ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() };
    const keys = Object.keys(body);
    const values = Object.values(body);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(req.params.id, organizationId);
    const result = await db.query(
      `UPDATE departments SET ${setClauses} WHERE id = $${values.length - 1} AND organization_id = $${values.length} RETURNING *`,
      values
    );
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'UPDATE', module: 'Admin', entity_type: 'department', entity_id: req.params.id });
    return res.json({ message: 'Department updated', department: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const toggleDepartment = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const curRes = await db.query(
      `SELECT is_active FROM departments WHERE id=$1 AND organization_id=$2`,
      [req.params.id, organizationId]
    );
    if (!curRes.rows.length) return res.status(404).json({ error: 'Department not found' });
    const nextActive = !curRes.rows[0].is_active;
    const result = await db.query(
      `UPDATE departments SET is_active=$1, updated_by=$2 WHERE id=$3 AND organization_id=$4 RETURNING *`,
      [nextActive, req.user.id, req.params.id, organizationId]
    );
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: nextActive ? 'ACTIVATE' : 'DEACTIVATE', module: 'Admin', entity_type: 'department', entity_id: req.params.id });
    return res.json({ message: `Department ${nextActive ? 'activated' : 'deactivated'}`, department: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Consultation Types / Fee Config ───────────────────────────────────────────
const getConsultationTypes = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const result = await db.query(
      `SELECT * FROM consultation_types WHERE organization_id=$1 ORDER BY type_name`,
      [organizationId]
    );
    return res.json({ consultation_types: result.rows });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const createConsultationType = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const insertPayload = { ...req.body, organization_id: organizationId, created_by: req.user.id };
    const keys = Object.keys(insertPayload);
    const values = Object.values(insertPayload);
    const result = await db.query(
      `INSERT INTO consultation_types (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i+1}`).join(', ')}) RETURNING *`,
      values
    );
    return res.status(201).json({ message: 'Consultation type created', consultation_type: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const updateConsultationType = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const body = { ...req.body, updated_by: req.user.id };
    const keys = Object.keys(body);
    const values = Object.values(body);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(req.params.id, organizationId);
    const result = await db.query(
      `UPDATE consultation_types SET ${setClauses} WHERE id=$${values.length-1} AND organization_id=$${values.length} RETURNING *`,
      values
    );
    return res.json({ message: 'Consultation type updated', consultation_type: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Doctor Leaves / Block Dates ───────────────────────────────────────────────
const getDoctorLeaves = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { doctor_id } = req.query;
    const params = [organizationId];
    let extra = '';
    if (doctor_id) { params.push(doctor_id); extra = ` AND doctor_id = $${params.length}`; }
    const result = await db.query(
      `SELECT * FROM doctor_leaves WHERE organization_id=$1${extra} ORDER BY leave_date ASC`,
      params
    );
    return res.json({ leaves: result.rows });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const createDoctorLeave = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const insertPayload = { ...req.body, organization_id: organizationId, created_by: req.user.id };
    const keys = Object.keys(insertPayload);
    const values = Object.values(insertPayload);
    const result = await db.query(
      `INSERT INTO doctor_leaves (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i+1}`).join(', ')}) RETURNING *`,
      values
    );
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'CREATE', module: 'Admin', entity_type: 'doctor_leave', entity_id: result.rows[0].id });
    return res.status(201).json({ message: 'Leave created', leave: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const deleteDoctorLeave = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    await db.query(`DELETE FROM doctor_leaves WHERE id=$1 AND organization_id=$2`, [req.params.id, organizationId]);
    return res.json({ message: 'Leave deleted' });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Users Management ──────────────────────────────────────────────────────────
const getUsers = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const result = await db.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.role_id, u.roles, u.is_active,
              u.account_status, u.invite_status, u.last_login_at, u.two_factor_enabled,
              u.branch_id, u.organization_id, u.created_at,
              sp.employee_id, sp.department, sp.designation, sp.employment_status
       FROM users u
       LEFT JOIN staff_profiles sp ON sp.user_id = u.id AND sp.organization_id = u.organization_id
       WHERE u.organization_id = $1
       ORDER BY u.created_at DESC`,
      [organizationId]
    );
    const users = result.rows.map(u => ({
      ...u,
      roles: Array.isArray(u.roles) && u.roles.length ? u.roles : [u.role_id],
    }));
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createUser = async (req, res) => {
  try {
    const db = req.db;
    const bcrypt = require('bcryptjs');
    const { organizationId, organization, portalAccess, seatLimits } = await getOrganizationContext(req);
    const { first_name, last_name, email, phone, password, role_id, roles, branch_id, department, designation, send_invite } = req.body;
    const invite = !!send_invite || !password;
    if (!email || !first_name || !last_name) return res.status(400).json({ error: 'Required fields missing' });
    if (!invite && !password) return res.status(400).json({ error: 'Password is required' });

    const dupEmail = await db.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email]);
    if (dupEmail.rows.length) return res.status(409).json({ error: 'Email already exists' });
    if (phone) {
      const dupPhone = await db.query(`SELECT id FROM users WHERE phone=$1 AND role_id != 3 LIMIT 1`, [phone]);
      if (dupPhone.rows.length) return res.status(409).json({ error: 'Mobile number already exists' });
    }

    const primaryRole = role_id || (Array.isArray(roles) && roles[0]) || 5;
    const userRoles   = Array.isArray(roles) && roles.length ? roles : [primaryRole];
    const portalCheck = ensurePortalEnabled(portalAccess, primaryRole);
    if (!portalCheck.ok) return res.status(403).json({ error: portalCheck.message });
    const seatCheck = await ensureSeatAvailable({ organizationId, seatLimits, roleId: primaryRole });
    if (!seatCheck.ok) return res.status(409).json({ error: seatCheck.message });

    const password_hash = await bcrypt.hash(invite ? crypto.randomBytes(24).toString('hex') : password, 10);
    const inviteToken  = invite ? crypto.randomBytes(32).toString('hex') : null;
    const inviteExpiry = invite ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() : null;

    const insertRes = await db.query(
      `INSERT INTO users
         (first_name, last_name, email, phone, password_hash, role_id, roles, branch_id,
          organization_id, is_active, email_verified, account_status, invite_status,
          invite_token, invite_token_expiry, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$12,$13,$14,$15)
       RETURNING id, first_name, last_name, email, phone, role_id, roles, is_active, account_status, invite_status, branch_id, organization_id, created_at`,
      [
        first_name, last_name, email, phone || null, password_hash,
        primaryRole, userRoles, branch_id || null, organizationId,
        !invite,
        invite ? 'pending_activation' : 'active',
        invite ? 'invited' : 'active',
        inviteToken, inviteExpiry, req.user.id
      ]
    );
    const data = insertRes.rows[0];

    // Mirror to staff_profiles
    const existingStaff = await db.query(`SELECT id FROM staff_profiles WHERE user_id=$1 LIMIT 1`, [data.id]);
    if (!existingStaff.rows.length) {
      try {
        await db.query(
          `INSERT INTO staff_profiles
             (organization_id, user_id, full_name, email, mobile, department, designation, role_id, employment_status, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            organizationId, data.id, `${first_name} ${last_name}`.trim(), email, phone || null,
            department || null, designation || null, primaryRole,
            invite ? 'Inactive' : 'Active', !invite
          ]
        );
      } catch { /* best-effort */ }
    }

    if (invite) {
      const url = `${FRONTEND_URL}/activate?token=${inviteToken}`;
      await sendInvitationEmail(email, `${first_name} ${last_name}`.trim(), url, organization?.organization_name, ROLE_LABELS[primaryRole]);
    }

    // Auto-create doctor profile for role 2
    if (userRoles.includes(2)) {
      const { specialization, consultation_fee, experience_years } = req.body;
      const existingDoc = await db.query(`SELECT id FROM doctors WHERE user_id=$1 LIMIT 1`, [data.id]);
      if (!existingDoc.rows.length) {
        await db.query(
          `INSERT INTO doctors (user_id, specialization, consultation_fee, experience_years, organization_id, is_active)
           VALUES ($1,$2,$3,$4,$5,true)`,
          [data.id, specialization || 'General Medicine', consultation_fee != null ? Number(consultation_fee) : 0, experience_years != null && experience_years !== '' ? Number(experience_years) : null, organizationId]
        );
      }
    }

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'CREATE_USER', module: 'Admin', entity_type: 'user', entity_id: data.id });
    return res.status(201).json({ message: invite ? 'User created and invitation sent' : 'User created', user: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId, portalAccess, seatLimits } = await getOrganizationContext(req);
    const { password, roles, ...rest } = req.body;
    let payload = { ...rest, updated_by: req.user.id, updated_at: new Date().toISOString() };
    if (Array.isArray(roles) && roles.length > 0) {
      payload.role_id = roles[0];
      payload.roles   = roles;
      const portalCheck = ensurePortalEnabled(portalAccess, payload.role_id);
      if (!portalCheck.ok) return res.status(403).json({ error: portalCheck.message });
      const seatCheck = await ensureSeatAvailable({ organizationId, seatLimits, roleId: payload.role_id, excludeUserId: req.params.id });
      if (!seatCheck.ok) return res.status(409).json({ error: seatCheck.message });
    }
    if (password) {
      const bcrypt = require('bcryptjs');
      payload.password_hash = await bcrypt.hash(password, 10);
    }

    const keys = Object.keys(payload);
    const values = Object.values(payload);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(req.params.id, organizationId);
    const result = await db.query(
      `UPDATE users SET ${setClauses} WHERE id = $${values.length - 1} AND organization_id = $${values.length}
       RETURNING id, first_name, last_name, email, phone, role_id, roles, is_active, branch_id`,
      values
    );
    const data = result.rows[0];

    // Auto-create doctor profile if role 2
    const updatedRoles = Array.isArray(data.roles) && data.roles.length ? data.roles : [data.role_id].filter(Boolean);
    if (updatedRoles.includes(2)) {
      const existingDoc = await db.query(`SELECT id FROM doctors WHERE user_id=$1 LIMIT 1`, [req.params.id]);
      if (!existingDoc.rows.length) {
        await db.query(
          `INSERT INTO doctors (user_id, specialization, consultation_fee, organization_id, is_active) VALUES ($1,'General Medicine',0,$2,true)`,
          [req.params.id, organizationId]
        );
      }
    }

    // Sync to staff_profiles
    const staffPatch = {};
    if (data.first_name || data.last_name) staffPatch.full_name = `${data.first_name || ''} ${data.last_name || ''}`.trim();
    if (rest.email !== undefined)  staffPatch.email  = data.email;
    if (rest.phone !== undefined)  staffPatch.mobile = data.phone;
    if (Array.isArray(roles) && roles.length) staffPatch.role_id = data.role_id;
    if (rest.is_active !== undefined) {
      staffPatch.is_active = data.is_active;
      staffPatch.employment_status = data.is_active ? 'Active' : 'Inactive';
    }
    if (Object.keys(staffPatch).length) {
      const spKeys = Object.keys(staffPatch);
      const spVals = Object.values(staffPatch);
      const spSet  = spKeys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      spVals.push(req.params.id, organizationId);
      await db.query(
        `UPDATE staff_profiles SET ${spSet} WHERE user_id = $${spVals.length - 1} AND organization_id = $${spVals.length}`,
        spVals
      );
    }

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'UPDATE_USER', module: 'Admin', entity_type: 'user', entity_id: req.params.id });
    return res.json({ message: 'User updated', user: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const toggleUserActive = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const curRes = await db.query(`SELECT is_active FROM users WHERE id=$1 AND organization_id=$2`, [req.params.id, organizationId]);
    if (!curRes.rows.length) return res.status(404).json({ error: 'User not found' });
    const next = !curRes.rows[0].is_active;
    const result = await db.query(
      `UPDATE users SET is_active=$1, account_status=$2, updated_by=$3 WHERE id=$4 AND organization_id=$5 RETURNING id, is_active, account_status`,
      [next, next ? 'active' : 'inactive', req.user.id, req.params.id, organizationId]
    );
    const data = result.rows[0];
    await db.query(
      `UPDATE staff_profiles SET is_active=$1, employment_status=$2 WHERE user_id=$3 AND organization_id=$4`,
      [data.is_active, data.is_active ? 'Active' : 'Inactive', req.params.id, organizationId]
    );
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: data.is_active ? 'UNLOCK_USER' : 'LOCK_USER', module: 'Admin', entity_type: 'user', entity_id: req.params.id });
    return res.json({ message: `User ${data.is_active ? 'activated' : 'locked'}`, user: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Helper: cascade delete all records for a doctor
const cascadeDeleteDoctor = async (doctorId, db) => {
  const apptRes = await db.query(`SELECT id FROM appointments WHERE doctor_id=$1`, [doctorId]);
  const apptIds = apptRes.rows.map(a => a.id);
  const loRes   = await db.query(`SELECT id FROM lab_orders WHERE doctor_id=$1`, [doctorId]);
  const loIds   = loRes.rows.map(l => l.id);

  if (loIds.length)   await db.query(`DELETE FROM lab_results WHERE lab_order_id = ANY($1)`, [loIds]);
  if (apptIds.length) await db.query(`DELETE FROM lab_results WHERE appointment_id = ANY($1)`, [apptIds]);
  await db.query(`DELETE FROM lab_results WHERE doctor_id=$1`, [doctorId]);
  if (apptIds.length) await db.query(`DELETE FROM queue_tokens WHERE appointment_id = ANY($1)`, [apptIds]);
  await db.query(`DELETE FROM queue_tokens WHERE doctor_id=$1`, [doctorId]);
  if (apptIds.length) await db.query(`DELETE FROM prescriptions WHERE appointment_id = ANY($1)`, [apptIds]);
  await db.query(`DELETE FROM prescriptions WHERE doctor_id=$1`, [doctorId]);
  if (apptIds.length) await db.query(`DELETE FROM lab_orders WHERE appointment_id = ANY($1)`, [apptIds]);
  await db.query(`DELETE FROM lab_orders WHERE doctor_id=$1`, [doctorId]);
  if (apptIds.length) await db.query(`DELETE FROM consultations WHERE appointment_id = ANY($1)`, [apptIds]);
  await db.query(`DELETE FROM consultations WHERE doctor_id=$1`, [doctorId]);
  await db.query(`DELETE FROM follow_ups WHERE doctor_id=$1`, [doctorId]);
  await db.query(`DELETE FROM appointments WHERE doctor_id=$1`, [doctorId]);
  await db.query(`DELETE FROM doctor_leaves WHERE doctor_id=$1`, [doctorId]);
  await db.query(`DELETE FROM doctor_availability WHERE doctor_id=$1`, [doctorId]);
  await db.query(`DELETE FROM doctor_blocked_slots WHERE doctor_id=$1`, [doctorId]);
  await db.query(`DELETE FROM doctors WHERE id=$1`, [doctorId]);
};

const deleteUser = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });

    const userRes = await db.query(`SELECT id, first_name, last_name, role_id FROM users WHERE id=$1 AND organization_id=$2`, [id, organizationId]);
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role_id === 1) return res.status(403).json({ error: 'Cannot delete admin accounts' });

    if (user.role_id === 2) {
      const docRes = await db.query(`SELECT id FROM doctors WHERE user_id=$1 LIMIT 1`, [id]);
      const doctor = docRes.rows[0];
      if (doctor) {
        const apptRes = await db.query(
          `SELECT a.id, a.appointment_date, a.appointment_time, a.status, a.patient_id
           FROM appointments a
           WHERE a.doctor_id=$1 AND a.status NOT IN ('cancelled','completed')`,
          [doctor.id]
        );
        if (apptRes.rows.length > 0) {
          const appts = apptRes.rows;
          const patientIds = [...new Set(appts.map(a => a.patient_id).filter(Boolean))];
          const patRes  = await db.query(`SELECT id, user_id FROM patients WHERE id = ANY($1)`, [patientIds]);
          const uids    = patRes.rows.map(p => p.user_id).filter(Boolean);
          const uMap    = {};
          if (uids.length) {
            const puRes = await db.query(`SELECT id, first_name, last_name FROM users WHERE id = ANY($1)`, [uids]);
            puRes.rows.forEach(u => { uMap[u.id] = u; });
          }
          const pMap = {};
          patRes.rows.forEach(p => { pMap[p.id] = uMap[p.user_id] || null; });
          const appointments = appts.map(a => ({
            id: a.id, appointment_date: a.appointment_date, appointment_time: a.appointment_time, status: a.status,
            patient_name: pMap[a.patient_id] ? `${pMap[a.patient_id].first_name} ${pMap[a.patient_id].last_name}` : 'Unknown Patient'
          }));
          return res.status(409).json({ error: 'Doctor has active appointments', appointments });
        }
        await cascadeDeleteDoctor(doctor.id, db);
      }
    }

    await db.query(`DELETE FROM users WHERE id=$1 AND organization_id=$2`, [id, organizationId]);
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'DELETE_USER', module: 'Admin', entity_type: 'user', entity_id: id });
    return res.json({ message: `User ${user.first_name} ${user.last_name} deleted` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const bulkDeleteUsers = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array is required' });

    const deleted = [], skipped = [];

    for (const id of ids) {
      if (id === req.user.id) { skipped.push({ id, reason: 'own account' }); continue; }
      const userRes = await db.query(`SELECT id, first_name, last_name, role_id FROM users WHERE id=$1 AND organization_id=$2`, [id, organizationId]);
      const user = userRes.rows[0];
      if (!user) { skipped.push({ id, reason: 'not found' }); continue; }
      if (user.role_id === 1) { skipped.push({ id, reason: 'admin account' }); continue; }

      if (user.role_id === 2) {
        const docRes = await db.query(`SELECT id FROM doctors WHERE user_id=$1 LIMIT 1`, [id]);
        const doctor = docRes.rows[0];
        if (doctor) {
          const apptRes = await db.query(
            `SELECT id FROM appointments WHERE doctor_id=$1 AND status NOT IN ('cancelled','completed')`,
            [doctor.id]
          );
          if (apptRes.rows.length) { skipped.push({ id, reason: 'doctor has active appointments' }); continue; }
          await cascadeDeleteDoctor(doctor.id, db);
        }
      }

      await db.query(`DELETE FROM users WHERE id=$1 AND organization_id=$2`, [id, organizationId]);
      deleted.push(id);
      await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'DELETE_USER', module: 'Admin', entity_type: 'user', entity_id: id });
    }

    return res.json({ message: `${deleted.length} user(s) deleted`, deleted, skipped });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const db = req.db;
    const bcrypt = require('bcryptjs');
    const { organizationId } = await getOrganizationContext(req);
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const password_hash = await bcrypt.hash(new_password, 10);
    await db.query(
      `UPDATE users SET password_hash=$1, force_password_change=true, updated_by=$2 WHERE id=$3 AND organization_id=$4`,
      [password_hash, req.user.id, req.params.id, organizationId]
    );
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'RESET_PASSWORD', module: 'Admin', entity_type: 'user', entity_id: req.params.id });
    return res.json({ message: 'Password reset successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const USER_STATUSES = ['active', 'inactive', 'suspended', 'pending_invitation', 'pending_activation'];
const setUserStatus = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { status } = req.body;
    if (!USER_STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${USER_STATUSES.join(', ')}` });
    if (req.params.id === req.user.id && status !== 'active') return res.status(400).json({ error: 'You cannot change the status of your own account' });
    const isActive = status === 'active';
    const result = await db.query(
      `UPDATE users SET account_status=$1, is_active=$2, updated_by=$3 WHERE id=$4 AND organization_id=$5 RETURNING id, account_status, is_active`,
      [status, isActive, req.user.id, req.params.id, organizationId]
    );
    await db.query(
      `UPDATE staff_profiles SET is_active=$1, employment_status=$2 WHERE user_id=$3 AND organization_id=$4`,
      [isActive, isActive ? 'Active' : (status === 'suspended' ? 'Suspended' : 'Inactive'), req.params.id, organizationId]
    );
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: `STATUS_${status.toUpperCase()}`, module: 'Admin', entity_type: 'user', entity_id: req.params.id });
    return res.json({ message: `User status set to ${status}`, user: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const inviteUser = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId, organization } = await getOrganizationContext(req);
    const userRes = await db.query(
      `SELECT id, first_name, last_name, email, role_id, invite_status FROM users WHERE id=$1 AND organization_id=$2`,
      [req.params.id, organizationId]
    );
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.invite_status === 'active') return res.status(409).json({ error: 'This account is already activated' });

    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await db.query(
      `UPDATE users SET invite_token=$1, invite_token_expiry=$2, invite_status='invited', account_status='pending_activation' WHERE id=$3`,
      [token, expiry, user.id]
    );

    const url  = `${FRONTEND_URL}/activate?token=${token}`;
    const sent = await sendInvitationEmail(user.email, `${user.first_name} ${user.last_name}`.trim(), url, organization?.organization_name, ROLE_LABELS[user.role_id]);
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'INVITE_USER', module: 'Admin', entity_type: 'user', entity_id: user.id });
    return res.json({
      message: sent ? 'Invitation sent' : 'Invitation created — email delivery unavailable, share the link manually.',
      ...(!sent && process.env.NODE_ENV !== 'production' ? { activate_url: url } : {}),
    });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Plan info + feature upgrade requests (org admin side) ─────────────────────
const FEATURE_CATALOG = [
  { key: 'hrms',         label: 'HRMS',         desc: 'Staff, attendance, leave, payroll, shifts.' },
  { key: 'ai_assistant', label: 'AI Assistant', desc: 'Natural-language insights, reports & summaries.' },
  { key: 'queue_voice',  label: 'Queue Voice',  desc: 'Automated voice announcements at the lobby.' },
];

const getMyPlanInfo = async (req, res) => {
  try {
    const db = req.db;
    const { organization } = await getOrganizationContext(req);
    const flags    = normalizeFeatureFlags(organization?.feature_flags);
    const features = FEATURE_CATALOG.map(f => ({ ...f, enabled: flags[f.key] === true }));
    const pendingRes = await db.query(
      `SELECT feature, status FROM feature_requests WHERE organization_id=$1 AND status='pending'`,
      [organization?.id]
    );
    const pendingSet = new Set((pendingRes.rows || []).map(p => p.feature));
    return res.json({
      plan: organization?.plan || 'trial',
      features: features.map(f => ({ ...f, requested: pendingSet.has(f.key) })),
    });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const requestFeature = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { feature, message } = req.body;
    if (!FEATURE_CATALOG.some(f => f.key === feature)) return res.status(400).json({ error: 'Unknown feature' });
    const existRes = await db.query(
      `SELECT id FROM feature_requests WHERE organization_id=$1 AND feature=$2 AND status='pending' LIMIT 1`,
      [organizationId, feature]
    );
    if (existRes.rows.length) return res.status(409).json({ error: 'A request for this feature is already pending.' });
    const result = await db.query(
      `INSERT INTO feature_requests (organization_id, requested_by, request_type, feature, message, status)
       VALUES ($1,$2,'feature',$3,$4,'pending') RETURNING *`,
      [organizationId, req.user.id, feature, message || null]
    );
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: organizationId, action: 'REQUEST_FEATURE', module: 'Admin', entity_type: 'feature_request', entity_id: result.rows[0].id, description: feature });
    return res.status(201).json({ message: 'Request submitted. Our support team will contact you.', request: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── RBAC Permission Matrix ────────────────────────────────────────────────────
const getPermissionMatrix = async (req, res) => {
  try {
    const { organizationId } = await getOrganizationContext(req);
    const roleIds = [1, 2, 5, 6, 7, 8, 10, 11, 12];
    const matrix = {};
    for (const r of roleIds) matrix[r] = await getEffectivePermissions(organizationId, r);
    return res.json({ modules: MODULES, actions: ACTIONS, roles: roleIds, matrix });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const updateRolePermissions = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const roleId = Number(req.params.roleId);
    if (roleId === 1 || roleId === 9) return res.status(400).json({ error: 'Admin and Super Admin always have full access and cannot be edited' });
    const { permissions } = req.body;
    if (!permissions || typeof permissions !== 'object') return res.status(400).json({ error: 'permissions object is required' });

    const rows = MODULES
      .filter(m => permissions[m])
      .map(m => ({
        organization_id: organizationId, role_id: roleId, module: m,
        can_view: !!permissions[m].view, can_create: !!permissions[m].create,
        can_edit: !!permissions[m].edit, can_delete: !!permissions[m].delete,
        can_approve: !!permissions[m].approve,
        updated_by: req.user.id, updated_at: new Date().toISOString(),
      }));

    for (const row of rows) {
      const keys = Object.keys(row);
      const values = Object.values(row);
      const cols = keys.join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const updateCols = keys.filter(k => !['organization_id', 'role_id', 'module'].includes(k));
      const updateSet  = updateCols.map(k => `${k} = EXCLUDED.${k}`).join(', ');
      await db.query(
        `INSERT INTO role_permissions (${cols}) VALUES (${placeholders})
         ON CONFLICT (organization_id, role_id, module) DO UPDATE SET ${updateSet}`,
        values
      );
    }

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'UPDATE_PERMISSIONS', module: 'Admin', entity_type: 'role', entity_id: roleId });
    return res.json({ message: 'Permissions updated' });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const getMyPermissions = async (req, res) => {
  try {
    const { organizationId } = await getOrganizationContext(req);
    const grid = await getEffectivePermissionsForRoles(organizationId, rolesOf(req.user));
    return res.json({ permissions: grid, modules: MODULES, actions: ACTIONS });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Lab Test Catalog ──────────────────────────────────────────────────────────
const getLabTestCatalog = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const result = await db.query(
      `SELECT * FROM lab_test_catalog WHERE organization_id=$1 ORDER BY test_name ASC`,
      [organizationId]
    );
    return res.json({ tests: result.rows || [] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const createLabTest = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { test_name, test_code, category, fee, description } = req.body;
    if (!test_name || fee == null) return res.status(400).json({ error: 'test_name and fee are required' });
    const result = await db.query(
      `INSERT INTO lab_test_catalog
         (organization_id, test_name, test_code, category, fee, description, is_active, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8) RETURNING *`,
      [organizationId, test_name, test_code || null, category || null, parseFloat(fee), description || null, req.user.id, new Date().toISOString()]
    );
    return res.status(201).json({ test: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const updateLabTest = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const body = { ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() };
    const keys = Object.keys(body);
    const values = Object.values(body);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(req.params.id, organizationId);
    const result = await db.query(
      `UPDATE lab_test_catalog SET ${setClauses} WHERE id=$${values.length-1} AND organization_id=$${values.length} RETURNING *`,
      values
    );
    return res.json({ test: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const deleteLabTest = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    await db.query(`DELETE FROM lab_test_catalog WHERE id=$1 AND organization_id=$2`, [req.params.id, organizationId]);
    return res.json({ message: 'Test deleted' });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Specializations ───────────────────────────────────────────────────────────
const getSpecializations = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const result = await db.query(
      `SELECT * FROM specializations WHERE organization_id=$1 ORDER BY name`,
      [organizationId]
    );
    return res.json({ specializations: result.rows });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const createSpecialization = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const result = await db.query(
      `INSERT INTO specializations (organization_id, name) VALUES ($1,$2) RETURNING *`,
      [organizationId, name.trim()]
    );
    return res.status(201).json({ specialization: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const toggleSpecialization = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const curRes = await db.query(`SELECT is_active FROM specializations WHERE id=$1 AND organization_id=$2`, [req.params.id, organizationId]);
    const result = await db.query(
      `UPDATE specializations SET is_active=$1 WHERE id=$2 AND organization_id=$3 RETURNING *`,
      [!curRes.rows[0]?.is_active, req.params.id, organizationId]
    );
    return res.json({ specialization: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const deleteSpecialization = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    await db.query(`DELETE FROM specializations WHERE id=$1 AND organization_id=$2`, [req.params.id, organizationId]);
    return res.json({ message: 'Deleted' });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Hospital Rooms ───────────────────────────────────────────────────────────
const getRooms = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const result = await db.query(`SELECT * FROM hospital_rooms WHERE organization_id=$1 ORDER BY room_name`, [organizationId]);
    return res.json({ rooms: result.rows });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const createRoom = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const insertPayload = { ...req.body, organization_id: organizationId };
    const keys = Object.keys(insertPayload);
    const values = Object.values(insertPayload);
    const result = await db.query(
      `INSERT INTO hospital_rooms (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i+1}`).join(', ')}) RETURNING *`,
      values
    );
    return res.status(201).json({ room: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const updateRoom = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const keys = Object.keys(req.body);
    const values = Object.values(req.body);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(req.params.id, organizationId);
    const result = await db.query(
      `UPDATE hospital_rooms SET ${setClauses} WHERE id=$${values.length-1} AND organization_id=$${values.length} RETURNING *`,
      values
    );
    return res.json({ room: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const deleteRoom = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    await db.query(`DELETE FROM hospital_rooms WHERE id=$1 AND organization_id=$2`, [req.params.id, organizationId]);
    return res.json({ message: 'Room deleted' });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

module.exports = {
  getHospitalProfile, upsertHospitalProfile, uploadLogo,
  getBranches, createBranch, updateBranch, deleteBranch,
  getDepartments, createDepartment, updateDepartment, toggleDepartment,
  getConsultationTypes, createConsultationType, updateConsultationType,
  getDoctorLeaves, createDoctorLeave, deleteDoctorLeave,
  getUsers, createUser, updateUser, toggleUserActive, deleteUser, bulkDeleteUsers, resetUserPassword,
  setUserStatus, inviteUser, getPermissionMatrix, updateRolePermissions, getMyPermissions,
  getMyPlanInfo, requestFeature,
  getLabTestCatalog, createLabTest, updateLabTest, deleteLabTest,
  getSpecializations, createSpecialization, toggleSpecialization, deleteSpecialization,
  getRooms, createRoom, updateRoom, deleteRoom,
};
