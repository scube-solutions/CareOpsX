const { getOrganizationContext } = require('../utils/organizationAccess');

// ── Staff ────────────────────────────────────────────────────────────────────
const getStaff = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await db
      .from('staff_profiles')
      .select('*, users(id, first_name, last_name, email, phone, role_id, is_active)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ staff: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const createStaff = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await db
      .from('staff_profiles')
      .insert([{ ...req.body, organization_id: organizationId }])
      .select('*').single();
    if (error) throw error;
    return res.status(201).json({ staff: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const updateStaff = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data, error } = await db
      .from('staff_profiles')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('organization_id', organizationId)
      .select('*').single();
    if (error) throw error;
    return res.json({ staff: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const toggleStaff = async (req, res) => {
  try {
    const db = req.db;
    const { organizationId } = await getOrganizationContext(req);
    const { data: existing } = await db.from('staff_profiles').select('is_active').eq('id', req.params.id).single();
    const { data, error } = await db
      .from('staff_profiles')
      .update({ is_active: !existing?.is_active })
      .eq('id', req.params.id)
      .eq('organization_id', organizationId)
      .select('*').single();
    if (error) throw error;
    return res.json({ staff: data });
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
  getStaff, createStaff, updateStaff, toggleStaff,
  getAttendance, markAttendance, updateAttendance,
  getShifts, createShift, updateShift, deleteShift,
  getLeaves, createLeave, updateLeaveStatus,
  getPayroll, runPayroll, getPayslip,
  getSalaryStructures, createSalaryStructure, updateSalaryStructure,
};
