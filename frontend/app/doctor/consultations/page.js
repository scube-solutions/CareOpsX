'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';

const STATUS_STYLE = {
  booked:    { bg: '#fef3c7', text: '#92400e' },
  confirmed: { bg: '#dbeafe', text: '#1e40af' },
  completed: { bg: '#dcfce7', text: '#166534' },
  cancelled: { bg: '#fee2e2', text: '#b91c1c' },
  no_show:   { bg: '#e2e8f0', text: '#334155' },
};
const LAB_STATUS_COLOR = {
  ordered:          '#f59e0b',
  sample_collected: '#3b82f6',
  processing:       '#8b5cf6',
  ready:            '#10b981',
  delivered:        '#64748b',
  cancelled:        '#ef4444',
};

export default function DoctorConsultationsPage() {
  const [doctorId, setDoctorId]         = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [selected, setSelected]         = useState(null);
  const [history, setHistory]           = useState([]);
  const [labOrders, setLabOrders]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [msg, setMsg]                   = useState('');
  const [saving, setSaving]             = useState(false);

  // Consultation form
  const [showForm, setShowForm]   = useState(false);
  const [consult, setConsult]     = useState({ chief_complaint: '', symptoms: '', diagnosis: '', advice: '', notes: '', follow_up_required: false, follow_up_date: '' });

  // Lab form
  const [showLabForm, setShowLabForm] = useState(false);
  const [labForm, setLabForm]         = useState({ tests: [{ test_name: '', test_code: '' }], urgency: 'normal', notes: '' });
  const [testCatalog, setTestCatalog] = useState([]);

  // Follow-up form
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');

  useEffect(() => {
    const user = getUser();
    if (!user) return;
    api('/doctors').then(d => {
      const docs = d.doctors || d || [];
      const myDoc = docs.find(doc => doc.user_id === user.id);
      if (myDoc) setDoctorId(myDoc.id);
    });
    api('/lab/test-catalog').then(d => setTestCatalog(d.tests || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!doctorId) return;
    const today = new Date().toISOString().split('T')[0];
    api(`/appointments?doctor_id=${doctorId}&date_from=${today}`)
      .then(d => setAppointments(d.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [doctorId]);

  const loadPatientData = async (pid) => {
    try {
      const d = await api(`/consultations/patient-history/${pid}`);
      setHistory(d.history || []);
      setLabOrders(d.lab_orders || []);
    } catch (e) { console.error(e); }
  };

  const selectAppt = async (a) => {
    setSelected(a);
    setShowForm(false);
    setShowLabForm(false);
    setShowFollowUp(false);
    setConsult({ chief_complaint: '', symptoms: '', diagnosis: '', advice: '', notes: '', follow_up_required: false, follow_up_date: '' });
    setLabForm({ tests: [{ test_name: '', test_code: '' }], urgency: 'normal', notes: '' });
    setFollowUpDate('');
    setFollowUpNotes('');
    const pid = a.patients?.id || a.patient_id;
    if (pid) await loadPatientData(pid);
  };

  const quickDate = (months, weeks = 0) => {
    const d = new Date();
    if (weeks) d.setDate(d.getDate() + weeks * 7);
    else d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
  };

  const scheduleFollowUp = async () => {
    if (!followUpDate) { setMsg('Please select a follow-up date'); return; }
    setSaving(true);
    try {
      await api('/followups', {
        method: 'POST',
        body: JSON.stringify({
          patient_id:      selected.patients?.id || selected.patient_id,
          doctor_id:       doctorId,
          appointment_id:  selected.id,
          follow_up_date:  followUpDate,
          notes:           followUpNotes || null,
          status:          'scheduled',
        }),
      });
      setMsg(`Follow-up scheduled for ${new Date(followUpDate).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} — patient will be reminded 3, 2 & 1 day before`);
      setShowFollowUp(false);
      setFollowUpDate('');
      setFollowUpNotes('');
    } catch (e) { setMsg(e.message); } finally { setSaving(false); }
  };

  const saveConsultation = async () => {
    if (!consult.chief_complaint) { setMsg('Chief complaint is required'); return; }
    setSaving(true);
    try {
      await api('/consultations', {
        method: 'POST',
        body: JSON.stringify({ patient_id: selected.patients?.id || selected.patient_id, appointment_id: selected.id, doctor_id: doctorId, ...consult }),
      });
      setMsg('Consultation saved successfully');
      setShowForm(false);
      const today = new Date().toISOString().split('T')[0];
      const d = await api(`/appointments?doctor_id=${doctorId}&date_from=${today}`);
      setAppointments(d.data || []);
    } catch (e) { setMsg(e.message); } finally { setSaving(false); }
  };

  // Lab helpers
  const addTestRow    = () => setLabForm(f => ({ ...f, tests: [...f.tests, { test_name: '', test_code: '' }] }));
  const removeTestRow = (i) => setLabForm(f => ({ ...f, tests: f.tests.filter((_, idx) => idx !== i) }));
  const updateTest    = (i, field, val) => setLabForm(f => ({ ...f, tests: f.tests.map((t, idx) => idx === i ? { ...t, [field]: val } : t) }));

  const assignLabTest = async () => {
    const validTests = labForm.tests.filter(t => t.test_name.trim());
    if (!validTests.length) { setMsg('Enter at least one test name'); return; }
    setSaving(true);
    try {
      await api('/consultations/lab-orders', {
        method: 'POST',
        body: JSON.stringify({
          patient_id:     selected.patients?.id || selected.patient_id,
          doctor_id:      doctorId,
          appointment_id: selected.id,
          tests:          validTests,
          urgency:        labForm.urgency,
          notes:          labForm.notes || null,
        }),
      });
      setMsg(`${validTests.length} lab test${validTests.length > 1 ? 's' : ''} assigned — visible in the lab portal`);
      setShowLabForm(false);
      setLabForm({ tests: [{ test_name: '', test_code: '' }], urgency: 'normal', notes: '' });
      const pid = selected.patients?.id || selected.patient_id;
      if (pid) await loadPatientData(pid);
    } catch (e) { setMsg(e.message); } finally { setSaving(false); }
  };

  if (loading) return <div style={s.center}>Loading...</div>;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.h1}>Consultations</h1>
          <p style={s.sub}>Select an appointment to start or record a consultation</p>
        </div>
      </div>

      {msg && (
        <div style={s.info}>
          {msg}
          <button onClick={() => setMsg('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>×</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>
        {/* Appointments list */}
        <div style={s.card}>
          <h2 style={s.h2}>Appointments ({appointments.length})</h2>
          {appointments.length === 0 ? (
            <p style={s.empty}>No upcoming appointments.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {appointments.map(a => {
                const patName = `${a.patients?.first_name || ''} ${a.patients?.last_name || ''}`.trim() || '–';
                const badge   = STATUS_STYLE[a.status] || STATUS_STYLE.booked;
                return (
                  <div key={a.id} onClick={() => selectAppt(a)}
                    style={{ ...s.row, background: selected?.id === a.id ? '#f0f9ff' : '#f8fafc', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '.875rem', color: '#0f1f3d' }}>{patName}</div>
                        <div style={{ fontSize: '.75rem', color: '#64748b' }}>{a.appointment_date} {(a.appointment_time || '').slice(0, 5)}</div>
                      </div>
                      <span style={{ background: badge.bg, color: badge.text, padding: '2px 8px', borderRadius: 12, fontSize: '.7rem', fontWeight: 600 }}>{a.status}</span>
                    </div>
                    {a.reason && <div style={{ fontSize: '.75rem', color: '#475569', marginTop: 4 }}>Reason: {a.reason}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div>
          {!selected ? (
            <div style={{ ...s.card, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: '#94a3b8' }}>
              Select an appointment from the list
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Patient info + action buttons */}
              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={s.h2}>{`${selected.patients?.first_name || ''} ${selected.patients?.last_name || ''}`.trim() || '–'}</h2>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                      {[
                        ['Patient ID', selected.patients?.patient_uid || '–'],
                        ['Phone',      selected.patients?.phone || '–'],
                        ['Booking',    selected.booking_id || '–'],
                        ['Date',       selected.appointment_date],
                        ['Time',       (selected.appointment_time || '').slice(0, 5)],
                      ].map(([l, v]) => (
                        <div key={l}>
                          <div style={{ fontSize: '.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>{l}</div>
                          <div style={{ fontSize: '.875rem', fontWeight: 600, color: '#0f1f3d' }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                    {!showForm && ['booked', 'confirmed'].includes(selected.status) && (
                      <button onClick={() => { setShowForm(true); setShowLabForm(false); setShowFollowUp(false); }} style={s.btnPri}>+ Start Consultation</button>
                    )}
                    <button onClick={() => { setShowLabForm(v => !v); setShowForm(false); setShowFollowUp(false); }}
                      style={{ ...s.btnSec, borderColor: showLabForm ? '#00b4a0' : undefined, color: showLabForm ? '#00b4a0' : undefined }}>
                      🧪 Assign Lab Test
                    </button>
                    <button onClick={() => { setShowFollowUp(v => !v); setShowForm(false); setShowLabForm(false); }}
                      style={{ ...s.btnSec, borderColor: showFollowUp ? '#7c3aed' : undefined, color: showFollowUp ? '#7c3aed' : undefined }}>
                      📅 Schedule Follow-up
                    </button>
                  </div>
                </div>
              </div>

              {/* Consultation form */}
              {showForm && (
                <div style={s.card}>
                  <h2 style={s.h2}>Consultation Notes</h2>
                  <div style={s.grid2}>
                    {[['Chief Complaint *', 'chief_complaint'], ['Symptoms', 'symptoms'], ['Diagnosis', 'diagnosis'], ['Advice', 'advice']].map(([l, k]) => (
                      <div key={k}>
                        <label style={s.label}>{l}</label>
                        <textarea value={consult[k]} onChange={e => setConsult({ ...consult, [k]: e.target.value })}
                          style={{ ...s.input, height: 70, resize: 'vertical', width: '100%' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={s.label}>Notes</label>
                    <textarea value={consult.notes} onChange={e => setConsult({ ...consult, notes: e.target.value })}
                      style={{ ...s.input, height: 60, width: '100%', resize: 'vertical' }} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '.875rem', fontWeight: 600, color: '#475569', marginBottom: 10 }}>
                      <input type="checkbox" checked={consult.follow_up_required}
                        onChange={e => setConsult({ ...consult, follow_up_required: e.target.checked, follow_up_date: '' })} />
                      Schedule Follow-up Visit
                    </label>
                    {consult.follow_up_required && (
                      <div style={{ paddingLeft: 24 }}>
                        <div style={{ fontSize: '.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Quick select</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                          {[
                            { label: '1 Week',   months: 0, weeks: 1 },
                            { label: '2 Weeks',  months: 0, weeks: 2 },
                            { label: '1 Month',  months: 1, weeks: 0 },
                            { label: '2 Months', months: 2, weeks: 0 },
                            { label: '3 Months', months: 3, weeks: 0 },
                            { label: '6 Months', months: 6, weeks: 0 },
                          ].map(opt => {
                            const d = new Date();
                            if (opt.weeks) d.setDate(d.getDate() + opt.weeks * 7);
                            else d.setMonth(d.getMonth() + opt.months);
                            const val = d.toISOString().split('T')[0];
                            return (
                              <button key={opt.label} onClick={() => setConsult(c => ({ ...c, follow_up_date: val }))}
                                style={{ padding: '5px 14px', borderRadius: 20, border: `1.5px solid ${consult.follow_up_date === val ? '#00b4a0' : '#e2e8f0'}`, background: consult.follow_up_date === val ? '#f0fdfb' : '#fff', color: consult.follow_up_date === val ? '#0f766e' : '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '.78rem' }}>
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '.78rem', color: '#94a3b8' }}>Or pick a date:</span>
                          <input type="date" value={consult.follow_up_date}
                            onChange={e => setConsult({ ...consult, follow_up_date: e.target.value })}
                            style={{ ...s.input, width: 180 }} />
                        </div>
                        {consult.follow_up_date && (
                          <div style={{ marginTop: 8, fontSize: '.8rem', color: '#00b4a0', fontWeight: 600 }}>
                            ✓ Follow-up scheduled for {new Date(consult.follow_up_date).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                            — patient & lab will be reminded 3 days, 2 days, and 1 day before
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={saveConsultation} disabled={saving} style={s.btnPri}>{saving ? 'Saving...' : 'Save Consultation'}</button>
                    <button onClick={() => setShowForm(false)} style={s.btnSec}>Cancel</button>
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
                      <div key={i} style={{ marginBottom: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        {/* Catalog quick-fill */}
                        {testCatalog.length > 0 && (
                          <select
                            defaultValue=""
                            onChange={e => {
                              const ct = testCatalog.find(c => c.id === e.target.value);
                              if (ct) setLabForm(f => ({ ...f, tests: f.tests.map((t2, idx) => idx === i ? { ...t2, test_name: ct.test_name, test_code: ct.test_code || '' } : t2) }));
                              e.target.value = '';
                            }}
                            style={{ ...s.input, marginBottom: 6, color: '#475569' }}>
                            <option value="">📋 Select from common tests (optional)…</option>
                            {testCatalog.map(c => (
                              <option key={c.id} value={c.id}>{c.test_name}{c.test_code ? ` — ${c.test_code}` : ''}</option>
                            ))}
                          </select>
                        )}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input value={t.test_name} onChange={e => updateTest(i, 'test_name', e.target.value)}
                            placeholder="Test name (e.g. CBC, LFT, Lipid Panel)"
                            style={{ ...s.input, flex: 2 }} />
                          <input value={t.test_code} onChange={e => updateTest(i, 'test_code', e.target.value)}
                            placeholder="Code (optional)"
                            style={{ ...s.input, flex: 1 }} />
                          {labForm.tests.length > 1 && (
                            <button onClick={() => removeTestRow(i)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem', padding: '0 4px' }}>×</button>
                          )}
                        </div>
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
                          style={{ padding: '6px 18px', borderRadius: 20, border: `1.5px solid ${labForm.urgency === u ? (u === 'urgent' ? '#ef4444' : '#00b4a0') : '#e2e8f0'}`, background: labForm.urgency === u ? (u === 'urgent' ? '#fee2e2' : '#f0fdfb') : '#fff', color: labForm.urgency === u ? (u === 'urgent' ? '#b91c1c' : '#0f766e') : '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '.8rem' }}>
                          {u === 'urgent' ? '⚡ Urgent' : '✓ Normal'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={s.label}>Instructions for Lab</label>
                    <textarea value={labForm.notes} onChange={e => setLabForm(f => ({ ...f, notes: e.target.value }))}
                      style={{ ...s.input, height: 60, width: '100%', resize: 'vertical' }}
                      placeholder="Special instructions for the lab..." />
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={assignLabTest} disabled={saving} style={s.btnPri}>
                      {saving ? 'Assigning...' : 'Assign Test'}
                    </button>
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
                            style={{ padding: '6px 16px', borderRadius: 20, border: `1.5px solid ${followUpDate === val ? '#7c3aed' : '#e2e8f0'}`, background: followUpDate === val ? '#f5f3ff' : '#fff', color: followUpDate === val ? '#7c3aed' : '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '.82rem' }}>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom date */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={s.label}>Or Pick a Specific Date</label>
                    <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                      style={{ ...s.input, width: 220, marginTop: 6 }} min={new Date().toISOString().split('T')[0]} />
                  </div>

                  {followUpDate && (
                    <div style={{ marginBottom: 14, padding: '10px 14px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, fontSize: '.875rem', color: '#7c3aed', fontWeight: 600 }}>
                      📅 {new Date(followUpDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      <div style={{ fontSize: '.78rem', fontWeight: 400, color: '#6d28d9', marginTop: 4 }}>
                        Patient will be reminded 3 days, 2 days, and 1 day before this date.
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={s.label}>Notes for Patient (optional)</label>
                    <textarea value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)}
                      style={{ ...s.input, height: 60, width: '100%', resize: 'vertical', marginTop: 6 }}
                      placeholder="e.g. Bring previous reports, fasting required..." />
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={scheduleFollowUp} disabled={saving || !followUpDate} style={{ ...s.btnPri, background: '#7c3aed' }}>
                      {saving ? 'Scheduling...' : 'Confirm Follow-up'}
                    </button>
                    <button onClick={() => setShowFollowUp(false)} style={s.btnSec}>Cancel</button>
                  </div>
                </div>
              )}

              {/* ── Existing Lab Orders ── */}
              {labOrders.length > 0 && (
                <div style={s.card}>
                  <h2 style={s.h2}>Lab Orders ({labOrders.length})</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {labOrders.map(o => {
                      const c = LAB_STATUS_COLOR[o.status] || '#94a3b8';
                      const reports = o.lab_reports || [];
                      return (
                        <div key={o.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc' }}>
                            <div>
                              <span style={{ fontWeight: 600, fontSize: '.875rem', color: '#0f1f3d' }}>{o.test_name}</span>
                              {o.test_code && <span style={{ fontSize: '.75rem', color: '#64748b', marginLeft: 6 }}>{o.test_code}</span>}
                              <div style={{ fontSize: '.75rem', color: '#64748b', marginTop: 2 }}>{new Date(o.ordered_at).toLocaleString('en-IN')}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              {o.urgency === 'urgent' && (
                                <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '.7rem', padding: '1px 7px', borderRadius: 8, fontWeight: 700 }}>URGENT</span>
                              )}
                              <span style={{ background: c + '20', color: c, fontSize: '.72rem', padding: '3px 10px', borderRadius: 10, fontWeight: 600, textTransform: 'capitalize' }}>
                                {(o.status || '').replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>
                          {reports.length > 0 ? reports.map(r => (
                            <div key={r.id} style={{ padding: '10px 14px', borderTop: '1px solid #e2e8f0', background: '#fff' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <span style={{ fontSize: '.78rem', color: '#64748b' }}>Report — {new Date(r.uploaded_at || r.created_at).toLocaleDateString('en-IN')}</span>
                                <span style={{ background: r.is_normal ? '#dcfce7' : '#fee2e2', color: r.is_normal ? '#166534' : '#b91c1c', fontSize: '.72rem', padding: '2px 10px', borderRadius: 10, fontWeight: 700 }}>
                                  {r.is_normal ? 'Normal' : 'Abnormal'}
                                </span>
                              </div>
                              {r.findings && <div style={{ fontSize: '.84rem', color: '#334155', background: '#f8fafc', padding: '8px 10px', borderRadius: 6, marginBottom: 6 }}>{r.findings}</div>}
                              {r.remarks  && <div style={{ fontSize: '.8rem', color: '#475569', fontStyle: 'italic' }}>{r.remarks}</div>}
                              {r.report_url && (
                                <a href={r.report_url} target="_blank" rel="noopener noreferrer"
                                  style={{ display: 'inline-block', marginTop: 6, padding: '.35rem .9rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: '.78rem', fontWeight: 600, textDecoration: 'none' }}>
                                  Download Report ↓
                                </a>
                              )}
                            </div>
                          )) : (
                            <div style={{ padding: '8px 14px', borderTop: '1px solid #f1f5f9', fontSize: '.8rem', color: '#94a3b8' }}>Report pending</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Previous visits */}
              <div style={s.card}>
                <h2 style={s.h2}>Previous Visits</h2>
                {history.length === 0 ? (
                  <p style={s.empty}>No previous visits</p>
                ) : history.slice(0, 5).map(h => (
                  <div key={h.id} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, fontSize: '.875rem' }}>{h.consultation_date}</span>
                      <span style={{ fontSize: '.75rem', color: '#64748b' }}>{h.consultation_status}</span>
                    </div>
                    {h.chief_complaint && <div style={{ fontSize: '.8rem', color: '#475569', marginTop: 2 }}><strong>CC:</strong> {h.chief_complaint}</div>}
                    {h.diagnosis       && <div style={{ fontSize: '.8rem', color: '#475569' }}><strong>Dx:</strong> {h.diagnosis}</div>}
                  </div>
                ))}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  page:   { padding: '2rem', maxWidth: 1300, margin: '0 auto' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#64748b' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  h1:     { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2:     { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', marginBottom: 12 },
  sub:    { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  card:   { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  row:    { borderRadius: 10, padding: '10px 12px', border: '1px solid #e2e8f0' },
  grid2:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 },
  label:  { display: 'block', fontSize: '.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 },
  input:  { padding: '.6rem .9rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem', boxSizing: 'border-box' },
  btnPri: { padding: '.6rem 1.2rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem' },
  btnSec: { padding: '.6rem 1rem', background: '#f1f5f9', color: '#0f1f3d', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem' },
  info:   { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.875rem', marginBottom: 16, display: 'flex', alignItems: 'center' },
  empty:  { color: '#94a3b8', fontSize: '.875rem', textAlign: 'center', padding: '1rem 0' },
};
