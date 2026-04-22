'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const STATUS_STYLE = {
  booked:      { bg: '#fef3c7', text: '#92400e' },
  confirmed:   { bg: '#dbeafe', text: '#1e40af' },
  completed:   { bg: '#dcfce7', text: '#166534' },
  cancelled:   { bg: '#fee2e2', text: '#b91c1c' },
  no_show:     { bg: '#e2e8f0', text: '#334155' },
};

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 800, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f1f3d' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '16px 20px' }}>{children}</div>
      </div>
    </div>
  );
}

export default function ReceptionistDashboard() {
  const [stats, setStats]               = useState(null);
  const [queue, setQueue]               = useState([]);
  const [appts, setAppts]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [payRequests, setPayRequests]   = useState([]);
  const [approvingId, setApprovingId]   = useState(null);
  const [modal, setModal]               = useState(null); // 'appts' | 'completed' | 'pending' | 'followups'

  useEffect(() => {
    const load = async () => {
      try {
        const today  = new Date().toISOString().split('T')[0];
        const end30  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const [analyticsData, upcomingData, apptData] = await Promise.all([
          api(`/analytics/dashboard?date_from=${today}&date_to=${today}`),
          api('/followups/upcoming'),
          api(`/appointments?date_from=${today}&date_to=${end30}`),
        ]);
        setStats(analyticsData.kpis);
        setQueue(upcomingData.upcoming || []);
        setAppts(apptData.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();

    const pollPayments = () =>
      api('/payment-requests').then(d => setPayRequests(d.requests || [])).catch(() => {});
    pollPayments();
    const pollTimer = setInterval(pollPayments, 8000);
    return () => clearInterval(pollTimer);
  }, []);

  const approvePayRequest = async (id) => {
    setApprovingId(id);
    try {
      await api(`/payment-requests/${id}/approve`, { method: 'PATCH' });
      setPayRequests(prev => prev.filter(r => r.id !== id));
    } catch (e) { console.error(e); }
    finally { setApprovingId(null); }
  };

  if (loading) return <div style={s.center}>Loading...</div>;

  const todayStr  = new Date().toISOString().split('T')[0];
  const todayAppts      = appts.filter(a => a.appointment_date === todayStr);
  const completedAppts  = appts.filter(a => a.status === 'completed');

  const cards = [
    { key: 'appts',     label: "Today's Appointments", value: todayAppts.length,                                             color: '#00b4a0' },
    { key: 'completed', label: 'Completed',             value: stats?.completed_consultations ?? completedAppts.length,      color: '#3b82f6' },
    { key: 'pending',   label: 'Pending Collections',   value: stats ? `₹${stats.pending_collections?.toFixed(0)}` : '–',   color: '#f59e0b' },
    { key: 'followups', label: 'Upcoming Follow-ups',   value: queue.length,                                                 color: '#8b5cf6' },
  ];

  const ApptTable = ({ rows, emptyMsg }) => rows.length === 0
    ? <p style={s.empty}>{emptyMsg || 'No appointments.'}</p>
    : (
      <table style={s.table}>
        <thead><tr style={{ background: '#f8fafc' }}>
          {['Patient', 'Phone', 'Doctor', 'Date & Time', 'Status', 'Booking ID'].map(h => <th key={h} style={s.th}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map(a => {
            const patName = `${a.patients?.first_name || ''} ${a.patients?.last_name || ''}`.trim() || '–';
            const docName = `${a.doctors?.users?.first_name || ''} ${a.doctors?.users?.last_name || ''}`.trim() || '–';
            const badge   = STATUS_STYLE[a.status] || STATUS_STYLE.booked;
            return (
              <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={s.td}><span style={{ fontWeight: 600, color: '#0f1f3d' }}>{patName}</span></td>
                <td style={s.td}>{a.patients?.phone || '–'}</td>
                <td style={s.td}>Dr. {docName}<div style={{ fontSize: 11, color: '#64748b' }}>{a.doctors?.specialization}</div></td>
                <td style={s.td}><div style={{ fontWeight: 500 }}>{a.appointment_date}</div><div style={{ fontSize: 12, color: '#64748b' }}>{(a.appointment_time || '').slice(0, 5)}</div></td>
                <td style={s.td}><span style={{ background: badge.bg, color: badge.text, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{a.status}</span></td>
                <td style={s.td}>{a.booking_id && <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#0f766e', background: '#f0fdfb', padding: '2px 6px', borderRadius: 4 }}>{a.booking_id}</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );

  return (
    <div style={s.page}>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>

      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.h1}>Reception Dashboard</h1>
          <p style={s.sub}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <a href="/receptionist/patients/new" style={s.btnPrimary}>+ New Patient</a>
          <a href="/receptionist/queue" style={s.btnSecondary}>View Queue</a>
        </div>
      </div>

      {/* KPI Cards — clickable */}
      <div style={s.grid4}>
        {cards.map(c => (
          <div key={c.key} onClick={() => setModal(c.key)}
            style={{ ...s.card, borderTop: `4px solid ${c.color}`, cursor: 'pointer', transition: 'box-shadow .15s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'}
          >
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: '.85rem', color: '#64748b', marginTop: 4 }}>{c.label}</div>
            <div style={{ fontSize: '.72rem', color: c.color, marginTop: 6 }}>Click to view →</div>
          </div>
        ))}
      </div>

      {/* Pending Payment Requests — blinking alert */}
      {payRequests.length > 0 && (
        <div style={{ background: '#fff7ed', border: '2px solid #f97316', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#ef4444', animation: 'blink 1s step-start infinite' }} />
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#c2410c' }}>
              {payRequests.length} Pending Payment Request{payRequests.length > 1 ? 's' : ''} — Collect at Reception
            </h2>
          </div>
          <table style={s.table}>
            <thead><tr style={{ background: '#fff3e8' }}>
              {['Patient', 'Phone', 'Doctor', 'Date & Time', 'Fee', 'Action'].map(h => <th key={h} style={s.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {payRequests.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #fed7aa' }}>
                  <td style={s.td}><span style={{ fontWeight: 600, color: '#0f1f3d' }}>{r.patient_name}</span></td>
                  <td style={s.td}>{r.patient_phone || '–'}</td>
                  <td style={s.td}>{r.doctor_name || '–'}<div style={{ fontSize: 11, color: '#64748b' }}>{r.specialty}</div></td>
                  <td style={s.td}>{r.appointment_date || '–'}<div style={{ fontSize: 11, color: '#64748b' }}>{(r.appointment_time || '').slice(0, 5)}</div></td>
                  <td style={s.td}><span style={{ fontWeight: 700, color: '#0f1f3d' }}>₹{r.consultation_fee}</span></td>
                  <td style={s.td}>
                    <button onClick={() => approvePayRequest(r.id)} disabled={approvingId === r.id}
                      style={{ padding: '6px 14px', background: approvingId === r.id ? '#9ca3af' : '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '.8rem', cursor: 'pointer' }}>
                      {approvingId === r.id ? 'Saving…' : '✓ Mark Received'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Appointments Next 30 Days */}
      <div style={s.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={s.h2}>Appointments — Next 30 Days</h2>
          <a href="/receptionist/appointments" style={s.linkBtn}>+ Book New</a>
        </div>
        <ApptTable rows={appts} emptyMsg="No appointments in the next 30 days." />
      </div>

      {/* Follow-ups */}
      {queue.length > 0 && (
        <div style={s.section}>
          <h2 style={{ ...s.h2, marginBottom: 14 }}>Upcoming Follow-ups (Next 3 Months)</h2>
          <table style={s.table}>
            <thead><tr>{['Patient', 'Phone', 'Follow-up Date', 'Disease Tag', 'Action'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {queue.map(f => (
                <tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={s.td}><a href={`/receptionist/patients/${f.patient_id}`} style={{ color: '#00b4a0', fontWeight: 600, textDecoration: 'none' }}>{f.patients?.first_name} {f.patients?.last_name}</a></td>
                  <td style={s.td}>{f.patients?.phone}</td>
                  <td style={s.td}>{f.follow_up_date}</td>
                  <td style={s.td}>{f.disease_tag || '–'}</td>
                  <td style={s.td}><a href={`/receptionist/appointments?patient_id=${f.patient_id}`} style={s.link}>Book Appointment</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={s.card}>
          <h3 style={s.h3}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {[
              { href: '/receptionist/patients/new',  label: 'Register New Patient', color: '#00b4a0' },
              { href: '/receptionist/appointments',  label: 'Book Appointment',      color: '#3b82f6' },
              { href: '/receptionist/queue',         label: 'Manage Queue',          color: '#8b5cf6' },
              { href: '/receptionist/billing',       label: 'Create Invoice',        color: '#f59e0b' },
            ].map(a => (
              <a key={a.href} href={a.href} style={{ ...s.quickBtn, background: a.color }}>{a.label}</a>
            ))}
          </div>
        </div>
        <div style={s.card}>
          <h3 style={s.h3}>Today at a Glance</h3>
          <div style={{ marginTop: 12 }}>
            {[
              { label: 'Total Revenue',     val: `₹${stats?.total_revenue?.toFixed(0) ?? 0}` },
              { label: 'Collected Today',   val: `₹${stats?.total_collected?.toFixed(0) ?? 0}` },
              { label: 'Missed Follow-ups', val: stats?.missed_followups ?? 0 },
              { label: 'At-risk Patients',  val: stats?.high_risk_dropoff ?? 0 },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '.875rem', color: '#64748b' }}>{r.label}</span>
                <span style={{ fontSize: '.875rem', fontWeight: 600, color: '#0f1f3d' }}>{r.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === 'appts' && (
        <Modal title={`Today's Appointments (${todayAppts.length})`} onClose={() => setModal(null)}>
          <ApptTable rows={todayAppts} emptyMsg="No appointments today." />
        </Modal>
      )}
      {modal === 'completed' && (
        <Modal title={`Completed Appointments`} onClose={() => setModal(null)}>
          <ApptTable rows={completedAppts} emptyMsg="No completed appointments." />
        </Modal>
      )}
      {modal === 'pending' && (
        <Modal title="Pending Collections" onClose={() => setModal(null)}>
          {payRequests.length === 0
            ? <p style={s.empty}>No pending payment requests.</p>
            : <table style={s.table}>
                <thead><tr>{['Patient', 'Phone', 'Doctor', 'Date', 'Fee'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {payRequests.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={s.td}>{r.patient_name}</td>
                      <td style={s.td}>{r.patient_phone || '–'}</td>
                      <td style={s.td}>{r.doctor_name || '–'}</td>
                      <td style={s.td}>{r.appointment_date || '–'}</td>
                      <td style={s.td}>₹{r.consultation_fee}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </Modal>
      )}
      {modal === 'followups' && (
        <Modal title={`Upcoming Follow-ups (${queue.length})`} onClose={() => setModal(null)}>
          {queue.length === 0 ? <p style={s.empty}>No upcoming follow-ups.</p> : (
            <table style={s.table}>
              <thead><tr>{['Patient', 'Phone', 'Follow-up Date', 'Disease Tag'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {queue.map(f => (
                  <tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={s.td}><a href={`/receptionist/patients/${f.patient_id}`} style={{ color: '#00b4a0', fontWeight: 600, textDecoration: 'none' }}>{f.patients?.first_name} {f.patients?.last_name}</a></td>
                    <td style={s.td}>{f.patients?.phone}</td>
                    <td style={s.td}>{f.follow_up_date}</td>
                    <td style={s.td}>{f.disease_tag || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </div>
  );
}

const s = {
  page:        { padding: '2rem', maxWidth: 1200, margin: '0 auto' },
  center:      { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#64748b' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  h1:          { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2:          { fontSize: '1rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h3:          { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', margin: 0 },
  sub:         { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  grid4:       { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 },
  card:        { background: '#fff', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  section:     { background: '#fff', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', marginBottom: 16 },
  table:       { width: '100%', borderCollapse: 'collapse' },
  th:          { textAlign: 'left', padding: '9px 12px', fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0' },
  td:          { padding: '10px 12px', fontSize: '.875rem', color: '#334155' },
  empty:       { color: '#94a3b8', fontSize: '.875rem', padding: '.5rem 0' },
  link:        { color: '#00b4a0', fontWeight: 600, textDecoration: 'none', fontSize: '.8rem' },
  linkBtn:     { padding: '.45rem 1rem', background: '#00b4a0', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: '.8rem', textDecoration: 'none' },
  btnPrimary:  { padding: '.6rem 1.2rem', background: '#00b4a0', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: '.875rem', textDecoration: 'none' },
  btnSecondary:{ padding: '.6rem 1.2rem', background: '#f1f5f9', color: '#0f1f3d', borderRadius: 8, fontWeight: 600, fontSize: '.875rem', textDecoration: 'none' },
  quickBtn:    { display: 'block', padding: '.65rem 1rem', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: '.875rem', textDecoration: 'none', textAlign: 'center' },
};
