const crypto = require('crypto');
const { auditLog } = require('../middlewares/audit');
const { getOrganizationContext, ensurePortalEnabled, ensureSeatAvailable, ROLE_LABELS } = require('../utils/organizationAccess');
const { sendInvitationEmail } = require('../utils/notify');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ── Hospital Profile ──────────────────────────────────────────────────────────
const getHospitalProfile = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId, organization } = await getOrganizationContext(req);
    const { data, error } = await supabase.from('hospital_profile').select('*').eq('organization_id', organizationId).single();
    if (error && error.code !== 'PGRST116') throw error;
    // Include org-level info (registration date, plan/billing) for the Subscription tab
    return res.json({
      profile: data || {},
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
    const supabase = req.db;
    const { organizationId, organization } = await getOrganizationContext(req);
    const payload = { ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() };
    const { data: existing } = await supabase.from('hospital_profile').select('id').eq('organization_id', organizationId).single();
    let result;
    if (existing) {
      const { data, error } = await supabase.from('hospital_profile').update(payload).eq('id', existing.id).select('*').single();
      if (error) throw error;
      result = data;
    } else {
      // First-time insert: hospital_name is NOT NULL — fall back to the org name so
      // partial saves (e.g. logo-only upload) don't fail.
      if (!payload.hospital_name || !String(payload.hospital_name).trim()) {
        payload.hospital_name = organization?.organization_name || 'Hospital';
      }
      const { data, error } = await supabase.from('hospital_profile').insert([{ ...payload, organization_id: organizationId, created_by: req.user.id }]).select('*').single();
      if (error) throw error;
      result = data;
    }
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'UPSERT', module: 'Admin', entity_type: 'hospital_profile', entity_id: result.id });
    return res.json({ message: 'Hospital profile saved', profile: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Logo Upload (Supabase Storage) ───────────────────────────────────────────
const uploadLogo = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { base64, filename, content_type } = req.body;
    if (!base64 || !filename) return res.status(400).json({ error: 'base64 and filename required' });

    const buffer = Buffer.from(base64, 'base64');
    const ext    = (filename.split('.').pop() || 'png').toLowerCase();
    const path   = `org_${organizationId}/logo_${Date.now()}.${ext}`;

    await supabase.storage.createBucket('hospital-assets', { public: true }).catch(() => {});

    const { data, error } = await supabase.storage
      .from('hospital-assets')
      .upload(path, buffer, { contentType: content_type || 'image/png', upsert: true });
    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage.from('hospital-assets').getPublicUrl(data.path);
    return res.json({ url: publicUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Branches ─────────────────────────────────────────────────────────────────
const getBranches = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await supabase.from('branches').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ branches: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createBranch = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await supabase.from('branches').insert([{ ...req.body, organization_id: organizationId, created_by: req.user.id }]).select('*').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'CREATE', module: 'Admin', entity_type: 'branch', entity_id: data.id });
    return res.status(201).json({ message: 'Branch created', branch: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateBranch = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await supabase.from('branches').update({ ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('organization_id', organizationId).select('*').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'UPDATE', module: 'Admin', entity_type: 'branch', entity_id: req.params.id });
    return res.json({ message: 'Branch updated', branch: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const deleteBranch = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { error } = await supabase.from('branches').update({ is_active: false, updated_by: req.user.id }).eq('id', req.params.id).eq('organization_id', organizationId);
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'DEACTIVATE', module: 'Admin', entity_type: 'branch', entity_id: req.params.id });
    return res.json({ message: 'Branch deactivated' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Departments ───────────────────────────────────────────────────────────────
const getDepartments = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { active_only } = req.query;
    let query = supabase.from('departments').select('*').eq('organization_id', organizationId).order('department_name');
    if (active_only === 'true') query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw error;
    return res.json({ departments: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createDepartment = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { department_name, department_code } = req.body;
    const { data: existing } = await supabase.from('departments').select('id').eq('organization_id', organizationId).or(`department_name.eq.${department_name},department_code.eq.${department_code}`).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Department name or code already exists' });
    const { data, error } = await supabase.from('departments').insert([{ ...req.body, organization_id: organizationId, is_active: true, created_by: req.user.id }]).select('*').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'CREATE', module: 'Admin', entity_type: 'department', entity_id: data.id });
    return res.status(201).json({ message: 'Department created', department: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await supabase.from('departments').update({ ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('organization_id', organizationId).select('*').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'UPDATE', module: 'Admin', entity_type: 'department', entity_id: req.params.id });
    return res.json({ message: 'Department updated', department: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const toggleDepartment = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data: dept } = await supabase.from('departments').select('is_active').eq('id', req.params.id).eq('organization_id', organizationId).single();
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    const { data, error } = await supabase.from('departments').update({ is_active: !dept.is_active, updated_by: req.user.id }).eq('id', req.params.id).eq('organization_id', organizationId).select('*').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: data.is_active ? 'ACTIVATE' : 'DEACTIVATE', module: 'Admin', entity_type: 'department', entity_id: req.params.id });
    return res.json({ message: `Department ${data.is_active ? 'activated' : 'deactivated'}`, department: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Consultation Types / Fee Config ───────────────────────────────────────────
const getConsultationTypes = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await supabase.from('consultation_types').select('*').eq('organization_id', organizationId).order('type_name');
    if (error) throw error;
    return res.json({ consultation_types: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createConsultationType = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await supabase.from('consultation_types').insert([{ ...req.body, organization_id: organizationId, created_by: req.user.id }]).select('*').single();
    if (error) throw error;
    return res.status(201).json({ message: 'Consultation type created', consultation_type: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateConsultationType = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await supabase.from('consultation_types').update({ ...req.body, updated_by: req.user.id }).eq('id', req.params.id).eq('organization_id', organizationId).select('*').single();
    if (error) throw error;
    return res.json({ message: 'Consultation type updated', consultation_type: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Doctor Leaves / Block Dates ───────────────────────────────────────────────
const getDoctorLeaves = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { doctor_id } = req.query;
    let query = supabase.from('doctor_leaves').select('*').eq('organization_id', organizationId).order('leave_date', { ascending: true });
    if (doctor_id) query = query.eq('doctor_id', doctor_id);
    const { data, error } = await query;
    if (error) throw error;
    return res.json({ leaves: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createDoctorLeave = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await supabase.from('doctor_leaves').insert([{ ...req.body, organization_id: organizationId, created_by: req.user.id }]).select('*').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'CREATE', module: 'Admin', entity_type: 'doctor_leave', entity_id: data.id });
    return res.status(201).json({ message: 'Leave created', leave: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const deleteDoctorLeave = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { error } = await supabase.from('doctor_leaves').delete().eq('id', req.params.id).eq('organization_id', organizationId);
    if (error) throw error;
    return res.json({ message: 'Leave deleted' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Users Management ──────────────────────────────────────────────────────────
const getUsers = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    // Join staff_profiles so HRMS-sourced fields (employee_id, department,
    // designation, employment_status) surface in User Management.
    const { data, error } = await supabase.from('users')
      .select('id, first_name, last_name, email, phone, role_id, roles, is_active, account_status, invite_status, last_login_at, two_factor_enabled, branch_id, organization_id, created_at, staff_profiles(employee_id, department, designation, employment_status)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const usersWithRoles = (data || []).map(u => {
      const staff = Array.isArray(u.staff_profiles) ? u.staff_profiles[0] : u.staff_profiles;
      return {
        ...u,
        roles: Array.isArray(u.roles) && u.roles.length ? u.roles : [u.role_id],
        employee_id      : staff?.employee_id || null,
        department       : staff?.department || null,
        designation      : staff?.designation || null,
        employment_status: staff?.employment_status || null,
        staff_profiles   : undefined,
      };
    });
    return res.json({ users: usersWithRoles });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createUser = async (req, res) => {
  try {
    const supabase = req.db;
    const bcrypt = require('bcryptjs');
    const { organizationId, organization, portalAccess, seatLimits } = await getOrganizationContext(req);
    const { first_name, last_name, email, phone, password, role_id, roles, branch_id, department, designation, send_invite } = req.body;
    // Invitation-based onboarding: no password needed when sending an invite.
    const invite = !!send_invite || !password;
    if (!email || !first_name || !last_name) return res.status(400).json({ error: 'Required fields missing' });
    if (!invite && !password) return res.status(400).json({ error: 'Password is required' });

    const { data: existing } = await supabase.from('users').select('id').ilike('email', email).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Email already exists' });
    // Mobile uniqueness (excluding patient accounts which may share numbers).
    if (phone) {
      const { data: dupPhone } = await supabase.from('users').select('id').eq('phone', phone).neq('role_id', 3).maybeSingle();
      if (dupPhone) return res.status(409).json({ error: 'Mobile number already exists' });
    }

    const primaryRole = role_id || (Array.isArray(roles) && roles[0]) || 5;
    const userRoles = Array.isArray(roles) && roles.length ? roles : [primaryRole];
    const portalCheck = ensurePortalEnabled(portalAccess, primaryRole);
    if (!portalCheck.ok) return res.status(403).json({ error: portalCheck.message });
    const seatCheck = await ensureSeatAvailable({ organizationId, seatLimits, roleId: primaryRole });
    if (!seatCheck.ok) return res.status(409).json({ error: seatCheck.message });

    // For invited users, store an unusable hash + an activation token, and keep
    // the account inactive until they activate. Otherwise create an active login.
    const password_hash = await bcrypt.hash(invite ? crypto.randomBytes(24).toString('hex') : password, 10);
    const inviteToken = invite ? crypto.randomBytes(32).toString('hex') : null;
    const inviteExpiry = invite ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() : null;

    const { data, error } = await supabase.from('users').insert([{
      first_name, last_name, email, phone: phone || null, password_hash,
      role_id: primaryRole, roles: userRoles, branch_id: branch_id || null,
      organization_id: organizationId,
      is_active: !invite,
      email_verified: !invite,
      account_status: invite ? 'pending_activation' : 'active',
      invite_status: invite ? 'invited' : 'active',
      invite_token: inviteToken, invite_token_expiry: inviteExpiry,
      created_by: req.user.id,
    }]).select('id, first_name, last_name, email, phone, role_id, roles, is_active, account_status, invite_status, branch_id, organization_id, created_at').single();
    if (error) throw error;

    // Mirror to an employee record so HRMS ↔ User Management stay in sync.
    const { data: existingStaff } = await supabase.from('staff_profiles').select('id').eq('user_id', data.id).maybeSingle();
    if (!existingStaff) {
      try {
        await supabase.from('staff_profiles').insert([{
          organization_id: organizationId, user_id: data.id,
          full_name: `${first_name} ${last_name}`.trim(), email, mobile: phone || null,
          department: department || null, designation: designation || null, role_id: primaryRole,
          employment_status: invite ? 'Inactive' : 'Active', is_active: !invite,
        }]);
      } catch { /* mirror is best-effort */ }
    }

    // Auto-send the invitation email on creation.
    if (invite) {
      const url = `${FRONTEND_URL}/activate?token=${inviteToken}`;
      await sendInvitationEmail(email, `${first_name} ${last_name}`.trim(), url, organization?.organization_name, ROLE_LABELS[primaryRole]);
    }

    // Auto-create a doctor profile so the user shows on the Doctors page immediately
    if (userRoles.includes(2)) {
      const { specialization, consultation_fee, experience_years } = req.body;
      const { data: existingDoc } = await supabase.from('doctors').select('id').eq('user_id', data.id).maybeSingle();
      if (!existingDoc) {
        await supabase.from('doctors').insert([{
          user_id: data.id,
          specialization: specialization || 'General Medicine',
          consultation_fee: consultation_fee != null ? Number(consultation_fee) : 0,
          experience_years: experience_years != null && experience_years !== '' ? Number(experience_years) : null,
          organization_id: organizationId,
          is_active: true,
        }]);
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
    const supabase = req.db;
    const { organizationId, portalAccess, seatLimits } = await getOrganizationContext(req);
    const { password, roles, ...rest } = req.body;
    let payload = { ...rest, updated_by: req.user.id, updated_at: new Date().toISOString() };
    if (Array.isArray(roles) && roles.length > 0) {
      payload.role_id = roles[0];
      payload.roles = roles;
      const portalCheck = ensurePortalEnabled(portalAccess, payload.role_id);
      if (!portalCheck.ok) return res.status(403).json({ error: portalCheck.message });
      const seatCheck = await ensureSeatAvailable({ organizationId, seatLimits, roleId: payload.role_id, excludeUserId: req.params.id });
      if (!seatCheck.ok) return res.status(409).json({ error: seatCheck.message });
    }
    if (password) {
      const bcrypt = require('bcryptjs');
      payload.password_hash = await bcrypt.hash(password, 10);
    }
    const { data, error } = await supabase.from('users').update(payload).eq('id', req.params.id).eq('organization_id', organizationId).select('id, first_name, last_name, email, phone, role_id, roles, is_active, branch_id').single();
    if (error) throw error;

    // If the user now has the doctor role, ensure a doctor profile exists
    const updatedRoles = Array.isArray(data.roles) && data.roles.length ? data.roles : [data.role_id].filter(Boolean);
    if (updatedRoles.includes(2)) {
      const { data: existingDoc } = await supabase.from('doctors').select('id').eq('user_id', req.params.id).maybeSingle();
      if (!existingDoc) {
        await supabase.from('doctors').insert([{
          user_id: req.params.id,
          specialization: 'General Medicine',
          consultation_fee: 0,
          organization_id: organizationId,
          is_active: true,
        }]);
      }
    }

    // Reverse-sync role / name / contact / status to the linked employee record.
    const staffPatch = {};
    if (data.first_name || data.last_name) staffPatch.full_name = `${data.first_name || ''} ${data.last_name || ''}`.trim();
    if (rest.email !== undefined)  staffPatch.email = data.email;
    if (rest.phone !== undefined)  staffPatch.mobile = data.phone;
    if (Array.isArray(roles) && roles.length) staffPatch.role_id = data.role_id;
    if (rest.is_active !== undefined) {
      staffPatch.is_active = data.is_active;
      staffPatch.employment_status = data.is_active ? 'Active' : 'Inactive';
    }
    if (Object.keys(staffPatch).length) {
      await supabase.from('staff_profiles').update(staffPatch).eq('user_id', req.params.id).eq('organization_id', organizationId);
    }

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'UPDATE_USER', module: 'Admin', entity_type: 'user', entity_id: req.params.id });
    return res.json({ message: 'User updated', user: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const toggleUserActive = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data: user } = await supabase.from('users').select('is_active').eq('id', req.params.id).eq('organization_id', organizationId).single();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const next = !user.is_active;
    const { data, error } = await supabase.from('users').update({ is_active: next, account_status: next ? 'active' : 'inactive', updated_by: req.user.id }).eq('id', req.params.id).eq('organization_id', organizationId).select('id, is_active, account_status').single();
    if (error) throw error;
    // Keep the linked employee record's status in sync.
    await supabase.from('staff_profiles')
      .update({ is_active: data.is_active, employment_status: data.is_active ? 'Active' : 'Inactive' })
      .eq('user_id', req.params.id).eq('organization_id', organizationId);
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: data.is_active ? 'UNLOCK_USER' : 'LOCK_USER', module: 'Admin', entity_type: 'user', entity_id: req.params.id });
    return res.json({ message: `User ${data.is_active ? 'activated' : 'locked'}`, user: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const cascadeDeleteDoctor = async (doctorId, sb) => {
  const { data: appts } = await sb.from('appointments').select('id').eq('doctor_id', doctorId);
  const apptIds = (appts || []).map(a => a.id);
  const { data: labOrders } = await sb.from('lab_orders').select('id').eq('doctor_id', doctorId);
  const loIds = (labOrders || []).map(l => l.id);
  if (loIds.length)  await sb.from('lab_results').delete().in('lab_order_id', loIds);
  if (apptIds.length) await sb.from('lab_results').delete().in('appointment_id', apptIds).not('appointment_id', 'is', null);
  await sb.from('lab_results').delete().eq('doctor_id', doctorId);
  if (apptIds.length) await sb.from('queue_tokens').delete().in('appointment_id', apptIds);
  await sb.from('queue_tokens').delete().eq('doctor_id', doctorId);
  if (apptIds.length) await sb.from('prescriptions').delete().in('appointment_id', apptIds);
  await sb.from('prescriptions').delete().eq('doctor_id', doctorId);
  if (apptIds.length) await sb.from('lab_orders').delete().in('appointment_id', apptIds);
  await sb.from('lab_orders').delete().eq('doctor_id', doctorId);
  if (apptIds.length) await sb.from('consultations').delete().in('appointment_id', apptIds);
  await sb.from('consultations').delete().eq('doctor_id', doctorId);
  await sb.from('follow_ups').delete().eq('doctor_id', doctorId);
  await sb.from('appointments').delete().eq('doctor_id', doctorId);
  await sb.from('doctor_leaves').delete().eq('doctor_id', doctorId);
  await sb.from('doctor_availability').delete().eq('doctor_id', doctorId);
  await sb.from('doctor_blocked_slots').delete().eq('doctor_id', doctorId);
  const { error } = await sb.from('doctors').delete().eq('id', doctorId);
  if (error) throw error;
};

const deleteUser = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    const { data: user } = await supabase.from('users').select('id, first_name, last_name, role_id').eq('id', id).eq('organization_id', organizationId).single();
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role_id === 1) return res.status(403).json({ error: 'Cannot delete admin accounts' });
    if (user.role_id === 2) {
      const { data: doctor } = await supabase.from('doctors').select('id').eq('user_id', id).single();
      if (doctor) {
        const { data: appts } = await supabase
          .from('appointments').select('id, appointment_date, appointment_time, status, patient_id')
          .eq('doctor_id', doctor.id).not('status', 'in', '("cancelled","completed")');
        if (appts && appts.length > 0) {
          const patientIds = [...new Set(appts.map(a => a.patient_id).filter(Boolean))];
          const { data: patients } = await supabase.from('patients').select('id, user_id').in('id', patientIds);
          const userIds = (patients || []).map(p => p.user_id).filter(Boolean);
          const { data: pUsers } = await supabase.from('users').select('id, first_name, last_name').in('id', userIds);
          const uMap = {}; (pUsers || []).forEach(u => { uMap[u.id] = u; });
          const pMap = {}; (patients || []).forEach(p => { pMap[p.id] = uMap[p.user_id] || null; });
          const appointments = appts.map(a => ({
            id: a.id, appointment_date: a.appointment_date, appointment_time: a.appointment_time, status: a.status,
            patient_name: pMap[a.patient_id] ? `${pMap[a.patient_id].first_name} ${pMap[a.patient_id].last_name}` : 'Unknown Patient'
          }));
          return res.status(409).json({ error: 'Doctor has active appointments', appointments });
        }
        await cascadeDeleteDoctor(doctor.id, supabase);
      }
    }
    const { error } = await supabase.from('users').delete().eq('id', id).eq('organization_id', organizationId);
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'DELETE_USER', module: 'Admin', entity_type: 'user', entity_id: id });
    return res.json({ message: `User ${user.first_name} ${user.last_name} deleted` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const bulkDeleteUsers = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array is required' });

    const deleted = [];
    const skipped = [];

    for (const id of ids) {
      if (id === req.user.id) { skipped.push({ id, reason: 'own account' }); continue; }
      const { data: user } = await supabase.from('users').select('id, first_name, last_name, role_id').eq('id', id).eq('organization_id', organizationId).single();
      if (!user) { skipped.push({ id, reason: 'not found' }); continue; }
      if (user.role_id === 1) { skipped.push({ id, reason: 'admin account' }); continue; }

      // Doctor with active appointments → skip
      if (user.role_id === 2) {
        const { data: doctor } = await supabase.from('doctors').select('id').eq('user_id', id).single();
        if (doctor) {
          const { data: appts } = await supabase.from('appointments').select('id').eq('doctor_id', doctor.id).not('status', 'in', '("cancelled","completed")');
          if (appts && appts.length > 0) { skipped.push({ id, reason: 'doctor has active appointments' }); continue; }
          await cascadeDeleteDoctor(doctor.id, supabase);
        }
      }

      const { error } = await supabase.from('users').delete().eq('id', id).eq('organization_id', organizationId);
      if (error) { skipped.push({ id, reason: error.message }); continue; }
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
    const supabase = req.db;
    const bcrypt = require('bcryptjs');
    const { organizationId } = await getOrganizationContext(req);
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const password_hash = await bcrypt.hash(new_password, 10);
    const { error } = await supabase.from('users').update({ password_hash, force_password_change: true, updated_by: req.user.id }).eq('id', req.params.id).eq('organization_id', organizationId);
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'RESET_PASSWORD', module: 'Admin', entity_type: 'user', entity_id: req.params.id });
    return res.json({ message: 'Password reset successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── User status (Active / Inactive / Suspended) ───────────────────────────────
const USER_STATUSES = ['active', 'inactive', 'suspended', 'pending_invitation', 'pending_activation'];
const setUserStatus = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { status } = req.body;
    if (!USER_STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${USER_STATUSES.join(', ')}` });
    if (req.params.id === req.user.id && status !== 'active') return res.status(400).json({ error: 'You cannot change the status of your own account' });
    const isActive = status === 'active';
    const { data, error } = await supabase.from('users')
      .update({ account_status: status, is_active: isActive, updated_by: req.user.id })
      .eq('id', req.params.id).eq('organization_id', organizationId)
      .select('id, account_status, is_active').single();
    if (error) throw error;
    await supabase.from('staff_profiles')
      .update({ is_active: isActive, employment_status: isActive ? 'Active' : (status === 'suspended' ? 'Suspended' : 'Inactive') })
      .eq('user_id', req.params.id).eq('organization_id', organizationId);
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: `STATUS_${status.toUpperCase()}`, module: 'Admin', entity_type: 'user', entity_id: req.params.id });
    return res.json({ message: `User status set to ${status}`, user: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// Send / re-send an account-activation invitation from User Management.
const inviteUser = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId, organization } = await getOrganizationContext(req);
    const { data: user, error } = await supabase.from('users')
      .select('id, first_name, last_name, email, role_id, invite_status')
      .eq('id', req.params.id).eq('organization_id', organizationId).single();
    if (error || !user) return res.status(404).json({ error: 'User not found' });
    if (user.invite_status === 'active') return res.status(409).json({ error: 'This account is already activated' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await supabase.from('users').update({ invite_token: token, invite_token_expiry: expiry, invite_status: 'invited', account_status: 'pending_activation' }).eq('id', user.id);

    const url = `${FRONTEND_URL}/activate?token=${token}`;
    const sent = await sendInvitationEmail(user.email, `${user.first_name} ${user.last_name}`.trim(), url, organization?.organization_name, ROLE_LABELS[user.role_id]);
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'INVITE_USER', module: 'Admin', entity_type: 'user', entity_id: user.id });
    return res.json({
      message: sent ? 'Invitation sent' : 'Invitation created — email delivery unavailable, share the link manually.',
      ...(!sent && process.env.NODE_ENV !== 'production' ? { activate_url: url } : {}),
    });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Plan info + feature upgrade requests (org admin side) ─────────────────────
const { normalizeFeatureFlags } = require('../utils/organizationAccess');
const FEATURE_CATALOG = [
  { key: 'hrms',         label: 'HRMS',            desc: 'Staff, attendance, leave, payroll, shifts.' },
  { key: 'ai_assistant', label: 'AI Assistant',    desc: 'Natural-language insights, reports & summaries.' },
  { key: 'queue_voice',  label: 'Queue Voice',     desc: 'Automated voice announcements at the lobby.' },
];

// What the org has now + which features are locked (to show "request access").
const getMyPlanInfo = async (req, res) => {
  try {
    const { organization } = await getOrganizationContext(req);
    const flags = normalizeFeatureFlags(organization?.feature_flags);
    const features = FEATURE_CATALOG.map(f => ({ ...f, enabled: flags[f.key] === true }));
    // Any pending requests so the UI can show "Requested".
    const { data: pending } = await req.db.from('feature_requests')
      .select('feature, status').eq('organization_id', organization?.id).eq('status', 'pending');
    const pendingSet = new Set((pending || []).map(p => p.feature));
    return res.json({
      plan: organization?.plan || 'trial',
      features: features.map(f => ({ ...f, requested: pendingSet.has(f.key) })),
    });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// Org admin raises a request to unlock a feature (super admin grants after payment).
const requestFeature = async (req, res) => {
  try {
    const { organizationId } = await getOrganizationContext(req);
    const { feature, message } = req.body;
    if (!FEATURE_CATALOG.some(f => f.key === feature)) return res.status(400).json({ error: 'Unknown feature' });
    // Avoid duplicate open requests.
    const { data: existing } = await req.db.from('feature_requests')
      .select('id').eq('organization_id', organizationId).eq('feature', feature).eq('status', 'pending').maybeSingle();
    if (existing) return res.status(409).json({ error: 'A request for this feature is already pending.' });
    const { data, error } = await req.db.from('feature_requests').insert([{
      organization_id: organizationId, requested_by: req.user.id,
      request_type: 'feature', feature, message: message || null, status: 'pending',
    }]).select('*').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: organizationId, action: 'REQUEST_FEATURE', module: 'Admin', entity_type: 'feature_request', entity_id: data.id, description: feature });
    return res.status(201).json({ message: 'Request submitted. Our support team will contact you.', request: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── RBAC Permission Matrix ────────────────────────────────────────────────────
const { MODULES, ACTIONS, getEffectivePermissions, getEffectivePermissionsForRoles, rolesOf } = require('../utils/permissions');

// Effective grid for every manageable role in this org (defaults + overrides).
const getPermissionMatrix = async (req, res) => {
  try {
    const { organizationId } = await getOrganizationContext(req);
    const roleIds = [1, 2, 5, 6, 7, 8, 10, 11, 12];
    const matrix = {};
    for (const r of roleIds) matrix[r] = await getEffectivePermissions(organizationId, r);
    return res.json({ modules: MODULES, actions: ACTIONS, roles: roleIds, matrix });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// Upsert override rows for a single role.
const updateRolePermissions = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const roleId = Number(req.params.roleId);
    if (roleId === 1 || roleId === 9) return res.status(400).json({ error: 'Admin and Super Admin always have full access and cannot be edited' });
    const { permissions } = req.body; // { module: { view, create, edit, delete, approve } }
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
    if (rows.length) {
      const { error } = await supabase.from('role_permissions').upsert(rows, { onConflict: 'organization_id,role_id,module' });
      if (error) throw error;
    }
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'UPDATE_PERMISSIONS', module: 'Admin', entity_type: 'role', entity_id: roleId });
    return res.json({ message: 'Permissions updated' });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// Current user's own effective permission grid — used for frontend menu gating.
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
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await supabase.from('lab_test_catalog')
      .select('*').eq('organization_id', organizationId).order('test_name', { ascending: true });
    if (error) throw error;
    return res.json({ tests: data || [] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const createLabTest = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { test_name, test_code, category, fee, description } = req.body;
    if (!test_name || fee == null) return res.status(400).json({ error: 'test_name and fee are required' });
    const { data, error } = await supabase.from('lab_test_catalog').insert([{
      organization_id: organizationId,
      test_name, test_code: test_code || null, category: category || null,
      fee: parseFloat(fee), description: description || null,
      is_active: true, created_by: req.user.id, created_at: new Date().toISOString(),
    }]).select('*').single();
    if (error) throw error;
    return res.status(201).json({ test: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const updateLabTest = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await supabase.from('lab_test_catalog')
      .update({ ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('organization_id', organizationId).select('*').single();
    if (error) throw error;
    return res.json({ test: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const deleteLabTest = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { error } = await supabase.from('lab_test_catalog').delete().eq('id', req.params.id).eq('organization_id', organizationId);
    if (error) throw error;
    return res.json({ message: 'Test deleted' });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Specializations ───────────────────────────────────────────────────────────
const getSpecializations = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await supabase.from('specializations').select('*').eq('organization_id', organizationId).order('name');
    if (error) throw error;
    return res.json({ specializations: data || [] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const createSpecialization = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const { data, error } = await supabase.from('specializations').insert([{ organization_id: organizationId, name: name.trim() }]).select().single();
    if (error) throw error;
    return res.status(201).json({ specialization: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const toggleSpecialization = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data: cur } = await supabase.from('specializations').select('is_active').eq('id', req.params.id).eq('organization_id', organizationId).single();
    const { data, error } = await supabase.from('specializations').update({ is_active: !cur?.is_active }).eq('id', req.params.id).eq('organization_id', organizationId).select().single();
    if (error) throw error;
    return res.json({ specialization: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const deleteSpecialization = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { error } = await supabase.from('specializations').delete().eq('id', req.params.id).eq('organization_id', organizationId);
    if (error) throw error;
    return res.json({ message: 'Deleted' });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Hospital Rooms ───────────────────────────────────────────────────────────
const getRooms = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await supabase.from('hospital_rooms').select('*').eq('organization_id', organizationId).order('room_name');
    if (error) throw error;
    return res.json({ rooms: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createRoom = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await supabase.from('hospital_rooms').insert([{ ...req.body, organization_id: organizationId }]).select('*').single();
    if (error) throw error;
    return res.status(201).json({ room: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateRoom = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await supabase.from('hospital_rooms').update(req.body).eq('id', req.params.id).eq('organization_id', organizationId).select('*').single();
    if (error) throw error;
    return res.json({ room: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const deleteRoom = async (req, res) => {
  try {
    const supabase = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { error } = await supabase.from('hospital_rooms').delete().eq('id', req.params.id).eq('organization_id', organizationId);
    if (error) throw error;
    return res.json({ message: 'Room deleted' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getHospitalProfile, upsertHospitalProfile,
  getBranches, createBranch, updateBranch, deleteBranch,
  getDepartments, createDepartment, updateDepartment, toggleDepartment,
  getConsultationTypes, createConsultationType, updateConsultationType,
  getDoctorLeaves, createDoctorLeave, deleteDoctorLeave,
  uploadLogo,
  getUsers, createUser, updateUser, toggleUserActive, deleteUser, bulkDeleteUsers, resetUserPassword,
  setUserStatus, inviteUser, getPermissionMatrix, updateRolePermissions, getMyPermissions,
  getMyPlanInfo, requestFeature,
  getLabTestCatalog, createLabTest, updateLabTest, deleteLabTest,
  getSpecializations, createSpecialization, toggleSpecialization, deleteSpecialization,
  getRooms, createRoom, updateRoom, deleteRoom,
};
