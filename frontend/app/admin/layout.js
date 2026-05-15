'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';
import AppShell from '@/lib/AppShell';

export const T = {
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

// Clean SVG icons - no unicode, no emoji
const Icons = {
  Dashboard: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  Calendar: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Users: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Stethoscope: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
      <circle cx="20" cy="10" r="2"/>
    </svg>
  ),
  Staff: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Billing: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  ),
  Logo: () => (
    <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #1e3f85 0%, #13cfbd 100%)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
        <rect x="10.5" y="4" width="3" height="16" rx="1.5" fill="white"/>
        <rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="white"/>
      </svg>
    </div>
  ),
  Logout: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href:'/admin/dashboard',    label:'Dashboard',    Icon:Icons.Dashboard    },
      { href:'/admin/analytics',    label:'Analytics',    Icon:Icons.Billing      },
    ],
  },
  {
    label: 'Management',
    items: [
      { href:'/admin/appointments', label:'Appointments', Icon:Icons.Calendar     },
      { href:'/admin/patients',     label:'Patients',     Icon:Icons.Users        },
      { href:'/admin/doctors',      label:'Doctors',      Icon:Icons.Stethoscope  },
      { href:'/admin/billing',      label:'Billing',      Icon:Icons.Billing      },
    ],
  },
  {
    label: 'Clinical',
    items: [
      { href:'/receptionist/queue', label:'Queue',        Icon:Icons.Staff        },
      { href:'/admin/dropoff',      label:'Drop-Off',     Icon:Icons.Users        },
      { href:'/admin/lab',          label:'Lab',          Icon:Icons.Dashboard    },
      { href:'/admin/pharmacy',     label:'Pharmacy',     Icon:Icons.Billing      },
    ],
  },
  {
    label: 'System',
    items: [
      { href:'/admin/setup',         label:'Setup',         Icon:Icons.Staff     },
      { href:'/admin/notifications', label:'Notifications', Icon:Icons.Calendar  },
      { href:'/admin/audit',         label:'Audit Logs',    Icon:Icons.Dashboard },
    ],
  },
];

export default function AdminLayout({ children }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = getUser();
    const roles = Array.isArray(u?.roles) && u.roles.length ? u.roles : [u?.role_id];
    if (!u || !roles.includes(1)) {
      router.push('/login');
    } else {
      setUser(u);
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;

  const orgLabel = user?.organization_name || 'Administrator';

  return (
    <AppShell title="Admin Console" roleLabel={orgLabel} currentRole={1} groups={NAV_GROUPS} user={user} collapsibleDesktop defaultCollapsed>
      {children}
    </AppShell>
  );
}
