'use client';
import { useState, useEffect } from 'react';
import { getUser } from '@/lib/auth';

const ROLE_META = {
  1: { label: 'Admin',         href: '/admin/dashboard' },
  2: { label: 'Doctor',        href: '/doctor/dashboard' },
  3: { label: 'Patient',       href: '/patient/dashboard' },
  5: { label: 'Receptionist',  href: '/receptionist/dashboard' },
  6: { label: 'Lab Staff',     href: '/lab/dashboard' },
  7: { label: 'Pharmacist',    href: '/pharmacy/dashboard' },
  8: { label: 'Reporting',     href: '/admin/analytics' },
};

export default function RoleSwitcher({ currentRole }) {
  const [others, setOthers] = useState([]);

  useEffect(() => {
    const u = getUser();
    if (!u) return;
    const roles = Array.isArray(u.roles) && u.roles.length ? u.roles : [u.role_id];
    setOthers(roles.filter(r => r !== currentRole && ROLE_META[r]));
  }, [currentRole]);

  if (!others.length) return null;

  return (
    <div style={{ padding: '.75rem 1rem .5rem', borderTop: '1px solid rgba(255,255,255,.07)' }}>
      <div style={{ fontSize: '.62rem', color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.09em', fontWeight: 700, marginBottom: 6 }}>
        Switch Role
      </div>
      {others.map(roleId => (
        <a
          key={roleId}
          href={ROLE_META[roleId].href}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', color: 'rgba(255,255,255,.5)', fontSize: '.78rem', textDecoration: 'none', borderRadius: 6, marginBottom: 3, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', transition: 'all .12s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,180,160,.12)'; e.currentTarget.style.color = '#00b4a0'; e.currentTarget.style.borderColor = 'rgba(0,180,160,.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.03)'; e.currentTarget.style.color = 'rgba(255,255,255,.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)'; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3L4 7l4 4"/><path d="M4 7h16"/><path d="M16 21l4-4-4-4"/><path d="M20 17H4"/>
          </svg>
          {ROLE_META[roleId].label}
        </a>
      ))}
    </div>
  );
}
