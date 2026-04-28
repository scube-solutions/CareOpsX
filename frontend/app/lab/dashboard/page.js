'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const STATUS_COLORS = {
  ordered:          { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  sample_collected: { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
  processing:       { bg: '#ede9fe', text: '#6d28d9', border: '#ddd6fe' },
  ready:            { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
  delivered:        { bg: '#f1f5f9', text: '#334155', border: '#e2e8f0' },
  cancelled:        { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' },
};

export default function LabDashboard() {
  const [allOrders, setAllOrders]   = useState([]);
  const [reports, setReports]       = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      api('/lab/orders').catch(() => ({ lab_orders: [] })),
      api('/lab/reports').catch(() => ({ lab_reports: [] })),
    ]).then(([o, r]) => {
      setAllOrders(o.lab_orders || []);
      setReports(r.lab_reports || []);
    }).finally(() => setLoading(false));
  }, []);

  const countBy = (arr, key, val) => arr.filter(x => x[key] === val).length;
  const today = new Date().toDateString();
  const todayOrders  = allOrders.filter(o => new Date(o.ordered_at).toDateString() === today);
  const pendingCount = allOrders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
  const urgentCount  = allOrders.filter(o => o.urgency === 'urgent' && !['delivered', 'cancelled'].includes(o.status)).length;
  const recentReports = reports.slice(0, 5);

  if (loading) return <div style={s.center}>Loading...</div>;

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={s.h1}>Lab Dashboard</h1>
        <p style={s.sub}>Overview of lab operations</p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: "Today's Orders", value: todayOrders.length, color: '#3b82f6', bg: '#eff6ff' },
          { label: 'Pending',        value: pendingCount,       color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Urgent',         value: urgentCount,        color: '#ef4444', bg: '#fef2f2' },
          { label: 'Reports Filed',  value: reports.length,     color: '#10b981', bg: '#f0fdf4' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '1.25rem 1.5rem', border: `1px solid ${c.color}20` }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: '.8rem', color: '#64748b', marginTop: 6, fontWeight: 600 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Status Breakdown */}
        <div style={s.card}>
          <h2 style={s.h2}>Status Breakdown</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {['ordered', 'sample_collected', 'processing', 'ready', 'delivered'].map(st => {
              const cnt   = countBy(allOrders, 'status', st);
              const total = allOrders.length || 1;
              const pct   = Math.round((cnt / total) * 100);
              const c     = STATUS_COLORS[st];
              return (
                <div key={st}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '.8rem', fontWeight: 600, color: c.text, textTransform: 'capitalize' }}>{st.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: '.8rem', color: '#64748b' }}>{cnt} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: c.text, borderRadius: 4, transition: 'width .3s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Today's Orders */}
        <div style={s.card}>
          <h2 style={s.h2}>Today's Orders</h2>
          {todayOrders.length === 0
            ? <p style={s.empty}>No orders today yet.</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {todayOrders.slice(0, 6).map(o => {
                  const c = STATUS_COLORS[o.status] || STATUS_COLORS.ordered;
                  return (
                    <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#f8fafc', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '.85rem', color: '#0f1f3d' }}>{o.patients?.first_name} {o.patients?.last_name}</div>
                        <div style={{ fontSize: '.75rem', color: '#64748b' }}>{o.test_name}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {o.urgency === 'urgent' && (
                          <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '.7rem', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>URGENT</span>
                        )}
                        <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontSize: '.72rem', padding: '2px 8px', borderRadius: 10, fontWeight: 600, textTransform: 'capitalize' }}>
                          {o.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {todayOrders.length > 6 && (
                  <p style={{ fontSize: '.8rem', color: '#64748b', textAlign: 'center' }}>+{todayOrders.length - 6} more — <a href="/lab/orders" style={{ color: '#00b4a0', textDecoration: 'none' }}>View all</a></p>
                )}
              </div>
            )}
        </div>

        {/* Recent Reports */}
        <div style={{ ...s.card, gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={s.h2}>Recent Reports</h2>
            <a href="/lab/reports" style={{ fontSize: '.8rem', color: '#00b4a0', textDecoration: 'none', fontWeight: 600 }}>View all →</a>
          </div>
          {recentReports.length === 0
            ? <p style={s.empty}>No reports uploaded yet.</p>
            : (
              <table style={s.table}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Patient', 'Test', 'Result', 'Uploaded At', 'Report'].map(h => <th key={h} style={s.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {recentReports.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={s.td}>
                        <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{r.patients?.first_name} {r.patients?.last_name}</div>
                        <div style={{ fontSize: '.75rem', color: '#64748b' }}>{r.patients?.patient_uid}</div>
                      </td>
                      <td style={s.td}>{r.lab_orders?.test_name || '–'}</td>
                      <td style={s.td}>
                        <span style={{ background: r.is_normal ? '#dcfce7' : '#fee2e2', color: r.is_normal ? '#166534' : '#b91c1c', padding: '3px 10px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>
                          {r.is_normal ? 'Normal' : 'Abnormal'}
                        </span>
                      </td>
                      <td style={{ ...s.td, fontSize: '.8rem', color: '#64748b' }}>{new Date(r.uploaded_at || r.created_at).toLocaleString('en-IN')}</td>
                      <td style={s.td}>
                        {r.report_url
                          ? <a href={r.report_url} target="_blank" rel="noopener noreferrer" style={{ color: '#1d4ed8', fontSize: '.8rem', fontWeight: 600 }}>Download</a>
                          : <span style={{ color: '#94a3b8', fontSize: '.8rem' }}>–</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>
    </div>
  );
}

const s = {
  page:  { padding: '2rem', maxWidth: 1400, margin: '0 auto' },
  center:{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#64748b' },
  h1:    { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2:    { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', margin: 0 },
  sub:   { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  card:  { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th:    { textAlign: 'left', padding: '10px 12px', fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0' },
  td:    { padding: '10px 12px', fontSize: '.875rem', color: '#334155' },
  empty: { color: '#94a3b8', fontSize: '.875rem', textAlign: 'center', padding: '1.5rem 0' },
};
