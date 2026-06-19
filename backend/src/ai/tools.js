// ─────────────────────────────────────────────────────────────────────────────
// AI tool registry.
//
// Each tool wraps a read-only, ORG-SCOPED query over existing HMS/HRMS data.
// RBAC is enforced HERE (server-side) — the model never sees data the user is
// not permitted to access. Every tool declares { module, action }; before it
// runs, the user's effective permissions are checked. Denied → the model gets a
// structured "access denied" result and tells the user, no data leaks.
// ─────────────────────────────────────────────────────────────────────────────
const { getEffectivePermissionsForRoles, rolesOf } = require('../utils/permissions');
const { REPORT_NAMES, buildReport } = require('./reports');

const today = () => new Date().toISOString().split('T')[0];
const sum = (rows, f) => (rows || []).reduce((s, r) => s + parseFloat(r[f] || 0), 0);

const orgFilterSQL = (baseSQL, orgId, params) => {
  let sql = baseSQL;
  if (orgId) {
    params.push(orgId);
    sql += (baseSQL.toLowerCase().includes('where') ? ' AND' : ' WHERE') + ` organization_id = $${params.length}`;
  }
  return sql;
};

// ── Tool implementations ─────────────────────────────────────────────────────
const TOOLS = {
  get_hospital_overview: {
    module: 'reports', action: 'view',
    description: 'Get today\'s (or a date range\'s) hospital KPI overview: patient count, appointments, completed consultations, total revenue, pending collections, lab orders. Use for "how many patients today", "today\'s overview", revenue snapshots.',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Start date YYYY-MM-DD. Defaults to today.' },
        date_to:   { type: 'string', description: 'End date YYYY-MM-DD. Defaults to today.' },
      },
    },
    run: async ({ db, orgId, args }) => {
      const from = args.date_from || today();
      const to   = args.date_to   || today();

      const patientsParams = [];
      const patientsSQL = orgFilterSQL('SELECT COUNT(*) FROM patients WHERE is_archived = false', orgId, patientsParams);

      const apptsParams = [from, to];
      const apptsSQL = orgFilterSQL('SELECT status FROM appointments WHERE appointment_date >= $1 AND appointment_date <= $2', orgId, apptsParams);

      const consultsParams = [from, to];
      const consultsSQL = orgFilterSQL('SELECT COUNT(*) FROM consultations WHERE consultation_date >= $1 AND consultation_date <= $2', orgId, consultsParams);

      const invoicesParams = [`${from}T00:00:00`, `${to}T23:59:59`];
      const invoicesSQL = orgFilterSQL('SELECT total_amount, paid_amount, status FROM invoices WHERE created_at >= $1 AND created_at <= $2', orgId, invoicesParams);

      const labParams = [`${from}T00:00:00`, `${to}T23:59:59`];
      const labSQL = orgFilterSQL('SELECT COUNT(*) FROM lab_orders WHERE ordered_at >= $1 AND ordered_at <= $2', orgId, labParams);

      const [patientsRes, apptsRes, consultsRes, invoicesRes, labOrdersRes] = await Promise.all([
        db.query(patientsSQL, patientsParams),
        db.query(apptsSQL, apptsParams),
        db.query(consultsSQL, consultsParams),
        db.query(invoicesSQL, invoicesParams),
        db.query(labSQL, labParams),
      ]);

      const patientsCount = parseInt(patientsRes.rows[0].count || 0);
      const apptRows = apptsRes.rows || [];
      const consultsCount = parseInt(consultsRes.rows[0].count || 0);
      const inv = invoicesRes.rows || [];
      const labOrdersCount = parseInt(labOrdersRes.rows[0].count || 0);

      return {
        period: { from, to },
        total_patients: patientsCount,
        total_appointments: apptRows.length,
        appointment_status: {
          completed: apptRows.filter(a => a.status === 'completed').length,
          cancelled: apptRows.filter(a => a.status === 'cancelled').length,
          no_show:   apptRows.filter(a => a.status === 'no_show').length,
          booked:    apptRows.filter(a => a.status === 'booked').length,
        },
        completed_consultations: consultsCount,
        total_revenue: sum(inv.filter(i => i.status === 'paid'), 'total_amount'),
        pending_collections: inv.filter(i => ['pending', 'partial'].includes(i.status)).reduce((s, i) => s + parseFloat(i.total_amount || 0) - parseFloat(i.paid_amount || 0), 0),
        lab_orders: labOrdersCount,
        currency: 'INR',
      };
    },
  },

  get_revenue_summary: {
    module: 'billing', action: 'view',
    description: 'Total revenue for a period grouped by invoice type. Use for revenue questions and month/period comparisons.',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Start date YYYY-MM-DD. Defaults to today.' },
        date_to:   { type: 'string', description: 'End date YYYY-MM-DD. Defaults to today.' },
      },
    },
    run: async ({ db, orgId, args }) => {
      const from = args.date_from || today();
      const to   = args.date_to   || today();
      const params = [`${from}T00:00:00`, `${to}T23:59:59`];
      const sql = orgFilterSQL(
        'SELECT total_amount, paid_amount, status, invoice_type FROM invoices WHERE created_at >= $1 AND created_at <= $2',
        orgId,
        params
      );
      const res = await db.query(sql, params);
      const invoices = res.rows || [];
      const grouped = {};
      invoices.forEach(i => {
        const k = i.invoice_type || 'other';
        if (!grouped[k]) grouped[k] = { type: k, total: 0, paid: 0, count: 0 };
        grouped[k].total += parseFloat(i.total_amount || 0);
        grouped[k].paid  += parseFloat(i.paid_amount || 0);
        grouped[k].count += 1;
      });
      return {
        period: { from, to },
        total_revenue: sum(invoices, 'total_amount'),
        total_collected: sum(invoices, 'paid_amount'),
        by_type: Object.values(grouped),
        currency: 'INR',
      };
    },
  },

  get_hr_summary: {
    module: 'hrms', action: 'view',
    description: 'HR workforce summary: total/active employees, who is on leave today, headcount by department. Use for HRMS questions about staff and leave.',
    parameters: {
      type: 'object',
      properties: {
        on_date: { type: 'string', description: 'Date YYYY-MM-DD to check leave for. Defaults to today.' },
      },
    },
    run: async ({ db, orgId, args }) => {
      const date = args.on_date || today();
      
      const staffParams = [];
      const staffSQL = orgFilterSQL('SELECT id, department, is_active, employment_status FROM staff_profiles', orgId, staffParams);
      
      const leaveParams = [date, date];
      const leaveSQL = orgFilterSQL('SELECT id, user_id, status FROM hr_leave_requests WHERE status = \'approved\' AND from_date <= $1 AND to_date >= $2', orgId, leaveParams);

      const [staffRes, leavesRes] = await Promise.all([
        db.query(staffSQL, staffParams),
        db.query(leaveSQL, leaveParams).catch(() => ({ rows: [] })),
      ]);
      const rows = staffRes.rows || [];
      const leaves = leavesRes.rows || [];
      const byDept = {};
      rows.forEach(s => { const d = s.department || 'Unassigned'; byDept[d] = (byDept[d] || 0) + 1; });
      return {
        date,
        total_employees: rows.length,
        active_employees: rows.filter(s => s.is_active !== false).length,
        on_leave_today: leaves.length,
        headcount_by_department: byDept,
      };
    },
  },

  get_low_stock_medicines: {
    module: 'pharmacy', action: 'view',
    description: 'List pharmacy medicines at or below their minimum stock threshold (need replenishment). Use for inventory/low-stock questions.',
    parameters: { type: 'object', properties: {} },
    run: async ({ db, orgId }) => {
      const params = [];
      const sql = orgFilterSQL('SELECT medicine_name, current_stock, reorder_level FROM pharmacy_inventory WHERE is_active = true', orgId, params);
      const res = await db.query(sql, params);
      const data = res.rows || [];
      const low = data.filter(m => m.reorder_level != null && Number(m.current_stock) <= Number(m.reorder_level));
      return {
        low_stock_count: low.length,
        items: low.slice(0, 50).map(m => ({ medicine: m.medicine_name, current_stock: m.current_stock, reorder_level: m.reorder_level })),
      };
    },
  },

  get_appointments_summary: {
    module: 'opd', action: 'view',
    description: 'Appointment counts and status breakdown for a date range (booked, completed, cancelled, no-show). Use for appointment/OPD scheduling questions.',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Start date YYYY-MM-DD. Defaults to today.' },
        date_to:   { type: 'string', description: 'End date YYYY-MM-DD. Defaults to today.' },
      },
    },
    run: async ({ db, orgId, args }) => {
      const from = args.date_from || today();
      const to   = args.date_to   || today();
      const params = [from, to];
      const sql = orgFilterSQL('SELECT id, status FROM appointments WHERE appointment_date >= $1 AND appointment_date <= $2', orgId, params);
      const res = await db.query(sql, params);
      const rows = res.rows || [];
      return {
        period: { from, to },
        total: rows.length,
        booked:    rows.filter(a => a.status === 'booked').length,
        completed: rows.filter(a => a.status === 'completed').length,
        cancelled: rows.filter(a => a.status === 'cancelled').length,
        no_show:   rows.filter(a => a.status === 'no_show').length,
      };
    },
  },

  get_doctor_performance: {
    module: 'reports', action: 'view',
    description: 'Per-doctor consultation counts and revenue over a period (default last 30 days). Use for "top doctor", "busiest doctor", doctor productivity questions.',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Start date YYYY-MM-DD. Defaults to 30 days ago.' },
        date_to:   { type: 'string', description: 'End date YYYY-MM-DD. Defaults to today.' },
      },
    },
    run: async ({ db, orgId, args }) => {
      const to = args.date_to || today();
      const from = args.date_from || new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0];
      const params = [from, to];
      const sql = orgFilterSQL('SELECT id, doctor_id FROM consultations WHERE consultation_date >= $1 AND consultation_date <= $2', orgId, params);
      const res = await db.query(sql, params);
      const rows = res.rows || [];
      const docIds = [...new Set(rows.map(c => c.doctor_id).filter(Boolean))];
      const nameMap = {};
      if (docIds.length) {
        const docsRes = await db.query('SELECT id, user_id FROM doctors WHERE id = ANY($1)', [docIds]);
        const userIds = [...new Set((docsRes.rows || []).map(d => d.user_id).filter(Boolean))];
        const usersRes = await db.query('SELECT id, first_name, last_name FROM users WHERE id = ANY($1)', [userIds]);
        const um = {}; (usersRes.rows || []).forEach(u => { um[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim(); });
        (docsRes.rows || []).forEach(d => { nameMap[d.id] = um[d.user_id] || 'Unknown'; });
      }
      const perf = {};
      rows.forEach(c => {
        const k = c.doctor_id || 'unassigned';
        if (!perf[k]) perf[k] = { doctor: nameMap[k] || 'Unassigned', consultations: 0 };
        perf[k].consultations += 1;
      });
      return { period: { from, to }, doctors: Object.values(perf).sort((a, b) => b.consultations - a.consultations).slice(0, 15) };
    },
  },

  get_attendance_summary: {
    module: 'hrms', action: 'view',
    description: 'Staff attendance status counts (present, absent, leave, etc.) for a given date. Use for attendance questions.',
    parameters: {
      type: 'object',
      properties: { on_date: { type: 'string', description: 'Date YYYY-MM-DD. Defaults to today.' } },
    },
    run: async ({ db, orgId, args }) => {
      const date = args.on_date || today();
      const params = [date];
      const sql = orgFilterSQL('SELECT status FROM attendance_logs WHERE date = $1', orgId, params);
      const res = await db.query(sql, params);
      const data = res.rows || [];
      const counts = {};
      data.forEach(r => { const k = r.status || 'unknown'; counts[k] = (counts[k] || 0) + 1; });
      return { date, total_marked: data.length, by_status: counts };
    },
  },

  get_patient_registrations: {
    module: 'reception', action: 'view',
    description: 'New patient registrations in a period and total active patients. Use for patient-registration / new-patient questions.',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Start date YYYY-MM-DD. Defaults to today.' },
        date_to:   { type: 'string', description: 'End date YYYY-MM-DD. Defaults to today.' },
      },
    },
    run: async ({ db, orgId, args }) => {
      const from = args.date_from || today();
      const to   = args.date_to   || today();
      
      const newParams = [`${from}T00:00:00`, `${to}T23:59:59`];
      const newSQL = orgFilterSQL('SELECT COUNT(*) FROM patients WHERE is_archived = false AND created_at >= $1 AND created_at <= $2', orgId, newParams);
      
      const totalParams = [];
      const totalSQL = orgFilterSQL('SELECT COUNT(*) FROM patients WHERE is_archived = false', orgId, totalParams);

      const [newRes, totalRes] = await Promise.all([
        db.query(newSQL, newParams),
        db.query(totalSQL, totalParams),
      ]);
      return { 
        period: { from, to }, 
        new_registrations: parseInt(newRes.rows[0].count || 0), 
        total_active_patients: parseInt(totalRes.rows[0].count || 0) 
      };
    },
  },

  get_lab_summary: {
    module: 'laboratory', action: 'view',
    description: 'Lab order counts by status for a period (ordered, in-progress, completed). Use for laboratory questions.',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Start date YYYY-MM-DD. Defaults to today.' },
        date_to:   { type: 'string', description: 'End date YYYY-MM-DD. Defaults to today.' },
      },
    },
    run: async ({ db, orgId, args }) => {
      const from = args.date_from || today();
      const to   = args.date_to   || today();
      const params = [`${from}T00:00:00`, `${to}T23:59:59`];
      const sql = orgFilterSQL('SELECT status FROM lab_orders WHERE ordered_at >= $1 AND ordered_at <= $2', orgId, params);
      const res = await db.query(sql, params);
      const data = res.rows || [];
      const counts = {};
      data.forEach(r => { const k = r.status || 'unknown'; counts[k] = (counts[k] || 0) + 1; });
      return { period: { from, to }, total_orders: data.length, by_status: counts };
    },
  },

  get_payroll_summary: {
    module: 'hrms', action: 'view',
    description: 'Payroll totals for a pay month (YYYY-MM): number of payslips, total gross and net salary. Use for payroll questions.',
    parameters: {
      type: 'object',
      properties: { pay_month: { type: 'string', description: 'Month in YYYY-MM. Defaults to current month.' } },
    },
    run: async ({ db, orgId, args }) => {
      const month = args.pay_month || new Date().toISOString().slice(0, 7);
      const params = [month];
      const sql = orgFilterSQL('SELECT gross_salary, net_salary, status FROM payroll_records WHERE pay_month = $1', orgId, params);
      const res = await db.query(sql, params);
      const data = res.rows || [];
      return {
        pay_month: month,
        payslips: data.length,
        total_gross: sum(data, 'gross_salary'),
        total_net: sum(data, 'net_salary'),
        currency: 'INR',
      };
    },
  },

  get_shift_list: {
    module: 'hrms', action: 'view',
    description: 'List configured work shifts with their timings. Use for shift-management questions.',
    parameters: { type: 'object', properties: {} },
    run: async ({ db, orgId }) => {
      const params = [];
      const sql = orgFilterSQL('SELECT shift_name, start_time, end_time, days_of_week FROM shifts', orgId, params);
      const res = await db.query(sql, params);
      const data = res.rows || [];
      return { shifts: data.map(s => ({ name: s.shift_name, start: s.start_time, end: s.end_time, days: s.days_of_week })) };
    },
  },

  // Meta-tool: prepares a downloadable report. module=null → per-report RBAC is
  // enforced inside buildReport (each report declares its own module/action).
  generate_report: {
    module: null,
    description: `Prepare a downloadable report when the user asks to "generate a report". Available report types: ${REPORT_NAMES.join(', ')}. Returns a confirmation; the user can then download it as CSV, Excel, or PDF.`,
    parameters: {
      type: 'object',
      properties: {
        report: { type: 'string', enum: REPORT_NAMES, description: 'Which report to generate.' },
        date_from: { type: 'string', description: 'Start date YYYY-MM-DD (optional).' },
        date_to:   { type: 'string', description: 'End date YYYY-MM-DD (optional).' },
      },
      required: ['report'],
    },
    run: async ({ db, orgId, user, args }) => {
      const built = await buildReport(args.report, { db, orgId, user }, args);
      if (built.access_denied || built.error) return built;
      return {
        report_ready: true, report: built.report, label: built.label,
        row_count: built.rows.length, summary: built.summary,
        params: { date_from: args.date_from || null, date_to: args.date_to || null },
        formats: ['csv', 'xlsx', 'pdf'],
        note: 'Tell the user the report is ready and they can download it as CSV, Excel, or PDF.',
      };
    },
  },
};

// OpenAI/Groq tool schema for the request.
const toolSchemas = () => Object.entries(TOOLS).map(([name, t]) => ({
  type: 'function',
  function: { name, description: t.description, parameters: t.parameters },
}));

// Execute a tool with RBAC enforcement. ctx = { db, user, orgId }.
const executeTool = async (name, args, ctx) => {
  const tool = TOOLS[name];
  if (!tool) return { error: `Unknown tool: ${name}` };
  try {
    // Tools with a declared module are RBAC-gated here; meta-tools (module=null)
    // enforce their own finer-grained permissions internally.
    if (tool.module) {
      const perms = await getEffectivePermissionsForRoles(ctx.orgId, rolesOf(ctx.user));
      if (!perms?.[tool.module]?.[tool.action]) {
        return { access_denied: true, message: `You do not have permission to view ${tool.module} data.` };
      }
    }
    const data = await tool.run({ db: ctx.db, orgId: ctx.orgId, user: ctx.user, args: args || {} });
    return data;
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = { TOOLS, toolSchemas, executeTool };
