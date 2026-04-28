'use client';
import { useEffect } from 'react';
import { getUser, logout } from '@/lib/auth';
import RoleSwitcher from '@/lib/RoleSwitcher';

const NAV = [
  { href: '/doctor/dashboard', label: 'My Queue' },
  { href: '/doctor/consultations', label: 'Consultations' },
  { href: '/doctor/patients', label: 'Patient Search' },
];

export default function DoctorLayout({ children }) {
  useEffect(() => {
    const u = getUser();
    const roles = Array.isArray(u?.roles) && u.roles.length ? u.roles : [u?.role_id];
    if (!u || ![1, 2].some(r => roles.includes(r))) window.location.href = '/login';
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f8fc', fontFamily: 'Inter, sans-serif' }}>
      <aside style={{ width: 220, background: '#0f1f3d', color: '#fff', padding: '1.5rem 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0 1.5rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, background: 'linear-gradient(135deg, #1e3f85 0%, #13cfbd 100%)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
              <rect x="10.5" y="4" width="3" height="16" rx="1.5" fill="white"/>
              <rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="white"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#fff', letterSpacing: '.2px' }}>
              Care<span style={{ color: '#00b4a0' }}>OpsX</span>
            </div>
            <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.35)', marginTop: 1, letterSpacing: '.06em', textTransform: 'uppercase' }}>Healthcare Operations</div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: '1rem 0' }}>
          {NAV.map(n => (
            <a key={n.href} href={n.href} style={{ display: 'block', padding: '.6rem 1.5rem', color: '#cbd5e1', fontSize: '.875rem', textDecoration: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#cbd5e1'; }}>
              {n.label}
            </a>
          ))}
        </nav>
        <RoleSwitcher currentRole={2} />
        <button onClick={logout} style={{ margin: '1rem 1.5rem', padding: '.6rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 8, cursor: 'pointer', fontSize: '.8rem' }}>
          Logout
        </button>
      </aside>
      <main style={{ flex: 1, overflow: 'auto' }}>{children}</main>
    </div>
  );
}
