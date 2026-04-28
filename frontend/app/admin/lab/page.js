'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const STATUS_COLOR = {
  ordered:          '#f59e0b',
  sample_collected: '#3b82f6',
  processing:       '#8b5cf6',
  ready:            '#10b981',
  delivered:        '#64748b',
  cancelled:        '#ef4444',
};
const STATUS_ORDER = ['ordered', 'sample_collected', 'processing', 'ready', 'delivered'];
const NEXT = { ordered: 'sample_collected', sample_collected: 'processing', processing: 'ready', ready: 'delivered' };

export default function AdminLabPage() {
  const [orders, setOrders]     = useState([]);
  const [filter, setFilter]     = useState('');
  const [selected, setSelected] = useState(null);
  const [report, setReport]     = useState({ findings: '', remarks: '', is_normal: true, report_url: '' });
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg]           = useState('');
  const [saving, setSaving]     = useState(false);

  const load = async () => {
    try {
      const d = await api(`/lab/orders${filter ? `?status=${filter}` : ''}`);
      setOrders(d.lab_orders || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id, status) => {
    try {
      await api(`/lab/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMsg(`Updated to ${status.replace('_', ' ')}`);
      load();
    } catch (e) { setMsg(e.message); }
  };

  const uploadReport = async () => {
    if (!selected || !report.findings) { setMsg('Findings are required'); return; }
    setSaving(true);
    try {
      await api('/lab/reports', { method: 'POST', body: JSON.stringify({ lab_order_id: selected.id, patient_id: selected.patient_id, doctor_id: selected.doctor_id, consultation_id: selected.consultation_id, ...report }) });
      setMsg('Report uploaded');
      setShowForm(false); setSelected(null);
      load();
    } catch (e) { setMsg(e.message); } finally { setSaving(false); }
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.h1}>Lab Management</h1>
          <p style={s.sub}>All lab orders across all doctors</p>
        </div>
        <button onClick={load} style={s.btnSec}>↻ Refresh</button>
      </div>

      {msg && <div style={s.info}>{msg}<button onClick={() => setMsg('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer' }}>×</button></div>}

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[{ v: '', label: 'All' }, ...STATUS_ORDER.map(s => ({ v: s, label: s.replace('_', ' ') }))].map(f => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            style={{ padding: '5px 14px', borderRadius: 20, border: `1.5px solid ${filter === f.v ? '#00b4a0' : '#e2e8f0'}`, background: filter === f.v ? '#00b4a0' : '#fff', color: filter === f.v ? '#fff' : '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '.8rem', textTransform: 'capitalize' }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
        <div style={s.card}>
          {orders.length === 0 ? <p style={s.empty}>No orders found.</p> : (
            <table style={s.table}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Patient', 'Test', 'Urgency', 'Ordered At', 'Status', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} onClick={() => { setSelected(o); setShowForm(false); }} style={{ cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: selected?.id === o.id ? '#f0f9ff' : 'transparent' }}>
                    <td style={s.td}>
                      <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{o.patients?.first_name} {o.patients?.last_name}</div>
                      <div style={{ fontSize: '.75rem', color: '#64748b' }}>{o.patients?.patient_uid}</div>
                    </td>
                    <td style={s.td}><span style={{ fontWeight: 600 }}>{o.test_name}</span>{o.test_code && <div style={{ fontSize: '.75rem', color: '#64748b' }}>{o.test_code}</div>}</td>
                    <td style={s.td}>
                      <span style={{ background: o.urgency === 'urgent' ? '#fef3c7' : '#f1f5f9', color: o.urgency === 'urgent' ? '#92400e' : '#64748b', padding: '2px 8px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>
                        {o.urgency}
                      </span>
                    </td>
                    <td style={{ ...s.td, fontSize: '.8rem', color: '#64748b' }}>{new Date(o.ordered_at).toLocaleString('en-IN')}</td>
                    <td style={s.td}>
                      <span style={{ background: STATUS_COLOR[o.status] + '20', color: STATUS_COLOR[o.status], padding: '3px 10px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>
                        {(o.status || '').replace('_', ' ')}
                      </span>
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {NEXT[o.status] && (
                          <button onClick={e => { e.stopPropagation(); updateStatus(o.id, NEXT[o.status]); }}
                            style={{ ...s.actBtn, color: STATUS_COLOR[NEXT[o.status]] }}>
                            → {NEXT[o.status].replace('_', ' ')}
                          </button>
                        )}
                        {o.status === 'processing' && (
                          <button onClick={e => { e.stopPropagation(); setSelected(o); setShowForm(true); }}
                            style={{ ...s.actBtn, background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>
                            Upload Report
                          </button>
                        )}
                      </div>
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
              <h2 style={s.h2}>Order Detail</h2>
              <button onClick={() => { setSelected(null); setShowForm(false); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {[
                ['Patient',  `${selected.patients?.first_name || ''} ${selected.patients?.last_name || ''}`.trim()],
                ['Patient ID', selected.patients?.patient_uid || '–'],
                ['Phone',    selected.patients?.phone || '–'],
                ['Test',     selected.test_name],
                ['Status',   selected.status],
                ['Urgency',  selected.urgency],
                ['Doctor',   `${selected.doctors?.users?.first_name || ''} ${selected.doctors?.users?.last_name || ''}`.trim() || '–'],
                ['Notes',    selected.notes || '–'],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '.8rem', color: '#94a3b8' }}>{l}</span>
                  <span style={{ fontSize: '.875rem', fontWeight: 600, color: '#0f1f3d', textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                </div>
              ))}
            </div>

            {showForm ? (
              <div>
                <h3 style={{ fontSize: '.875rem', fontWeight: 600, color: '#0f1f3d', marginBottom: 12 }}>Upload Report</h3>
                <div style={{ marginBottom: 10 }}>
                  <label style={s.label}>Findings *</label>
                  <textarea value={report.findings} onChange={e => setReport({ ...report, findings: e.target.value })} style={{ ...s.input, height: 80, width: '100%' }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={s.label}>Remarks</label>
                  <textarea value={report.remarks} onChange={e => setReport({ ...report, remarks: e.target.value })} style={{ ...s.input, height: 60, width: '100%' }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={s.label}>Report URL</label>
                  <input value={report.report_url} onChange={e => setReport({ ...report, report_url: e.target.value })} style={{ ...s.input, width: '100%' }} placeholder="https://..." />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: '.875rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={report.is_normal} onChange={e => setReport({ ...report, is_normal: e.target.checked })} />
                  Results within normal range
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={uploadReport} disabled={saving} style={s.btnPri}>{saving ? 'Uploading...' : 'Upload Report'}</button>
                  <button onClick={() => setShowForm(false)} style={s.btnSec}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowForm(true)} style={{ ...s.btnPri, width: '100%' }}>Upload Report</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  page:   { padding: '2rem', maxWidth: 1400, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  h1:     { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2:     { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', margin: 0 },
  sub:    { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  card:   { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  table:  { width: '100%', borderCollapse: 'collapse' },
  th:     { textAlign: 'left', padding: '10px 12px', fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0' },
  td:     { padding: '10px 12px', fontSize: '.875rem', color: '#334155' },
  label:  { display: 'block', fontSize: '.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 },
  input:  { padding: '.6rem .9rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem', boxSizing: 'border-box' },
  btnPri: { padding: '.6rem 1.2rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem' },
  btnSec: { padding: '.6rem 1rem', background: '#f1f5f9', color: '#0f1f3d', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem' },
  actBtn: { padding: '4px 10px', background: '#f0fdf4', color: '#065f46', border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 },
  info:   { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.875rem', marginBottom: 16, display: 'flex', alignItems: 'center' },
  empty:  { color: '#94a3b8', fontSize: '.875rem', textAlign: 'center', padding: '2rem 0' },
};
