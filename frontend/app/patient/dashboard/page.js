'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getUser, logout } from '@/lib/auth';

// ─── Design tokens ───────────────────────────────────────
const T = {
  teal:    '#00b4a0',
  navy:    '#0f1f3d',
  bg:      '#f5f8fc',
  card:    '#ffffff',
  border:  '#e2e8f0',
  text:    '#1e293b',
  muted:   '#64748b',
  display: "'Bricolage Grotesque', sans-serif",
  body:    "'Instrument Sans', sans-serif",
};

const STATUS_COLORS = {
  booked:     { bg: '#eff6ff', text: '#1d4ed8' },
  confirmed:  { bg: '#f0fdfb', text: '#0f766e' },
  completed:  { bg: '#f0fdf4', text: '#15803d' },
  cancelled:  { bg: '#fef2f2', text: '#b91c1c' },
  no_show:    { bg: '#fefce8', text: '#a16207' },
};

const NAV_ITEMS = [
  { key: 'overview',       label: 'Overview',          icon: '⊞' },
  { key: 'appointments',   label: 'My Appointments',   icon: '◷' },
  { key: 'lab',            label: 'Lab Reports',       icon: '🧪', href: '/patient/lab' },
  { key: 'prescriptions',  label: 'Prescriptions',     icon: '💊', href: '/patient/prescriptions' },
  { key: 'followups',      label: 'Follow-ups',        icon: '📅', href: '/patient/followups' },
];

