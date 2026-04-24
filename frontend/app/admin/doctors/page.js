'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { T } from '../layout';

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const initialDoctorForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  password: '',
  specialization: '',
  consultation_fee: '',
  experience: '',
};

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingDoctor, setSavingDoctor] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState(initialDoctorForm);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // doctor to delete
  const [deletingId, setDeletingId] = useState(null);
  const [apptBlock, setApptBlock] = useState(null); // { doctor, appointments } when 409

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDoctor, setActiveDoctor] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [availability, setAvailability] = useState({
    working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    start_time: '09:00',
    end_time: '17:00',
    slot_duration: 30,
  });

  const loadDoctors = async () => {
    setLoading(true);
    try {
      const res = await api('/doctors');
      setDoctors(res.doctors || []);
    } catch (err) {
      console.error(err.message);
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
    api('/admin/specializations').then(r => setSpecializations((r.specializations || []).filter(s => s.is_active)));
  }, []);

  const doctorName = (doctor) => {
    const first = doctor?.users?.first_name || '';
    const last = doctor?.users?.last_name || '';
    const composed = `${first} ${last}`.trim();
    return composed || doctor?.users?.name || 'Doctor';
  };

  const onCreateDoctor = async (e) => {
    e.preventDefault();
    setFormError('');
    setSavingDoctor(true);

    try {
      const registerRes = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          password: form.password,
          role_id: 2,
        }),
      });

      const userId = registerRes?.user?.id;
      if (!userId) throw new Error('Doctor user account was created but user ID is missing');

      await api('/doctors', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          specialization: form.specialization.trim(),
          consultation_fee: Number(form.consultation_fee),
          experience: form.experience ? Number(form.experience) : null,
        }),
      });

      setShowAddModal(false);
      setForm(initialDoctorForm);
      await loadDoctors();
    } catch (err) {
      setFormError(err.message || 'Could not create doctor');
    } finally {
      setSavingDoctor(false);
    }
  };

  const onDeleteDoctor = async () => {
    if (!deleteConfirm) return;
    setDeletingId(deleteConfirm.id);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/doctors/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.status === 409) {
        const body = await res.json();
        setApptBlock({ doctor: deleteConfirm, appointments: body.appointments || [] });
        setDeleteConfirm(null);
        return;
      }
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || 'Failed to delete'); }
      setDeleteConfirm(null);
      await loadDoctors();
    } catch (err) {
      alert(err.message || 'Failed to delete doctor');
    } finally {
      setDeletingId(null);
    }
  };

  const cancelAppt = async (apptId) => {
    try {
      await api(`/appointments/${apptId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) });
      setApptBlock(prev => prev ? { ...prev, appointments: prev.appointments.filter(a => a.id !== apptId) } : null);
    } catch (err) {
      alert(err.message || 'Failed to cancel appointment');
    }
  };

  const openAvailabilityDrawer = async (doctor) => {
    setActiveDoctor(doctor);
    setDrawerOpen(true);
    setAvailabilityError('');
    setAvailabilityLoading(true);

    try {
      const res = await api(`/doctors/${doctor.id}/availability`);
      const row = res.data;
      if (row) {
        setAvailability({
          working_days: Array.isArray(row.working_days) ? row.working_days : [],
          start_time: row.start_time || '09:00',
          end_time: row.end_time || '17:00',
          slot_duration: Number(row.slot_duration) || 30,
        });
      } else {
        setAvailability({
          working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          start_time: '09:00',
          end_time: '17:00',
          slot_duration: 30,
        });
      }
    } catch (err) {
      setAvailabilityError(err.message || 'Failed to load availability');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const toggleDay = (day) => {
    setAvailability((prev) => {
      const exists = prev.working_days.includes(day);
      return {
        ...prev,
        working_days: exists
          ? prev.working_days.filter((d) => d !== day)
          : [...prev.working_days, day],
      };
    });
  };

  const estimatedSlots = useMemo(() => {
    const [sh, sm] = String(availability.start_time || '00:00').split(':').map(Number);
    const [eh, em] = String(availability.end_time || '00:00').split(':').map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    const span = Math.max(end - start, 0);
    if (!availability.slot_duration || availability.slot_duration <= 0) return 0;
    return Math.floor(span / Number(availability.slot_duration));
  }, [availability.start_time, availability.end_time, availability.slot_duration]);

  const saveAvailability = async () => {
    if (!activeDoctor) return;

    setAvailabilitySaving(true);
    setAvailabilityError('');
    try {
      await api(`/doctors/${activeDoctor.id}/availability`, {
        method: 'POST',
        body: JSON.stringify({
          working_days: availability.working_days,
          start_time: availability.start_time,
          end_time: availability.end_time,
          slot_duration: Number(availability.slot_duration),
        }),
      });
      setDrawerOpen(false);
      setActiveDoctor(null);
    } catch (err) {
      setAvailabilityError(err.message || 'Failed to save availability');
    } finally {
      setAvailabilitySaving(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: T.display, color: T.navy, fontSize: 24 }}>Doctors</h1>
          <p style={{ margin: '4px 0 0', color: T.muted, fontSize: 13 }}>Card view for specialties, fees, and availability setup</p>
        </div>
        <button
          onClick={() => {
            setFormError('');
            setShowAddModal(true);
          }}
          style={{ border: 'none', background: T.teal, color: '#fff', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', fontWeight: 700 }}
        >
          + Add Doctor
        </button>
      </header>

      {loading ? (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, color: T.muted }}>Loading doctors...</div>
      ) : doctors.length === 0 ? (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, color: T.muted }}>No doctors added yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {doctors.map((doctor) => (
            <article key={doctor.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                <div>
                  <div style={{ color: T.navy, fontFamily: T.display, fontSize: 18, fontWeight: 700 }}>Dr. {doctorName(doctor)}</div>
                  <div style={{ color: T.muted, fontSize: 12 }}>{doctor.users?.email || '-'}</div>
                </div>
                <span style={{ background: '#ecfeff', color: '#0f766e', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '4px 9px' }}>
                  {doctor.specialization || 'General'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: T.muted }}>Consultation Fee</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.navy }}>Rs {doctor.consultation_fee ?? '-'}</div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: T.muted }}>Experience</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.navy }}>{doctor.experience_years ?? 0} yrs</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => openAvailabilityDrawer(doctor)}
                  style={{ flex: 1, border: `1px solid ${T.border}`, background: '#fff', color: T.text, borderRadius: 8, padding: '9px 11px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Availability
                </button>
                <button
                  onClick={() => setDeleteConfirm(doctor)}
                  style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: 8, padding: '9px 12px', cursor: 'pointer', fontWeight: 600 }}
                  title="Delete doctor"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.36)', display: 'grid', placeItems: 'center', zIndex: 30 }}>
          <form onSubmit={onCreateDoctor} style={{ width: 'min(720px, 95vw)', background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 16 }}>
            <h3 style={{ margin: 0, fontFamily: T.display, color: T.navy, fontSize: 21 }}>Add Doctor</h3>
            <p style={{ margin: '5px 0 12px', color: T.muted, fontSize: 13 }}>Step 1: create user (role 2). Step 2: attach doctor profile.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {[
                ['first_name', 'First Name', 'text'],
                ['last_name', 'Last Name', 'text'],
                ['email', 'Email', 'email'],
                ['phone', 'Phone', 'tel'],
                ['password', 'Password', 'password'],
                // specialization handled separately below
                ['consultation_fee', 'Consultation Fee', 'number'],
                ['experience', 'Experience (years)', 'number'],
              ].map(([key, label, type]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 12, color: T.muted, marginBottom: 4 }}>{label}</label>
                  <input
                    type={type}
                    required={['first_name', 'last_name', 'email', 'password', 'consultation_fee'].includes(key)}
                    min={type === 'number' ? 0 : undefined}
                    value={form[key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 10px', fontFamily: T.body }}
                  />
                </div>
              ))}
              {/* Specialization dropdown */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: T.muted, marginBottom: 4 }}>Specialization *</label>
                <select
                  required
                  value={form.specialization}
                  onChange={e => setForm(prev => ({ ...prev, specialization: e.target.value }))}
                  style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 10px', fontFamily: T.body, background: '#fff' }}
                >
                  <option value="">-- Select specialization --</option>
                  {specializations.map(sp => (
                    <option key={sp.id} value={sp.name}>{sp.name}</option>
                  ))}
                </select>
                {specializations.length === 0 && (
                  <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>No specializations configured. Add them in System Setup → Specializations.</div>
                )}
              </div>
            </div>

            {formError && (
              <div style={{ marginTop: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 10px', color: '#b91c1c', fontSize: 13 }}>
                {formError}
              </div>
            )}

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type='button' disabled={savingDoctor} onClick={() => setShowAddModal(false)} style={{ border: `1px solid ${T.border}`, background: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type='submit' disabled={savingDoctor} style={{ border: 'none', background: T.teal, color: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>
                {savingDoctor ? 'Saving...' : 'Create Doctor'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'grid', placeItems: 'center', zIndex: 40 }}>
          <div style={{ background: T.card, borderRadius: 14, padding: '28px 32px', width: 'min(420px, 92vw)', boxShadow: '0 24px 64px rgba(0,0,0,.18)' }}>
            <h3 style={{ margin: '0 0 8px', fontFamily: T.display, color: T.navy, fontSize: 18 }}>Delete Doctor</h3>
            <p style={{ margin: '0 0 20px', color: T.muted, fontSize: 14 }}>
              Are you sure you want to remove <strong>Dr. {doctorName(deleteConfirm)}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} disabled={!!deletingId}
                style={{ border: `1px solid ${T.border}`, background: '#fff', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontFamily: T.body }}>
                Cancel
              </button>
              <button onClick={onDeleteDoctor} disabled={!!deletingId}
                style={{ border: 'none', background: '#dc2626', color: '#fff', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontFamily: T.body, fontWeight: 600 }}>
                {deletingId ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {apptBlock && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', display: 'grid', placeItems: 'center', zIndex: 40 }}>
          <div style={{ background: T.card, borderRadius: 14, padding: '28px 32px', width: 'min(560px, 96vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.2)' }}>
            <h3 style={{ margin: '0 0 4px', fontFamily: T.display, color: T.navy, fontSize: 18 }}>Cannot Delete Doctor</h3>
            <p style={{ margin: '0 0 16px', color: T.muted, fontSize: 14 }}>
              <strong>Dr. {doctorName(apptBlock.doctor)}</strong> has {apptBlock.appointments.length} active appointment{apptBlock.appointments.length !== 1 ? 's' : ''}. Cancel them first, then delete.
            </p>
            {apptBlock.appointments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <p style={{ color: '#16a34a', fontWeight: 600, marginBottom: 16 }}>✓ All appointments cancelled. You can now delete this doctor.</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => setApptBlock(null)} style={{ border: `1px solid ${T.border}`, background: '#fff', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontFamily: T.body }}>Close</button>
                  <button onClick={() => { setDeleteConfirm(apptBlock.doctor); setApptBlock(null); }}
                    style={{ border: 'none', background: '#dc2626', color: '#fff', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontFamily: T.body, fontWeight: 600 }}>
                    Delete Doctor
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ overflowY: 'auto', flex: 1, borderRadius: 8, border: `1px solid ${T.border}` }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: T.bg }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily: T.display, color: T.navy, fontWeight: 600 }}>Patient</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily: T.display, color: T.navy, fontWeight: 600 }}>Date</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily: T.display, color: T.navy, fontWeight: 600 }}>Time</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily: T.display, color: T.navy, fontWeight: 600 }}>Status</th>
                        <th style={{ padding: '10px 14px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {apptBlock.appointments.map((a, i) => (
                        <tr key={a.id} style={{ borderTop: i === 0 ? 'none' : `1px solid ${T.border}` }}>
                          <td style={{ padding: '10px 14px', fontFamily: T.body, color: T.navy }}>{a.patient_name}</td>
                          <td style={{ padding: '10px 14px', color: T.muted }}>{a.appointment_date}</td>
                          <td style={{ padding: '10px 14px', color: T.muted }}>{a.appointment_time?.slice(0,5)}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ background: '#fef9c3', color: '#92400e', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>{a.status}</span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <button onClick={() => cancelAppt(a.id)}
                              style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                              Cancel
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                  <button onClick={() => setApptBlock(null)} style={{ border: `1px solid ${T.border}`, background: '#fff', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontFamily: T.body }}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.2)', zIndex: 25 }} onClick={() => setDrawerOpen(false)}>
          <aside
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'absolute', right: 0, top: 0, width: 'min(520px, 96vw)', height: '100vh', background: T.card, borderLeft: `1px solid ${T.border}`, padding: 16, overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontFamily: T.display, color: T.navy, fontSize: 20 }}>Availability</h3>
              <button onClick={() => setDrawerOpen(false)} style={{ border: `1px solid ${T.border}`, background: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>Close</button>
            </div>

            <p style={{ margin: '0 0 12px', color: T.muted, fontSize: 13 }}>
              {activeDoctor ? `Dr. ${doctorName(activeDoctor)}` : ''}
            </p>

            {availabilityLoading ? (
              <div style={{ color: T.muted }}>Loading availability...</div>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>Working Days</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {WEEK_DAYS.map((day) => {
                      const active = availability.working_days.includes(day);
                      return (
                        <button
                          type='button'
                          key={day}
                          onClick={() => toggleDay(day)}
                          style={{ border: `1px solid ${active ? T.teal : T.border}`, background: active ? '#ecfeff' : '#fff', color: active ? '#0f766e' : T.text, borderRadius: 999, fontSize: 12, padding: '6px 10px', cursor: 'pointer' }}
                        >
                          {day.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: T.muted, marginBottom: 4 }}>Start Time</label>
                    <input type='time' value={availability.start_time} onChange={(e) => setAvailability((prev) => ({ ...prev, start_time: e.target.value }))} style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 10px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: T.muted, marginBottom: 4 }}>End Time</label>
                    <input type='time' value={availability.end_time} onChange={(e) => setAvailability((prev) => ({ ...prev, end_time: e.target.value }))} style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 10px' }} />
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, color: T.muted, marginBottom: 4 }}>Slot Duration</label>
                  <select value={availability.slot_duration} onChange={(e) => setAvailability((prev) => ({ ...prev, slot_duration: Number(e.target.value) }))} style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 10px' }}>
                    {[10, 15, 20, 30, 45, 60].map((v) => (
                      <option key={v} value={v}>{v} minutes</option>
                    ))}
                  </select>
                </div>

                <div style={{ background: '#f8fafc', border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: T.muted }}>Estimated slots per day</div>
                  <div style={{ fontFamily: T.display, color: T.navy, fontSize: 28, fontWeight: 700 }}>{estimatedSlots}</div>
                </div>

                {availabilityError && (
                  <div style={{ marginBottom: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 10px', color: '#b91c1c', fontSize: 13 }}>
                    {availabilityError}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type='button' onClick={() => setDrawerOpen(false)} disabled={availabilitySaving} style={{ border: `1px solid ${T.border}`, background: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type='button' onClick={saveAvailability} disabled={availabilitySaving} style={{ border: 'none', background: T.teal, color: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>
                    {availabilitySaving ? 'Saving...' : 'Save Availability'}
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
