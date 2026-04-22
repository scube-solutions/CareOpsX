const supabase = require('../utils/supabase');
const { auditLog } = require('../middlewares/audit');

// ── Hospital Profile ──────────────────────────────────────────────────────────
const getHospitalProfile = async (req, res) => {
  try {
    const { data, error } = await supabase.from('hospital_profile').select('*').single();
    if (error && error.code !== 'PGRST116') throw error;
    return res.json({ profile: data || {} });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const upsertHospitalProfile = async (req, res) => {
  try {
    const payload = { ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() };
    const { data: existing } = await supabase.from('hospital_profile').select('id').single();
    let result;
    if (existing) {
      const { data, error } = await supabase.from('hospital_profile').update(payload).eq('id', existing.id).select('*').single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase.from('hospital_profile').insert([{ ...payload, created_by: req.user.id }]).select('*').single();
      if (error) throw error;
      result = data;
    }
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'UPSERT', module: 'Admin', entity_type: 'hospital_profile', entity_id: result.id });
    return res.json({ message: 'Hospital profile saved', profile: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Branches ─────────────────────────────────────────────────────────────────
const getBranches = async (req, res) => {
  try {
    const { data, error } = await supabase.from('branches').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ branches: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createBranch = async (req, res) => {
  try {
    const { data, error } = await supabase.from('branches').insert([{ ...req.body, created_by: req.user.id }]).select('*').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'CREATE', module: 'Admin', entity_type: 'branch', entity_id: data.id });
    return res.status(201).json({ message: 'Branch created', branch: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateBranch = async (req, res) => {
  try {
    const { data, error } = await supabase.from('branches').update({ ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() }).eq('id', req.params.id).select('*').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'UPDATE', module: 'Admin', entity_type: 'branch', entity_id: req.params.id });
    return res.json({ message: 'Branch updated', branch: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const deleteBranch = async (req, res) => {
  try {
    const { error } = await supabase.from('branches').update({ is_active: false, updated_by: req.user.id }).eq('id', req.params.id);
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'DEACTIVATE', module: 'Admin', entity_type: 'branch', entity_id: req.params.id });
    return res.json({ message: 'Branch deactivated' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Departments ───────────────────────────────────────────────────────────────
const getDepartments = async (req, res) => {
  try {
    const { active_only } = req.query;
    let query = supabase.from('departments').select('*').order('department_name');
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
    const { department_name, department_code } = req.body;
    const { data: existing } = await supabase.from('departments').select('id').or(`department_name.eq.${department_name},department_code.eq.${department_code}`).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Department name or code already exists' });
    const { data, error } = await supabase.from('departments').insert([{ ...req.body, is_active: true, created_by: req.user.id }]).select('*').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'CREATE', module: 'Admin', entity_type: 'department', entity_id: data.id });
    return res.status(201).json({ message: 'Department created', department: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const { data, error } = await supabase.from('departments').update({ ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() }).eq('id', req.params.id).select('*').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'UPDATE', module: 'Admin', entity_type: 'department', entity_id: req.params.id });
    return res.json({ message: 'Department updated', department: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const toggleDepartment = async (req, res) => {
  try {
    const { data: dept } = await supabase.from('departments').select('is_active').eq('id', req.params.id).single();
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    const { data, error } = await supabase.from('departments').update({ is_active: !dept.is_active, updated_by: req.user.id }).eq('id', req.params.id).select('*').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: data.is_active ? 'ACTIVATE' : 'DEACTIVATE', module: 'Admin', entity_type: 'department', entity_id: req.params.id });
    return res.json({ message: `Department ${data.is_active ? 'activated' : 'deactivated'}`, department: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Consultation Types / Fee Config ───────────────────────────────────────────
const getConsultationTypes = async (req, res) => {
  try {
    const { data, error } = await supabase.from('consultation_types').select('*').order('type_name');
    if (error) throw error;
    return res.json({ consultation_types: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createConsultationType = async (req, res) => {
  try {
    const { data, error } = await supabase.from('consultation_types').insert([{ ...req.body, created_by: req.user.id }]).select('*').single();
    if (error) throw error;
    return res.status(201).json({ message: 'Consultation type created', consultation_type: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateConsultationType = async (req, res) => {
  try {
    const { data, error } = await supabase.from('consultation_types').update({ ...req.body, updated_by: req.user.id }).eq('id', req.params.id).select('*').single();
    if (error) throw error;
    return res.json({ message: 'Consultation type updated', consultation_type: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Doctor Leaves / Block Dates ───────────────────────────────────────────────
const getDoctorLeaves = async (req, res) => {
  try {
    const { doctor_id } = req.query;
    let query = supabase.from('doctor_leaves').select('*').order('leave_date', { ascending: true });
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
    const { data, error } = await supabase.from('doctor_leaves').insert([{ ...req.body, created_by: req.user.id }]).select('*').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'CREATE', module: 'Admin', entity_type: 'doctor_leave', entity_id: data.id });
    return res.status(201).json({ message: 'Leave created', leave: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const deleteDoctorLeave = async (req, res) => {
  try {
    const { error } = await supabase.from('doctor_leaves').delete().eq('id', req.params.id);
    if (error) throw error;
    return res.json({ message: 'Leave deleted' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Users Management ──────────────────────────────────────────────────────────
const getUsers = async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('id, first_name, last_name, email, phone, role_id, is_active, branch_id, created_at').order('created_at', { ascending: false });
    if (error) throw error;
    const usersWithRoles = (data || []).map(u => ({ ...u, roles: [u.role_id] }));
    return res.json({ users: usersWithRoles });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createUser = async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { first_name, last_name, email, phone, password, role_id, roles, branch_id } = req.body;
    if (!email || !password || !first_name || !last_name) return res.status(400).json({ error: 'Required fields missing' });
    const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Email already exists' });
    const password_hash = await bcrypt.hash(password, 10);
    const primaryRole = role_id || (Array.isArray(roles) && roles[0]) || 5;
    const { data, error } = await supabase.from('users').insert([{ first_name, last_name, email, phone: phone || null, password_hash, role_id: primaryRole, roles: roles || [primaryRole], branch_id: branch_id || null, is_active: true, created_by: req.user.id }]).select('id, first_name, last_name, email, phone, role_id, roles, is_active, branch_id, created_at').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'CREATE_USER', module: 'Admin', entity_type: 'user', entity_id: data.id });
    return res.status(201).json({ message: 'User created', user: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    let payload = { ...rest, updated_by: req.user.id, updated_at: new Date().toISOString() };
    if (password) {
      const bcrypt = require('bcryptjs');
      payload.password_hash = await bcrypt.hash(password, 10);
    }
    const { data, error } = await supabase.from('users').update(payload).eq('id', req.params.id).select('id, first_name, last_name, email, phone, role_id, is_active, branch_id').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'UPDATE_USER', module: 'Admin', entity_type: 'user', entity_id: req.params.id });
    return res.json({ message: 'User updated', user: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const toggleUserActive = async (req, res) => {
  try {
    const { data: user } = await supabase.from('users').select('is_active').eq('id', req.params.id).single();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { data, error } = await supabase.from('users').update({ is_active: !user.is_active, updated_by: req.user.id }).eq('id', req.params.id).select('id, is_active').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: data.is_active ? 'UNLOCK_USER' : 'LOCK_USER', module: 'Admin', entity_type: 'user', entity_id: req.params.id });
    return res.json({ message: `User ${data.is_active ? 'activated' : 'locked'}`, user: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    const { data: user } = await supabase.from('users').select('id, first_name, last_name, role_id').eq('id', id).single();
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role_id === 1) return res.status(403).json({ error: 'Cannot delete admin accounts' });
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'DELETE_USER', module: 'Admin', entity_type: 'user', entity_id: id });
    return res.json({ message: `User ${user.first_name} ${user.last_name} deleted` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const password_hash = await bcrypt.hash(new_password, 10);
    const { error } = await supabase.from('users').update({ password_hash, force_password_change: true, updated_by: req.user.id }).eq('id', req.params.id);
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'RESET_PASSWORD', module: 'Admin', entity_type: 'user', entity_id: req.params.id });
    return res.json({ message: 'Password reset successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Lab Test Catalog ──────────────────────────────────────────────────────────
const getLabTestCatalog = async (req, res) => {
  try {
    const { data, error } = await supabase.from('lab_test_catalog')
      .select('*').order('test_name', { ascending: true });
    if (error) throw error;
    return res.json({ tests: data || [] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const createLabTest = async (req, res) => {
  try {
    const { test_name, test_code, category, fee, description } = req.body;
    if (!test_name || fee == null) return res.status(400).json({ error: 'test_name and fee are required' });
    const { data, error } = await supabase.from('lab_test_catalog').insert([{
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
    const { data, error } = await supabase.from('lab_test_catalog')
      .update({ ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select('*').single();
    if (error) throw error;
    return res.json({ test: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const deleteLabTest = async (req, res) => {
  try {
    const { error } = await supabase.from('lab_test_catalog').delete().eq('id', req.params.id);
    if (error) throw error;
    return res.json({ message: 'Test deleted' });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

module.exports = {
  getHospitalProfile, upsertHospitalProfile,
  getBranches, createBranch, updateBranch, deleteBranch,
  getDepartments, createDepartment, updateDepartment, toggleDepartment,
  getConsultationTypes, createConsultationType, updateConsultationType,
  getDoctorLeaves, createDoctorLeave, deleteDoctorLeave,
  getUsers, createUser, updateUser, toggleUserActive, deleteUser, resetUserPassword,
  getLabTestCatalog, createLabTest, updateLabTest, deleteLabTest,
};