// ─── Sidebar ──────────────────────────────────────────────
function Sidebar({ active, onNav, user, collapsed, onToggle }) {
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'P';

  return (
    <aside style={{
      width: collapsed ? 64 : 240,
      minHeight: '100vh',
      background: T.navy,
      display: 'flex',
      flexDirection: 'column',
      transition: 'width .2s ease',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid rgba(255,255,255,.08)`, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={onToggle}>
        <svg viewBox="0 0 24 24" fill="none" width="28" height="28" style={{ flexShrink: 0 }}>
          <rect x="9" y="2" width="6" height="6" rx="1" fill="white" opacity=".9"/>
          <rect x="9" y="16" width="6" height="6" rx="1" fill="white" opacity=".9"/>
          <rect x="2" y="9" width="6" height="6" rx="1" fill="white" opacity=".6"/>
          <rect x="16" y="9" width="6" height="6" rx="1" fill="white" opacity=".6"/>
          <rect x="10" y="10" width="4" height="4" rx=".5" fill="#00b4a0"/>
        </svg>
        {!collapsed && (
          <div>
            <div style={{ fontFamily: T.display, fontWeight: 700, color: '#fff', fontSize: 15, letterSpacing: '.3px' }}>
              CareOps<span style={{ color: T.teal }}>X</span>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 1 }}>Patient Portal</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px' }}>
        {!collapsed && <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', padding: '4px 8px 8px' }}>Main</div>}
        {NAV_ITEMS.map(item => {
          const isActive = active === item.key;
          const commonStyle = {
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', padding: collapsed ? '10px 0' : '10px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 8, border: 'none', cursor: 'pointer',
            background: isActive ? 'rgba(0,180,160,.18)' : 'transparent',
            color: isActive ? T.teal : 'rgba(255,255,255,.55)',
            fontFamily: T.body, fontSize: 14, fontWeight: isActive ? 600 : 400,
            marginBottom: 2, transition: 'all .15s', textDecoration: 'none',
          };
          if (item.href) {
            return (
              <a key={item.key} href={item.href} style={commonStyle}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && item.label}
              </a>
            );
          }
          return (
            <button key={item.key} onClick={() => onNav(item.key)} style={commonStyle}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && item.label}
            </button>
          );
        })}

        {!collapsed && <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', padding: '12px 8px 8px' }}>Actions</div>}
        <a href="/patient/book" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: collapsed ? '10px 0' : '10px 12px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderRadius: 8, border: 'none', cursor: 'pointer',
          background: 'rgba(0,180,160,.12)',
          color: T.teal,
          fontFamily: T.body, fontSize: 14, fontWeight: 600,
          marginBottom: 2, textDecoration: 'none',
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>＋</span>
          {!collapsed && 'Book Appointment'}
        </a>
      </nav>

      {/* Footer user */}
      {!collapsed && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Patient'}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email || ''}</div>
            </div>
          </div>
          <button onClick={() => logout()} style={{
            width: '100%', padding: '7px', borderRadius: 6, border: '1px solid rgba(255,255,255,.12)',
            background: 'transparent', color: 'rgba(255,255,255,.45)', fontFamily: T.body, fontSize: 12, cursor: 'pointer',
          }}>Sign Out</button>
        </div>
      )}
    </aside>
  );
}

// ─── Appointment card ────────────────────────────────────
function ApptCard({ appt }) {
  const s = STATUS_COLORS[appt.status] || STATUS_COLORS.booked;
  const firstName = appt.doctors?.users?.first_name || '';
  const lastName = appt.doctors?.users?.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const fallbackName = appt.doctors?.users?.name || '';
  const doctorName = fullName ? `Dr. ${fullName}` : (fallbackName ? `Dr. ${fallbackName}` : 'Doctor');
  const statusLabel = appt.status
    ? appt.status.charAt(0).toUpperCase() + appt.status.slice(1)
    : 'Booked';
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: T.display, fontWeight: 700, color: T.navy, fontSize: 15 }}>{doctorName}</div>
          <div style={{ color: T.muted, fontSize: 13 }}>{appt.doctors?.specialization || '—'}</div>
        </div>
        <span style={{ ...s, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
          {statusLabel}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 20, fontSize: 13, color: T.muted }}>
        <span>📅 {appt.appointment_date}</span>
        <span>⏰ {appt.appointment_time}</span>
      </div>
      {appt.booking_id && (
        <div style={{ marginTop: 8, fontSize: 11, color: T.muted, fontFamily: 'JetBrains Mono, monospace' }}>
          {appt.booking_id}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────
export default function PatientDashboard() {
  const router = useRouter();
  const [user, setUser]                 = useState(null);
  const [collapsed, setCollapsed]       = useState(true);
  const [section, setSection]           = useState('overview');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  // Auth check
  useEffect(() => {
    const u = getUser();
    if (!u) { router.push('/login'); return; }
    // Redirect admin/doctor to their own dashboards
    if (u.role_id === 1) { router.push('/admin/dashboard'); return; }
    if (u.role_id === 2) { router.push('/doctor/dashboard'); return; }
    setUser(u);
  }, []);

  // Load appointments
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api('/appointments');
        setAppointments(res.appointments || res.data || []);
      } catch {
        setError('Could not load appointments.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const now = new Date();
  const upcoming  = appointments.filter(a => (a.status === 'booked' || a.status === 'confirmed') && new Date(a.appointment_date) >= now);
  const completed = appointments.filter(a => a.status === 'completed');
  const doctorsVisited = new Set(appointments.map(a => a.doctor_id)).size;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, fontFamily: T.body }}>
      <Sidebar active={section} onNav={setSection} user={user} collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

      <main style={{ flex: 1, overflow: 'auto' }}>
        {/* Top bar */}
        <header style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
          <span style={{ fontFamily: T.display, fontWeight: 700, color: T.navy, fontSize: 17 }}>
            {NAV_ITEMS.find(n => n.key === section)?.label || 'Overview'}
          </span>
          <a href="/patient/book" style={{
            marginLeft: 'auto', background: T.teal, color: '#fff', border: 'none',
            borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', textDecoration: 'none', fontFamily: T.body,
          }}>+ Book Appointment</a>
        </header>

        <div style={{ padding: '28px 28px' }}>

          {/* ── Overview ── */}
          {section === 'overview' && (
            <>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontFamily: T.display, fontSize: 24, fontWeight: 700, color: T.navy, margin: 0 }}>
                  {greeting()}, {user.name?.split(' ')[0] || 'there'} 👋
                </h1>
                <p style={{ color: T.muted, fontSize: 14, marginTop: 4 }}>Here's your health overview</p>
              </div>

              {/* Stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
                {[
                  { label: 'Upcoming', value: upcoming.length,      icon: '📅', color: '#eff6ff', iconBg: '#eff6ff' },
                  { label: 'Completed', value: completed.length,    icon: '✅', color: '#f0fdf4', iconBg: '#f0fdf4' },
                  { label: 'Doctors visited', value: doctorsVisited, icon: '👨‍⚕️', color: '#faf5ff', iconBg: '#faf5ff' },
                ].map(s => (
                  <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{s.icon}</div>
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: T.display, color: T.navy }}>{s.value}</div>
                      <div style={{ fontSize: 13, color: T.muted }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Next appointment highlight */}
              {upcoming.length > 0 && (
                <div style={{ background: `linear-gradient(135deg, ${T.teal} 0%, #0f766e 100%)`, borderRadius: 14, padding: '20px 24px', marginBottom: 24, color: '#fff' }}>
                  <div style={{ fontSize: 12, opacity: .75, marginBottom: 6, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>Next appointment</div>
                  <div style={{ fontFamily: T.display, fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                    {(() => {
                      const firstName = upcoming[0].doctors?.users?.first_name || '';
                      const lastName = upcoming[0].doctors?.users?.last_name || '';
                      const fullName = `${firstName} ${lastName}`.trim();
                      if (fullName) return `Dr. ${fullName}`;
                      if (upcoming[0].doctors?.users?.name) return `Dr. ${upcoming[0].doctors.users.name}`;
                      return 'Doctor';
                    })()}
                  </div>
                  <div style={{ opacity: .85, fontSize: 14 }}>
                    {upcoming[0].appointment_date} • {upcoming[0].appointment_time}
                  </div>
                  {upcoming[0].booking_id && (
                    <div style={{ marginTop: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, opacity: .7 }}>{upcoming[0].booking_id}</div>
                  )}
                </div>
              )}

              {/* Recent appointments */}
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '0 0' }}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: T.display, fontWeight: 700, color: T.navy, fontSize: 16 }}>Recent appointments</span>
                  <button onClick={() => setSection('appointments')} style={{ background: 'none', border: 'none', color: T.teal, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: T.body }}>View all →</button>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: 24, color: T.muted }}>Loading...</div>
                  ) : appointments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 32 }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                      <p style={{ color: T.muted, fontSize: 14 }}>No appointments yet.</p>
                      <a href="/patient/book" style={{ color: T.teal, fontWeight: 600, fontSize: 14 }}>Book your first appointment →</a>
                    </div>
                  ) : (
                    appointments.slice(0, 3).map(a => <ApptCard key={a.id} appt={a} />)
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── My Appointments ── */}
          {section === 'appointments' && (
            <>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: T.navy, margin: 0 }}>My Appointments</h1>
                <p style={{ color: T.muted, fontSize: 14, marginTop: 4 }}>{appointments.length} total</p>
              </div>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#b91c1c', marginBottom: 16, fontSize: 14 }}>{error}</div>
              )}

              {loading ? (
                <div style={{ textAlign: 'center', padding: 48, color: T.muted }}>Loading...</div>
              ) : appointments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 64, background: T.card, borderRadius: 14, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                  <p style={{ color: T.muted, marginBottom: 16 }}>You have no appointments yet.</p>
                  <a href="/patient/book" style={{ background: T.teal, color: '#fff', padding: '10px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Book Appointment</a>
                </div>
              ) : (
                appointments.map(a => <ApptCard key={a.id} appt={a} />)
              )}
            </>
          )}

        </div>
      </main>
    </div>
  );
}
