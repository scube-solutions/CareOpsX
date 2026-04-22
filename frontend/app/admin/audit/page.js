'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ module: '', action: '', entity_type: '', date_from: '', date_to: '' });
  const [loading, setLoading] = useState(false);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 50, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
      const data = await api(`/audit?${params}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setPage(p);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const ACTION_COLORS = { CREATE: '#10b981', UPDATE: '#3b82f6', DELETE: '#ef4444', LOGIN: '#8b5cf6', REFUND: '#f59e0b' };
  const getActionColor = (action) => {
    const key = Object.keys(ACTION_COLORS).find(k => action?.toUpperCase().includes(k));
    return ACTION_COLORS[key] || '#64748b';
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div><h1 style={s.h1}>Audit Logs</h1><p style={s.sub}>{total} total records</p></div>
      </div>

      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {[['Module', 'module', ['Admin', 'Patient', 'Queue', 'Consultation', 'Billing', 'Lab', 'Pharmacy', 'FollowUp', 'DropOff']],
            ['Entity', 'entity_type', ['patient', 'appointment', 'invoice', 'consultation', 'lab_order', 'pharmacy_invoice', 'user']],
          ].map(([label, key, options]) => (
            <div key={key}>
              <label style={s.label}>{label}</label>
              <select value={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })} style={s.input}>
                <option value="">All</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div><label style={s.label}>Action</label><input value={filters.action} onChange={e => setFilters({ ...filters, action: e.target.value })} style={s.input} placeholder="e.g. CREATE" /></div>
          <div><label style={s.label}>Date From</label><input type="date" value={filters.date_from} onChange={e => setFilters({ ...filters, date_from: e.target.value })} style={s.input} /></div>
          <div><label style={s.label}>Date To</label><input type="date" value={filters.date_to} onChange={e => setFilters({ ...filters, date_to: e.target.value })} style={s.input} /></div>
          <button onClick={() => load(1)} style={s.btnPri}>Search</button>
          <button onClick={() => { setFilters({ module: '', action: '', entity_type: '', date_from: '', date_to: '' }); setTimeout(() => load(1), 50); }} style={s.btnSec}>Reset</button>
        </div>
      </div>

      <div style={s.card}>
        {loading ? <div style={s.center}>Loading...</div> : (
          <table style={s.table}>
            <thead><tr>{['Time', 'User/Role', 'Module', 'Action', 'Entity', 'Description'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No audit logs found</td></tr>
              ) : logs.map(log => (
                <tr key={log.id} style={{ background: log.action?.includes('DELETE') || log.action?.includes('REFUND') ? '#fff8f8' : 'transparent' }}>
                  <td style={{ ...s.td, whiteSpace: 'nowrap', color: '#64748b', fontSize: '.8rem' }}>
                    {new Date(log.created_at).toLocaleDateString('en-IN')}<br />
                    <span style={{ color: '#94a3b8' }}>{new Date(log.created_at).toLocaleTimeString('en-IN')}</span>
                  </td>
                  <td style={s.td}>
                    <div style={{ fontSize: '.8rem', color: '#0f1f3d' }}>{log.user_id?.substring(0, 8)}...</div>
                    <span style={{ fontSize: '.7rem', background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: 4 }}>{log.role_name}</span>
                  </td>
                  <td style={s.td}><span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>{log.module}</span></td>
                  <td style={s.td}><span style={{ background: getActionColor(log.action) + '20', color: getActionColor(log.action), padding: '2px 8px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>{log.action}</span></td>
                  <td style={s.td}><span style={{ fontSize: '.8rem', color: '#475569' }}>{log.entity_type || '–'}{log.entity_id ? ` #${log.entity_id.substring(0, 8)}` : ''}</span></td>
                  <td style={{ ...s.td, fontSize: '.8rem', color: '#64748b', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.description || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {total > 50 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '1rem', borderTop: '1px solid #f1f5f9' }}>
            <button onClick={() => load(page - 1)} disabled={page <= 1} style={s.btnSec}>← Prev</button>
            <span style={{ padding: '.5rem 1rem', color: '#64748b', fontSize: '.875rem' }}>Page {page} of {Math.ceil(total / 50)}</span>
            <button onClick={() => load(page + 1)} disabled={page >= Math.ceil(total / 50)} style={s.btnSec}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  page: { padding: '2rem', maxWidth: 1400, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  h1: { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  sub: { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  center: { padding: '3rem', textAlign: 'center', color: '#64748b' },
  card: { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  label: { display: 'block', fontSize: '.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: 4 },
  input: { padding: '.55rem .9rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', background: '#f8fafc', fontSize: '.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' },
  td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9' },
  btnPri: { padding: '.55rem 1.2rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem' },
  btnSec: { padding: '.55rem 1rem', background: '#f1f5f9', color: '#0f1f3d', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem' },
};
