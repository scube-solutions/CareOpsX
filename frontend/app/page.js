'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const N = '#0f1f3d', T = '#00b4a0', TB = '#13cfbd';

function LogoIcon({ size = 36 }) {
  return (
    <div style={{ width: size, height: size, background: 'linear-gradient(135deg, #1e3f85 0%, #13cfbd 100%)', borderRadius: size * 0.27, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg viewBox="0 0 24 24" fill="none" width={size * 0.5} height={size * 0.5}>
        <rect x="10.5" y="4" width="3" height="16" rx="1.5" fill="white"/>
        <rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="white"/>
      </svg>
    </div>
  );
}

function Logo({ light }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', textDecoration: 'none' }}>
      <LogoIcon size={36} />
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: light ? '#fff' : N, lineHeight: 1.1 }}>
          CareOps<span style={{ color: T }}>X</span>
        </div>
        <div style={{ fontSize: '0.6rem', color: light ? 'rgba(255,255,255,0.45)' : '#94a3b8', letterSpacing: '0.04em' }}>Hospital Management</div>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: '🧠', title: 'Smart Scheduling', desc: 'AI-powered slot optimization ensures maximum doctor utilization while minimizing patient wait times.' },
  { icon: '📱', title: 'Multi-Channel Booking', desc: 'Patients book via web or kiosk. Instant confirmations keep everyone in the loop.' },
  { icon: '👥', title: 'Doctor Management', desc: 'Manage doctor profiles, specializations, availability windows, and consultation fees from one dashboard.' },
  { icon: '📊', title: 'Analytics Dashboard', desc: 'Real-time reports on appointment volumes, no-show rates, revenue, and specialty demand trends.' },
  { icon: '🔔', title: 'Automated Reminders', desc: 'Reduce no-shows by up to 40% with automated reminders before each appointment.' },
  { icon: '💳', title: 'Integrated Billing', desc: 'Generate invoices, accept payments, and track revenue — all within the same unified platform.' },
];

const STEPS = [
  { n: '1', title: 'Choose Specialty', desc: 'Select from medical specialties. Instant doctor availability shown in real-time.' },
  { n: '2', title: 'Pick Your Doctor', desc: 'View doctor profiles, consultation fees, and available slots side by side.' },
  { n: '3', title: 'Select Date & Time', desc: 'Interactive calendar shows real-time availability. Choose morning or afternoon slots.' },
  { n: '4', title: 'Confirmed!', desc: 'Receive instant confirmation with a unique reference number.' },
];

const SPECIALTIES = [
  { icon: '❤️', name: 'Cardiology' }, { icon: '🧠', name: 'Neurology' },
  { icon: '🦴', name: 'Orthopedics' }, { icon: '👶', name: 'Pediatrics' },
  { icon: '🔬', name: 'Dermatology' }, { icon: '👁️', name: 'Ophthalmology' },
  { icon: '🦷', name: 'Dentistry' }, { icon: '🫁', name: 'Pulmonology' },
  { icon: '🩺', name: 'General' }, { icon: '🧬', name: 'Oncology' },
  { icon: '🫘', name: 'Nephrology' }, { icon: '👂', name: 'ENT' },
];

