'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function LabReportsPage() {
  const [reports, setReports]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    api('/lab/reports')
      .then(d => setReports(d.lab_reports || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = reports.filter(r => {
    const q = search.toLowerCase();
    if (!q) return true;
    const patient = `${r.patients?.first_name || ''} ${r.patients?.last_name || ''}`.toLowerCase();
    const test = (r.lab_orders?.test_name || '').toLowerCase();
    const uid = (r.patients?.patient_uid || '').toLowerCase();
    return patient.includes(q) || test.includes(q) || uid.includes(q);
  });

  if (loading) return <div style={s.center}>Loading...</div>;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.h1}>Lab Reports</h1>
          <p style={s.sub}>{reports.length} report{reports.length !== 1 ? 's' : ''} uploaded</p>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by patient name, ID or test..."
          style={{ ...s.input, width: 340 }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: 20 }}>
        <div style={s.card}>
          {filtered.length === 0
            ? <p style={s.empty}>{search ? 'No reports match your search.' : 'No reports yet.'}</p>
            : (
              <table style={s.table}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Patient', 'Test', 'Uploaded At', 'Result', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} onClick={() => setSelected(selected?.id === r.id ? null : r)}
                      style={{ cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: selected?.id === r.id ? '#f0f9ff' : 'transparent' }}>
                      <td style={s.td}>
                        <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{r.patients?.first_name} {r.patients?.last_name}</div>
                        <div style={{ fontSize: '.75rem', color: '#64748b' }}>{r.patients?.patient_uid}</div>
                      </td>
                      <td style={s.td}>
                        <span style={{ fontWeight: 600 }}>{r.lab_orders?.test_name || '–'}</span>
                      </td>
                      <td style={{ ...s.td, fontSize: '.8rem', color: '#64748b' }}>
                        {new Date(r.uploaded_at || r.created_at).toLocaleString('en-IN')}
                      </td>
                      <td style={s.td}>
                        <span style={{ background: r.is_normal ? '#dcfce7' : '#fee2e2', color: r.is_normal ? '#166534' : '#b91c1c', padding: '3px 10px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>
                          {r.is_normal ? 'Normal' : 'Abnormal'}
                        </span>
                      </td>
                      <td style={s.td}>
                        <button onClick={e => { e.stopPropagation(); setSelected(selected?.id === r.id ? null : r); }}
                          style={{ ...s.actBtn, color: '#1d4ed8', borderColor: '#bfdbfe', background: '#eff6ff' }}>
                          View →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>

        {selected && (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={s.h2}>Report Detail</h2>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>

            {/* Patient & test info */}
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, color: '#0f1f3d', marginBottom: 2 }}>
                {selected.patients?.first_name} {selected.patients?.last_name}
              </div>
              <div style={{ fontSize: '.8rem', color: '#64748b' }}>{selected.patients?.patient_uid} {selected.patients?.phone && `• ${selected.patients.phone}`}</div>
              {selected.lab_orders?.test_name && (
                <div style={{ marginTop: 8, fontSize: '.875rem', fontWeight: 600, color: '#0f1f3d' }}>
                  Test: {selected.lab_orders.test_name}
                  {selected.lab_orders.test_code && <span style={{ fontSize: '.75rem', color: '#64748b', marginLeft: 8 }}>{selected.lab_orders.test_code}</span>}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: '.8rem', color: '#64748b' }}>
                Uploaded: {new Date(selected.uploaded_at || selected.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
              <span style={{ background: selected.is_normal ? '#dcfce7' : '#fee2e2', color: selected.is_normal ? '#166534' : '#b91c1c', padding: '3px 12px', borderRadius: 12, fontSize: '.8rem', fontWeight: 700 }}>
                {selected.is_normal ? 'Normal' : 'Abnormal'}
              </span>
            </div>

            {selected.findings && (
              <div style={{ marginBottom: 12 }}>
                <div style={s.sectionLabel}>Findings</div>
                <div style={s.block}>{selected.findings}</div>
              </div>
            )}

            {selected.remarks && (
              <div style={{ marginBottom: 12 }}>
                <div style={s.sectionLabel}>Remarks</div>
                <div style={s.block}>{selected.remarks}</div>
              </div>
            )}

            {selected.report_url && (
              <a href={selected.report_url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-block', marginTop: 8, padding: '.5rem 1rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: '.8rem', fontWeight: 600, textDecoration: 'none' }}>
                Download Report
              </a>
            )}

            {selected.doctors?.users && (
              <div style={{ marginTop: 14, fontSize: '.8rem', color: '#64748b' }}>
                Ordered by: Dr. {selected.doctors.users.first_name} {selected.doctors.users.last_name}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  page:         { padding: '2rem', maxWidth: 1400, margin: '0 auto' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  center:       { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#64748b' },
  h1:           { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2:           { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', margin: 0 },
  sub:          { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  card:         { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  table:        { width: '100%', borderCollapse: 'collapse' },
  th:           { textAlign: 'left', padding: '10px 12px', fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0' },
  td:           { padding: '10px 12px', fontSize: '.875rem', color: '#334155' },
  input:        { padding: '.6rem .9rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem', boxSizing: 'border-box' },
  actBtn:       { padding: '4px 10px', background: '#f0fdf4', color: '#065f46', border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 },
  empty:        { color: '#94a3b8', fontSize: '.875rem', textAlign: 'center', padding: '2rem 0' },
  sectionLabel: { fontSize: '.72rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 },
  block:        { fontSize: '.875rem', color: '#334155', background: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' },
};
