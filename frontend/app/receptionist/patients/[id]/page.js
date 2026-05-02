'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

export default function PatientDetailPage() {
  const { id } = useParams();
  const [patient, setPatient]   = useState(null);
  const [appts, setAppts]       = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [tab, setTab]           = useState('info');

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [patData, apptData, invData] = await Promise.all([
          api(`/patients/${id}`),
          api(`/appointments?patient_id=${id}&limit=50`).catch(() => ({ data: [] })),
          api(`/billing/invoices?patient_id=${id}`).catch(() => ({ invoices: [] })),
        ]);
        setPatient(patData.patient || patData);
        setAppts(apptData.data || []);
        setInvoices(invData.invoices || []);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  if (loading) return <div style={s.center}>Loading...</div>;
  if (error)   return <div style={s.center} dangerouslySetInnerHTML={{ __html: `Error: ${error}` }} />;
  if (!patient) return <div style={s.center}>Patient not found.</div>;

  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth)) / 31557600000)
    : null;

  const totalPaid = invoices.reduce((sum, inv) => {
    const paid = (inv.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
    return sum + paid;
  }, 0);

  const totalDue = invoices.reduce((sum, inv) => sum + (inv.balance_due || 0), 0);

  const STATUS_COLOR = {
    booked:    { bg: '#fef3c7', text: '#92400e' },
    confirmed: { bg: '#dbeafe', text: '#1e40af' },
    completed: { bg: '#dcfce7', text: '#166534' },
    cancelled: { bg: '#fee2e2', text: '#b91c1c' },
    no_show:   { bg: '#e2e8f0', text: '#334155' },
  };

  const tabs = ['info', 'appointments', 'payments'];

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/receptionist/patients" style={s.back}>← Back</a>
          <div style={s.avatar}>{(patient.first_name?.[0] || 'P').toUpperCase()}</div>
          <div>
            <h1 style={s.h1}>{patient.first_name} {patient.last_name}</h1>
            <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={s.badge}>{patient.patient_uid || '–'}</span>
              {patient.blood_group && <span style={{ ...s.badge, background: '#fef2f2', color: '#b91c1c' }}>{patient.blood_group}</span>}
              {patient.chronic_disease_tag && <span style={{ ...s.badge, background: '#fef3c7', color: '#92400e' }}>{patient.chronic_disease_tag}</span>}
            </div>
          </div>
        </div>
        <a href={`/receptionist/appointments?patient_id=${id}&patient_name=${encodeURIComponent((patient.first_name || '') + ' ' + (patient.last_name || ''))}`} style={s.btnPri}>
          + Book Appointment
        </a>
      </div>

      {/* Tabs */}
      <div style={s.tabBar}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ ...s.tabBtn, ...(tab === t ? s.tabActive : {}) }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Info tab */}
      {tab === 'info' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={s.card}>
            <h2 style={s.h2}>Personal Details</h2>
            {[
              ['Age',       age ? `${age} years` : '–'],
              ['Gender',    patient.gender || '–'],
              ['DOB',       patient.date_of_birth || '–'],
              ['Phone',     patient.phone || '–'],
              ['Alt Phone', patient.alternate_phone || '–'],
              ['Email',     patient.email || '–'],
            ].map(([label, val]) => (
              <div key={label} style={s.row}>
                <span style={s.rowLabel}>{label}</span>
                <span style={s.rowVal}>{val}</span>
              </div>
            ))}
          </div>

          <div style={s.card}>
            <h2 style={s.h2}>Medical Info</h2>
            {[
              ['Blood Group',   patient.blood_group || '–'],
              ['Allergies',     patient.allergies || '–'],
              ['Conditions',    patient.existing_conditions || '–'],
              ['Chronic Tag',   patient.chronic_disease_tag || '–'],
            ].map(([label, val]) => (
              <div key={label} style={s.row}>
                <span style={s.rowLabel}>{label}</span>
                <span style={s.rowVal}>{val}</span>
              </div>
            ))}
          </div>

          <div style={s.card}>
            <h2 style={s.h2}>Address</h2>
            {[
              ['Line 1',   patient.address_line_1 || '–'],
              ['Line 2',   patient.address_line_2 || '–'],
              ['City',     patient.city || '–'],
              ['State',    patient.state || '–'],
              ['Postal',   patient.postal_code || '–'],
            ].map(([label, val]) => (
              <div key={label} style={s.row}>
                <span style={s.rowLabel}>{label}</span>
                <span style={s.rowVal}>{val}</span>
              </div>
            ))}
          </div>

          <div style={s.card}>
            <h2 style={s.h2}>Emergency Contact</h2>
            {[
              ['Name',         patient.emergency_contact_name || '–'],
              ['Relationship', patient.emergency_contact_relationship || '–'],
              ['Phone',        patient.emergency_contact_phone || '–'],
            ].map(([label, val]) => (
              <div key={label} style={s.row}>
                <span style={s.rowLabel}>{label}</span>
                <span style={s.rowVal}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Appointments tab */}
      {tab === 'appointments' && (
        <div style={s.card}>
          <h2 style={s.h2}>Appointments ({appts.length})</h2>
          {appts.length === 0
            ? <p style={s.empty}>No appointments found.</p>
            : (
              <table style={s.table}>
                <thead><tr style={{ background: '#f8fafc' }}>
                  {['Token', 'Date', 'Time', 'Doctor', 'Status', 'Booking ID'].map(h => <th key={h} style={s.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {appts.map(a => {
                    const docName = `${a.doctors?.users?.first_name || ''} ${a.doctors?.users?.last_name || ''}`.trim() || '–';
                    const badge = STATUS_COLOR[a.status] || STATUS_COLOR.booked;
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={s.td}>
                          {a.token_number
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: '#00b4a0', color: '#fff', fontWeight: 700, fontSize: 12 }}>{a.token_number}</span>
                            : <span style={{ color: '#cbd5e1' }}>–</span>}
                        </td>
                        <td style={s.td}>{a.appointment_date}</td>
                        <td style={s.td}>{(a.appointment_time || '').slice(0, 5)}</td>
                        <td style={s.td}>Dr. {docName}<div style={{ fontSize: 11, color: '#64748b' }}>{a.doctors?.specialization}</div></td>
                        <td style={s.td}><span style={{ background: badge.bg, color: badge.text, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{a.status}</span></td>
                        <td style={s.td}>{a.booking_id && <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#0f766e', background: '#f0fdfb', padding: '2px 6px', borderRadius: 4 }}>{a.booking_id}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </div>
      )}

      {/* Payments tab */}
      {tab === 'payments' && (
        <div style={s.card}>
          <h2 style={s.h2}>Payment History ({invoices.length})</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#f0fdfb', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0f766e' }}>₹{totalPaid.toFixed(2)}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Total Paid</div>
            </div>
            <div style={{ background: '#fef2f2', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#b91c1c' }}>₹{totalDue.toFixed(2)}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Balance Due</div>
            </div>
            <div style={{ background: '#eff6ff', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1d4ed8' }}>{invoices.length}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Total Invoices</div>
            </div>
          </div>
          {invoices.length === 0
            ? <p style={s.empty}>No invoices found.</p>
            : (
              <table style={s.table}>
                <thead><tr style={{ background: '#f8fafc' }}>
                  {['Invoice #', 'Type', 'Date', 'Total', 'Paid', 'Balance', 'Status'].map(h => <th key={h} style={s.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {invoices.map(inv => {
                    const paid = (inv.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
                    const bal  = inv.balance_due ?? (inv.total_amount - paid);
                    const statusColor = inv.status === 'paid' ? { bg: '#dcfce7', text: '#166534' } : inv.status === 'partial' ? { bg: '#fef3c7', text: '#92400e' } : { bg: '#fee2e2', text: '#b91c1c' };
                    return (
                      <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={s.td}><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#0f766e' }}>{inv.invoice_number || inv.id?.slice(0, 8)}</span></td>
                        <td style={s.td}>{inv.invoice_type || 'consultation'}</td>
                        <td style={s.td}>{(inv.created_at || '').slice(0, 10)}</td>
                        <td style={s.td}>₹{(inv.total_amount || 0).toFixed(2)}</td>
                        <td style={s.td} style={{ color: '#166534', fontWeight: 600 }}>₹{paid.toFixed(2)}</td>
                        <td style={s.td} style={{ color: bal > 0 ? '#b91c1c' : '#166534', fontWeight: 600 }}>₹{bal.toFixed(2)}</td>
                        <td style={s.td}><span style={{ background: statusColor.bg, color: statusColor.text, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{inv.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </div>
      )}
    </div>
  );
}

const s = {
  page:      { padding: '2rem', maxWidth: 1100, margin: '0 auto' },
  center:    { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#64748b' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  h1:        { fontSize: '1.4rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2:        { fontSize: '.95rem', fontWeight: 700, color: '#0f1f3d', margin: '0 0 14px' },
  back:      { color: '#00b4a0', textDecoration: 'none', fontWeight: 600, fontSize: '.875rem' },
  avatar:    { width: 48, height: 48, borderRadius: '50%', background: '#00b4a0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, flexShrink: 0 },
  badge:     { fontSize: '.72rem', fontWeight: 600, background: '#f0fdfb', color: '#0f766e', padding: '2px 8px', borderRadius: 20 },
  btnPri:    { padding: '.6rem 1.2rem', background: '#00b4a0', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: '.875rem', textDecoration: 'none' },
  tabBar:    { display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 0 },
  tabBtn:    { padding: '.5rem 1rem', background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', fontSize: '.875rem', color: '#64748b', fontWeight: 500, marginBottom: -1 },
  tabActive: { borderBottom: '2px solid #00b4a0', color: '#00b4a0', fontWeight: 700 },
  card:      { background: '#fff', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  row:       { display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f8fafc', fontSize: '.875rem' },
  rowLabel:  { color: '#64748b', minWidth: 120 },
  rowVal:    { color: '#0f1f3d', fontWeight: 500, textAlign: 'right' },
  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { textAlign: 'left', padding: '9px 12px', fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0' },
  td:        { padding: '10px 12px', fontSize: '.875rem', color: '#334155' },
  empty:     { color: '#94a3b8', fontSize: '.875rem', padding: '.5rem 0' },
};
