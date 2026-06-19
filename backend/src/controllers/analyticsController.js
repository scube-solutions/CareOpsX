
const attachDoctorNames = async (rows, doctorIdField = 'doctor_id', db) => {
  const ids = [...new Set(rows.map(r => r[doctorIdField]).filter(Boolean))];
  if (!ids.length) return {};
  const docRes = await db.query(`SELECT id, user_id FROM doctors WHERE id = ANY($1)`, [ids]);
  if (!docRes.rows.length) return {};
  const userIds = [...new Set(docRes.rows.map(d => d.user_id).filter(Boolean))];
  const userRes = await db.query(`SELECT id, first_name, last_name FROM users WHERE id = ANY($1)`, [userIds]);
  const userMap = {};
  (userRes.rows || []).forEach(u => { userMap[u.id] = u; });
  const nameMap = {};
  docRes.rows.forEach(d => {
    const u = userMap[d.user_id];
    nameMap[d.id] = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : 'Unknown';
  });
  return nameMap;
};

// ── KPI Dashboard Summary ─────────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const { date_from, date_to } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const from = date_from || today;
    const to   = date_to   || today;

    const orgP = organizationId ? [organizationId] : [];
    const orgC = organizationId ? `AND organization_id = $1` : '';
    const orgCDate = organizationId ? `AND organization_id = $3` : ''; // after from/to

    const [
      patientsRes, appointmentsRes, consultationsRes,
      invoicesRes, paymentsRes, labOrdersRes,
      pharmaRes, missedFuRes, dropoffRes
    ] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM patients WHERE is_archived = false ${orgC}`, orgP),
      db.query(`SELECT id, status FROM appointments WHERE appointment_date BETWEEN $1 AND $2 ${organizationId ? `AND organization_id = $3` : ''}`, [from, to, ...orgP]),
      db.query(`SELECT id FROM consultations WHERE consultation_date BETWEEN $1 AND $2 ${organizationId ? `AND organization_id = $3` : ''}`, [from, to, ...orgP]),
      db.query(`SELECT total_amount, paid_amount, status, invoice_type FROM invoices WHERE created_at BETWEEN $1 AND $2 ${organizationId ? `AND organization_id = $3` : ''}`, [`${from}T00:00:00`, `${to}T23:59:59`, ...orgP]),
      db.query(`SELECT amount, payment_mode FROM payments WHERE payment_date BETWEEN $1 AND $2 ${organizationId ? `AND organization_id = $3` : ''}`, [`${from}T00:00:00`, `${to}T23:59:59`, ...orgP]),
      db.query(`SELECT id, status FROM lab_orders WHERE ordered_at BETWEEN $1 AND $2 ${organizationId ? `AND organization_id = $3` : ''}`, [`${from}T00:00:00`, `${to}T23:59:59`, ...orgP]),
      db.query(`SELECT total_amount, status FROM pharmacy_invoices WHERE created_at BETWEEN $1 AND $2 ${organizationId ? `AND organization_id = $3` : ''}`, [`${from}T00:00:00`, `${to}T23:59:59`, ...orgP]),
      db.query(`SELECT COUNT(*) FROM follow_up_plans WHERE status = 'scheduled' AND follow_up_date < $1 ${organizationId ? `AND organization_id = $2` : ''}`, [today, ...orgP]),
      db.query(`SELECT COUNT(*) FROM drop_off_watchlist WHERE risk_level IN ('high','critical') AND outcome = 'at_risk' ${orgC}`, orgP),
    ]);

    const apptData  = appointmentsRes.rows || [];
    const invData   = invoicesRes.rows    || [];
    const payData   = paymentsRes.rows    || [];
    const pharmData = pharmaRes.rows      || [];

    const totalRevenue   = invData.filter(i => i.status === 'paid').reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
    const pendingAmount  = invData.filter(i => ['pending','partial'].includes(i.status)).reduce((s, i) => s + parseFloat(i.total_amount || 0) - parseFloat(i.paid_amount || 0), 0);
    const totalCollected = payData.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const pharmRevenue   = pharmData.filter(p => p.status === 'dispensed').reduce((s, p) => s + parseFloat(p.total_amount || 0), 0);

    return res.json({
      kpis: {
        total_patients:           parseInt(patientsRes.rows[0].count) || 0,
        total_appointments:       apptData.length,
        completed_consultations:  consultationsRes.rows.length,
        total_revenue:            totalRevenue,
        pending_collections:      pendingAmount,
        total_collected:          totalCollected,
        pharmacy_revenue:         pharmRevenue,
        lab_orders:               labOrdersRes.rows.length,
        missed_followups:         parseInt(missedFuRes.rows[0].count) || 0,
        high_risk_dropoff:        parseInt(dropoffRes.rows[0].count) || 0,
      },
      appointment_breakdown: {
        completed: apptData.filter(a => a.status === 'completed').length,
        cancelled: apptData.filter(a => a.status === 'cancelled').length,
        no_show:   apptData.filter(a => a.status === 'no_show').length,
        booked:    apptData.filter(a => a.status === 'booked').length,
      },
      payment_modes: payData.reduce((acc, p) => {
        acc[p.payment_mode] = (acc[p.payment_mode] || 0) + parseFloat(p.amount || 0);
        return acc;
      }, {}),
      period: { from, to }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Revenue by Department / Doctor ────────────────────────────────────────────
const getRevenueAnalytics = async (req, res) => {
  try {
    const db = req.db;
    const { date_from, date_to, group_by = 'doctor' } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const from = date_from || today;
    const to   = date_to   || today;

    const organizationId = req.user?.organization_id ?? null;
    const params = [`${from}T00:00:00`, `${to}T23:59:59`];
    let orgClause = '';
    if (organizationId) { params.push(organizationId); orgClause = ` AND organization_id = $${params.length}`; }

    const invRes = await db.query(
      `SELECT total_amount, paid_amount, status, invoice_type, consultation_id
       FROM invoices WHERE created_at BETWEEN $1 AND $2${orgClause}`,
      params
    );
    const invoices = invRes.rows || [];

    // Build consultation_id → doctor_id map
    const consultationIds = [...new Set(invoices.map(i => i.consultation_id).filter(Boolean))];
    const consultDocMap = {};
    if (consultationIds.length) {
      const cRes = await db.query(
        `SELECT id, doctor_id FROM consultations WHERE id = ANY($1)`,
        [consultationIds]
      );
      (cRes.rows || []).forEach(c => { consultDocMap[c.id] = c.doctor_id; });
    }
    const invWithDoctor = invoices.map(i => ({ ...i, doctor_id: consultDocMap[i.consultation_id] || null }));
    const nameMap = await attachDoctorNames(invWithDoctor.filter(i => i.doctor_id), 'doctor_id', db);

    const grouped = {};
    invWithDoctor.forEach(inv => {
      const key   = group_by === 'doctor' ? (inv.doctor_id || 'unassigned') : inv.invoice_type;
      const label = group_by === 'doctor' ? (nameMap[inv.doctor_id] || 'Unassigned') : inv.invoice_type;
      if (!grouped[key]) grouped[key] = { label, total: 0, paid: 0, pending: 0, count: 0 };
      grouped[key].total   += parseFloat(inv.total_amount || 0);
      grouped[key].paid    += parseFloat(inv.paid_amount  || 0);
      grouped[key].pending += parseFloat(inv.total_amount || 0) - parseFloat(inv.paid_amount || 0);
      grouped[key].count   += 1;
    });

    return res.json({ revenue: Object.values(grouped), period: { from, to } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Patient Volume ────────────────────────────────────────────────────────────
const getPatientVolume = async (req, res) => {
  try {
    const db = req.db;
    const { date_from, date_to } = req.query;
    const today         = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const organizationId = req.user?.organization_id ?? null;
    const params = [date_from || thirtyDaysAgo, date_to || today];
    let orgClause = '';
    if (organizationId) { params.push(organizationId); orgClause = ` AND organization_id = $${params.length}`; }

    const result = await db.query(
      `SELECT appointment_date, status FROM appointments WHERE appointment_date BETWEEN $1 AND $2${orgClause} ORDER BY appointment_date ASC`,
      params
    );

    const byDate = {};
    (result.rows || []).forEach(a => {
      if (!byDate[a.appointment_date]) byDate[a.appointment_date] = { date: a.appointment_date, total: 0, completed: 0, cancelled: 0 };
      byDate[a.appointment_date].total += 1;
      if (a.status === 'completed') byDate[a.appointment_date].completed += 1;
      if (a.status === 'cancelled') byDate[a.appointment_date].cancelled += 1;
    });

    return res.json({ volume: Object.values(byDate) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Doctor Performance ────────────────────────────────────────────────────────
const getDoctorPerformance = async (req, res) => {
  try {
    const db = req.db;
    const { date_from, date_to } = req.query;
    const today         = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const organizationId = req.user?.organization_id ?? null;
    const params = [date_from || thirtyDaysAgo, date_to || today];
    let orgClause = '';
    if (organizationId) { params.push(organizationId); orgClause = ` AND organization_id = $${params.length}`; }

    const consultRes = await db.query(
      `SELECT id, doctor_id FROM consultations WHERE consultation_date BETWEEN $1 AND $2${orgClause}`,
      params
    );
    const consultations = consultRes.rows || [];
    const nameMap = await attachDoctorNames(consultations, 'doctor_id', db);

    const consultIds = [...new Set(consultations.map(c => c.id).filter(Boolean))];
    const invByConsult = {};
    if (consultIds.length) {
      const invRes = await db.query(
        `SELECT consultation_id, total_amount, paid_amount FROM invoices WHERE consultation_id = ANY($1)`,
        [consultIds]
      );
      (invRes.rows || []).forEach(i => {
        if (!invByConsult[i.consultation_id]) invByConsult[i.consultation_id] = [];
        invByConsult[i.consultation_id].push(i);
      });
    }

    const perf = {};
    consultations.forEach(c => {
      const k = c.doctor_id;
      if (!perf[k]) perf[k] = { doctor_id: k, name: nameMap[k] || 'Unknown', consultations: 0, revenue: 0, paid: 0 };
      perf[k].consultations += 1;
      (invByConsult[c.id] || []).forEach(i => {
        perf[k].revenue += parseFloat(i.total_amount || 0);
        perf[k].paid    += parseFloat(i.paid_amount  || 0);
      });
    });

    return res.json({ performance: Object.values(perf).sort((a, b) => b.consultations - a.consultations) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Lab Summary ───────────────────────────────────────────────────────────────
const getLabSummary = async (req, res) => {
  try {
    const db = req.db;
    const { date_from, date_to } = req.query;
    const today = new Date().toISOString().split('T')[0];

    const organizationId = req.user?.organization_id ?? null;
    const params = [`${date_from || today}T00:00:00`, `${date_to || today}T23:59:59`];
    let orgClause = '';
    if (organizationId) { params.push(organizationId); orgClause = ` AND organization_id = $${params.length}`; }

    const result = await db.query(
      `SELECT status, test_name, urgency FROM lab_orders WHERE ordered_at BETWEEN $1 AND $2${orgClause}`,
      params
    );
    const data = result.rows || [];

    const statusCounts = data.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});
    const testCounts   = data.reduce((acc, o) => { acc[o.test_name] = (acc[o.test_name] || 0) + 1; return acc; }, {});
    const topTests = Object.entries(testCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));

    return res.json({ total: data.length, status_breakdown: statusCounts, top_tests: topTests });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Pharmacy Summary ──────────────────────────────────────────────────────────
const getPharmacySummary = async (req, res) => {
  try {
    const db = req.db;
    const { date_from, date_to } = req.query;
    const today = new Date().toISOString().split('T')[0];

    const organizationId = req.user?.organization_id ?? null;
    const params = [`${date_from || today}T00:00:00`, `${date_to || today}T23:59:59`];
    let orgClause = '';
    if (organizationId) { params.push(organizationId); orgClause = ` AND organization_id = $${params.length}`; }

    const result = await db.query(
      `SELECT status, total_amount, amount_paid FROM pharmacy_invoices WHERE created_at BETWEEN $1 AND $2${orgClause}`,
      params
    );
    const data = result.rows || [];

    const dispensed      = data.filter(i => i.status === 'dispensed');
    const totalSales     = dispensed.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
    const totalCollected = dispensed.reduce((s, i) => s + parseFloat(i.amount_paid  || 0), 0);

    return res.json({ total_bills: data.length, dispensed_count: dispensed.length, total_sales: totalSales, total_collected: totalCollected });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Follow-up Compliance ──────────────────────────────────────────────────────
const getFollowUpSummary = async (req, res) => {
  try {
    const db = req.db;
    const { date_from, date_to } = req.query;
    const today       = new Date().toISOString().split('T')[0];
    const thirtyAgo   = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const organizationId = req.user?.organization_id ?? null;
    const params = [date_from || thirtyAgo, date_to || today];
    let orgClause = '';
    if (organizationId) { params.push(organizationId); orgClause = ` AND organization_id = $${params.length}`; }

    const result = await db.query(
      `SELECT status, disease_tag, follow_up_date FROM follow_up_plans WHERE follow_up_date BETWEEN $1 AND $2${orgClause}`,
      params
    );
    const data = result.rows || [];

    const total       = data.length;
    const completed   = data.filter(f => f.status === 'completed').length;
    const missed      = data.filter(f => f.status === 'missed' || (f.status === 'scheduled' && String(f.follow_up_date).split('T')[0] < today)).length;
    const compliance_rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const byDisease = data.reduce((acc, f) => {
      const tag = f.disease_tag || 'general';
      if (!acc[tag]) acc[tag] = { total: 0, completed: 0, missed: 0 };
      acc[tag].total    += 1;
      if (f.status === 'completed') acc[tag].completed += 1;
      if (f.status === 'missed')    acc[tag].missed    += 1;
      return acc;
    }, {});

    return res.json({ total, completed, missed, compliance_rate, by_disease: byDisease });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getDashboard, getRevenueAnalytics, getPatientVolume, getDoctorPerformance, getLabSummary, getPharmacySummary, getFollowUpSummary };
