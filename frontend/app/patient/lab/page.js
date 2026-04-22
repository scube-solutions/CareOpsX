'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const STATUS_COLOR = {
  ordered:          { bg: '#fef3c7', text: '#92400e' },
  sample_collected: { bg: '#dbeafe', text: '#1e40af' },
  processing:       { bg: '#ede9fe', text: '#6d28d9' },
  ready:            { bg: '#dcfce7', text: '#166534' },
  delivered:        { bg: '#f1f5f9', text: '#334155' },
  cancelled:        { bg: '#fee2e2', text: '#b91c1c' },
};

export default function PatientLabPage() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/lab/my-orders')
      .then(d => setOrders(d.lab_orders || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={s.center}>Loading...</div>;

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={s.h1}>My Lab Reports</h1>
        <p style={s.sub}>{orders.length} test{orders.length !== 1 ? 's' : ''} ordered</p>
      </div>

      {orders.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧪</div>
          <p style={{ color: '#64748b' }}>No lab tests ordered yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
          <div style={s.card}>
            <table style={s.table}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Test', 'Urgency', 'Ordered', 'Status', 'Report'].map(h => <th key={h} style={s.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const badge = STATUS_COLOR[o.status] || STATUS_COLOR.ordered;
                  const hasReport = o.lab_reports?.length > 0;
                  return (
                    <tr key={o.id} onClick={() => setSelected(selected?.id === o.id ? null : o)}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: hasReport ? 'pointer' : 'default', background: selected?.id === o.id ? '#f0f9ff' : 'transparent' }}>
                      <td style={s.td}>
                        <div style={{ fontWeight: 600, color: '#0f1f3d' }}>{o.test_name}</div>
                        {o.test_code && <div style={{ fontSize: '.75rem', color: '#64748b' }}>{o.test_code}</div>}
                        {o.doctors?.users && (
                          <div style={{ fontSize: '.75rem', color: '#64748b' }}>
                            Dr. {o.doctors.users.first_name} {o.doctors.users.last_name}
                          </div>
                        )}
                      </td>
                      <td style={s.td}>
                        <span style={{ background: o.urgency === 'urgent' ? '#fef3c7' : '#f1f5f9', color: o.urgency === 'urgent' ? '#92400e' : '#64748b', padding: '2px 8px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>
                          {o.urgency}
                        </span>
                      </td>
                      <td style={{ ...s.td, fontSize: '.8rem', color: '#64748b' }}>{new Date(o.ordered_at).toLocaleDateString('en-IN')}</td>
                      <td style={s.td}>
                        <span style={{ background: badge.bg, color: badge.text, padding: '3px 10px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>
                          {(o.status || '').replace('_', ' ')}
                        </span>
                      </td>
                      <td style={s.td}>
                        {hasReport ? (
                          <span style={{ color: '#00b4a0', fontWeight: 600, fontSize: '.8rem', cursor: 'pointer' }}>View →</span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '.8rem' }}>Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selected && selected.lab_reports?.length > 0 && (
            <div style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={s.h2}>{selected.test_name} — Report</h2>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
              </div>
              {selected.lab_reports.map((r, i) => (
                <div key={r.id} style={{ padding: i > 0 ? '16px 0 0' : '0', borderTop: i > 0 ? '1px solid #e2e8f0' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: '.8rem', color: '#64748b' }}>{new Date(r.uploaded_at || r.created_at).toLocaleDateString('en-IN')}</span>
                    <span style={{ background: r.is_normal ? '#dcfce7' : '#fee2e2', color: r.is_normal ? '#166534' : '#b91c1c', padding: '2px 10px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>
                      {r.is_normal ? 'Normal' : 'Abnormal'}
                    </span>
                  </div>
                  {r.findings && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: '.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>Findings</div>
                      <div style={{ fontSize: '.875rem', color: '#334155', background: '#f8fafc', padding: '10px 12px', borderRadius: 8 }}>{r.findings}</div>
                    </div>
                  )}
                  {r.remarks && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: '.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>Remarks</div>
                      <div style={{ fontSize: '.875rem', color: '#334155', background: '#f8fafc', padding: '10px 12px', borderRadius: 8 }}>{r.remarks}</div>
                    </div>
                  )}
                  {r.report_url && (
                    <a href={r.report_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-block', padding: '.5rem 1rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: '.8rem', fontWeight: 600, textDecoration: 'none', marginTop: 8 }}>
                      Download Report
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  page:   { padding: '2rem', maxWidth: 1100, margin: '0 auto' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#64748b' },
  h1:     { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2:     { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', margin: 0 },
  sub:    { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  card:   { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  table:  { width: '100%', borderCollapse: 'collapse' },
  th:     { textAlign: 'left', padding: '10px 12px', fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0' },
  td:     { padding: '10px 12px', fontSize: '.875rem', color: '#334155' },
};
