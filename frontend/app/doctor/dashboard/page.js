'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';

const STATUS_COLORS = { waiting: '#f59e0b', called: '#3b82f6', in_consultation: '#8b5cf6', completed: '#10b981', missed: '#ef4444' };
const APPT_STATUS_STYLE = {
  booked:    { bg: '#fef3c7', text: '#92400e' },
  confirmed: { bg: '#dbeafe', text: '#1e40af' },
  completed: { bg: '#dcfce7', text: '#166534' },
  cancelled: { bg: '#fee2e2', text: '#b91c1c' },
  no_show:   { bg: '#e2e8f0', text: '#334155' },
};

export default function DoctorDashboard() {
  const [queue, setQueue] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);
  const [patientLabOrders, setPatientLabOrders] = useState([]);
  const [doctorId, setDoctorId] = useState(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConsultForm, setShowConsultForm] = useState(false);
  const [showLabForm, setShowLabForm]     = useState(false);
  const [showFollowUp, setShowFollowUp]   = useState(false);
  const [consult, setConsult] = useState({ chief_complaint: '', symptoms: '', diagnosis: '', advice: '', notes: '', follow_up_required: false, follow_up_date: '' });
  const [labForm, setLabForm] = useState({ tests: [{ test_name: '', test_code: '' }], urgency: 'normal', notes: '' });
  const [followUpDate, setFollowUpDate]   = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [weekAppts, setWeekAppts] = useState([]);

  useEffect(() => {
    const user = getUser();
    if (!user) return;
    api('/doctors').then(d => {
      const docs = d.doctors || d || [];
      const myDoc = docs.find(doc => doc.user_id === user.id);
      if (myDoc) setDoctorId(myDoc.id);
    });
  }, []);

  useEffect(() => {
    if (!doctorId) return;
    const today   = new Date().toISOString().split('T')[0];
    const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    api(`/appointments?doctor_id=${doctorId}&date_from=${today}&date_to=${weekEnd}`)
      .then(d => setWeekAppts(d.data || []))
      .catch(console.error);
  }, [doctorId]);

  const loadQueue = useCallback(async () => {
    if (!doctorId) return;
    try {
      const data = await api(`/consultations/doctor-queue/${doctorId}`);
      setQueue(data.queue || []);
    } catch (e) { console.error(e); }
  }, [doctorId]);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 10000);
    return () => clearInterval(interval);
  }, [loadQueue]);

  const selectToken = async (token) => {
    setSelectedToken(token);
    setShowConsultForm(false);
    setShowLabForm(false);
    setShowFollowUp(false);
    setFollowUpDate('');
    setFollowUpNotes('');
    setConsult({ chief_complaint: '', symptoms: '', diagnosis: '', advice: '', notes: '', follow_up_required: false, follow_up_date: '' });
    setLabForm({ tests: [{ test_name: '', test_code: '' }], urgency: 'normal', notes: '' });
    if (token.patients?.id) {
      try {
        const data = await api(`/consultations/patient-history/${token.patients.id}`);
        setPatientHistory(data.history || []);
        setPatientLabOrders(data.lab_orders || []);
      } catch (e) { console.error(e); }
    }
  };

  const addTestRow    = () => setLabForm(f => ({ ...f, tests: [...f.tests, { test_name: '', test_code: '' }] }));
  const removeTestRow = (i) => setLabForm(f => ({ ...f, tests: f.tests.filter((_, idx) => idx !== i) }));
  const updateTest    = (i, field, val) => setLabForm(f => ({ ...f, tests: f.tests.map((t, idx) => idx === i ? { ...t, [field]: val } : t) }));

  const assignLabTest = async () => {
    if (!selectedToken) return;
    const validTests = labForm.tests.filter(t => t.test_name.trim());
    if (!validTests.length) { setMsg('Enter at least one test name'); return; }
    setLoading(true);
    try {
      await api('/consultations/lab-orders', {
        method: 'POST',
        body: JSON.stringify({
          patient_id:     selectedToken.patients?.id,
          doctor_id:      doctorId,
          appointment_id: selectedToken.appointment_id || null,
          tests:          validTests,
          urgency:        labForm.urgency,
          notes:          labForm.notes || null,
        }),
      });
      setMsg(`${validTests.length} lab test${validTests.length > 1 ? 's' : ''} assigned successfully`);
      setShowLabForm(false);
      setLabForm({ tests: [{ test_name: '', test_code: '' }], urgency: 'normal', notes: '' });
      // Refresh lab orders for this patient
      const data = await api(`/consultations/patient-history/${selectedToken.patients.id}`);
      setPatientLabOrders(data.lab_orders || []);
    } catch (e) { setMsg(e.message); } finally { setLoading(false); }
  };

  const quickDate = (months, weeks = 0) => {
    const d = new Date();
    if (weeks) d.setDate(d.getDate() + weeks * 7);
    else d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
  };

  const scheduleFollowUp = async () => {
    if (!followUpDate) { setMsg('Please select a follow-up date'); return; }
    setLoading(true);
    try {
      await api('/followups', {
        method: 'POST',
        body: JSON.stringify({
          patient_id:     selectedToken.patients?.id,
          doctor_id:      doctorId,
          appointment_id: selectedToken.appointment_id || null,
          follow_up_date: followUpDate,
          notes:          followUpNotes || null,
          status:         'scheduled',
        }),
      });
      setMsg(`Follow-up scheduled for ${new Date(followUpDate).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} — patient will be reminded 3, 2 & 1 day before`);
      setShowFollowUp(false);
      setFollowUpDate('');
      setFollowUpNotes('');
    } catch (e) { setMsg(e.message); } finally { setLoading(false); }
  };

  const callNext = async () => {
    if (!doctorId) return;
    setLoading(true);
    try {
      const data = await api(`/queue/next/${doctorId}`, { method: 'POST' });
      setMsg(data.next_token !== null ? `Called Token #${data.token?.token_number}` : 'No more patients waiting');
      await loadQueue();
    } catch (e) { setMsg(e.message); } finally { setLoading(false); }
  };

  const markMissed = async (tokenId) => {
    await api(`/queue/token/${tokenId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'missed' }) });
    await loadQueue();
  };

  const saveConsultation = async () => {
    if (!selectedToken || !consult.chief_complaint) { setMsg('Chief complaint is required'); return; }
    setLoading(true);
    try {
      await api('/consultations', { method: 'POST', body: JSON.stringify({ patient_id: selectedToken.patients?.id, appointment_id: selectedToken.appointment_id, doctor_id: doctorId, ...consult }) });
      setMsg('Consultation saved successfully');
      setShowConsultForm(false);
      setSelectedToken(null);
      await loadQueue();
    } catch (e) { setMsg(e.message); } finally { setLoading(false); }
  };

  const waiting = queue.filter(t => t.status === 'waiting');
  const completed = queue.filter(t => t.status === 'completed').length;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.h1}>Doctor Queue</h1>
          <p style={s.sub}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={s.statBadge}><span style={{ fontSize: '1.2rem', fontWeight: 700 }}>{waiting.length}</span><span style={{ fontSize: '.7rem', color: '#64748b' }}>Waiting</span></div>
          <div style={s.statBadge}><span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981' }}>{completed}</span><span style={{ fontSize: '.7rem', color: '#64748b' }}>Done</span></div>
          <button onClick={callNext} disabled={loading} style={s.btnPri}>{loading ? '...' : '→ Call Next'}</button>
        </div>
      </div>

      {msg && <div style={s.info}>{msg}<button onClick={() => setMsg('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer' }}>×</button></div>}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
        <div style={s.card}>
          <h2 style={s.h2}>Today's Queue ({queue.length})</h2>
          {queue.length === 0 ? <p style={s.empty}>Queue is empty</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {queue.map(t => (
                <div key={t.id} onClick={() => selectToken(t)}
                  style={{ ...s.tokenRow, borderLeft: `4px solid ${STATUS_COLORS[t.status] || '#e2e8f0'}`, background: selectedToken?.id === t.id ? '#f0f9ff' : '#f8fafc', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.3rem', fontWeight: 800, color: STATUS_COLORS[t.status] }}>#{t.token_number}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{t.patients?.first_name} {t.patients?.last_name}</div>
                      <div style={{ fontSize: '.75rem', color: '#64748b' }}>{t.patients?.patient_uid}</div>
                    </div>
                    <span style={{ background: STATUS_COLORS[t.status] + '20', color: STATUS_COLORS[t.status], padding: '2px 8px', borderRadius: 12, fontSize: '.7rem', fontWeight: 600 }}>{t.status}</span>
                  </div>
                  {(t.status === 'called' || t.status === 'in_consultation') && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button onClick={e => { e.stopPropagation(); setSelectedToken(t); setShowConsultForm(true); }} style={s.actBtn}>+ Consultation</button>
                      <button onClick={e => { e.stopPropagation(); markMissed(t.id); }} style={{ ...s.actBtn, background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }}>Missed</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          {!selectedToken ? (
            <div style={{ ...s.card, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: '#94a3b8' }}>
              Select a patient from the queue to view details
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ ...s.h2, marginBottom: 12 }}>{selectedToken.patients?.first_name} {selectedToken.patients?.last_name}</h2>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                      {[['Patient ID', selectedToken.patients?.patient_uid], ['Phone', selectedToken.patients?.phone], ['DOB', selectedToken.patients?.date_of_birth || '–'], ['Blood Group', selectedToken.patients?.blood_group || '–'], ['Allergies', selectedToken.patients?.allergies || 'None'], ['Chronic', selectedToken.patients?.chronic_disease_tag || '–']].map(([l, v]) => (
                        <div key={l}><div style={{ fontSize: '.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>{l}</div><div style={{ fontSize: '.875rem', fontWeight: 600, color: '#0f1f3d' }}>{v}</div></div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {!showConsultForm && <button onClick={() => { setShowConsultForm(true); setShowLabForm(false); setShowFollowUp(false); }} style={s.btnPri}>+ Consultation</button>}
                    <button onClick={() => { setShowLabForm(v => !v); setShowConsultForm(false); setShowFollowUp(false); }} style={{ ...s.btnSec, borderColor: showLabForm ? '#00b4a0' : undefined, color: showLabForm ? '#00b4a0' : undefined }}>🧪 Assign Lab Test</button>
                    <button onClick={() => { setShowFollowUp(v => !v); setShowConsultForm(false); setShowLabForm(false); }} style={{ ...s.btnSec, borderColor: showFollowUp ? '#7c3aed' : undefined, color: showFollowUp ? '#7c3aed' : undefined }}>📅 Follow-up</button>
                  </div>
                </div>
              </div>

              {showConsultForm && (
                <div style={s.card}>
                  <h2 style={s.h2}>Consultation Notes</h2>
                  <div style={s.grid2}>
                    {[['Chief Complaint *', 'chief_complaint'], ['Symptoms', 'symptoms'], ['Diagnosis', 'diagnosis'], ['Advice', 'advice']].map(([l, k]) => (
                      <div key={k} style={s.fg}>
                        <label style={s.label}>{l}</label>
                        <textarea value={consult[k]} onChange={e => setConsult({ ...consult, [k]: e.target.value })} style={{ ...s.input, height: 70, resize: 'vertical' }} />
                      </div>
                    ))}
                  </div>
                  <div style={s.fg}><label style={s.label}>Notes</label><textarea value={consult.notes} onChange={e => setConsult({ ...consult, notes: e.target.value })} style={{ ...s.input, height: 60, width: '100%' }} /></div>
                  <div style={{ marginTop: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 10 }}>
                      <input type="checkbox" checked={consult.follow_up_required}
                        onChange={e => setConsult({ ...consult, follow_up_required: e.target.checked, follow_up_date: '' })} />
                      <span style={{ fontSize: '.8rem', fontWeight: 600, color: '#475569' }}>Schedule Follow-up Visit</span>
                    </label>
                    {consult.follow_up_required && (
                      <div style={{ paddingLeft: 24 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                          {[
                            { label: '1 Week',   weeks: 1, months: 0 },
                            { label: '2 Weeks',  weeks: 2, months: 0 },
                            { label: '1 Month',  weeks: 0, months: 1 },
                            { label: '2 Months', weeks: 0, months: 2 },
                            { label: '3 Months', weeks: 0, months: 3 },
                            { label: '6 Months', weeks: 0, months: 6 },
                          ].map(opt => {
                            const d = new Date();
                            if (opt.weeks) d.setDate(d.getDate() + opt.weeks * 7);
                            else d.setMonth(d.getMonth() + opt.months);
                            const val = d.toISOString().split('T')[0];
                            return (
                              <button key={opt.label} onClick={() => setConsult(c => ({ ...c, follow_up_date: val }))}
                                style={{ padding: '4px 12px', borderRadius: 20, border: `1.5px solid ${consult.follow_up_date === val ? '#00b4a0' : '#e2e8f0'}`, background: consult.follow_up_date === val ? '#f0fdfb' : '#fff', color: consult.follow_up_date === val ? '#0f766e' : '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '.75rem' }}>
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '.75rem', color: '#94a3b8' }}>Or:</span>
                          <input type="date" value={consult.follow_up_date}
                            onChange={e => setConsult({ ...consult, follow_up_date: e.target.value })}
                            style={{ ...s.input, width: 160 }} />
                        </div>
                        {consult.follow_up_date && (
                          <div style={{ marginTop: 6, fontSize: '.78rem', color: '#00b4a0', fontWeight: 600 }}>
                            ✓ {new Date(consult.follow_up_date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} — reminders sent 3, 2 & 1 day before
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    <button onClick={saveConsultation} disabled={loading} style={s.btnPri}>{loading ? 'Saving...' : 'Save Consultation'}</button>
                    <button onClick={() => setShowConsultForm(false)} style={{ ...s.btnSec, color: '#ef4444' }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* ── Assign Lab Test Form ── */}
              {showLabForm && (
                <div style={s.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h2 style={s.h2}>Assign Lab Test</h2>
                    <button onClick={() => setShowLabForm(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                  </div>

                  {/* Test rows */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={s.label}>Tests *</label>
                    {labForm.tests.map((t, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <input
                          value={t.test_name}
                          onChange={e => updateTest(i, 'test_name', e.target.value)}
                          placeholder="Test name (e.g. CBC, Lipid Panel)"
                          style={{ ...s.input, flex: 2 }}
                        />
                        <input
                          value={t.test_code}
                          onChange={e => updateTest(i, 'test_code', e.target.value)}
                          placeholder="Code (optional)"
                          style={{ ...s.input, flex: 1 }}
                        />
                        {labForm.tests.length > 1 && (
                          <button onClick={() => removeTestRow(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem', padding: '0 4px' }}>×</button>
                        )}
                      </div>
                    ))}
                    <button onClick={addTestRow} style={{ ...s.btnSec, fontSize: '.78rem', padding: '4px 12px' }}>+ Add Another Test</button>
                  </div>

                  {/* Urgency */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={s.label}>Urgency</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['normal', 'urgent'].map(u => (
                        <button key={u} onClick={() => setLabForm(f => ({ ...f, urgency: u }))}
                          style={{ padding: '6px 18px', borderRadius: 20, border: `1.5px solid ${labForm.urgency === u ? (u === 'urgent' ? '#ef4444' : '#00b4a0') : '#e2e8f0'}`, background: labForm.urgency === u ? (u === 'urgent' ? '#fee2e2' : '#f0fdfb') : '#fff', color: labForm.urgency === u ? (u === 'urgent' ? '#b91c1c' : '#0f766e') : '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '.8rem', textTransform: 'capitalize' }}>
                          {u === 'urgent' ? '⚡ Urgent' : '✓ Normal'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={s.label}>Notes</label>
                    <textarea value={labForm.notes} onChange={e => setLabForm(f => ({ ...f, notes: e.target.value }))}
                      style={{ ...s.input, height: 60, resize: 'vertical' }} placeholder="Special instructions for the lab..." />
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={assignLabTest} disabled={loading} style={s.btnPri}>{loading ? 'Assigning...' : 'Assign Test'}</button>
                    <button onClick={() => setShowLabForm(false)} style={s.btnSec}>Cancel</button>
                  </div>
                </div>
              )}

              {/* ── Schedule Follow-up Form ── */}
              {showFollowUp && (
                <div style={{ ...s.card, borderLeft: '4px solid #7c3aed' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={{ ...s.h2, color: '#7c3aed' }}>Schedule Follow-up Visit</h2>
                    <button onClick={() => setShowFollowUp(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                  </div>

                  {/* Quick presets */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={s.label}>Quick Select</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                      {[
                        { label: '1 Week',   m: 0, w: 1 },
                        { label: '2 Weeks',  m: 0, w: 2 },
                        { label: '1 Month',  m: 1, w: 0 },
                        { label: '2 Months', m: 2, w: 0 },
                        { label: '3 Months', m: 3, w: 0 },
                        { label: '6 Months', m: 6, w: 0 },
                      ].map(opt => {
                        const val = quickDate(opt.m, opt.w);
                        return (
                          <button key={opt.label} onClick={() => setFollowUpDate(val)}
                            style={{ padding: '5px 14px', borderRadius: 20, border: `1.5px solid ${followUpDate === val ? '#7c3aed' : '#e2e8f0'}`, background: followUpDate === val ? '#f5f3ff' : '#fff', color: followUpDate === val ? '#7c3aed' : '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '.78rem' }}>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={s.label}>Or Pick a Specific Date</label>
                    <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                      style={{ ...s.input, width: 200, marginTop: 6 }} min={new Date().toISOString().split('T')[0]} />
                  </div>

                  {followUpDate && (
                    <div style={{ marginBottom: 12, padding: '10px 14px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, fontSize: '.875rem', color: '#7c3aed', fontWeight: 600 }}>
                      📅 {new Date(followUpDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      <div style={{ fontSize: '.75rem', fontWeight: 400, color: '#6d28d9', marginTop: 2 }}>Patient & lab will be reminded 3, 2 & 1 day before.</div>
                    </div>
                  )}

                  <div style={{ marginBottom: 14 }}>
                    <label style={s.label}>Notes for Patient (optional)</label>
                    <textarea value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)}
                      style={{ ...s.input, height: 56, width: '100%', resize: 'vertical', marginTop: 4 }}
                      placeholder="e.g. Bring previous reports, fasting required..." />
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={scheduleFollowUp} disabled={loading || !followUpDate}
                      style={{ ...s.btnPri, background: '#7c3aed' }}>
                      {loading ? 'Scheduling...' : 'Confirm Follow-up'}
                    </button>
                    <button onClick={() => setShowFollowUp(false)} style={s.btnSec}>Cancel</button>
                  </div>
                </div>
              )}

              {/* ── Patient Lab Orders ── */}
              {patientLabOrders.length > 0 && (
                <div style={s.card}>
                  <h2 style={s.h2}>Lab Orders for this Patient</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {patientLabOrders.map(o => {
                      const reports = o.lab_reports || [];
                      const statusColor = { ordered: '#f59e0b', sample_collected: '#3b82f6', processing: '#8b5cf6', ready: '#10b981', delivered: '#64748b', cancelled: '#ef4444' };
                      const c = statusColor[o.status] || '#94a3b8';
                      return (
                        <div key={o.id} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontWeight: 600, fontSize: '.875rem', color: '#0f1f3d' }}>{o.test_name}</span>
                              {o.test_code && <span style={{ fontSize: '.75rem', color: '#64748b', marginLeft: 6 }}>{o.test_code}</span>}
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              {o.urgency === 'urgent' && <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '.7rem', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>URGENT</span>}
                              <span style={{ background: c + '20', color: c, fontSize: '.72rem', padding: '2px 8px', borderRadius: 10, fontWeight: 600, textTransform: 'capitalize' }}>{(o.status || '').replace(/_/g, ' ')}</span>
                            </div>
                          </div>
                          {reports.length > 0 && (
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                              {reports.map(r => (
                                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '.8rem', color: '#475569' }}>{r.findings ? r.findings.slice(0, 80) + (r.findings.length > 80 ? '…' : '') : 'Report available'}</span>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span style={{ background: r.is_normal ? '#dcfce7' : '#fee2e2', color: r.is_normal ? '#166534' : '#b91c1c', fontSize: '.7rem', padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>{r.is_normal ? 'Normal' : 'Abnormal'}</span>
                                    {r.report_url && <a href={r.report_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '.78rem', color: '#1d4ed8', fontWeight: 600 }}>Download</a>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={s.card}>
                <h2 style={s.h2}>Previous Visits</h2>
                {patientHistory.length === 0 ? <p style={s.empty}>No previous visits</p> : patientHistory.slice(0, 5).map(h => (
                  <div key={h.id} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 600, fontSize: '.875rem' }}>{h.consultation_date}</span><span style={{ fontSize: '.75rem', color: '#64748b' }}>{h.consultation_status}</span></div>
                    {h.chief_complaint && <div style={{ fontSize: '.8rem', color: '#475569', marginTop: 2 }}><strong>CC:</strong> {h.chief_complaint}</div>}
                    {h.diagnosis && <div style={{ fontSize: '.8rem', color: '#475569' }}><strong>Dx:</strong> {h.diagnosis}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Appointments This Week */}
      <div style={{ ...s.card, marginTop: 20 }}>
        <h2 style={s.h2}>Appointments This Week</h2>
        {weekAppts.length === 0 ? (
          <p style={s.empty}>No appointments this week.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Patient', 'Date', 'Time', 'Status', 'Booking ID'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weekAppts.map(a => {
                const patName = `${a.patients?.first_name || ''} ${a.patients?.last_name || ''}`.trim() || '–';
                const badge   = APPT_STATUS_STYLE[a.status] || APPT_STATUS_STYLE.booked;
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontSize: '.875rem', color: '#334155' }}>
                      <div style={{ fontWeight: 600, color: '#0f1f3d' }}>{patName}</div>
                      {a.patients?.phone && <div style={{ fontSize: 12, color: '#64748b' }}>{a.patients.phone}</div>}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '.875rem', color: '#334155' }}>{a.appointment_date}</td>
                    <td style={{ padding: '10px 12px', fontSize: '.875rem', color: '#334155' }}>{(a.appointment_time || '').slice(0, 5)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: badge.bg, color: badge.text, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{a.status}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '.875rem', color: '#334155' }}>
                      {a.booking_id && <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#0f766e', background: '#f0fdfb', padding: '2px 6px', borderRadius: 4 }}>{a.booking_id}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const s = {
  page: { padding: '2rem', maxWidth: 1300, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  h1: { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2: { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', marginBottom: 12 },
  sub: { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  card: { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  tokenRow: { borderRadius: 10, padding: '10px 12px', border: '1px solid #e2e8f0' },
  statBadge: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 },
  fg: { marginBottom: 10 },
  label: { display: 'block', fontSize: '.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 },
  input: { width: '100%', padding: '.6rem .9rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem', boxSizing: 'border-box' },
  btnPri: { padding: '.6rem 1.2rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem', textDecoration: 'none' },
  btnSec: { padding: '.6rem 1rem', background: '#f1f5f9', color: '#0f1f3d', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem', textDecoration: 'none', display: 'inline-block' },
  actBtn: { padding: '3px 10px', background: '#f0fdf4', color: '#065f46', border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 },
  info: { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.875rem', marginBottom: 16, display: 'flex', alignItems: 'center' },
  empty: { color: '#94a3b8', fontSize: '.875rem', textAlign: 'center', padding: '1rem 0' },
};
