// ─────────────────────────────────────────────────────────────────────────────
// Report definitions. Each report is RBAC-gated ({ module, action }) and returns
// a normalized { title, columns, rows, summary } that the exporters turn into
// CSV / Excel / PDF. Reuses the same org-scoping discipline as the tools.
// ─────────────────────────────────────────────────────────────────────────────
const { getEffectivePermissionsForRoles, rolesOf } = require('../utils/permissions');

const today = () => new Date().toISOString().split('T')[0];
const monthStart = () => new Date().toISOString().slice(0, 7) + '-01';
const num = (v) => parseFloat(v || 0);

const orgFilterSQL = (baseSQL, orgId, params) => {
  let sql = baseSQL;
  if (orgId) {
    params.push(orgId);
    sql += (baseSQL.toLowerCase().includes('where') ? ' AND' : ' WHERE') + ` organization_id = $${params.length}`;
  }
  return sql;
};

const REPORTS = {
  revenue: {
    label: 'Revenue Report', module: 'billing', action: 'view',
    build: async ({ db, orgId, args }) => {
      const from = args.date_from || monthStart();
      const to   = args.date_to   || today();
      const params = [`${from}T00:00:00`, `${to}T23:59:59`];
      const sql = orgFilterSQL(
        'SELECT total_amount, paid_amount, status, invoice_type FROM invoices WHERE created_at >= $1 AND created_at <= $2',
        orgId,
        params
      );
      const res = await db.query(sql, params);
      const data = res.rows || [];
      const g = {};
      data.forEach(i => {
        const k = i.invoice_type || 'other';
        if (!g[k]) g[k] = { type: k, total: 0, paid: 0, pending: 0, count: 0 };
        g[k].total += num(i.total_amount); g[k].paid += num(i.paid_amount);
        g[k].pending += num(i.total_amount) - num(i.paid_amount); g[k].count += 1;
      });
      const rows = Object.values(g).map(r => ({ ...r, total: r.total.toFixed(2), paid: r.paid.toFixed(2), pending: r.pending.toFixed(2) }));
      return {
        title: `Revenue Report (${from} to ${to})`,
        columns: [{ key: 'type', label: 'Invoice Type' }, { key: 'count', label: 'Invoices' }, { key: 'total', label: 'Total (₹)' }, { key: 'paid', label: 'Collected (₹)' }, { key: 'pending', label: 'Pending (₹)' }],
        rows,
        summary: `Total revenue ₹${data.reduce((s, i) => s + num(i.total_amount), 0).toFixed(2)} across ${data.length} invoices.`,
      };
    },
  },

  attendance: {
    label: 'Attendance Report', module: 'hrms', action: 'view',
    build: async ({ db, orgId, args }) => {
      const date = args.date_from || today();
      const params = [date];
      const sql = orgFilterSQL('SELECT status FROM attendance_logs WHERE date = $1', orgId, params);
      const res = await db.query(sql, params);
      const data = res.rows || [];
      const c = {};
      data.forEach(r => { const k = r.status || 'unknown'; c[k] = (c[k] || 0) + 1; });
      return {
        title: `Attendance Report (${date})`,
        columns: [{ key: 'status', label: 'Status' }, { key: 'count', label: 'Count' }],
        rows: Object.entries(c).map(([status, count]) => ({ status, count })),
        summary: `${data.length} attendance records marked on ${date}.`,
      };
    },
  },

  inventory_status: {
    label: 'Inventory Status Report', module: 'pharmacy', action: 'view',
    build: async ({ db, orgId }) => {
      const params = [];
      const sql = orgFilterSQL('SELECT medicine_name, current_stock, reorder_level FROM pharmacy_inventory WHERE is_active = true', orgId, params);
      const res = await db.query(sql, params);
      const data = res.rows || [];
      const rows = data.filter(m => m.reorder_level != null && num(m.current_stock) <= num(m.reorder_level))
        .map(m => ({ medicine: m.medicine_name, current_stock: m.current_stock, reorder_level: m.reorder_level }));
      return {
        title: 'Inventory Status Report — Low Stock',
        columns: [{ key: 'medicine', label: 'Medicine' }, { key: 'current_stock', label: 'Current Stock' }, { key: 'reorder_level', label: 'Reorder Level' }],
        rows,
        summary: `${rows.length} medicine(s) at or below reorder level.`,
      };
    },
  },

  department_performance: {
    label: 'Department / Doctor Performance Report', module: 'reports', action: 'view',
    build: async ({ db, orgId, args }) => {
      const to = args.date_to || today();
      const from = args.date_from || new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0];
      const params = [from, to];
      const sql = orgFilterSQL('SELECT id, doctor_id FROM consultations WHERE consultation_date >= $1 AND consultation_date <= $2', orgId, params);
      const res = await db.query(sql, params);
      const rows0 = res.rows || [];
      const docIds = [...new Set(rows0.map(c => c.doctor_id).filter(Boolean))];
      const nameMap = {};
      if (docIds.length) {
        const docsRes = await db.query('SELECT id, user_id, specialization FROM doctors WHERE id = ANY($1)', [docIds]);
        const userIds = [...new Set((docsRes.rows || []).map(d => d.user_id).filter(Boolean))];
        const usersRes = await db.query('SELECT id, first_name, last_name FROM users WHERE id = ANY($1)', [userIds]);
        const um = {}; (usersRes.rows || []).forEach(u => { um[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim(); });
        (docsRes.rows || []).forEach(d => { nameMap[d.id] = { name: um[d.user_id] || 'Unknown', dept: d.specialization || '—' }; });
      }
      const perf = {};
      rows0.forEach(c => { const k = c.doctor_id || 'x'; if (!perf[k]) perf[k] = { doctor: nameMap[k]?.name || 'Unassigned', department: nameMap[k]?.dept || '—', consultations: 0 }; perf[k].consultations += 1; });
      return {
        title: `Department / Doctor Performance (${from} to ${to})`,
        columns: [{ key: 'doctor', label: 'Doctor' }, { key: 'department', label: 'Specialization' }, { key: 'consultations', label: 'Consultations' }],
        rows: Object.values(perf).sort((a, b) => b.consultations - a.consultations),
        summary: `${rows0.length} consultations across ${Object.keys(perf).length} doctors.`,
      };
    },
  },

  employee_leave: {
    label: 'Employee Leave Summary', module: 'hrms', action: 'view',
    build: async ({ db, orgId, args }) => {
      const from = args.date_from || monthStart();
      const to   = args.date_to   || today();
      const params = [from, to];
      const sql = orgFilterSQL('SELECT user_id, leave_type, from_date, to_date, status FROM hr_leave_requests WHERE from_date >= $1 AND from_date <= $2', orgId, params);
      const res = await db.query(sql, params);
      const data = res.rows || [];
      const userIds = [...new Set(data.map(l => l.user_id).filter(Boolean))];
      const um = {};
      if (userIds.length) {
        const usersRes = await db.query('SELECT id, first_name, last_name FROM users WHERE id = ANY($1)', [userIds]);
        (usersRes.rows || []).forEach(u => { um[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim(); });
      }
      return {
        title: `Employee Leave Summary (${from} to ${to})`,
        columns: [{ key: 'employee', label: 'Employee' }, { key: 'leave_type', label: 'Type' }, { key: 'from_date', label: 'From' }, { key: 'to_date', label: 'To' }, { key: 'status', label: 'Status' }],
        rows: data.map(l => ({ employee: um[l.user_id] || 'Unknown', leave_type: l.leave_type || '—', from_date: l.from_date, to_date: l.to_date, status: l.status })),
        summary: `${data.length} leave request(s) in the period.`,
      };
    },
  },

  monthly_hospital: {
    label: 'Monthly Hospital Report', module: 'reports', action: 'view',
    build: async ({ db, orgId, args }) => {
      const from = args.date_from || monthStart();
      const to   = args.date_to   || today();
      
      const patientsParams = [`${from}T00:00:00`, `${to}T23:59:59`];
      const patientsSQL = orgFilterSQL('SELECT COUNT(*) FROM patients WHERE is_archived = false AND created_at >= $1 AND created_at <= $2', orgId, patientsParams);
      
      const apptsParams = [from, to];
      const apptsSQL = orgFilterSQL('SELECT COUNT(*) FROM appointments WHERE appointment_date >= $1 AND appointment_date <= $2', orgId, apptsParams);
      
      const consultsParams = [from, to];
      const consultsSQL = orgFilterSQL('SELECT COUNT(*) FROM consultations WHERE consultation_date >= $1 AND consultation_date <= $2', orgId, consultsParams);
      
      const invoicesParams = [`${from}T00:00:00`, `${to}T23:59:59`];
      const invoicesSQL = orgFilterSQL('SELECT total_amount, status FROM invoices WHERE created_at >= $1 AND created_at <= $2', orgId, invoicesParams);
      
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
      const apptsCount = parseInt(apptsRes.rows[0].count || 0);
      const consultsCount = parseInt(consultsRes.rows[0].count || 0);
      const invoicesData = invoicesRes.rows || [];
      const labOrdersCount = parseInt(labOrdersRes.rows[0].count || 0);

      const revenue = invoicesData.filter(i => i.status === 'paid').reduce((s, i) => s + num(i.total_amount), 0);
      const rows = [
        { metric: 'New Patient Registrations', value: patientsCount },
        { metric: 'Total Appointments', value: apptsCount },
        { metric: 'Completed Consultations', value: consultsCount },
        { metric: 'Lab Orders', value: labOrdersCount },
        { metric: 'Revenue (₹)', value: revenue.toFixed(2) },
      ];
      return {
        title: `Monthly Hospital Report (${from} to ${to})`,
        columns: [{ key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }],
        rows,
        summary: `Period ${from} to ${to}: ${patientsCount} new patients, ₹${revenue.toFixed(2)} revenue.`,
      };
    },
  },
};

const REPORT_NAMES = Object.keys(REPORTS);

// Build a report after checking the caller's permission for its module.
const buildReport = async (name, ctx, args = {}) => {
  const def = REPORTS[name];
  if (!def) return { error: `Unknown report: ${name}. Available: ${REPORT_NAMES.join(', ')}` };
  const perms = await getEffectivePermissionsForRoles(ctx.orgId, rolesOf(ctx.user));
  if (!perms?.[def.module]?.[def.action]) {
    return { access_denied: true, message: `You do not have permission to generate the ${def.label}.` };
  }
  const result = await def.build({ db: ctx.db, orgId: ctx.orgId, args });
  return { ...result, report: name, label: def.label };
};

module.exports = { REPORTS, REPORT_NAMES, buildReport };
