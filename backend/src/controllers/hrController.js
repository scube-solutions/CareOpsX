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

// Generate the invite token + expiry pair, and return the activation URL.
const buildInvite = () => {
  const token  = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48h
  return { token, expiry, url: `${FRONTEND_URL}/activate?token=${token}` };
};

// ── Staff ────────────────────────────────────────────────────────────────────
const getStaff = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await db
      .from('staff_profiles')
      .select('*, users(id, first_name, last_name, email, phone, role_id, is_active, invite_status, email_verified)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ staff: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// HRMS is the master source of employee records. Employees are created here
// WITHOUT selecting an existing user. When create_login is enabled, a matching
// users row is created and linked so the record syncs to User Management.
const createStaff = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId, portalAccess, seatLimits } = await getOrganizationContext(req);
    const {
      employee_id, full_name, email, mobile, department, designation,
      role_id, employment_type, employment_status, create_login,
      date_of_joining, blood_group, emergency_contact, address,
    } = req.body;

    // ── Validation (HRMS owns the identity fields) ──
    if (!full_name || !String(full_name).trim()) return res.status(400).json({ error: 'Full name is required' });
    if (!email || !EMAIL_RE.test(email))         return res.status(400).json({ error: 'A valid email address is required' });
    const roleId = Number(role_id) || null;
    if (create_login && !roleId)                 return res.status(400).json({ error: 'Assigned role is required to create a system login' });

    // ── Uniqueness: email + mobile (employee-level and user-level) ──
    const { data: dupEmail } = await db.from('staff_profiles')
      .select('id').eq('organization_id', organizationId).ilike('email', email).maybeSingle();
    if (dupEmail) return res.status(409).json({ error: 'An employee with this email already exists' });

    if (mobile) {
      const { data: dupMobile } = await db.from('staff_profiles')
        .select('id').eq('organization_id', organizationId).eq('mobile', mobile).maybeSingle();
      if (dupMobile) return res.status(409).json({ error: 'An employee with this mobile number already exists' });
    }

    let userId = null;
    let inviteUrl = null;

    // ── Optionally create the linked system login ──
    if (create_login) {
      const portalCheck = ensurePortalEnabled(portalAccess, roleId);
      if (!portalCheck.ok) return res.status(403).json({ error: portalCheck.message });
      const seatCheck = await ensureSeatAvailable({ organizationId, seatLimits, roleId });
      if (!seatCheck.ok) return res.status(409).json({ error: seatCheck.message });

      const { data: existingUser } = await db.from('users').select('id').ilike('email', email).maybeSingle();
      if (existingUser) return res.status(409).json({ error: 'A user account with this email already exists' });
      if (mobile) {
        const { data: existingPhone } = await db.from('users')
          .select('id').eq('organization_id', organizationId).eq('phone', mobile).maybeSingle();
        if (existingPhone) return res.status(409).json({ error: 'A user account with this mobile number already exists' });
      }

      const { first_name, last_name } = splitName(full_name);
      const isActive = (employment_status || 'Active') === 'Active';
      // Unusable random hash — the real password is set by the user on invite
      // activation. Avoids a NULL-constraint violation and blocks login meanwhile
      // (account is also email_verified:false until activated).
      const placeholderHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
      const { data: newUser, error: userErr } = await db.from('users').insert([{
        first_name, last_name, email, phone: mobile || null,
        password_hash: placeholderHash,      // replaced on invite activation
        role_id: roleId, roles: [roleId],
        organization_id: organizationId,
        is_active: isActive,
        email_verified: false,               // blocks login until activated
        invite_status: 'pending',
        created_by: req.user.id,
      }]).select('id').single();
      if (userErr) throw userErr;
      userId = newUser.id;

      // Auto-create a doctor profile so role-2 staff appear on the Doctors page.
      if (roleId === 2) {
        const { data: existingDoc } = await db.from('doctors').select('id').eq('user_id', userId).maybeSingle();
        if (!existingDoc) {
          await db.from('doctors').insert([{
            user_id: userId, specialization: 'General Medicine',
            consultation_fee: 0, organization_id: organizationId, is_active: true,
          }]);
        }
      }
    }

    // ── Insert the employee master record ──
    const { data: staff, error } = await db.from('staff_profiles').insert([{
      organization_id: organizationId,
      user_id: userId,
      employee_id: employee_id || null,
      full_name: String(full_name).trim(),
      email,
      mobile: mobile || null,
      department: department || null,
      designation: designation || null,
      role_id: roleId,
      employment_type: employment_type || null,
      employment_status: employment_status || 'Active',
      date_of_joining: date_of_joining || null,
      blood_group: blood_group || null,
      emergency_contact: emergency_contact || null,
      address: address || null,
      is_active: (employment_status || 'Active') === 'Active',
    }]).select('*, users(id, first_name, last_name, email, phone, role_id, is_active, invite_status)').single();
    if (error) throw error;

    return res.status(201).json({ staff, has_login: !!userId });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const updateStaff = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    // Whitelist employee fields; never let user_id be reassigned here.
    const {
      employee_id, full_name, email, mobile, department, designation,
      role_id, employment_type, employment_status,
      date_of_joining, blood_group, emergency_contact, address,
    } = req.body;
    const payload = {
      ...(employee_id !== undefined && { employee_id }),
      ...(full_name !== undefined && { full_name }),
      ...(email !== undefined && { email }),
      ...(mobile !== undefined && { mobile }),
      ...(department !== undefined && { department }),
      ...(designation !== undefined && { designation }),
      ...(role_id !== undefined && { role_id: Number(role_id) || null }),
      ...(employment_type !== undefined && { employment_type }),
      ...(employment_status !== undefined && {
        employment_status,
        is_active: employment_status === 'Active',
      }),
      ...(date_of_joining !== undefined && { date_of_joining: date_of_joining || null }),
      ...(blood_group !== undefined && { blood_group }),
      ...(emergency_contact !== undefined && { emergency_contact }),
      ...(address !== undefined && { address }),
    };

    const { data, error } = await db
      .from('staff_profiles')
      .update(payload)
      .eq('id', req.params.id)
      .eq('organization_id', organizationId)
      .select('*, users(id, first_name, last_name, email, phone, role_id, is_active, invite_status)').single();
    if (error) throw error;

    // ── Sync changes down to the linked user (HRMS → User Management) ──
    if (data.user_id) {
      const userPatch = {};
      if (full_name !== undefined)        Object.assign(userPatch, splitName(full_name));
      if (email !== undefined)            userPatch.email = email;
      if (mobile !== undefined)           userPatch.phone = mobile || null;
      if (role_id !== undefined && Number(role_id)) {
        userPatch.role_id = Number(role_id);
        userPatch.roles   = [Number(role_id)];
      }
      if (employment_status !== undefined) userPatch.is_active = employment_status === 'Active';
      if (Object.keys(userPatch).length) {
        userPatch.updated_by = req.user.id;
        await db.from('users').update(userPatch).eq('id', data.user_id).eq('organization_id', organizationId);
      }
    }

    return res.json({ staff: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const toggleStaff = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data: existing } = await db.from('staff_profiles').select('is_active, user_id').eq('id', req.params.id).single();
    const next = !existing?.is_active;
    const { data, error } = await db
      .from('staff_profiles')
      .update({ is_active: next, employment_status: next ? 'Active' : 'Inactive' })
      .eq('id', req.params.id)
      .eq('organization_id', organizationId)
      .select('*, users(id, first_name, last_name, email, phone, role_id, is_active, invite_status)').single();
    if (error) throw error;

    // Sync activation state to the linked user.
    if (existing?.user_id) {
      await db.from('users').update({ is_active: next, updated_by: req.user.id })
        .eq('id', existing.user_id).eq('organization_id', organizationId);
    }
    return res.json({ staff: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// Send (or re-send) an account-activation invitation to a staff member's login.
const inviteStaff = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId, organization } = await getOrganizationContext(req);
    const { data: staff, error } = await db.from('staff_profiles')
      .select('id, full_name, email, user_id, role_id')
      .eq('id', req.params.id).eq('organization_id', organizationId).single();
    if (error || !staff) return res.status(404).json({ error: 'Staff member not found' });
    if (!staff.user_id)  return res.status(400).json({ error: 'This employee has no system login. Enable "Create System Login" first.' });

    const { data: user } = await db.from('users')
      .select('id, first_name, email, invite_status').eq('id', staff.user_id).single();
    if (!user) return res.status(404).json({ error: 'Linked user account not found' });
    if (user.invite_status === 'active') return res.status(409).json({ error: 'This account is already activated' });

    const { token, expiry, url } = buildInvite();
    const { error: updErr } = await db.from('users')
      .update({ invite_token: token, invite_token_expiry: expiry, invite_status: 'invited' })
      .eq('id', user.id);
    if (updErr) throw updErr;

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
    let q = db.from('attendance_logs')
      .select('*, users!attendance_logs_user_id_fkey(id, first_name, last_name, role_id)')
      .eq('organization_id', organizationId)
      .order('date', { ascending: false });
    if (date)    q = q.eq('date', date);
    if (user_id) q = q.eq('user_id', user_id);
    if (month)   q = q.gte('date', `${month}-01`).lte('date', `${month}-31`);
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ attendance: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const markAttendance = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { user_id, date, status, check_in, check_out, notes } = req.body;
    const { data, error } = await db
      .from('attendance_logs')
      .upsert([{ user_id, date, status, check_in, check_out, notes, organization_id: organizationId, marked_by: req.user.id }],
        { onConflict: 'user_id,date' })
      .select('*').single();
    if (error) throw error;
    return res.status(201).json({ attendance: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const updateAttendance = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await db
      .from('attendance_logs')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('organization_id', organizationId)
      .select('*').single();
    if (error) throw error;
    return res.json({ attendance: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Shifts ───────────────────────────────────────────────────────────────────
const getShifts = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await db.from('shifts').select('*').eq('organization_id', organizationId).order('shift_name');
    if (error) throw error;
    return res.json({ shifts: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const createShift = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await db.from('shifts').insert([{ ...req.body, organization_id: organizationId }]).select('*').single();
    if (error) throw error;
    return res.status(201).json({ shift: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const updateShift = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await db.from('shifts').update(req.body).eq('id', req.params.id).eq('organization_id', organizationId).select('*').single();
    if (error) throw error;
    return res.json({ shift: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const deleteShift = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { error } = await db.from('shifts').delete().eq('id', req.params.id).eq('organization_id', organizationId);
    if (error) throw error;
    return res.json({ message: 'Shift deleted' });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Leave Requests ───────────────────────────────────────────────────────────
const getLeaves = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { status, user_id } = req.query;
    let q = db.from('hr_leave_requests')
      .select('*, users!hr_leave_requests_user_id_fkey(id, first_name, last_name, role_id)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (status)  q = q.eq('status', status);
    if (user_id) q = q.eq('user_id', user_id);
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ leaves: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const createLeave = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await db
      .from('hr_leave_requests')
      .insert([{ ...req.body, user_id: req.body.user_id || req.user.id, organization_id: organizationId, status: 'pending' }])
      .select('*').single();
    if (error) throw error;
    return res.status(201).json({ leave: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const updateLeaveStatus = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { status, remarks } = req.body;
    const { data, error } = await db
      .from('hr_leave_requests')
      .update({ status, remarks, reviewed_by: req.user.id, reviewed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('organization_id', organizationId)
      .select('*').single();
    if (error) throw error;
    return res.json({ leave: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Payroll ──────────────────────────────────────────────────────────────────
const getPayroll = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { month, user_id } = req.query;
    let q = db.from('payroll_records')
      .select('*, users!payroll_records_user_id_fkey(id, first_name, last_name, role_id)')
      .eq('organization_id', organizationId)
      .order('pay_month', { ascending: false });
    if (month)   q = q.eq('pay_month', month);
    if (user_id) q = q.eq('user_id', user_id);
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ payroll: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const runPayroll = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { pay_month, records } = req.body;
    if (!pay_month || !Array.isArray(records)) return res.status(400).json({ error: 'pay_month and records[] required' });
    const rows = records.map(r => ({ ...r, pay_month, organization_id: organizationId, generated_by: req.user.id, status: 'generated' }));
    const { data, error } = await db.from('payroll_records').upsert(rows, { onConflict: 'user_id,pay_month' }).select('*');
    if (error) throw error;
    return res.status(201).json({ payroll: data, count: data.length });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const getPayslip = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await db
      .from('payroll_records')
      .select('*, users!payroll_records_user_id_fkey(id, first_name, last_name, email, role_id)')
      .eq('id', req.params.id)
      .eq('organization_id', organizationId)
      .single();
    if (error) throw error;
    return res.json({ payslip: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Salary Structures ────────────────────────────────────────────────────────
const getSalaryStructures = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await db.from('salary_structures').select('*').eq('organization_id', organizationId).order('grade');
    if (error) throw error;
    return res.json({ structures: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const createSalaryStructure = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await db.from('salary_structures').insert([{ ...req.body, organization_id: organizationId }]).select('*').single();
    if (error) throw error;
    return res.status(201).json({ structure: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const updateSalaryStructure = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await db.from('salary_structures').update(req.body).eq('id', req.params.id).eq('organization_id', organizationId).select('*').single();
    if (error) throw error;
    return res.json({ structure: data });
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
