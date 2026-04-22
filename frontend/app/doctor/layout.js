'use client';
import { useEffect } from 'react';
import { getUser, logout } from '@/lib/auth';

const NAV = [
  { href: '/doctor/dashboard', label: 'My Queue' },
  { href: '/doctor/consultations', label: 'Consultations' },
  { href: '/doctor/patients', label: 'Patient Search' },
];

export default function DoctorLayout({ children }) {
  useEffect(() => {
    const u = getUser();
    if (!u || ![1, 2].includes(u.role_id)) window.location.href = '/login';
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f8fc', fontFamily: 'Inter, sans-serif' }}>
      <aside style={{ width: 220, background: '#0f1f3d', color: '#fff', padding: '1.5rem 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0 1.5rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#00b4a0' }}>CareOpsX</div>
          <div style={{ fontSize: '.75rem', color: '#94a3b8', marginTop: 2 }}>Doctor Portal</div>
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
        <button onClick={logout} style={{ margin: '1rem 1.5rem', padding: '.6rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 8, cursor: 'pointer', fontSize: '.8rem' }}>
          Logout
        </button>
      </aside>
      <main style={{ flex: 1, overflow: 'auto' }}>{children}</main>
    </div>
  );
}
