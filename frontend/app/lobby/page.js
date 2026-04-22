'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function LobbyDisplay() {
  const [doctors, setDoctors]           = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [called, setCalled]             = useState([]);
  const [waiting, setWaiting]           = useState([]);
  const [totalWaiting, setTotalWaiting] = useState(0);
  const [lastUpdated, setLastUpdated]   = useState(null);

  // Load doctor list once
  useEffect(() => {
    api('/doctors').then(d => {
      const docs = d.doctors || d || [];
      setDoctors(docs);
    }).catch(console.error);
  }, []);

  const loadLobby = async () => {
    try {
      const qs = selectedDoctor ? `?doctor_id=${selectedDoctor}` : '';
      const data = await api(`/queue/lobby${qs}`);
      setCalled(data.called || []);
      setWaiting(data.waiting || []);
      setTotalWaiting(data.total_waiting || 0);
      setLastUpdated(new Date().toLocaleTimeString('en-IN'));
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    loadLobby();
    const interval = setInterval(loadLobby, 8000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctor]);

  const doctorLabel = () => {
    if (!selectedDoctor) return null;
    const d = doctors.find(doc => doc.id === selectedDoctor);
    if (!d) return null;
    const name = `${d.users?.first_name || ''} ${d.users?.last_name || ''}`.trim() || d.users?.name || 'Doctor';
    return `Dr. ${name}${d.specialization ? ` — ${d.specialization}` : ''}`;
  };

  return (
    <div style={ls.page}>
      {/* Header */}
      <div style={ls.header}>
        <div style={ls.logo}>
          <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
            <rect x="9" y="2" width="6" height="6" rx="1" fill="#00b4a0" opacity=".9"/>
            <rect x="9" y="16" width="6" height="6" rx="1" fill="#00b4a0" opacity=".9"/>
            <rect x="2" y="9" width="6" height="6" rx="1" fill="white" opacity=".6"/>
            <rect x="16" y="9" width="6" height="6" rx="1" fill="white" opacity=".6"/>
            <rect x="10" y="10" width="4" height="4" rx=".5" fill="#fff"/>
          </svg>
          <span style={ls.logoText}>CareOpsX</span>
        </div>
        <div style={ls.headerCenter}>
          <div style={ls.headerTitle}>PATIENT TOKEN DISPLAY</div>
          <div style={ls.headerDate}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          {doctorLabel() && (
            <div style={ls.doctorPill}>{doctorLabel()}</div>
          )}
        </div>
        <div style={ls.headerRight}>
          <div style={ls.waitingCount}>{totalWaiting}</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem' }}>Waiting</div>
        </div>
      </div>

      {/* Doctor Filter Bar */}
      <div style={ls.filterBar}>
        <span style={ls.filterLabel}>Select Doctor:</span>
        <div style={ls.filterButtons}>
          <button
            onClick={() => setSelectedDoctor('')}
            style={{ ...ls.filterBtn, ...(selectedDoctor === '' ? ls.filterBtnActive : {}) }}
          >
            All Doctors
          </button>
          {doctors.map(d => {
            const name = `${d.users?.first_name || ''} ${d.users?.last_name || ''}`.trim() || d.users?.name || 'Doctor';
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDoctor(d.id)}
                style={{ ...ls.filterBtn, ...(selectedDoctor === d.id ? ls.filterBtnActive : {}) }}
              >
                Dr. {name}
                {d.specialization && <span style={ls.specTag}>{d.specialization}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Now Calling */}
      <div style={ls.section}>
        <div style={ls.sectionTitle}>NOW CALLING</div>
        {called.length === 0 ? (
          <div style={ls.noCall}>Waiting for next patient...</div>
        ) : (
          <div style={ls.calledGrid}>
            {called.map(t => (
              <div key={t.id} style={ls.calledCard}>
                <div style={ls.tokenBig}>#{t.token_number}</div>
                <div style={ls.patientName}>{t.patients?.first_name} {t.patients?.last_name}</div>
                <div style={ls.roomTag}>
                  <span style={ls.roomIcon}>🚪</span>
                  Room {t.doctors?.room_number || 'OPD'}
                </div>
                <div style={ls.pleaseTag}>PLEASE PROCEED</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Waiting Queue */}
      {waiting.length > 0 && (
        <div style={ls.section}>
          <div style={ls.sectionTitle}>UPCOMING</div>
          <div style={ls.waitingGrid}>
            {waiting.slice(0, 10).map((t, i) => (
              <div key={t.id} style={{ ...ls.waitingCard, opacity: i === 0 ? 1 : 0.75 - i * 0.06 }}>
                <span style={ls.waitToken}>#{t.token_number}</span>
                <span style={ls.waitName}>{t.patients?.first_name} {t.patients?.last_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={ls.footer}>
        <span>Auto-refreshes every 8 seconds</span>
        <span>Last updated: {lastUpdated}</span>
        <span>Please wait for your token to be called</span>
      </div>
    </div>
  );
}

const ls = {
  page:            { minHeight: '100vh', background: '#0a1628', color: '#fff', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column' },
  header:          { background: '#0f1f3d', padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #00b4a0' },
  logo:            { display: 'flex', alignItems: 'center', gap: 12 },
  logoText:        { fontSize: '1.5rem', fontWeight: 800, color: '#00b4a0' },
  headerCenter:    { textAlign: 'center' },
  headerTitle:     { fontSize: '1.8rem', fontWeight: 900, letterSpacing: '0.1em', color: '#fff' },
  headerDate:      { fontSize: '1rem', color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  doctorPill:      { marginTop: 6, display: 'inline-block', background: 'rgba(0,180,160,0.2)', border: '1px solid rgba(0,180,160,0.4)', borderRadius: 20, padding: '3px 14px', fontSize: '.85rem', color: '#00b4a0', fontWeight: 600 },
  headerRight:     { textAlign: 'center' },
  waitingCount:    { fontSize: '3rem', fontWeight: 900, color: '#00b4a0', lineHeight: 1 },
  filterBar:       { background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  filterLabel:     { fontSize: '.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  filterButtons:   { display: 'flex', gap: 10, flexWrap: 'wrap' },
  filterBtn:       { padding: '.45rem 1.1rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', borderRadius: 20, cursor: 'pointer', fontSize: '.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s' },
  filterBtnActive: { background: 'rgba(0,180,160,0.2)', border: '1px solid #00b4a0', color: '#00b4a0', fontWeight: 700 },
  specTag:         { background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '1px 8px', fontSize: '.72rem', color: 'rgba(255,255,255,0.5)' },
  section:         { padding: '2rem 3rem' },
  sectionTitle:    { fontSize: '.85rem', fontWeight: 700, letterSpacing: '0.15em', color: '#00b4a0', marginBottom: '1.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  noCall:          { fontSize: '1.5rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '3rem 0' },
  calledGrid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' },
  calledCard:      { background: 'linear-gradient(135deg, #0f2a4a, #1a3a6b)', border: '2px solid #00b4a0', borderRadius: '16px', padding: '2rem', textAlign: 'center', boxShadow: '0 0 30px rgba(0,180,160,0.2)' },
  tokenBig:        { fontSize: '4rem', fontWeight: 900, color: '#00b4a0', lineHeight: 1, marginBottom: '0.75rem' },
  patientName:     { fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' },
  roomTag:         { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,180,160,0.15)', border: '1px solid rgba(0,180,160,0.3)', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '1.1rem', marginBottom: '1rem' },
  roomIcon:        { fontSize: '1.2rem' },
  pleaseTag:       { background: '#00b4a0', color: '#fff', borderRadius: 20, padding: '0.4rem 1.2rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', display: 'inline-block' },
  waitingGrid:     { display: 'flex', flexWrap: 'wrap', gap: '1rem' },
  waitingCard:     { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12 },
  waitToken:       { fontSize: '1.3rem', fontWeight: 800, color: '#94a3b8' },
  waitName:        { fontSize: '1rem', color: 'rgba(255,255,255,0.7)' },
  footer:          { marginTop: 'auto', background: 'rgba(255,255,255,0.03)', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', fontSize: '.8rem', color: 'rgba(255,255,255,0.4)', borderTop: '1px solid rgba(255,255,255,0.08)' },
};
