'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AnalyticsDashboard() {
  const [kpis, setKpis] = useState(null);
  const [apptBreakdown, setApptBreakdown] = useState({});
  const [revenue, setRevenue] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [labSummary, setLabSummary] = useState(null);
  const [pharmSummary, setPharmSummary] = useState(null);
  const [followupSummary, setFollowupSummary] = useState(null);
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  const load = async (from, to) => {
    const f = from || dateFrom;
    const t = to   || dateTo;
    setLoading(true);
    const q = `date_from=${f}&date_to=${t}`;
    try {
      const [dash, rev, doc, lab, pharm, fu] = await Promise.all([
        api(`/analytics/dashboard?${q}`),
        api(`/analytics/revenue?${q}`),
        api(`/analytics/doctor-performance?${q}`),
        api(`/analytics/lab?${q}`),
        api(`/analytics/pharmacy?${q}`),
        api(`/analytics/followup?${q}`),
      ]);
      setKpis(dash.kpis);
      setApptBreakdown(dash.appointment_breakdown || {});
      setRevenue(rev.revenue || []);
      setDoctors(doc.performance || []);
      setLabSummary(lab);
      setPharmSummary(pharm);
      setFollowupSummary(fu);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const kpiCards = kpis ? [
    { label: 'Total Patients', value: kpis.total_patients, color: '#00b4a0' },
    { label: "Period Appointments", value: kpis.total_appointments, color: '#3b82f6' },
    { label: 'Consultations', value: kpis.completed_consultations, color: '#8b5cf6' },
    { label: 'Revenue', value: `₹${kpis.total_revenue?.toFixed(0)}`, color: '#10b981' },
    { label: 'Pending Collections', value: `₹${kpis.pending_collections?.toFixed(0)}`, color: '#f59e0b' },
    { label: 'Lab Orders', value: kpis.lab_orders, color: '#06b6d4' },
    { label: 'Pharmacy Revenue', value: `₹${kpis.pharmacy_revenue?.toFixed(0)}`, color: '#ec4899' },
    { label: 'Missed Follow-ups', value: kpis.missed_followups, color: '#ef4444' },
  ] : [];

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div><h1 style={s.h1}>Analytics Dashboard</h1><p style={s.sub}>Hospital performance overview</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {[{ label: 'Today', days: 0 }, { label: '7D', days: 7 }, { label: '1M', days: 30 }, { label: '2M', days: 60 }, { label: '3M', days: 90 }, { label: '6M', days: 180 }].map(p => (
            <button key={p.label} onClick={() => {
              const to   = new Date().toISOString().split('T')[0];
              const from = new Date(Date.now() - p.days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              setDateFrom(from); setDateTo(to);
              load(from, to);
            }} style={{ padding: '6px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
              {p.label}
            </button>
          ))}
          <div><label style={s.label}>From</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={s.input} /></div>
          <div><label style={s.label}>To</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={s.input} /></div>
          <button onClick={() => load(dateFrom, dateTo)} style={{ ...s.btnPri, alignSelf: 'flex-end' }}>Apply</button>
        </div>
      </div>

      {loading ? <div style={s.center}>Loading analytics...</div> : (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            {kpiCards.map(c => (
              <div key={c.label} style={{ ...s.card, borderTop: `4px solid ${c.color}` }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: c.color }}>{c.value}</div>
                <div style={{ fontSize: '.8rem', color: '#64748b', marginTop: 4 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Appointment Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={s.card}>
              <h2 style={s.h2}>Appointment Breakdown</h2>
              {Object.entries(apptBreakdown).map(([status, count]) => (
                <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ textTransform: 'capitalize', color: '#475569', fontSize: '.875rem' }}>{status}</span>
                  <span style={{ fontWeight: 700, color: '#0f1f3d' }}>{count}</span>
                </div>
              ))}
            </div>

            <div style={s.card}>
              <h2 style={s.h2}>Follow-up Compliance</h2>
              {followupSummary && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '3rem', fontWeight: 900, color: followupSummary.compliance_rate >= 70 ? '#10b981' : '#f59e0b' }}>{followupSummary.compliance_rate}%</div>
                      <div style={{ color: '#64748b', fontSize: '.875rem' }}>Compliance Rate</div>
                    </div>
                  </div>
                  {[['Total Follow-ups', followupSummary.total], ['Completed', followupSummary.completed], ['Missed', followupSummary.missed]].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#475569', fontSize: '.875rem' }}>{l}</span>
                      <span style={{ fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Doctor Performance */}
          <div style={{ ...s.card, marginBottom: 16 }}>
            <h2 style={s.h2}>Doctor Performance</h2>
            <table style={s.table}>
              <thead><tr>{['Doctor', 'Consultations', 'Revenue', 'Collected', 'Pending'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {doctors.length === 0 ? <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', color: '#94a3b8' }}>No data</td></tr>
                  : doctors.map(d => (
                    <tr key={d.doctor_id}>
                      <td style={s.td}><strong>{d.name || 'Unknown'}</strong></td>
                      <td style={s.td}>{d.consultations}</td>
                      <td style={s.td}>₹{d.revenue?.toFixed(0)}</td>
                      <td style={s.td}>₹{d.paid?.toFixed(0)}</td>
                      <td style={s.td}>₹{(d.revenue - d.paid)?.toFixed(0)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Revenue by Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={s.card}>
              <h2 style={s.h2}>Revenue by Type</h2>
              {revenue.length === 0 ? <p style={s.empty}>No data</p> : revenue.map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ textTransform: 'capitalize', color: '#475569', fontSize: '.875rem' }}>{r.label}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#0f1f3d' }}>₹{r.total?.toFixed(0)}</div>
                    <div style={{ fontSize: '.75rem', color: '#94a3b8' }}>{r.count} invoices</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={s.card}>
              <h2 style={s.h2}>Lab & Pharmacy Summary</h2>
              {labSummary && (
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: '.875rem', fontWeight: 600, color: '#0f1f3d', margin: '0 0 8px' }}>Lab</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: '.875rem', color: '#64748b' }}>Total Orders</span><strong>{labSummary.total}</strong></div>
                  {Object.entries(labSummary.status_breakdown || {}).map(([st, cnt]) => (
                    <div key={st} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f9f9f9' }}><span style={{ textTransform: 'capitalize', color: '#94a3b8', fontSize: '.8rem' }}>{st.replace('_', ' ')}</span><span>{cnt}</span></div>
                  ))}
                </div>
              )}
              {pharmSummary && (
                <div>
                  <h3 style={{ fontSize: '.875rem', fontWeight: 600, color: '#0f1f3d', margin: '0 0 8px' }}>Pharmacy</h3>
                  {[['Bills Generated', pharmSummary.total_bills], ['Dispensed', pharmSummary.dispensed_count], ['Total Sales', `₹${pharmSummary.total_sales?.toFixed(0)}`], ['Collected', `₹${pharmSummary.total_collected?.toFixed(0)}`]].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f9f9f9' }}><span style={{ color: '#94a3b8', fontSize: '.8rem' }}>{l}</span><span style={{ fontWeight: 600 }}>{v}</span></div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const s = {
  page: { padding: '2rem', maxWidth: 1400, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  h1: { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2: { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', marginBottom: 14 },
  sub: { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#64748b' },
  card: { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  label: { display: 'block', fontSize: '.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: 4 },
  input: { padding: '.55rem .9rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', background: '#f8fafc', fontSize: '.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' },
  td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '.875rem' },
  empty: { color: '#94a3b8', textAlign: 'center', padding: '1rem' },
  btnPri: { padding: '.6rem 1.2rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem' },
};
