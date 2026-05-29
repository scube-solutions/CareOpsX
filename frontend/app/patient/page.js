'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';

const T = { teal: '#00b4a0', navy: '#0f1f3d', bg: '#f5f8fc', border: '#e2e8f0', muted: '#64748b', display: "'Bricolage Grotesque',sans-serif", body: "'Instrument Sans',sans-serif" };

const FEATURES = [
  { icon: '📅', title: 'Book Appointments', desc: 'Schedule with any doctor in minutes. Choose specialty, date, and slot.' },
  { icon: '💊', title: 'View Prescriptions', desc: 'Access your prescriptions and medication history anytime.' },
  { icon: '🔬', title: 'Lab Reports', desc: 'Download and track your lab test results online.' },
  { icon: '💳', title: 'Payment History', desc: 'View and manage all your billing and payment records.' },
  { icon: '📋', title: 'Follow-up Plans', desc: 'Stay on top of your follow-up appointments and care plans.' },
  { icon: '👤', title: 'Health Profile', desc: 'Manage your personal health information securely.' },
];

export default function PatientHome() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = getUser();
    if (u && u.role_id === 3) setUser(u);
  }, []);

  return (
    <div style={{ fontFamily: T.body, background: T.bg, minHeight: '100vh' }}>

      {/* Navbar */}
      <nav style={{ background: '#fff', borderBottom: `1px solid ${T.border}`, padding: '0 5%', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#1e3f85,#13cfbd)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><rect x="10.5" y="4" width="3" height="16" rx="1.5" fill="white"/><rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="white"/></svg>
          </div>
          <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 16, color: T.navy }}>Care<span style={{ color: T.teal }}>OpsX</span></div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {user ? (
            <>
              <span style={{ fontSize: 13, color: T.muted }}>Hi, {user.name?.split(' ')[0] || 'Patient'}</span>
              <button onClick={() => router.push('/patient/dashboard')} style={{ padding: '8px 18px', background: T.teal, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                My Dashboard →
              </button>
            </>
          ) : (
            <>
              <button onClick={() => router.push('/login')} style={{ padding: '8px 16px', background: 'transparent', color: T.navy, border: `1.5px solid ${T.border}`, borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Sign In
              </button>
              <button onClick={() => router.push('/patient/book')} style={{ padding: '8px 18px', background: T.teal, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Book Appointment
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: `linear-gradient(135deg,${T.navy} 0%,#1a3260 100%)`, padding: '80px 5%', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,180,160,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(0,180,160,.07) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,180,160,.15)', border: '1px solid rgba(0,180,160,.3)', borderRadius: 99, padding: '5px 14px', fontSize: 12, fontWeight: 600, color: T.teal, letterSpacing: '.06em', marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.teal, display: 'inline-block' }} />
            Your Health, Your Control
          </div>
          <h1 style={{ fontFamily: T.display, fontSize: 'clamp(2rem,4.5vw,3rem)', color: '#fff', fontWeight: 800, lineHeight: 1.15, margin: '0 0 16px' }}>
            Manage Your Health<br /><span style={{ color: T.teal }}>All in One Place</span>
          </h1>
          <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,.65)', lineHeight: 1.7, marginBottom: 32 }}>
            Book appointments, access prescriptions, view lab reports, and track your health journey — anytime, anywhere.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/patient/book')} style={{ padding: '12px 28px', background: T.teal, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,180,160,.35)' }}>
              📅 Book Appointment
            </button>
            {!user && (
              <button onClick={() => router.push('/login')} style={{ padding: '12px 28px', background: 'transparent', color: 'rgba(255,255,255,.8)', border: '1.5px solid rgba(255,255,255,.3)', borderRadius: 10, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
                Sign In to Portal →
              </button>
            )}
            {user && (
              <button onClick={() => router.push('/patient/dashboard')} style={{ padding: '12px 28px', background: 'transparent', color: 'rgba(255,255,255,.8)', border: '1.5px solid rgba(255,255,255,.3)', borderRadius: 10, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
                Go to Dashboard →
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '72px 5%', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontFamily: T.display, fontSize: 'clamp(1.6rem,3vw,2.2rem)', color: T.navy, fontWeight: 700, margin: '0 0 12px' }}>Everything you need</h2>
          <p style={{ color: T.muted, fontSize: '1rem' }}>One portal for all your healthcare needs</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 14, padding: '24px', transition: 'all .2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(15,31,61,.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 15, color: T.navy, marginBottom: 6 }}>{f.title}</div>
              <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: T.teal, padding: '60px 5%', textAlign: 'center' }}>
        <h2 style={{ fontFamily: T.display, fontSize: 'clamp(1.5rem,2.5vw,2rem)', color: '#fff', fontWeight: 700, margin: '0 0 12px' }}>Ready to take control of your health?</h2>
        <p style={{ color: 'rgba(255,255,255,.8)', marginBottom: 28, fontSize: 15 }}>Sign in or book an appointment to get started.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/patient/book')} style={{ padding: '11px 26px', background: T.navy, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Book Appointment</button>
          {!user && <button onClick={() => router.push('/login')} style={{ padding: '11px 26px', background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,.5)', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Sign In</button>}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: T.navy, padding: '24px 5%', textAlign: 'center' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.35)' }}>© 2025 CareOpsX Patient Portal</span>
      </footer>
    </div>
  );
}
