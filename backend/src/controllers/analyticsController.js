const supabase = require('../utils/supabase');

const attachDoctorNames = async (rows, doctorIdField = 'doctor_id') => {
  const ids = [...new Set(rows.map(r => r[doctorIdField]).filter(Boolean))];
  if (!ids.length) return {};
  const { data: doctors } = await supabase.from('doctors').select('id, user_id').in('id', ids);
  if (!doctors?.length) return {};
  const userIds = [...new Set(doctors.map(d => d.user_id).filter(Boolean))];
  const { data: users } = await supabase.from('users').select('id, first_name, last_name').in('id', userIds);
  const userMap = {};
  (users || []).forEach(u => { userMap[u.id] = u; });
  const nameMap = {};
  doctors.forEach(d => {
    const u = userMap[d.user_id];
    nameMap[d.id] = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : 'Unknown';
  });
  return nameMap;
};

// ── KPI Dashboard Summary ─────────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const { date_from, date_to, branch_id, department_id, doctor_id } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const from = date_from || today;
    const to = date_to || today;

    const [patients, appointments, consultations, invoices, payments, labOrders, pharmacySales, missedFollowups, dropoffAtRisk] = await Promise.all([
      supabase.from('patients').select('id', { count: 'exact', head: true }).eq('is_archived', false),
      supabase.from('appointments').select('id, status', { count: 'exact' }).gte('appointment_date', from).lte('appointment_date', to),
      supabase.from('consultations').select('id, consultation_date', { count: 'exact' }).gte('consultation_date', from).lte('consultation_date', to),
      supabase.from('invoices').select('total_amount, paid_amount, status, invoice_type').gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`),
      supabase.from('payments').select('amount, payment_mode').gte('payment_date', `${from}T00:00:00`).lte('payment_date', `${to}T23:59:59`),
      supabase.from('lab_orders').select('id, status', { count: 'exact' }).gte('ordered_at', `${from}T00:00:00`).lte('ordered_at', `${to}T23:59:59`),
      supabase.from('pharmacy_invoices').select('total_amount, status').gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`),
      supabase.from('follow_up_plans').select('id', { count: 'exact', head: true }).eq('status', 'scheduled').lt('follow_up_date', today),
      supabase.from('drop_off_watchlist').select('id', { count: 'exact', head: true }).in('risk_level', ['high', 'critical']).eq('outcome', 'at_risk'),
    ]);

    const apptData = appointments.data || [];
    const invData = invoices.data || [];
    const payData = payments.data || [];
    const pharmData = pharmacySales.data || [];

    const totalRevenue = invData.filter(i => i.status === 'paid').reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
    const pendingAmount = invData.filter(i => ['pending', 'partial'].includes(i.status)).reduce((s, i) => s + parseFloat(i.total_amount || 0) - parseFloat(i.paid_amount || 0), 0);
    const totalCollected = payData.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const pharmRevenue = pharmData.filter(p => p.status === 'dispensed').reduce((s, p) => s + parseFloat(p.total_amount || 0), 0);

    return res.json({
      kpis: {
        total_patients: patients.count || 0,
        total_appointments: appointments.count || 0,
        completed_consultations: consultations.count || 0,
        total_revenue: totalRevenue,
        pending_collections: pendingAmount,
        total_collected: totalCollected,
        pharmacy_revenue: pharmRevenue,
        lab_orders: labOrders.count || 0,
        missed_followups: missedFollowups.count || 0,
        high_risk_dropoff: dropoffAtRisk.count || 0,
      },
      appointment_breakdown: {
        completed: apptData.filter(a => a.status === 'completed').length,
        cancelled: apptData.filter(a => a.status === 'cancelled').length,
        no_show: apptData.filter(a => a.status === 'no_show').length,
        booked: apptData.filter(a => a.status === 'booked').length,
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
    const { date_from, date_to, group_by = 'doctor' } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const from = date_from || today;
    const to = date_to || today;

    const { data: invoices, error } = await supabase.from('invoices')
      .select('total_amount, paid_amount, status, invoice_type, consultation_id')
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`);

    if (error) throw error;

    // Build consultation_id → doctor_id map for doctor grouping
    const consultationIds = [...new Set((invoices || []).map(i => i.consultation_id).filter(Boolean))];
    const consultDocMap = {};
    if (consultationIds.length) {
      const { data: consults } = await supabase.from('consultations').select('id, doctor_id').in('id', consultationIds);
      (consults || []).forEach(c => { consultDocMap[c.id] = c.doctor_id; });
    }
    const invWithDoctor = (invoices || []).map(i => ({ ...i, doctor_id: consultDocMap[i.consultation_id] || null }));
    const nameMap = await attachDoctorNames(invWithDoctor.filter(i => i.doctor_id));

    const grouped = {};
    invWithDoctor.forEach(inv => {
      const key = group_by === 'doctor' ? (inv.doctor_id || 'unassigned') : inv.invoice_type;
      const label = group_by === 'doctor' ? (nameMap[inv.doctor_id] || 'Unassigned') : inv.invoice_type;

      if (!grouped[key]) grouped[key] = { label, total: 0, paid: 0, pending: 0, count: 0 };
      grouped[key].total += parseFloat(inv.total_amount || 0);
      grouped[key].paid += parseFloat(inv.paid_amount || 0);
      grouped[key].pending += (parseFloat(inv.total_amount || 0) - parseFloat(inv.paid_amount || 0));
      grouped[key].count += 1;
    });

    return res.json({ revenue: Object.values(grouped), period: { from, to } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Patient Volume ────────────────────────────────────────────────────────────
const getPatientVolume = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await supabase.from('appointments')
      .select('appointment_date, status')
      .gte('appointment_date', date_from || thirtyDaysAgo)
      .lte('appointment_date', date_to || today)
      .order('appointment_date', { ascending: true });

    if (error) throw error;

    const byDate = {};
    (data || []).forEach(a => {
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
    const { date_from, date_to } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: consultations, error } = await supabase.from('consultations')
      .select('id, doctor_id')
      .gte('consultation_date', date_from || thirtyDaysAgo)
      .lte('consultation_date', date_to || today);

    if (error) throw error;

    const nameMap = await attachDoctorNames(consultations || []);

    // Fetch invoices linked to these consultations for revenue
    const consultIds = [...new Set((consultations || []).map(c => c.id).filter(Boolean))];
    const invByConsult = {};
    if (consultIds.length) {
      const { data: invoices } = await supabase.from('invoices')
        .select('consultation_id, total_amount, paid_amount')
        .in('consultation_id', consultIds);
      (invoices || []).forEach(i => {
        if (!invByConsult[i.consultation_id]) invByConsult[i.consultation_id] = [];
        invByConsult[i.consultation_id].push(i);
      });
    }

    const perf = {};
    (consultations || []).forEach(c => {
      const k = c.doctor_id;
      if (!perf[k]) perf[k] = { doctor_id: k, name: nameMap[k] || 'Unknown', consultations: 0, revenue: 0, paid: 0 };
      perf[k].consultations += 1;
      (invByConsult[c.id] || []).forEach(i => {
        perf[k].revenue += parseFloat(i.total_amount || 0);
        perf[k].paid += parseFloat(i.paid_amount || 0);
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
    const { date_from, date_to } = req.query;
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase.from('lab_orders')
      .select('status, test_name, urgency')
      .gte('ordered_at', `${date_from || today}T00:00:00`)
      .lte('ordered_at', `${date_to || today}T23:59:59`);

    if (error) throw error;

    const statusCounts = (data || []).reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});
    const testCounts = (data || []).reduce((acc, o) => {
      acc[o.test_name] = (acc[o.test_name] || 0) + 1;
      return acc;
    }, {});
    const topTests = Object.entries(testCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));

    return res.json({ total: data.length, status_breakdown: statusCounts, top_tests: topTests });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Pharmacy Summary ──────────────────────────────────────────────────────────
const getPharmacySummary = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase.from('pharmacy_invoices')
      .select('status, total_amount, amount_paid')
      .gte('created_at', `${date_from || today}T00:00:00`)
      .lte('created_at', `${date_to || today}T23:59:59`);

    if (error) throw error;

    const dispensed = (data || []).filter(i => i.status === 'dispensed');
    const totalSales = dispensed.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
    const totalCollected = dispensed.reduce((s, i) => s + parseFloat(i.amount_paid || 0), 0);

    return res.json({ total_bills: data.length, dispensed_count: dispensed.length, total_sales: totalSales, total_collected: totalCollected });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Follow-up Compliance ──────────────────────────────────────────────────────
const getFollowUpSummary = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase.from('follow_up_plans')
      .select('status, disease_tag')
      .gte('follow_up_date', date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .lte('follow_up_date', date_to || today);

    if (error) throw error;

    const total = data.length;
    const completed = (data || []).filter(f => f.status === 'completed').length;
    const missed = (data || []).filter(f => f.status === 'missed' || (f.status === 'scheduled' && f.follow_up_date < today)).length;
    const compliance_rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const byDisease = (data || []).reduce((acc, f) => {
      const tag = f.disease_tag || 'general';
      if (!acc[tag]) acc[tag] = { total: 0, completed: 0, missed: 0 };
      acc[tag].total += 1;
      if (f.status === 'completed') acc[tag].completed += 1;
      if (f.status === 'missed') acc[tag].missed += 1;
      return acc;
    }, {});

    return res.json({ total, completed, missed, compliance_rate, by_disease: byDisease });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getDashboard, getRevenueAnalytics, getPatientVolume, getDoctorPerformance, getLabSummary, getPharmacySummary, getFollowUpSummary };
