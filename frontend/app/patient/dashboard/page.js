'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getUser, logout } from '@/lib/auth';

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
  { key: 'payments',       label: 'Payment History',   icon: '💳', href: '/patient/payments' },
  { key: 'profile',        label: 'My Profile',        icon: '👤', href: '/patient/profile' },
];

const SECTION_TITLES = {
  overview:     'Overview',
  appointments: 'My Appointments',
  upcoming:     'Upcoming Appointments',
  completed:    'Completed Visits',
  doctors:      'Doctors Visited',
};

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
      <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid rgba(255,255,255,.08)`, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #1e3f85 0%, #13cfbd 100%)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
            <rect x="10.5" y="4" width="3" height="16" rx="1.5" fill="white"/>
            <rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="white"/>
          </svg>
        </div>
        {!collapsed && (
          <div>
            <div style={{ fontFamily: T.display, fontWeight: 700, color: '#fff', fontSize: 15, letterSpacing: '.3px' }}>
              Care<span style={{ color: T.teal }}>OpsX</span>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 1, letterSpacing: '.06em', textTransform: 'uppercase' }}>Healthcare Operations</div>
          </div>
        )}
      </div>

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

function ApptCard({ appt, onClick }) {
  const s = STATUS_COLORS[appt.status] || STATUS_COLORS.booked;
  const firstName = appt.doctors?.users?.first_name || '';
  const lastName = appt.doctors?.users?.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const doctorName = fullName ? `Dr. ${fullName}` : (appt.doctors?.users?.name ? `Dr. ${appt.doctors.users.name}` : 'Doctor');
  const statusLabel = appt.status
    ? appt.status.charAt(0).toUpperCase() + appt.status.slice(1)
    : 'Booked';
  const isClickable = !!onClick;
  return (
    <div
      onClick={onClick}
      style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
        padding: '16px 20px', marginBottom: 10,
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'box-shadow .15s',
      }}
      onMouseEnter={e => { if (isClickable) e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { if (isClickable) e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: T.display, fontWeight: 700, color: T.navy, fontSize: 15 }}>{doctorName}</div>
          <div style={{ color: T.muted, fontSize: 13 }}>{appt.doctors?.specialization || '—'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...s, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
            {statusLabel}
          </span>
          {isClickable && appt.status === 'completed' && (
            <span style={{ fontSize: 11, color: T.teal, fontWeight: 600 }}>View details →</span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 20, fontSize: 13, color: T.muted }}>
        <span>📅 {appt.appointment_date}</span>
        <span>⏰ {appt.appointment_time}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        {appt.booking_id && (
          <span style={{ fontSize: 11, color: T.muted, fontFamily: 'JetBrains Mono, monospace' }}>{appt.booking_id}</span>
        )}
        {appt.token_number && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0fdfb', border: '1px solid #99f6e4', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700, color: '#0f766e' }}>
            🎫 Token #{appt.token_number}
          </span>
        )}
      </div>
    </div>
  );
}

function VisitModal({ detail, loading, onClose }) {
  const { appointment, consultation, prescriptions = [], lab_orders = [] } = detail || {};
  const doctorName = (() => {
    if (!appointment?.doctors) return 'Doctor';
    const u = appointment.doctors.users;
    const full = `${u?.first_name || ''} ${u?.last_name || ''}`.trim();
    return full ? `Dr. ${full}` : 'Doctor';
  })();

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,31,61,.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: T.card, borderRadius: 16, width: '100%', maxWidth: 640,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: T.card, zIndex: 1 }}>
          <div>
            <div style={{ fontFamily: T.display, fontWeight: 700, color: T.navy, fontSize: 17 }}>Visit Details</div>
            {appointment && <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{appointment.booking_id}</div>}
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: T.muted }}>×</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: T.muted }}>Loading visit details…</div>
        ) : (
          <div style={{ padding: '20px 24px' }}>
            {/* Appointment summary */}
            <div style={{ background: `linear-gradient(135deg, ${T.teal} 0%, #0f766e 100%)`, borderRadius: 12, padding: '16px 20px', marginBottom: 20, color: '#fff' }}>
              <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{doctorName}</div>
              <div style={{ opacity: .85, fontSize: 13 }}>{appointment?.doctors?.specialization}</div>
              <div style={{ display: 'flex', gap: 20, marginTop: 10, fontSize: 13, opacity: .9 }}>
                <span>📅 {appointment?.appointment_date}</span>
                <span>⏰ {appointment?.appointment_time}</span>
              </div>
              {appointment?.reason && <div style={{ marginTop: 8, fontSize: 12, opacity: .75 }}>Reason: {appointment.reason}</div>}
            </div>

            {/* Consultation */}
            {consultation ? (
              <>
                <Section title="Consultation Notes">
                  {consultation.chief_complaint && <Row label="Chief Complaint" value={consultation.chief_complaint} />}
                  {consultation.symptoms && <Row label="Symptoms" value={consultation.symptoms} />}
                  {consultation.history && <Row label="History" value={consultation.history} />}
                  {consultation.diagnosis && <Row label="Diagnosis" value={consultation.diagnosis} highlight />}
                  {consultation.notes && <Row label="Notes" value={consultation.notes} />}
                  {consultation.advice && <Row label="Advice" value={consultation.advice} />}
                  {consultation.follow_up_required && (
                    <Row label="Follow-up" value={`${consultation.follow_up_date || 'Required'}${consultation.follow_up_notes ? ` — ${consultation.follow_up_notes}` : ''}`} />
                  )}
                </Section>

                {prescriptions.length > 0 && (
                  <Section title={`Prescriptions (${prescriptions.length})`}>
                    {prescriptions.map((pres, pi) => (
                      <div key={pres.id || pi} style={{ marginBottom: pi < prescriptions.length - 1 ? 12 : 0 }}>
                        {pres.notes && <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>{pres.notes}</div>}
                        {(pres.prescription_items || []).map((item, ii) => (
                          <div key={ii} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                            <div>
                              <span style={{ fontWeight: 600, color: T.navy }}>{item.medicine_name}</span>
                              {item.dosage && <span style={{ color: T.muted, marginLeft: 8 }}>{item.dosage}</span>}
                            </div>
                            <div style={{ color: T.muted, fontSize: 12, textAlign: 'right' }}>
                              {item.frequency && <span>{item.frequency}</span>}
                              {item.duration && <span style={{ marginLeft: 8 }}>· {item.duration}</span>}
                              {item.route && <span style={{ marginLeft: 8 }}>· {item.route}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </Section>
                )}

                {lab_orders.length > 0 && (
                  <Section title={`Lab Orders (${lab_orders.length})`}>
                    {lab_orders.map((order, i) => (
                      <div key={order.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                        <span style={{ fontWeight: 600, color: T.navy }}>{order.test_name}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: order.status === 'completed' ? '#f0fdf4' : '#eff6ff', color: order.status === 'completed' ? '#15803d' : '#1d4ed8' }}>
                          {order.status || 'ordered'}
                        </span>
                      </div>
                    ))}
                  </Section>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 0', color: T.muted }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <p>No consultation notes recorded for this visit.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>{title}</div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 16px' }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: `1px solid #f8fafc`, fontSize: 13 }}>
      <span style={{ color: T.muted, minWidth: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ color: highlight ? T.teal : T.text, fontWeight: highlight ? 700 : 400 }}>{value}</span>
    </div>
  );
}

export default function PatientDashboard() {
  const router = useRouter();
  const [user, setUser]                 = useState(null);
  const [collapsed, setCollapsed]       = useState(true);
  const [section, setSection]           = useState('overview');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [detailModal, setDetailModal]   = useState(null); // { appt, loading, data }

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push('/login'); return; }
    if (u.role_id === 1) { router.push('/admin/dashboard'); return; }
    if (u.role_id === 2) { router.push('/doctor/dashboard'); return; }
    setUser(u);
  }, []);

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
  const upcoming      = appointments.filter(a => (a.status === 'booked' || a.status === 'confirmed') && new Date(a.appointment_date) >= now);
  const completed     = appointments.filter(a => a.status === 'completed');
  const uniqueDoctors = [...new Map(appointments.map(a => [a.doctor_id, a])).values()];

  const openDetail = async (appt) => {
    setDetailModal({ appt, loading: true, data: null });
    try {
      const res = await api(`/appointments/${appt.id}`);
      setDetailModal({ appt, loading: false, data: res });
    } catch {
      setDetailModal({ appt, loading: false, data: null });
    }
  };

  const handleApptClick = (appt) => {
    if (appt.status === 'completed') openDetail(appt);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (!user) return null;

  const statCards = [
    { label: 'Upcoming',       value: upcoming.length,       icon: '📅', section: 'upcoming',  iconBg: '#eff6ff' },
    { label: 'Completed',      value: completed.length,      icon: '✅', section: 'completed', iconBg: '#f0fdf4' },
    { label: 'Doctors visited', value: uniqueDoctors.length, icon: '👨‍⚕️', section: 'doctors',  iconBg: '#faf5ff' },
  ];

  const headerTitle = SECTION_TITLES[section] || 'Overview';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, fontFamily: T.body }}>
      <Sidebar active={section} onNav={setSection} user={user} collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

      <main style={{ flex: 1, overflow: 'auto' }}>
        <header style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
          {['upcoming','completed','doctors'].includes(section) && (
            <button onClick={() => setSection('overview')} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>←</button>
          )}
          <span style={{ fontFamily: T.display, fontWeight: 700, color: T.navy, fontSize: 17 }}>{headerTitle}</span>
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

              {/* Stat cards — clickable */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
                {statCards.map(sc => (
                  <div key={sc.label}
                    onClick={() => setSection(sc.section)}
                    style={{
                      background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
                      padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16,
                      cursor: 'pointer', transition: 'box-shadow .15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: sc.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{sc.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: T.display, color: T.navy }}>{sc.value}</div>
                      <div style={{ fontSize: 13, color: T.muted }}>{sc.label}</div>
                    </div>
                    <span style={{ color: T.teal, fontSize: 16 }}>›</span>
                  </div>
                ))}
              </div>

              {/* Next appointment highlight */}
              {upcoming.length > 0 && (
                <div style={{ background: `linear-gradient(135deg, ${T.teal} 0%, #0f766e 100%)`, borderRadius: 14, padding: '20px 24px', marginBottom: 24, color: '#fff' }}>
                  <div style={{ fontSize: 12, opacity: .75, marginBottom: 6, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>Next appointment</div>
                  <div style={{ fontFamily: T.display, fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                    {(() => {
                      const u = upcoming[0].doctors?.users;
                      const full = `${u?.first_name || ''} ${u?.last_name || ''}`.trim();
                      return full ? `Dr. ${full}` : (u?.name ? `Dr. ${u.name}` : 'Doctor');
                    })()}
                  </div>
                  <div style={{ opacity: .85, fontSize: 14 }}>
                    {upcoming[0].appointment_date} • {upcoming[0].appointment_time}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                    {upcoming[0].booking_id && (
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, opacity: .7 }}>{upcoming[0].booking_id}</span>
                    )}
                    {upcoming[0].token_number && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '3px 12px', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                        🎫 Queue Token #{upcoming[0].token_number}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Recent appointments */}
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14 }}>
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
                    appointments.slice(0, 3).map(a => (
                      <ApptCard key={a.id} appt={a} onClick={() => handleApptClick(a)} />
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── My Appointments ── */}
          {section === 'appointments' && (
            <>
              <div style={{ marginBottom: 20 }}>
                <p style={{ color: T.muted, fontSize: 14, marginTop: 4 }}>{appointments.length} total · click a completed visit to see details</p>
              </div>
              {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#b91c1c', marginBottom: 16, fontSize: 14 }}>{error}</div>}
              {loading ? (
                <div style={{ textAlign: 'center', padding: 48, color: T.muted }}>Loading...</div>
              ) : appointments.length === 0 ? (
                <EmptyAppt />
              ) : (
                appointments.map(a => <ApptCard key={a.id} appt={a} onClick={() => handleApptClick(a)} />)
              )}
            </>
          )}

          {/* ── Upcoming ── */}
          {section === 'upcoming' && (
            <>
              <p style={{ color: T.muted, fontSize: 14, marginBottom: 20 }}>{upcoming.length} upcoming appointment{upcoming.length !== 1 ? 's' : ''}</p>
              {upcoming.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 64, background: T.card, borderRadius: 14, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                  <p style={{ color: T.muted, marginBottom: 16 }}>No upcoming appointments.</p>
                  <a href="/patient/book" style={{ background: T.teal, color: '#fff', padding: '10px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Book Appointment</a>
                </div>
              ) : (
                upcoming.map(a => <ApptCard key={a.id} appt={a} />)
              )}
            </>
          )}

          {/* ── Completed Visits ── */}
          {section === 'completed' && (
            <>
              <p style={{ color: T.muted, fontSize: 14, marginBottom: 20 }}>{completed.length} completed visit{completed.length !== 1 ? 's' : ''} · click any to see full details</p>
              {completed.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 64, background: T.card, borderRadius: 14, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                  <p style={{ color: T.muted }}>No completed visits yet.</p>
                </div>
              ) : (
                completed.map(a => <ApptCard key={a.id} appt={a} onClick={() => handleApptClick(a)} />)
              )}
            </>
          )}

          {/* ── Doctors Visited ── */}
          {section === 'doctors' && (
            <>
              <p style={{ color: T.muted, fontSize: 14, marginBottom: 20 }}>{uniqueDoctors.length} doctor{uniqueDoctors.length !== 1 ? 's' : ''} visited</p>
              {uniqueDoctors.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 64, background: T.card, borderRadius: 14, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>👨‍⚕️</div>
                  <p style={{ color: T.muted }}>No doctors visited yet.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                  {uniqueDoctors.map(a => {
                    const u = a.doctors?.users;
                    const full = `${u?.first_name || ''} ${u?.last_name || ''}`.trim();
                    const doctorName = full ? `Dr. ${full}` : (u?.name ? `Dr. ${u.name}` : 'Doctor');
                    const visits = appointments.filter(x => x.doctor_id === a.doctor_id);
                    return (
                      <div key={a.doctor_id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e0f7f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>👨‍⚕️</div>
                        <div>
                          <div style={{ fontFamily: T.display, fontWeight: 700, color: T.navy, fontSize: 15 }}>{doctorName}</div>
                          <div style={{ color: T.muted, fontSize: 13 }}>{a.doctors?.specialization || '—'}</div>
                          <div style={{ fontSize: 12, color: T.teal, marginTop: 4 }}>{visits.length} visit{visits.length !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

        </div>
      </main>

      {/* Visit detail modal */}
      {detailModal && (
        <VisitModal
          detail={detailModal.data}
          loading={detailModal.loading}
          onClose={() => setDetailModal(null)}
        />
      )}
    </div>
  );
}

function EmptyAppt() {
  return (
    <div style={{ textAlign: 'center', padding: 64, background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
      <p style={{ color: '#64748b', marginBottom: 16 }}>No appointments yet.</p>
      <a href="/patient/book" style={{ background: '#00b4a0', color: '#fff', padding: '10px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Book Appointment</a>
    </div>
  );
}