export default function LandingPage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  return (
    <div style={{ fontFamily: 'var(--font-body)', color: N, background: '#f8fbff', overflowX: 'hidden' }}>

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        padding: '0 5%', height: 68,
        display: 'flex', alignItems: 'center', gap: '1.5rem',
        background: scrolled ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(0,180,160,0.1)',
        boxShadow: scrolled ? '0 2px 20px rgba(15,31,61,0.08)' : 'none',
        transition: 'all 0.22s ease',
      }}>
        <a href="/" style={{ textDecoration: 'none', marginRight: 'auto' }}><Logo /></a>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {['features', 'how-it-works', 'specialties'].map(s => (
            <span key={s} onClick={() => scrollTo(s)} style={{ padding: '0.45rem 0.875rem', borderRadius: 8, fontSize: '0.875rem', fontWeight: 500, color: '#475569', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.target.style.background = '#e6f7f5'; e.target.style.color = T; }}
              onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#475569'; }}>
              {s === 'how-it-works' ? 'How It Works' : s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => router.push('/login')} style={{ padding: '0.5rem 1.1rem', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'transparent', color: '#475569', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
            Sign In
          </button>
          <button onClick={() => router.push('/patient/book')} style={{ padding: '0.5rem 1.2rem', borderRadius: 10, background: `linear-gradient(135deg, ${T}, ${TB})`, color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', border: 'none', boxShadow: '0 4px 14px rgba(0,180,160,0.3)' }}>
            Book Appointment
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        minHeight: '100vh', paddingTop: 100,
        background: `linear-gradient(160deg, ${N} 0%, #1a3260 45%, #0d3d5c 100%)`,
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center',
      }}>
        {/* Grid bg */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(13,158,142,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(13,158,142,0.07) 1px, transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />
        {/* Orbs */}
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(13,158,142,0.15) 0%, transparent 70%)', top: -150, right: -150, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(13,158,142,0.12) 0%, transparent 70%)', bottom: -80, left: '10%', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', width: '100%', padding: '3rem 5%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(13,158,142,0.15)', border: '1px solid rgba(13,158,142,0.3)', borderRadius: 99, padding: '0.35rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: TB, letterSpacing: '0.06em', marginBottom: '1.5rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: TB, animation: 'pulse 2s infinite', display: 'inline-block' }} />
              Smart Healthcare Platform
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem,4.5vw,3.2rem)', color: '#fff', lineHeight: 1.15, marginBottom: '1.25rem', margin: '0 0 1.25rem' }}>
              Book Appointments<br />
              <em style={{ fontStyle: 'italic', color: TB }}>Smarter & Faster</em><br />
              Than Ever Before
            </h1>
            <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: '2rem', maxWidth: 480 }}>
              CareOpsX streamlines the entire patient journey — from specialty selection to confirmed appointments — in minutes, not hours.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button onClick={() => router.push('/patient/book')} style={{ padding: '0.875rem 2rem', borderRadius: 12, background: `linear-gradient(135deg, ${T}, ${TB})`, color: '#fff', fontSize: '1rem', fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,180,160,0.35)' }}>
                📅 Book Appointment Now
              </button>
              <button onClick={() => router.push('/login')} style={{ padding: '0.875rem 2rem', borderRadius: 12, background: 'transparent', color: 'rgba(255,255,255,0.8)', fontSize: '1rem', fontWeight: 600, border: '1.5px solid rgba(255,255,255,0.3)', cursor: 'pointer' }}>
                Admin Login →
              </button>
            </div>
            <div style={{ display: 'flex', gap: '2.5rem', marginTop: '3rem', paddingTop: '2.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {[['50K+', 'Appointments Booked'], ['200+', 'Specialist Doctors'], ['98%', 'Patient Satisfaction']].map(([v, l]) => (
                <div key={l}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: '#fff' }}>{v}</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.15rem' }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating card */}
          <div style={{ animation: 'float 6s ease-in-out infinite' }}>
            <div style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: '1.75rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.45)', marginBottom: '1.25rem' }}>Today's Appointments</div>
              {[['AK', '#0d9e8e', 'Dr. Arjun Kumar', 'Cardiology', '09:00 AM'], ['PS', '#8b5cf6', 'Dr. Priya Sharma', 'Neurology', '10:30 AM'], ['RN', '#f59e0b', 'Dr. Ravi Nair', 'Orthopedics', '02:00 PM']].map(([av, color, name, spec, time]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.75rem', borderRadius: 12, background: 'rgba(255,255,255,0.06)', marginBottom: '0.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{av}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>{spec}</div>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: TB, background: 'rgba(13,158,142,0.15)', padding: '0.2rem 0.55rem', borderRadius: 99, whiteSpace: 'nowrap' }}>{time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <style>{`
          @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
          @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.3)} }
          @media(max-width:900px){.hero-grid{grid-template-columns:1fr!important}}
        `}</style>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: '90px 5%', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#e6f7f5', border: '1px solid #b2ebe6', borderRadius: 99, padding: '0.3rem 0.9rem', fontSize: '0.75rem', fontWeight: 600, color: T, marginBottom: '1rem' }}>
            ✦ Platform Features
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem,3.5vw,2.5rem)', color: N, marginBottom: '0.875rem' }}>
            Everything your clinic needs, in one platform
          </h2>
          <p style={{ fontSize: '1rem', color: '#475569', maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
            From intelligent scheduling to real-time analytics — CareOpsX covers the entire appointment lifecycle.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1.5rem' }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ background: '#fff', borderRadius: 20, border: '1px solid rgba(15,31,61,0.08)', padding: '2rem', transition: 'all 0.22s ease', boxShadow: '0 4px 20px rgba(15,31,61,0.05)' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(15,31,61,0.1)'; e.currentTarget.style.borderColor = '#b2ebe6'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(15,31,61,0.05)'; e.currentTarget.style.borderColor = 'rgba(15,31,61,0.08)'; }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${T}, ${TB})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', marginBottom: '1.25rem', boxShadow: '0 4px 12px rgba(0,180,160,0.25)' }}>{f.icon}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: N, marginBottom: '0.5rem' }}>{f.title}</div>
              <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ background: `linear-gradient(160deg, ${N} 0%, #1a3260 100%)`, padding: '90px 5%', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(13,158,142,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(13,158,142,0.05) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(13,158,142,0.15)', border: '1px solid rgba(13,158,142,0.35)', borderRadius: 99, padding: '0.3rem 0.9rem', fontSize: '0.75rem', fontWeight: 600, color: TB, marginBottom: '1rem' }}>
              ✦ How It Works
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem,3.5vw,2.5rem)', color: '#fff', marginBottom: '0.875rem' }}>
              From search to confirmed in 3 minutes
            </h2>
            <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.6)', maxWidth: 460, margin: '0 auto', lineHeight: 1.7 }}>
              Our streamlined booking flow removes every unnecessary step.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1.5rem' }}>
            {STEPS.map(s => (
              <div key={s.n} style={{ textAlign: 'center', padding: '2rem 1.25rem' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: `linear-gradient(135deg, ${T}, ${TB})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: '#fff', margin: '0 auto 1.25rem', boxShadow: '0 4px 16px rgba(0,180,160,0.4)' }}>{s.n}</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff', marginBottom: '0.5rem' }}>{s.title}</div>
                <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SPECIALTIES */}
      <section id="specialties" style={{ padding: '90px 5%', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#e6f7f5', border: '1px solid #b2ebe6', borderRadius: 99, padding: '0.3rem 0.9rem', fontSize: '0.75rem', fontWeight: 600, color: T, marginBottom: '1rem' }}>✦ Specialties</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem,3.5vw,2.5rem)', color: N }}>All major specialties covered</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '1rem' }}>
          {SPECIALTIES.map(s => (
            <div key={s.name} onClick={() => router.push('/patient/book')} style={{ background: '#fff', border: '1.5px solid rgba(15,31,61,0.08)', borderRadius: 16, padding: '1.5rem 1rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 12px rgba(15,31,61,0.04)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T; e.currentTarget.style.background = '#e6f7f5'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(15,31,61,0.08)'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'none'; }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.625rem' }}>{s.icon}</span>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: N }}>{s.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: `linear-gradient(135deg, ${T} 0%, #0a7a6d 100%)`, padding: '80px 5%', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, transparent 70%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem,3.5vw,2.4rem)', color: '#fff', marginBottom: '1rem' }}>Ready to modernize your clinic?</h2>
          <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.8)', marginBottom: '2rem' }}>Join clinics already using CareOpsX to deliver better patient experiences.</p>
          <button onClick={() => router.push('/login')} style={{ padding: '0.875rem 2.5rem', borderRadius: 12, background: N, color: '#fff', fontSize: '1rem', fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 8px 24px rgba(15,31,61,0.4)' }}>
            Get Started →
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: N, padding: '50px 5% 28px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '2rem', marginBottom: '2.5rem' }}>
            <div>
              <Logo light />
              <p style={{ marginTop: '0.875rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', maxWidth: 240, lineHeight: 1.6 }}>Smart appointment booking and hospital management platform built for modern healthcare.</p>
            </div>
            {[['Platform', ['Book Appointment', 'Patient Portal', 'Admin Dashboard', 'Analytics']], ['Company', ['About', 'Careers', 'Blog', 'Contact']], ['Legal', ['Privacy Policy', 'Terms of Service', 'HIPAA']]].map(([title, links]) => (
              <div key={title}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: '1rem' }}>{title}</div>
                {links.map(l => <div key={l} style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', padding: '0.3rem 0', cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseEnter={e => e.target.style.color = TB}
                  onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.5)'}>{l}</div>)}
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>© 2025 CareOpsX. All rights reserved.</span>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>Built for modern healthcare ❤️</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
