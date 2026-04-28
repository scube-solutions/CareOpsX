'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const STATUS_STYLE = {
  sent:      { bg: '#f0fdf4', text: '#166534', label: 'Sent' },
  failed:    { bg: '#fef2f2', text: '#b91c1c', label: 'Failed' },
  pending:   { bg: '#fffbeb', text: '#92400e', label: 'Pending' },
  delivered: { bg: '#eff6ff', text: '#1d4ed8', label: 'Delivered' },
};

export default function NotificationsPage() {
  const [tab, setTab]     = useState('logs');
  const [logs, setLogs]   = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage]   = useState(1);
  const [loading, setLoading]   = useState(false);
  const [retrying, setRetrying] = useState(null);
  const [msg, setMsg]           = useState('');

  const [send, setSend] = useState({ channel: 'sms', recipient_phone: '', recipient_email: '', subject: '', message: '', event_type: 'manual' });
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');

  const loadLogs = async (p = page) => {
    setLoading(true);
    try {
      const d = await api(`/notifications/logs?page=${p}&limit=20`);
      setLogs(d.logs || []);
      setTotal(d.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadLogs(); }, [page]);

  const retry = async (id) => {
    setRetrying(id);
    try {
      const d = await api(`/notifications/logs/${id}/retry`, { method: 'POST' });
      setMsg(d.delivered ? 'Retry successful' : 'Retry failed — delivery error');
      loadLogs();
    } catch (e) { setMsg(e.message); }
    finally { setRetrying(null); }
  };

  const sendNotif = async () => {
    setSendMsg('');
    if (!send.message || !send.channel) { setSendMsg('Channel and message required'); return; }
    if (send.channel === 'sms' && !send.recipient_phone) { setSendMsg('Phone required for SMS'); return; }
    if (send.channel === 'email' && !send.recipient_email) { setSendMsg('Email required for email channel'); return; }
    setSending(true);
    try {
      const d = await api('/notifications/send', { method: 'POST', body: JSON.stringify(send) });
      setSendMsg(d.message);
      setSend(prev => ({ ...prev, recipient_phone: '', recipient_email: '', subject: '', message: '' }));
      if (tab === 'logs') loadLogs();
    } catch (e) { setSendMsg(e.message); }
    finally { setSending(false); }
  };

  const pages = Math.ceil(total / 20);

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={s.h1}>Notifications</h1>
        <p style={s.sub}>Manage notification logs and send manual alerts</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', width: 'fit-content' }}>
        {[['logs', 'Notification Logs'], ['send', 'Send Manual']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ padding: '9px 20px', background: tab === key ? '#0f1f3d' : '#f8fafc', color: tab === key ? '#fff' : '#64748b', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '.85rem' }}>
            {label}
          </button>
        ))}
      </div>

      {msg && <div style={{ ...s.card, background: '#f0fdfb', border: '1px solid #99f6e4', color: '#0f766e', marginBottom: 16, padding: '12px 16px' }}>{msg}</div>}

      {/* ── Logs tab ── */}
      {tab === 'logs' && (
        <div style={s.card}>
          {loading ? (
            <div style={s.center}>Loading…</div>
          ) : logs.length === 0 ? (
            <div style={s.center}>No notification logs yet</div>
          ) : (
            <>
              <table style={s.table}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Channel', 'Event', 'Recipient', 'Message', 'Status', 'Sent At', ''].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => {
                    const st = STATUS_STYLE[l.status] || STATUS_STYLE.pending;
                    const patient = l.patients;
                    return (
                      <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={s.td}>
                          <span style={{ background: l.channel === 'sms' ? '#eff6ff' : '#f5f3ff', color: l.channel === 'sms' ? '#1d4ed8' : '#6d28d9', padding: '2px 8px', borderRadius: 6, fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase' }}>{l.channel}</span>
                        </td>
                        <td style={{ ...s.td, fontSize: '.8rem', color: '#475569' }}>{l.event_type}</td>
                        <td style={s.td}>
                          {patient && <div style={{ fontWeight: 600, fontSize: '.82rem' }}>{patient.first_name} {patient.last_name}</div>}
                          <div style={{ fontSize: '.75rem', color: '#94a3b8' }}>{l.recipient_phone || l.recipient_email || '—'}</div>
                        </td>
                        <td style={{ ...s.td, maxWidth: 200 }}>
                          <div style={{ fontSize: '.8rem', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{l.message}</div>
                        </td>
                        <td style={s.td}>
                          <span style={{ background: st.bg, color: st.text, padding: '2px 10px', borderRadius: 10, fontSize: '.75rem', fontWeight: 600 }}>{st.label}</span>
                          {l.retry_count > 0 && <div style={{ fontSize: '.7rem', color: '#94a3b8', marginTop: 2 }}>Retried {l.retry_count}×</div>}
                        </td>
                        <td style={{ ...s.td, fontSize: '.78rem', color: '#64748b' }}>{l.sent_at ? new Date(l.sent_at).toLocaleString('en-IN') : '—'}</td>
                        <td style={s.td}>
                          {(l.status === 'failed' || l.status === 'pending') && (
                            <button onClick={() => retry(l.id)} disabled={retrying === l.id}
                              style={{ border: '1px solid #e2e8f0', background: '#fff', color: '#0f1f3d', borderRadius: 6, padding: '4px 10px', fontSize: '.75rem', cursor: 'pointer' }}>
                              {retrying === l.id ? '…' : 'Retry'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {pages > 1 && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
                  {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setPage(p)}
                      style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #e2e8f0', background: p === page ? '#0f1f3d' : '#fff', color: p === page ? '#fff' : '#64748b', fontWeight: 600, cursor: 'pointer' }}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Send tab ── */}
      {tab === 'send' && (
        <div style={{ ...s.card, maxWidth: 560 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f1f3d', marginTop: 0, marginBottom: 20 }}>Send Manual Notification</h2>

          {sendMsg && <div style={{ background: sendMsg.includes('ailed') || sendMsg.includes('required') ? '#fef2f2' : '#f0fdfb', border: `1px solid ${sendMsg.includes('ailed') || sendMsg.includes('required') ? '#fecaca' : '#99f6e4'}`, color: sendMsg.includes('ailed') || sendMsg.includes('required') ? '#b91c1c' : '#0f766e', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '.85rem' }}>{sendMsg}</div>}

          <div style={s.fg}>
            <label style={s.label}>Channel</label>
            <select style={s.input} value={send.channel} onChange={e => setSend(p => ({ ...p, channel: e.target.value }))}>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </select>
          </div>

          {send.channel === 'sms' && (
            <div style={s.fg}>
              <label style={s.label}>Recipient Phone</label>
              <input style={s.input} type="tel" placeholder="+91 9876543210" value={send.recipient_phone} onChange={e => setSend(p => ({ ...p, recipient_phone: e.target.value }))}/>
            </div>
          )}

          {send.channel === 'email' && (
            <>
              <div style={s.fg}>
                <label style={s.label}>Recipient Email</label>
                <input style={s.input} type="email" placeholder="patient@example.com" value={send.recipient_email} onChange={e => setSend(p => ({ ...p, recipient_email: e.target.value }))}/>
              </div>
              <div style={s.fg}>
                <label style={s.label}>Subject</label>
                <input style={s.input} placeholder="Appointment Reminder" value={send.subject} onChange={e => setSend(p => ({ ...p, subject: e.target.value }))}/>
              </div>
            </>
          )}

          <div style={s.fg}>
            <label style={s.label}>Message</label>
            <textarea style={{ ...s.input, height: 120, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Type your message…" value={send.message} onChange={e => setSend(p => ({ ...p, message: e.target.value }))}/>
          </div>

          <button onClick={sendNotif} disabled={sending}
            style={{ background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: 'pointer', opacity: sending ? .7 : 1 }}>
            {sending ? 'Sending…' : 'Send Notification'}
          </button>
        </div>
      )}
    </div>
  );
}

const s = {
  page:   { padding: '2rem', maxWidth: 1200, margin: '0 auto' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: '#64748b' },
  h1:     { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  sub:    { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  card:   { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  table:  { width: '100%', borderCollapse: 'collapse' },
  th:     { textAlign: 'left', padding: '10px 12px', fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0' },
  td:     { padding: '10px 12px', fontSize: '.875rem', color: '#334155', verticalAlign: 'top' },
  fg:     { marginBottom: '1rem' },
  label:  { display: 'block', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#475569', marginBottom: '.35rem' },
  input:  { width: '100%', padding: '.65rem 1rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', color: '#1e293b', fontSize: '.9rem', boxSizing: 'border-box', outline: 'none' },
};
