'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

const STATUS_COLORS = { waiting: '#f59e0b', called: '#3b82f6', in_consultation: '#8b5cf6', completed: '#10b981', missed: '#ef4444' };
const PRIORITY_LABEL = { emergency: '🚨 Emergency', urgent: '⚡ Urgent', normal: '' };

export default function QueuePage() {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [queue, setQueue] = useState([]);
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [priority, setPriority] = useState('normal');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api('/doctors').then(d => setDoctors(d.doctors || d || [])).catch(() => {});
  }, []);

  const loadQueue = useCallback(async () => {
    if (!selectedDoctor) return;
    try {
      const data = await api(`/queue/live/${selectedDoctor}`);
      setQueue(data.queue || []);
    } catch (e) { console.error(e); }
  }, [selectedDoctor]);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 10000);
    return () => clearInterval(interval);
  }, [loadQueue]);

  const searchPatients = async () => {
    if (!patientSearch) return;
    try {
      const data = await api(`/patients?search=${patientSearch}&limit=5`);
      setPatients(data.patients || []);
    } catch (e) { console.error(e); }
  };

  const generateToken = async () => {
    if (!selectedPatient || !selectedDoctor) { setMsg('Select patient and doctor'); return; }
    setLoading(true);
    try {
      await api('/queue/token', { method: 'POST', body: JSON.stringify({ patient_id: selectedPatient.id, doctor_id: selectedDoctor, priority }) });
      setMsg(`Token generated for ${selectedPatient.first_name} ${selectedPatient.last_name}`);
      setSelectedPatient(null);
      setPatientSearch('');
      setPatients([]);
      await loadQueue();
    } catch (e) { setMsg(e.message); } finally { setLoading(false); }
  };

  const updateStatus = async (tokenId, status) => {
    try {
      await api(`/queue/token/${tokenId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await loadQueue();
    } catch (e) { setMsg(e.message); }
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.h1}>Queue Management</h1>
        <a href="/lobby" target="_blank" style={s.btnSec}>Open Lobby Display ↗</a>
      </div>

      {msg && <div style={s.info}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>
        {/* Token Generation Panel */}
        <div style={s.card}>
          <h2 style={s.h2}>Generate Token</h2>
          <div style={s.fg}>
            <label style={s.label}>Select Doctor</label>
            <select value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)} style={s.input}>
              <option value="">-- Choose Doctor --</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.users?.first_name || d.name} ({d.specialization})</option>)}
            </select>
          </div>
          <div style={s.fg}>
            <label style={s.label}>Search Patient</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={patientSearch} onChange={e => setPatientSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchPatients()} style={{ ...s.input, flex: 1 }} placeholder="Name, phone, or ID" />
              <button onClick={searchPatients} style={s.btnSm}>Search</button>
            </div>
          </div>
          {patients.length > 0 && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
              {patients.map(p => (
                <div key={p.id} onClick={() => { setSelectedPatient(p); setPatients([]); setPatientSearch(`${p.first_name} ${p.last_name}`); }}
                  style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: selectedPatient?.id === p.id ? '#f0fdf4' : '#fff' }}>
                  <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{p.first_name} {p.last_name}</div>
                  <div style={{ fontSize: '.75rem', color: '#64748b' }}>{p.patient_uid} • {p.phone}</div>
                </div>
              ))}
            </div>
          )}
          {selectedPatient && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: '.875rem', color: '#065f46' }}>✓ {selectedPatient.first_name} {selectedPatient.last_name}</div>
              <div style={{ fontSize: '.75rem', color: '#065f46' }}>{selectedPatient.patient_uid} • {selectedPatient.phone}</div>
            </div>
          )}
          <div style={s.fg}>
            <label style={s.label}>Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value)} style={s.input}>
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <button onClick={generateToken} disabled={loading} style={{ ...s.btnPri, width: '100%', opacity: loading ? .6 : 1 }}>
            {loading ? 'Generating...' : 'Generate Token'}
          </button>
        </div>

        {/* Live Queue */}
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ ...s.h2, margin: 0 }}>Live Queue {selectedDoctor && <span style={{ fontSize: '.75rem', color: '#64748b', fontWeight: 400 }}>({queue.length} patients)</span>}</h2>
            <button onClick={loadQueue} style={s.btnSm}>↻ Refresh</button>
          </div>
          {!selectedDoctor ? (
            <p style={s.empty}>Select a doctor to see queue</p>
          ) : queue.length === 0 ? (
            <p style={s.empty}>No patients in queue</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {queue.map(t => (
                <div key={t.id} style={{ ...s.tokenCard, borderLeft: `4px solid ${STATUS_COLORS[t.status] || '#e2e8f0'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: STATUS_COLORS[t.status] || '#94a3b8', minWidth: 48 }}>#{t.token_number}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '.9rem' }}>{t.patients?.first_name} {t.patients?.last_name}
                        {PRIORITY_LABEL[t.priority] && <span style={{ marginLeft: 8, fontSize: '.75rem' }}>{PRIORITY_LABEL[t.priority]}</span>}
                      </div>
                      <div style={{ fontSize: '.75rem', color: '#64748b' }}>{t.patients?.patient_uid} • {t.patients?.phone}</div>
                    </div>
                    <span style={{ background: STATUS_COLORS[t.status] + '20', color: STATUS_COLORS[t.status], padding: '3px 10px', borderRadius: 20, fontSize: '.75rem', fontWeight: 600 }}>{t.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    {t.status === 'waiting' && <button onClick={() => updateStatus(t.id, 'called')} style={s.actBtn}>Call</button>}
                    {t.status === 'called' && <button onClick={() => updateStatus(t.id, 'in_consultation')} style={s.actBtn}>In Room</button>}
                    {t.status !== 'completed' && t.status !== 'missed' && <button onClick={() => updateStatus(t.id, 'missed')} style={{ ...s.actBtn, background: '#fef2f2', color: '#dc2626' }}>Missed</button>}
                    {t.status === 'missed' && <button onClick={() => updateStatus(t.id, 'waiting')} style={s.actBtn}>Recall</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { padding: '2rem', maxWidth: 1200, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  h1: { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2: { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', marginBottom: 16 },
  card: { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  tokenCard: { background: '#f8fafc', borderRadius: 10, padding: '12px 14px', border: '1px solid #e2e8f0' },
  fg: { marginBottom: 12 },
  label: { display: 'block', fontSize: '.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 },
  input: { width: '100%', padding: '.6rem .9rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem', boxSizing: 'border-box' },
  btnPri: { padding: '.7rem 1.2rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem' },
  btnSec: { padding: '.5rem 1rem', background: '#f1f5f9', color: '#0f1f3d', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem', textDecoration: 'none' },
  btnSm: { padding: '.5rem .9rem', background: '#0f1f3d', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem', whiteSpace: 'nowrap' },
  actBtn: { padding: '4px 12px', background: '#f0fdf4', color: '#065f46', border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 },
  info: { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.875rem', marginBottom: 16 },
  empty: { color: '#94a3b8', fontSize: '.875rem', padding: '2rem 0', textAlign: 'center' },
};
