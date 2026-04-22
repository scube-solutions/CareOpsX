'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const RISK_COLORS = { low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#7c3aed' };
const OUTCOME_COLORS = { at_risk: '#ef4444', still_at_risk: '#f59e0b', recovered: '#10b981', lost_to_follow_up: '#94a3b8' };

export default function DropOffPage() {
  const [watchlist, setWatchlist] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [actionNote, setActionNote] = useState('');
  const [actionType, setActionType] = useState('reminder_sent');
  const [newOutcome, setNewOutcome] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const [wl, sm] = await Promise.all([
        api(`/dropoff/watchlist${filter ? `?risk_level=${filter}` : ''}`),
        api('/dropoff/outcomes'),
      ]);
      setWatchlist(wl.watchlist || []);
      setSummary(sm);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, [filter]);

  const recordAction = async () => {
    if (!selected || !actionNote) { setMsg('Enter action notes'); return; }
    setLoading(true);
    try {
      await api(`/dropoff/watchlist/${selected.id}/action`, { method: 'PATCH', body: JSON.stringify({ action_type: actionType, notes: actionNote, outcome: newOutcome || undefined }) });
      setMsg('Action recorded');
      setSelected(null);
      setActionNote('');
      setNewOutcome('');
      await load();
    } catch (e) { setMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div><h1 style={s.h1}>Drop-Off Prevention Engine</h1><p style={s.sub}>At-risk patient watchlist and recovery tracking</p></div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Tracked', value: summary.total, color: '#64748b' },
            { label: 'At Risk', value: summary.at_risk, color: '#ef4444' },
            { label: 'Recovered', value: summary.recovered, color: '#10b981' },
            { label: 'Lost', value: summary.lost, color: '#94a3b8' },
          ].map(c => (
            <div key={c.label} style={{ ...s.card, borderTop: `4px solid ${c.color}`, textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: '.8rem', color: '#64748b' }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {msg && <div style={s.info}>{msg}<button onClick={() => setMsg('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer' }}>×</button></div>}

      {/* Risk Level Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['', 'low', 'medium', 'high', 'critical'].map(r => (
          <button key={r} onClick={() => setFilter(r)}
            style={{ padding: '6px 14px', borderRadius: 20, border: '1.5px solid', borderColor: filter === r ? (RISK_COLORS[r] || '#00b4a0') : '#e2e8f0', background: filter === r ? (RISK_COLORS[r] || '#00b4a0') : '#fff', color: filter === r ? '#fff' : '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '.8rem', textTransform: 'capitalize' }}>
            {r || 'All'}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
        <div style={s.card}>
          <h2 style={s.h2}>Watchlist ({watchlist.length})</h2>
          {watchlist.length === 0 ? <p style={s.empty}>No patients on watchlist</p> : (
            <table style={s.table}>
              <thead><tr>{['Patient', 'Risk Score', 'Risk Level', 'Trigger', 'Reason', 'Outcome', 'Last Action', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {watchlist.map(w => (
                  <tr key={w.id} style={{ cursor: 'pointer', background: selected?.id === w.id ? '#f0f9ff' : 'transparent' }} onClick={() => setSelected(w)}>
                    <td style={s.td}>
                      <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{w.patients?.first_name} {w.patients?.last_name}</div>
                      <div style={{ fontSize: '.75rem', color: '#64748b' }}>{w.patients?.patient_uid} • {w.patients?.phone}</div>
                      {w.patients?.chronic_disease_tag && <div style={{ fontSize: '.7rem', background: '#fef3c7', color: '#92400e', display: 'inline-block', padding: '1px 6px', borderRadius: 4, marginTop: 2 }}>{w.patients.chronic_disease_tag}</div>}
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 40, height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
                          <div style={{ width: `${w.risk_score}%`, height: '100%', background: RISK_COLORS[w.risk_level] || '#64748b' }} />
                        </div>
                        <span style={{ fontWeight: 700, color: RISK_COLORS[w.risk_level] }}>{w.risk_score}</span>
                      </div>
                    </td>
                    <td style={s.td}><span style={{ background: RISK_COLORS[w.risk_level] + '20', color: RISK_COLORS[w.risk_level], padding: '3px 10px', borderRadius: 12, fontSize: '.75rem', fontWeight: 700, textTransform: 'capitalize' }}>{w.risk_level}</span></td>
                    <td style={{ ...s.td, fontSize: '.8rem', color: '#64748b' }}>{w.trigger_type?.replace(/_/g, ' ')}</td>
                    <td style={{ ...s.td, fontSize: '.8rem', color: '#64748b', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.risk_reason}</td>
                    <td style={s.td}><span style={{ background: OUTCOME_COLORS[w.outcome] + '20', color: OUTCOME_COLORS[w.outcome], padding: '2px 8px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>{w.outcome?.replace(/_/g, ' ')}</span></td>
                    <td style={{ ...s.td, fontSize: '.8rem', color: '#94a3b8' }}>{w.last_action_at ? new Date(w.last_action_at).toLocaleDateString('en-IN') : '–'}</td>
                    <td style={s.td}><button onClick={e => { e.stopPropagation(); setSelected(w); }} style={s.actBtn}>Take Action</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ ...s.h2, margin: 0 }}>Recovery Action</h2>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: '.95rem' }}>{selected.patients?.first_name} {selected.patients?.last_name}</div>
              <div style={{ fontSize: '.8rem', color: '#64748b', marginTop: 2 }}>{selected.risk_reason}</div>
              <div style={{ marginTop: 6 }}><span style={{ background: RISK_COLORS[selected.risk_level] + '20', color: RISK_COLORS[selected.risk_level], padding: '2px 8px', borderRadius: 12, fontSize: '.75rem', fontWeight: 700 }}>Risk Score: {selected.risk_score}</span></div>
            </div>

            <div style={s.fg}>
              <label style={s.label}>Action Type</label>
              <select value={actionType} onChange={e => setActionType(e.target.value)} style={s.input}>
                {['reminder_sent', 'call_made', 'appointment_booked', 'doctor_notified', 'escalated', 'patient_responded'].map(a => (
                  <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div style={s.fg}>
              <label style={s.label}>Notes *</label>
              <textarea value={actionNote} onChange={e => setActionNote(e.target.value)} style={{ ...s.input, height: 80 }} placeholder="Describe the action taken..." />
            </div>
            <div style={s.fg}>
              <label style={s.label}>Update Outcome</label>
              <select value={newOutcome} onChange={e => setNewOutcome(e.target.value)} style={s.input}>
                <option value="">Keep current</option>
                <option value="at_risk">Still At Risk</option>
                <option value="still_at_risk">Partially Recovered</option>
                <option value="recovered">Recovered</option>
                <option value="lost_to_follow_up">Lost to Follow-up</option>
              </select>
            </div>
            <button onClick={recordAction} disabled={loading} style={{ ...s.btnPri, width: '100%' }}>{loading ? 'Saving...' : 'Record Action'}</button>

            {selected.action_history?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: '.875rem', fontWeight: 600, color: '#0f1f3d', marginBottom: 8 }}>Action History</h3>
                {selected.action_history.slice(-3).reverse().map((a, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: '.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{a.action_type?.replace(/_/g, ' ')}</span>
                      <span style={{ color: '#94a3b8' }}>{new Date(a.performed_at).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div style={{ color: '#64748b', marginTop: 2 }}>{a.notes}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  page: { padding: '2rem', maxWidth: 1400, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  h1: { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2: { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', marginBottom: 14 },
  sub: { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  card: { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  fg: { marginBottom: 12 },
  label: { display: 'block', fontSize: '.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: 4 },
  input: { width: '100%', padding: '.6rem .9rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem', boxSizing: 'border-box' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', background: '#f8fafc', fontSize: '.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' },
  td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9' },
  info: { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.875rem', marginBottom: 16, display: 'flex', alignItems: 'center' },
  btnPri: { padding: '.65rem 1.2rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem' },
  actBtn: { padding: '4px 10px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 6, cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 },
  empty: { color: '#94a3b8', textAlign: 'center', padding: '2rem' },
};
