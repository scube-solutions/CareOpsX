const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getOrganizationContext, ensurePortalEnabled, ensureSeatAvailable, ROLE_LABELS } = require('../utils/organizationAccess');
const { sendInvitationEmail } = require('../utils/notify');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const splitName = (fullName = '') => {
  const parts = String(fullName).trim().split(/\s+/);
  return { first_name: parts.shift() || '-', last_name: parts.join(' ') || '-' };
};

const buildInvite = () => {
  const token  = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  return { token, expiry, url: `${FRONTEND_URL}/activate?token=${token}` };
};

// ── Staff ────────────────────────────────────────────────────────────────────
const getStaff = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const result = await db.query(
      `SELECT sp.*,
              u.id AS user_id_joined, u.first_name, u.last_name, u.email AS user_email,
              u.phone, u.role_id, u.is_active AS user_is_active,
              u.invite_status, u.email_verified
       FROM staff_profiles sp
       LEFT JOIN users u ON u.id = sp.user_id
       WHERE sp.organization_id = $1
       ORDER BY sp.created_at DESC`,
      [organizationId]
    );
    const staff = (result.rows || []).map(row => ({
      ...row,
      users: row.user_id ? {
        id: row.user_id, first_name: row.first_name, last_name: row.last_name,
        email: row.user_email, phone: row.phone, role_id: row.role_id,
        is_active: row.user_is_active, invite_status: row.invite_status, email_verified: row.email_verified,
      } : null,
    }));
    return res.json({ staff });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const createStaff = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId, portalAccess, seatLimits } = await getOrganizationContext(req);
    const {
      employee_id, full_name, email, mobile, department, designation,
      role_id, employment_type, employment_status, create_login,
      date_of_joining, blood_group, emergency_contact, address,
    } = req.body;

    if (!full_name || !String(full_name).trim()) return res.status(400).json({ error: 'Full name is required' });
    if (!email || !EMAIL_RE.test(email))         return res.status(400).json({ error: 'A valid email address is required' });
    const roleId = Number(role_id) || null;
    if (create_login && !roleId)                 return res.status(400).json({ error: 'Assigned role is required to create a system login' });

    const dupEmail = await db.query(`SELECT id FROM staff_profiles WHERE organization_id=$1 AND LOWER(email)=LOWER($2) LIMIT 1`, [organizationId, email]);
    if (dupEmail.rows.length) return res.status(409).json({ error: 'An employee with this email already exists' });
    if (mobile) {
      const dupMobile = await db.query(`SELECT id FROM staff_profiles WHERE organization_id=$1 AND mobile=$2 LIMIT 1`, [organizationId, mobile]);
      if (dupMobile.rows.length) return res.status(409).json({ error: 'An employee with this mobile number already exists' });
    }

    let userId = null;
    let inviteUrl = null;

    if (create_login) {
      const portalCheck = ensurePortalEnabled(portalAccess, roleId);
      if (!portalCheck.ok) return res.status(403).json({ error: portalCheck.message });
      const seatCheck = await ensureSeatAvailable({ organizationId, seatLimits, roleId });
      if (!seatCheck.ok) return res.status(409).json({ error: seatCheck.message });

      const existUser = await db.query(`SELECT id FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1`, [email]);
      if (existUser.rows.length) return res.status(409).json({ error: 'A user account with this email already exists' });
      if (mobile) {
        const existPhone = await db.query(`SELECT id FROM users WHERE organization_id=$1 AND phone=$2 LIMIT 1`, [organizationId, mobile]);
        if (existPhone.rows.length) return res.status(409).json({ error: 'A user account with this mobile number already exists' });
      }

      const { first_name, last_name } = splitName(full_name);
      const isActive = (employment_status || 'Active') === 'Active';
      const placeholderHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
      const { token, expiry, url } = buildInvite();
      inviteUrl = url;

      const userInsert = await db.query(
        `INSERT INTO users
           (first_name, last_name, email, phone, password_hash, role_id, roles,
            organization_id, is_active, email_verified, invite_status, invite_token, invite_token_expiry, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,'invited',$10,$11,$12)
         RETURNING id`,
        [
          first_name, last_name, email, mobile || null,
          placeholderHash, roleId, [roleId], organizationId,
          isActive, token, expiry, req.user.id
        ]
      );
      userId = userInsert.rows[0].id;

      if (roleId === 2) {
        const existDoc = await db.query(`SELECT id FROM doctors WHERE user_id=$1 LIMIT 1`, [userId]);
        if (!existDoc.rows.length) {
          await db.query(
            `INSERT INTO doctors (user_id, specialization, consultation_fee, organization_id, is_active)
             VALUES ($1,'General Medicine',0,$2,true)`,
            [userId, organizationId]
          );
        }
      }
    }

    const staffInsert = await db.query(
      `INSERT INTO staff_profiles
         (organization_id, user_id, employee_id, full_name, email, mobile, department, designation,
          role_id, employment_type, employment_status, date_of_joining, blood_group, emergency_contact, address, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        organizationId, userId, employee_id || null, String(full_name).trim(),
        email, mobile || null, department || null, designation || null,
        roleId, employment_type || null, employment_status || 'Active',
        date_of_joining || null, blood_group || null, emergency_contact || null, address || null,
        (employment_status || 'Active') === 'Active'
      ]
    );
    const staffRow = staffInsert.rows[0];

    let userRow = null;
    if (userId) {
      const uRes = await db.query(`SELECT id, first_name, last_name, email, phone, role_id, is_active, invite_status FROM users WHERE id=$1`, [userId]);
      userRow = uRes.rows[0] || null;
    }

    return res.status(201).json({
      staff: { ...staffRow, users: userRow },
      has_login: !!userId,
      ...(!userId && inviteUrl && process.env.NODE_ENV !== 'production' ? { invite_url: inviteUrl } : {}),
    });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const updateStaff = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const {
      employee_id, full_name, email, mobile, department, designation,
      role_id, employment_type, employment_status,
      date_of_joining, blood_group, emergency_contact, address,
    } = req.body;

    const payload = {};
    if (employee_id !== undefined)        payload.employee_id       = employee_id;
    if (full_name !== undefined)          payload.full_name         = full_name;
    if (email !== undefined)              payload.email             = email;
    if (mobile !== undefined)             payload.mobile            = mobile;
    if (department !== undefined)         payload.department        = department;
    if (designation !== undefined)        payload.designation       = designation;
    if (role_id !== undefined)            payload.role_id           = Number(role_id) || null;
    if (employment_type !== undefined)    payload.employment_type   = employment_type;
    if (employment_status !== undefined)  { payload.employment_status = employment_status; payload.is_active = employment_status === 'Active'; }
    if (date_of_joining !== undefined)    payload.date_of_joining   = date_of_joining || null;
    if (blood_group !== undefined)        payload.blood_group       = blood_group;
    if (emergency_contact !== undefined)  payload.emergency_contact = emergency_contact;
    if (address !== undefined)            payload.address           = address;

    const keys = Object.keys(payload);
    const values = Object.values(payload);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(req.params.id, organizationId);

    const result = await db.query(
      `UPDATE staff_profiles SET ${setClauses} WHERE id=$${values.length - 1} AND organization_id=$${values.length} RETURNING *`,
      values
    );
    const staffRow = result.rows[0];

    // Sync to linked user
    if (staffRow.user_id) {
      const userPatch = {};
      if (full_name !== undefined)         Object.assign(userPatch, splitName(full_name));
      if (email !== undefined)             userPatch.email = email;
      if (mobile !== undefined)            userPatch.phone = mobile || null;
      if (role_id !== undefined && Number(role_id)) { userPatch.role_id = Number(role_id); userPatch.roles = [Number(role_id)]; }
      if (employment_status !== undefined) userPatch.is_active = employment_status === 'Active';
      if (Object.keys(userPatch).length) {
        userPatch.updated_by = req.user.id;
        const upKeys = Object.keys(userPatch);
        const upVals = Object.values(userPatch);
        const upSet  = upKeys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        upVals.push(staffRow.user_id, organizationId);
        await db.query(
          `UPDATE users SET ${upSet} WHERE id=$${upVals.length - 1} AND organization_id=$${upVals.length}`,
          upVals
        );
      }
    }

    // Attach user data
    let userRow = null;
    if (staffRow.user_id) {
      const uRes = await db.query(`SELECT id, first_name, last_name, email, phone, role_id, is_active, invite_status FROM users WHERE id=$1`, [staffRow.user_id]);
      userRow = uRes.rows[0] || null;
    }

    return res.json({ staff: { ...staffRow, users: userRow } });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const toggleStaff = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const existRes = await db.query(`SELECT is_active, user_id FROM staff_profiles WHERE id=$1 LIMIT 1`, [req.params.id]);
    const existing = existRes.rows[0];
    const next = !existing?.is_active;
    const result = await db.query(
      `UPDATE staff_profiles SET is_active=$1, employment_status=$2 WHERE id=$3 AND organization_id=$4 RETURNING *`,
      [next, next ? 'Active' : 'Inactive', req.params.id, organizationId]
    );
    const staffRow = result.rows[0];

    if (existing?.user_id) {
      await db.query(
        `UPDATE users SET is_active=$1, updated_by=$2 WHERE id=$3 AND organization_id=$4`,
        [next, req.user.id, existing.user_id, organizationId]
      );
    }

    let userRow = null;
    if (staffRow.user_id) {
      const uRes = await db.query(`SELECT id, first_name, last_name, email, phone, role_id, is_active, invite_status FROM users WHERE id=$1`, [staffRow.user_id]);
      userRow = uRes.rows[0] || null;
    }
    return res.json({ staff: { ...staffRow, users: userRow } });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const inviteStaff = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId, organization } = await getOrganizationContext(req);
    const staffRes = await db.query(
      `SELECT id, full_name, email, user_id, role_id FROM staff_profiles WHERE id=$1 AND organization_id=$2`,
      [req.params.id, organizationId]
    );
    const staff = staffRes.rows[0];
    if (!staff)         return res.status(404).json({ error: 'Staff member not found' });
    if (!staff.user_id) return res.status(400).json({ error: 'This employee has no system login. Enable "Create System Login" first.' });

    const userRes = await db.query(`SELECT id, first_name, email, invite_status FROM users WHERE id=$1`, [staff.user_id]);
    const user = userRes.rows[0];
    if (!user)                         return res.status(404).json({ error: 'Linked user account not found' });
    if (user.invite_status === 'active') return res.status(409).json({ error: 'This account is already activated' });

    const { token, expiry, url } = buildInvite();
    await db.query(
      `UPDATE users SET invite_token=$1, invite_token_expiry=$2, invite_status='invited' WHERE id=$3`,
      [token, expiry, user.id]
    );

    const sent = await sendInvitationEmail(staff.email || user.email, staff.full_name || user.first_name, url, organization?.organization_name, ROLE_LABELS[staff.role_id]);
    return res.json({
      message: sent ? 'Invitation sent' : 'Invitation created — email delivery is unavailable, share the link manually.',
      ...(!sent && process.env.NODE_ENV !== 'production' ? { activate_url: url } : {}),
    });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Attendance ───────────────────────────────────────────────────────────────
const getAttendance = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { date, user_id, month } = req.query;

    const params = [organizationId];
    const where  = [`al.organization_id = $1`];
    if (date)    { params.push(date);    where.push(`al.date = $${params.length}`); }
    if (user_id) { params.push(user_id); where.push(`al.user_id = $${params.length}`); }
    if (month)   { params.push(`${month}-01`); where.push(`al.date >= $${params.length}`); params.push(`${month}-31`); where.push(`al.date <= $${params.length}`); }

    const result = await db.query(
      `SELECT al.*,
              u.id AS u_id, u.first_name, u.last_name, u.role_id
       FROM attendance_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY al.date DESC`,
      params
    );
    const attendance = (result.rows || []).map(row => ({
      ...row,
      users: row.u_id ? { id: row.u_id, first_name: row.first_name, last_name: row.last_name, role_id: row.role_id } : null,
    }));
    return res.json({ attendance });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const markAttendance = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { user_id, date, status, check_in, check_out, notes } = req.body;
    const result = await db.query(
      `INSERT INTO attendance_logs (user_id, date, status, check_in, check_out, notes, organization_id, marked_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id, date) DO UPDATE SET
         status=$3, check_in=$4, check_out=$5, notes=$6, marked_by=$8
       RETURNING *`,
      [user_id, date, status, check_in || null, check_out || null, notes || null, organizationId, req.user.id]
    );
    return res.status(201).json({ attendance: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const updateAttendance = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const body = { ...req.body };
    const keys = Object.keys(body);
    const values = Object.values(body);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(req.params.id, organizationId);
    const result = await db.query(
      `UPDATE attendance_logs SET ${setClauses} WHERE id=$${values.length-1} AND organization_id=$${values.length} RETURNING *`,
      values
    );
    return res.json({ attendance: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Shifts ───────────────────────────────────────────────────────────────────
const getShifts = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const result = await db.query(`SELECT * FROM shifts WHERE organization_id=$1 ORDER BY shift_name`, [organizationId]);
    return res.json({ shifts: result.rows });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const createShift = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const insertPayload = { ...req.body, organization_id: organizationId };
    const keys = Object.keys(insertPayload);
    const values = Object.values(insertPayload);
    const result = await db.query(
      `INSERT INTO shifts (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i+1}`).join(', ')}) RETURNING *`,
      values
    );
    return res.status(201).json({ shift: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const updateShift = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const keys = Object.keys(req.body);
    const values = Object.values(req.body);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(req.params.id, organizationId);
    const result = await db.query(
      `UPDATE shifts SET ${setClauses} WHERE id=$${values.length-1} AND organization_id=$${values.length} RETURNING *`,
      values
    );
    return res.json({ shift: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const deleteShift = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    await db.query(`DELETE FROM shifts WHERE id=$1 AND organization_id=$2`, [req.params.id, organizationId]);
    return res.json({ message: 'Shift deleted' });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Leave Requests ───────────────────────────────────────────────────────────
const getLeaves = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { status, user_id } = req.query;
    const params = [organizationId];
    const where  = [`lr.organization_id = $1`];
    if (status)  { params.push(status);  where.push(`lr.status = $${params.length}`); }
    if (user_id) { params.push(user_id); where.push(`lr.user_id = $${params.length}`); }

    const result = await db.query(
      `SELECT lr.*, u.id AS u_id, u.first_name, u.last_name, u.role_id
       FROM hr_leave_requests lr
       LEFT JOIN users u ON u.id = lr.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY lr.created_at DESC`,
      params
    );
    const leaves = (result.rows || []).map(row => ({
      ...row,
      users: row.u_id ? { id: row.u_id, first_name: row.first_name, last_name: row.last_name, role_id: row.role_id } : null,
    }));
    return res.json({ leaves });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const createLeave = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const insertPayload = { ...req.body, user_id: req.body.user_id || req.user.id, organization_id: organizationId, status: 'pending' };
    const keys = Object.keys(insertPayload);
    const values = Object.values(insertPayload);
    const result = await db.query(
      `INSERT INTO hr_leave_requests (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i+1}`).join(', ')}) RETURNING *`,
      values
    );
    return res.status(201).json({ leave: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const updateLeaveStatus = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { status, remarks } = req.body;
    const result = await db.query(
      `UPDATE hr_leave_requests SET status=$1, remarks=$2, reviewed_by=$3, reviewed_at=$4
       WHERE id=$5 AND organization_id=$6
       RETURNING *`,
      [status, remarks || null, req.user.id, new Date().toISOString(), req.params.id, organizationId]
    );
    return res.json({ leave: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Payroll ──────────────────────────────────────────────────────────────────
const getPayroll = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { month, user_id } = req.query;
    const params = [organizationId];
    const where  = [`pr.organization_id = $1`];
    if (month)   { params.push(month);   where.push(`pr.pay_month = $${params.length}`); }
    if (user_id) { params.push(user_id); where.push(`pr.user_id = $${params.length}`); }

    const result = await db.query(
      `SELECT pr.*, u.id AS u_id, u.first_name, u.last_name, u.role_id
       FROM payroll_records pr
       LEFT JOIN users u ON u.id = pr.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY pr.pay_month DESC`,
      params
    );
    const payroll = (result.rows || []).map(row => ({
      ...row,
      users: row.u_id ? { id: row.u_id, first_name: row.first_name, last_name: row.last_name, role_id: row.role_id } : null,
    }));
    return res.json({ payroll });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const runPayroll = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { pay_month, records } = req.body;
    if (!pay_month || !Array.isArray(records)) return res.status(400).json({ error: 'pay_month and records[] required' });

    const results = [];
    for (const r of records) {
      const row = { ...r, pay_month, organization_id: organizationId, generated_by: req.user.id, status: 'generated' };
      const keys = Object.keys(row);
      const values = Object.values(row);
      const cols = keys.join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const updateSet = keys.filter(k => !['user_id', 'pay_month'].includes(k)).map(k => `${k} = EXCLUDED.${k}`).join(', ');
      const upsertRes = await db.query(
        `INSERT INTO payroll_records (${cols}) VALUES (${placeholders})
         ON CONFLICT (user_id, pay_month) DO UPDATE SET ${updateSet}
         RETURNING *`,
        values
      );
      results.push(upsertRes.rows[0]);
    }
    return res.status(201).json({ payroll: results, count: results.length });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const getPayslip = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const result = await db.query(
      `SELECT pr.*, u.id AS u_id, u.first_name, u.last_name, u.email, u.role_id
       FROM payroll_records pr
       LEFT JOIN users u ON u.id = pr.user_id
       WHERE pr.id=$1 AND pr.organization_id=$2`,
      [req.params.id, organizationId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Payslip not found' });
    const row = result.rows[0];
    return res.json({
      payslip: {
        ...row,
        users: row.u_id ? { id: row.u_id, first_name: row.first_name, last_name: row.last_name, email: row.email, role_id: row.role_id } : null,
      }
    });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Salary Structures ────────────────────────────────────────────────────────
const getSalaryStructures = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const result = await db.query(`SELECT * FROM salary_structures WHERE organization_id=$1 ORDER BY grade`, [organizationId]);
    return res.json({ structures: result.rows });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const createSalaryStructure = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const insertPayload = { ...req.body, organization_id: organizationId };
    const keys = Object.keys(insertPayload);
    const values = Object.values(insertPayload);
    const result = await db.query(
      `INSERT INTO salary_structures (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i+1}`).join(', ')}) RETURNING *`,
      values
    );
    return res.status(201).json({ structure: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const updateSalaryStructure = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const keys = Object.keys(req.body);
    const values = Object.values(req.body);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(req.params.id, organizationId);
    const result = await db.query(
      `UPDATE salary_structures SET ${setClauses} WHERE id=$${values.length-1} AND organization_id=$${values.length} RETURNING *`,
      values
    );
    return res.json({ structure: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

module.exports = {
  getStaff, createStaff, updateStaff, toggleStaff, inviteStaff,
  getAttendance, markAttendance, updateAttendance,
  getShifts, createShift, updateShift, deleteShift,
  getLeaves, createLeave, updateLeaveStatus,
  getPayroll, runPayroll, getPayslip,
  getSalaryStructures, createSalaryStructure, updateSalaryStructure,
};
