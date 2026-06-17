'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

const DEFAULT_SETTINGS = {
  voice_enabled: true, voice_name: null, voice_lang: 'en-IN', voice_gender: 'female',
  volume: 1, rate: 1, pitch: 1, repeat_count: 3, repeat_interval_sec: 10,
  announce_template: 'Attention please. Token number {token}, {name}, please proceed to {doctor}, consultation room {room}.',
};

export default function LobbyDisplay() {
  const [doctors, setDoctors]           = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [called, setCalled]             = useState([]);
  const [waiting, setWaiting]           = useState([]);
  const [totalWaiting, setTotalWaiting] = useState(0);
  const [lastUpdated, setLastUpdated]   = useState(null);
  const [settings, setSettings]         = useState(DEFAULT_SETTINGS);
  const [soundOn, setSoundOn]           = useState(false);

  const spokenRef   = useRef(new Set());   // keys "tokenId:call_count" already announced
  const voicesRef   = useRef([]);
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const timersRef   = useRef([]);
  settingsRef.current = settings;

  // Load available TTS voices (async on some browsers).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const load = () => { voicesRef.current = window.speechSynthesis.getVoices() || []; };
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  const pickVoice = useCallback((s) => {
    const voices = voicesRef.current;
    if (!voices.length) return null;
    if (s.voice_name) { const v = voices.find(v => v.name === s.voice_name); if (v) return v; }
    const byLang = voices.filter(v => !s.voice_lang || v.lang?.toLowerCase().startsWith(s.voice_lang.slice(0, 2).toLowerCase()));
    const pool = byLang.length ? byLang : voices;
    // Gender hint: match common female/male voice name markers when possible.
    const want = (s.voice_gender || 'female').toLowerCase();
    const marked = pool.find(v => new RegExp(want === 'male' ? 'male|david|mark|ravi|google uk english male' : 'female|zira|samantha|google uk english female|heera', 'i').test(v.name));
    return marked || pool[0];
  }, []);

  const speakOnce = useCallback((text) => {
    const s = settingsRef.current;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(s);
    if (v) u.voice = v;
    u.lang   = s.voice_lang || 'en-IN';
    u.volume = Number(s.volume ?? 1);
    u.rate   = Number(s.rate ?? 1);
    u.pitch  = Number(s.pitch ?? 1);
    window.speechSynthesis.speak(u);
  }, [pickVoice]);

  const announce = useCallback((token) => {
    const s = settingsRef.current;
    if (!s.voice_enabled) return;
    const name = `${token.patients?.first_name || ''} ${token.patients?.last_name || ''}`.trim() || 'patient';
    const doctor = token.doctors?.users ? `Doctor ${token.doctors.users.first_name || ''} ${token.doctors.users.last_name || ''}`.trim() : 'the doctor';
    const room = token.doctors?.room_number || 'OPD';
    const text = (s.announce_template || DEFAULT_SETTINGS.announce_template)
      .replace('{token}', `${token.token_number}`).replace('{name}', name)
      .replace('{doctor}', doctor).replace('{room}', `${room}`);
    const reps = Math.max(1, Number(s.repeat_count || 1));
    const gap  = Math.max(2, Number(s.repeat_interval_sec || 10)) * 1000;
    speakOnce(text); // first, immediate
    for (let i = 1; i < reps; i++) {
      const id = setTimeout(() => speakOnce(text), gap * i);
      timersRef.current.push(id);
    }
  }, [speakOnce]);

  // Load doctor list once
  useEffect(() => {
    api('/doctors').then(d => {
      const docs = d.doctors || d || [];
      setDoctors(docs);
    }).catch(console.error);
  }, []);

  const loadLobby = useCallback(async () => {
    try {
      const qs = selectedDoctor ? `?doctor_id=${selectedDoctor}` : '';
      const data = await api(`/queue/lobby${qs}`);
      const calledList = data.called || [];
      setCalled(calledList);
      setWaiting(data.waiting || []);
      setTotalWaiting(data.total_waiting || 0);
      if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      setLastUpdated(new Date().toLocaleTimeString('en-IN'));

      // Announce any token whose (id:call_count) we haven't spoken yet.
      if (soundOn) {
        calledList.filter(t => t.status === 'called').forEach(t => {
          const key = `${t.id}:${t.call_count || 0}`;
          if (!spokenRef.current.has(key)) { spokenRef.current.add(key); announce(t); }
        });
      }
    } catch (e) { console.error(e); }
  }, [selectedDoctor, soundOn, announce]);

  useEffect(() => {
    loadLobby();
    const interval = setInterval(loadLobby, 5000);
    return () => { clearInterval(interval); timersRef.current.forEach(clearTimeout); };
  }, [loadLobby]);

  // Prime audio (browsers block speech until a user gesture).
  const enableSound = () => {
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0; window.speechSynthesis.speak(u);
      voicesRef.current = window.speechSynthesis.getVoices() || [];
    } catch { /* ignore */ }
    setSoundOn(true);
  };

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
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #1e3f85 0%, #13cfbd 100%)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
              <rect x="10.5" y="4" width="3" height="16" rx="1.5" fill="white"/>
              <rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="white"/>
            </svg>
          </div>
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
          {!soundOn ? (
            <button onClick={enableSound} style={ls.soundBtn}>🔊 Enable Sound</button>
          ) : (
            <div style={{ fontSize: '.72rem', color: '#00b4a0', marginTop: 6 }}>🔊 Voice {settings.voice_enabled ? 'ON' : 'OFF'}</div>
          )}
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
                {t.doctors?.users && (
                  <div style={ls.doctorName}>Dr. {t.doctors.users.first_name} {t.doctors.users.last_name}</div>
                )}
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
        <span>Auto-refreshes every 5 seconds</span>
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
  patientName:     { fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginBottom: '0.4rem' },
  doctorName:      { fontSize: '1.05rem', fontWeight: 600, color: '#7dd3fc', marginBottom: '0.8rem' },
  soundBtn:        { marginTop: 8, background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: '.8rem', fontWeight: 700, cursor: 'pointer' },
  roomTag:         { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,180,160,0.15)', border: '1px solid rgba(0,180,160,0.3)', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '1.1rem', marginBottom: '1rem' },
  roomIcon:        { fontSize: '1.2rem' },
  pleaseTag:       { background: '#00b4a0', color: '#fff', borderRadius: 20, padding: '0.4rem 1.2rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', display: 'inline-block' },
  waitingGrid:     { display: 'flex', flexWrap: 'wrap', gap: '1rem' },
  waitingCard:     { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12 },
  waitToken:       { fontSize: '1.3rem', fontWeight: 800, color: '#94a3b8' },
  waitName:        { fontSize: '1rem', color: 'rgba(255,255,255,0.7)' },
  footer:          { marginTop: 'auto', background: 'rgba(255,255,255,0.03)', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', fontSize: '.8rem', color: 'rgba(255,255,255,0.4)', borderTop: '1px solid rgba(255,255,255,0.08)' },
};
