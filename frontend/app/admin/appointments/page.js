'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { T } from '../layout';

const STATUS_OPTIONS = ['', 'booked', 'confirmed', 'completed', 'cancelled', 'no_show'];

const STATUS_ACTIONS = {
  booked: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
};

const STATUS_STYLE = {
  booked: { bg: '#fef3c7', text: '#92400e' },
  confirmed: { bg: '#dbeafe', text: '#1e40af' },
  completed: { bg: '#dcfce7', text: '#166534' },
  cancelled: { bg: '#fee2e2', text: '#b91c1c' },
  no_show: { bg: '#e2e8f0', text: '#334155' },
};

const toLabel = (value) => value.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [date, setDate] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const [confirmModal, setConfirmModal] = useState(null);

  const loadDoctors = async () => {
    try {
      const res = await api('/doctors');
      setDoctors(res.doctors || []);
    } catch {
      setDoctors([]);
    }
  };

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (doctorId) params.append('doctor_id', doctorId);
      if (status) params.append('status', status);
      const qs = params.toString();
      const res = await api(`/appointments${qs ? `?${qs}` : ''}`);
      setAppointments(res.data || []);
    } catch (err) {
      console.error(err.message);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [date, doctorId, status]);

  const filteredAppointments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return appointments;

    return appointments.filter((a) => {
      const doctorName = `${a.doctors?.users?.first_name || ''} ${a.doctors?.users?.last_name || ''}`.trim() || a.doctors?.users?.name || '';
      const values = [
        a.booking_id,
        a.patients?.name,
        a.patients?.phone,
        doctorName,
        a.doctors?.specialization,
        a.appointment_date,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return values.includes(q);
    });
  }, [appointments, search]);

  const openConfirm = (appointment, nextStatus) => {
    setConfirmModal({ appointment, nextStatus });
  };

  const doStatusUpdate = async () => {
    if (!confirmModal) return;
    setActionLoading(true);
    try {
      await api(`/appointments/${confirmModal.appointment.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: confirmModal.nextStatus }),
      });
      setConfirmModal(null);
      loadAppointments();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <header style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, color: T.navy, fontFamily: T.display, fontSize: 24 }}>Appointments</h1>
        <p style={{ margin: '4px 0 0', color: T.muted, fontSize: 13 }}>Server filters + client search + controlled status transitions</p>
      </header>

      <section style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, marginBottom: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.3fr', gap: 10 }}>
        <input type='date' value={date} onChange={(e) => setDate(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', fontFamily: T.body }} />

        <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', fontFamily: T.body }}>
          <option value=''>All doctors</option>
          {doctors.map((d) => {
            const name = `${d.users?.first_name || ''} ${d.users?.last_name || ''}`.trim() || d.users?.name || 'Doctor';
            return <option key={d.id} value={d.id}>Dr. {name}</option>;
          })}
        </select>

        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', fontFamily: T.body }}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s || 'all'} value={s}>{s ? toLabel(s) : 'All statuses'}</option>
          ))}
        </select>

        <input
          type='text'
          placeholder='Search booking, patient, doctor...'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', fontFamily: T.body }}
        />
      </section>

      <section style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 22, color: T.muted }}>Loading appointments...</div>
        ) : filteredAppointments.length === 0 ? (
          <div style={{ padding: 22, color: T.muted }}>No appointments found for selected filters.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Booking', 'Date', 'Patient', 'Doctor', 'Status', 'Actions'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 12, color: T.muted, padding: '11px 14px', borderBottom: `1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((a) => {
                  const doctorName = `${a.doctors?.users?.first_name || ''} ${a.doctors?.users?.last_name || ''}`.trim() || a.doctors?.users?.name || 'Doctor';
                  const actions = STATUS_ACTIONS[a.status] || [];
                  const badge = STATUS_STYLE[a.status] || { bg: '#e2e8f0', text: '#334155' };

                  return (
                    <tr key={a.id}>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}`, fontFamily: 'monospace', fontSize: 12 }}>{a.booking_id || '-'}</td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                        {a.appointment_date}<br />
                        <span style={{ color: T.muted }}>{(a.appointment_time || '').slice(0, 5)}</span>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                        {a.patients?.name || '-'}
                        <div style={{ color: T.muted, fontSize: 12 }}>{a.patients?.phone || '-'}</div>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                        Dr. {doctorName}
                        <div style={{ color: T.muted, fontSize: 12 }}>{a.doctors?.specialization || '-'}</div>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}` }}>
                        <span style={{ background: badge.bg, color: badge.text, fontSize: 12, fontWeight: 700, borderRadius: 999, padding: '4px 10px' }}>
                          {toLabel(a.status || 'booked')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}` }}>
                        {actions.length === 0 ? (
                          <span style={{ color: T.muted }}>�</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {actions.map((nextStatus) => (
                              <button
                                key={nextStatus}
                                onClick={() => openConfirm(a, nextStatus)}
                                style={{ border: `1px solid ${T.border}`, background: '#fff', color: T.text, borderRadius: 8, padding: '5px 9px', fontSize: 12, cursor: 'pointer' }}
                              >
                                {toLabel(nextStatus)}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.38)', display: 'grid', placeItems: 'center', zIndex: 20 }}>
          <div style={{ width: 'min(480px, 92vw)', background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 18 }}>
            <h3 style={{ margin: 0, color: T.navy, fontFamily: T.display, fontSize: 20 }}>Confirm Status Change</h3>
            <p style={{ margin: '10px 0 14px', color: T.muted, fontSize: 14 }}>
              Move booking <b>{confirmModal.appointment.booking_id || confirmModal.appointment.id}</b> to <b>{toLabel(confirmModal.nextStatus)}</b>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setConfirmModal(null)} disabled={actionLoading} style={{ border: `1px solid ${T.border}`, background: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={doStatusUpdate} disabled={actionLoading} style={{ border: 'none', background: T.teal, color: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>
                {actionLoading ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
