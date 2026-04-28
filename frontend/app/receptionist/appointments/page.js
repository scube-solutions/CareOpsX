'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

function AppointmentsContent() {
  const searchParams = useSearchParams();

  const [tab, setTab]                   = useState('book');
  const [doctors, setDoctors]           = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [slots, setSlots]               = useState([]);

  const [patientQuery, setPatientQuery]     = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedDoctor, setSelectedDoctor]   = useState('');
  const [selectedDate, setSelectedDate]       = useState('');
  const [selectedSlot, setSelectedSlot]       = useState('');
  const [reason, setReason]                   = useState('');

  const [loadingSlots, setLoadingSlots]   = useState(false);
  const [saving, setSaving]               = useState(false);
  const [msg, setMsg]                     = useState({ type: '', text: '' });
  const [loadingAppts, setLoadingAppts]   = useState(false);
  const [paymentMode, setPaymentMode]     = useState('');
  const [paymentCollected, setPaymentCollected] = useState(false);

  // Pre-fill patient from search page query params
  useEffect(() => {
    const pid  = searchParams.get('patient_id');
    const pname = searchParams.get('patient_name');
    if (pid && pname) {
      setSelectedPatient({ id: pid, display: pname });
      setTab('book');
    }
  }, []);

  useEffect(() => {
    api('/doctors').then(d => setDoctors(d.doctors || [])).catch(() => {});
  }, []);

  const searchPatients = async () => {
    if (!patientQuery.trim()) return;
    try {
      const data = await api(`/patients?search=${encodeURIComponent(patientQuery)}&limit=8`);
      setPatientResults(data.patients || []);
    } catch (e) { console.error(e); }
  };

  const loadSlots = useCallback(async () => {
    if (!selectedDoctor || !selectedDate) return;
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot('');
    try {
      const data = await api(`/slots?doctor_id=${selectedDoctor}&date=${selectedDate}`);
      setSlots(data.slots || []);
    } catch (e) { setSlots([]); }
    finally { setLoadingSlots(false); }
  }, [selectedDoctor, selectedDate]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const loadAppointments = useCallback(async () => {
    setLoadingAppts(true);
    try {
      const data = await api('/appointments');
      setAppointments(data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoadingAppts(false); }
  }, []);

  useEffect(() => { if (tab === 'list') loadAppointments(); }, [tab]);

  // Reset payment state whenever doctor or slot changes
  useEffect(() => { setPaymentMode(''); setPaymentCollected(false); }, [selectedDoctor, selectedSlot]);

  const bookAppointment = async () => {
    if (!selectedPatient || !selectedDoctor || !selectedDate || !selectedSlot) {
      setMsg({ type: 'error', text: 'Please fill all required fields and select a time slot.' });
      return;
    }
    if (!paymentCollected) {
      setMsg({ type: 'error', text: 'Please collect the consultation fee before booking.' });
      return;
    }
    setSaving(true); setMsg({ type: '', text: '' });
    try {
      const doctorInfo = doctors.find(d => d.id === selectedDoctor);
      if (doctorInfo?.consultation_fee) {
        await api('/billing/invoices', {
          method: 'POST',
          body: JSON.stringify({
            patient_id: selectedPatient.id,
            doctor_id: selectedDoctor,
            consultation_fee: doctorInfo.consultation_fee,
            payment_mode: paymentMode,
            invoice_type: 'consultation',
          }),
        });
      }
      const data = await api('/appointments', {
        method: 'POST',
        body: JSON.stringify({ patient_id: selectedPatient.id, doctor_id: selectedDoctor, appointment_date: selectedDate, appointment_time: selectedSlot, reason }),
      });
      setMsg({ type: 'success', text: `Appointment booked! Booking ID: ${data.booking_id}` });
      setSelectedPatient(null); setSelectedDoctor(''); setSelectedDate(''); setSelectedSlot(''); setReason(''); setPatientQuery(''); setPatientResults([]);
      setPaymentMode(''); setPaymentCollected(false);
    } catch (e) { setMsg({ type: 'error', text: e.message || 'Failed to book appointment' }); }
    finally { setSaving(false); }
  };

  const doctorLabel = d => {
    const name = `${d.users?.first_name || ''} ${d.users?.last_name || ''}`.trim() || 'Doctor';
    return `Dr. ${name} — ${d.specialization || ''}`;
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.h1}>Appointments</h1>
          <p style={s.sub}>Book new appointments or view existing ones</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['book', 'Book Appointment'], ['list', 'View Appointments']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ ...s.tab, ...(tab === key ? s.tabActive : {}) }}>{label}</button>
        ))}
      </div>

      {tab === 'book' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Left: Patient + Doctor + Date */}
          <div style={s.card}>
            <h2 style={s.h2}>Patient</h2>
            {selectedPatient ? (
              <div style={s.selectedBox}>
                <span style={{ fontWeight: 600 }}>{selectedPatient.display || `${selectedPatient.first_name || ''} ${selectedPatient.last_name || ''}`.trim()}</span>
                {selectedPatient.phone && <span style={{ color: '#64748b', marginLeft: 8 }}>{selectedPatient.phone}</span>}
                <button onClick={() => { setSelectedPatient(null); setPatientResults([]); }} style={s.clearBtn}>✕ Change</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input style={s.input} placeholder="Search by name or phone..." value={patientQuery} onChange={e => setPatientQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchPatients()} />
                  <button onClick={searchPatients} style={s.btnSm}>Search</button>
                </div>
                {patientResults.map(p => (
                  <div key={p.id} onClick={() => { setSelectedPatient(p); setPatientResults([]); setPatientQuery(''); }} style={s.resultRow}>
                    <strong>{p.first_name} {p.last_name}</strong>
                    <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>{p.phone}</span>
                    <span style={s.uid}>{p.patient_uid}</span>
                  </div>
                ))}
                {patientResults.length === 0 && patientQuery && (
                  <p style={{ fontSize: 12, color: '#64748b' }}>No results. <a href="/receptionist/patients/new" style={{ color: '#00b4a0' }}>Register new patient →</a></p>
                )}
              </>
            )}

            <h2 style={{ ...s.h2, marginTop: 20 }}>Doctor</h2>
            <select style={s.input} value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)}>
              <option value="">Select doctor</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{doctorLabel(d)}</option>)}
            </select>

            <h2 style={{ ...s.h2, marginTop: 20 }}>Date</h2>
            <input type="date" style={s.input} min={today} value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />

            <h2 style={{ ...s.h2, marginTop: 20 }}>Reason <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></h2>
            <textarea style={{ ...s.input, height: 70, resize: 'vertical' }} placeholder="Chief complaint or reason..." value={reason} onChange={e => setReason(e.target.value)} />
          </div>

          {/* Right: Slot selection + payment + confirm */}
          <div style={s.card}>
            <h2 style={s.h2}>Select Time Slot</h2>
            {!selectedDoctor || !selectedDate ? (
              <p style={{ color: '#94a3b8', fontSize: 13 }}>Select a doctor and date to see available slots.</p>
            ) : loadingSlots ? (
              <p style={{ color: '#64748b' }}>Loading slots...</p>
            ) : slots.length === 0 ? (
              <div>
                <p style={{ color: '#92400e', fontSize: 13, background: '#fef3c7', padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}>
                  No slots configured for this doctor. Enter time manually:
                </p>
                <input type="time" style={{ ...s.input, maxWidth: 180 }} value={selectedSlot} onChange={e => setSelectedSlot(e.target.value)} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {slots.map(sl => (
                  <button key={sl.time} disabled={!sl.available} onClick={() => sl.available && setSelectedSlot(sl.time)}
                    style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: sl.available ? 'pointer' : 'not-allowed',
                      border: selectedSlot === sl.time ? '2px solid #00b4a0' : '1.5px solid #e2e8f0',
                      background: !sl.available ? '#f1f5f9' : selectedSlot === sl.time ? '#ecfdf5' : '#fff',
                      color: !sl.available ? '#94a3b8' : selectedSlot === sl.time ? '#065f46' : '#334155' }}>
                    {sl.time} {!sl.available && <span style={{ fontSize: 10 }}>Booked</span>}
                  </button>
                ))}
              </div>
            )}

            {selectedSlot && (() => {
              const doctorInfo = doctors.find(d => d.id === selectedDoctor);
              return (
                <>
                  {/* Booking summary */}
                  <div style={{ marginTop: 20, padding: '1rem', background: '#f0fdfb', borderRadius: 10, border: '1px solid #99f6e4' }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#065f46', fontWeight: 600 }}>Appointment Summary</p>
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: '#0f766e', lineHeight: 1.8 }}>
                      Patient: <strong>{selectedPatient?.display || `${selectedPatient?.first_name || ''} ${selectedPatient?.last_name || ''}`.trim() || '–'}</strong><br />
                      Doctor: <strong>{doctorLabel(doctorInfo || {})}</strong><br />
                      Date & Time: <strong>{selectedDate} at {selectedSlot}</strong>
                    </p>
                  </div>

                  {/* Payment collection */}
                  <div style={{ marginTop: 16, background: '#fafafa', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '1rem' }}>
                    <div style={{ fontWeight: 700, color: '#0f1f3d', marginBottom: 10, fontSize: '.875rem' }}>💰 Collect Consultation Fee</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <span style={{ fontSize: 13, color: '#64748b' }}>Amount due</span>
                      <span style={{ fontWeight: 800, fontSize: 22, color: '#0f766e' }}>
                        {doctorInfo?.consultation_fee ? `₹${doctorInfo.consultation_fee}` : '₹ —'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                      {[
                        { key: 'cash', label: '💵 Cash',       sub: 'Collect now',  available: true  },
                        { key: 'upi',  label: '📱 UPI',        sub: 'Coming soon',  available: false },
                        { key: 'card', label: '💳 Card Swipe', sub: 'Coming soon',  available: false },
                      ].map(m => (
                        <button key={m.key} onClick={() => m.available && !paymentCollected && setPaymentMode(m.key)}
                          style={{ padding: '10px 4px', borderRadius: 8, fontSize: '.76rem', fontWeight: 600,
                            cursor: m.available && !paymentCollected ? 'pointer' : 'not-allowed', textAlign: 'center',
                            border: `1.5px solid ${paymentMode === m.key ? '#0f766e' : '#e2e8f0'}`,
                            background: !m.available ? '#f8fafc' : paymentMode === m.key ? '#f0fdfb' : '#fff',
                            color: !m.available ? '#94a3b8' : paymentMode === m.key ? '#065f46' : '#334155' }}>
                          <div>{m.label}</div>
                          <div style={{ fontSize: '.68rem', marginTop: 2, opacity: .7 }}>{m.sub}</div>
                        </button>
                      ))}
                    </div>

                    {paymentCollected ? (
                      <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#15803d', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center' }}>
                        ✅ ₹{doctorInfo?.consultation_fee} collected — cash
                        <button onClick={() => setPaymentCollected(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>Undo</button>
                      </div>
                    ) : paymentMode === 'cash' ? (
                      <button onClick={() => setPaymentCollected(true)}
                        style={{ width: '100%', padding: '10px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        ✓ Mark ₹{doctorInfo?.consultation_fee || '—'} Collected (Cash)
                      </button>
                    ) : (
                      <div style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                        Select a payment method above to continue
                      </div>
                    )}
                  </div>
                </>
              );
            })()}

            {msg.text && (
              <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: msg.type === 'error' ? '#fef2f2' : '#f0fdf4', color: msg.type === 'error' ? '#b91c1c' : '#15803d', border: `1px solid ${msg.type === 'error' ? '#fecaca' : '#bbf7d0'}` }}>
                {msg.text}
              </div>
            )}

            <button onClick={bookAppointment} disabled={saving || !selectedPatient || !selectedSlot || !paymentCollected}
              style={{ ...s.btnPri, marginTop: 20, width: '100%', opacity: (!selectedPatient || !selectedSlot || saving || !paymentCollected) ? 0.5 : 1 }}>
              {saving ? 'Booking...' : '✓ Confirm & Book Appointment'}
            </button>
          </div>
        </div>
      )}

      {tab === 'list' && (
        <div style={s.card}>
          {loadingAppts ? <div style={{ padding: 20, color: '#64748b' }}>Loading...</div> : appointments.length === 0 ? (
            <div style={{ padding: 20, color: '#64748b' }}>No appointments found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Booking ID', 'Date / Time', 'Patient', 'Doctor', 'Status'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {appointments.map(a => {
                    const patName = `${a.patients?.first_name || ''} ${a.patients?.last_name || ''}`.trim() || '–';
                    const docName = `${a.doctors?.users?.first_name || ''} ${a.doctors?.users?.last_name || ''}`.trim() || '–';
                    const badge = { booked: ['#fef3c7', '#92400e'], confirmed: ['#dbeafe', '#1e40af'], completed: ['#dcfce7', '#166534'], cancelled: ['#fee2e2', '#b91c1c'], no_show: ['#e2e8f0', '#334155'] }[a.status] || ['#e2e8f0', '#334155'];
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={s.td}><span style={s.uid}>{a.booking_id || '–'}</span></td>
                        <td style={s.td}>{a.appointment_date}<br /><span style={{ color: '#64748b', fontSize: 12 }}>{(a.appointment_time || '').slice(0, 5)}</span></td>
                        <td style={s.td}><div style={{ fontWeight: 600 }}>{patName}</div><div style={{ fontSize: 12, color: '#64748b' }}>{a.patients?.phone}</div></td>
                        <td style={s.td}>Dr. {docName}<br /><span style={{ fontSize: 12, color: '#64748b' }}>{a.doctors?.specialization}</span></td>
                        <td style={s.td}><span style={{ background: badge[0], color: badge[1], padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{a.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#64748b' }}>Loading...</div>}>
      <AppointmentsContent />
    </Suspense>
  );
}

const s = {
  page:        { padding: '2rem', maxWidth: 1200, margin: '0 auto' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  h1:          { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2:          { fontSize: '.875rem', fontWeight: 700, color: '#0f1f3d', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 10px' },
  sub:         { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  card:        { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '1.5rem' },
  input:       { width: '100%', padding: '.65rem .9rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: '.875rem', outline: 'none', background: '#f8fafc', color: '#1e293b', boxSizing: 'border-box' },
  btnPri:      { padding: '.75rem 1.5rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '.9rem' },
  btnSm:       { padding: '.65rem 1rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.85rem', whiteSpace: 'nowrap' },
  tab:         { padding: '.6rem 1.25rem', border: '1px solid #e2e8f0', borderRadius: 999, background: '#fff', color: '#334155', cursor: 'pointer', fontWeight: 600, fontSize: '.875rem' },
  tabActive:   { background: '#ecfdf5', border: '1px solid #00b4a0', color: '#065f46' },
  selectedBox: { display: 'flex', alignItems: 'center', gap: 8, padding: '.75rem 1rem', background: '#f0fdfb', border: '1.5px solid #99f6e4', borderRadius: 8, flexWrap: 'wrap' },
  clearBtn:    { marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  resultRow:   { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 4, background: '#f8fafc', border: '1px solid #e2e8f0' },
  uid:         { fontFamily: 'monospace', fontSize: 11, background: '#f0fdfb', color: '#0f766e', padding: '2px 6px', borderRadius: 4, marginLeft: 'auto' },
  table:       { width: '100%', borderCollapse: 'collapse' },
  th:          { textAlign: 'left', padding: '10px 14px', fontSize: '.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' },
  td:          { padding: '11px 14px', fontSize: '.875rem', color: '#334155' },
};
