// 'use client';

// import { useEffect, useState } from 'react';
// import { usePathname } from 'next/navigation';
// import { getUser, logout } from '@/lib/auth';

// export const T = {
//   teal: '#00b4a0',
//   navy: '#0f1f3d',
//   bg: '#f5f8fc',
//   card: '#ffffff',
//   border: '#e2e8f0',
//   text: '#1e293b',
//   muted: '#64748b',
//   display: "'Bricolage Grotesque', sans-serif",
//   body: "'Instrument Sans', sans-serif",
// };

// const NAV_ITEMS = [
//   { label: 'Dashboard', href: '/admin/dashboard', icon: '?' },
//   { label: 'Appointments', href: '/admin/appointments', icon: '?' },
//   { label: 'Patients', href: '/admin/patients', icon: '?' },
//   { label: 'Doctors', href: '/admin/doctors', icon: '?' },
//   { label: 'Staff', href: '/admin/staff', icon: '?' },
//   { label: 'Billing', href: '/admin/billing', icon: '?' },
// ];

// export default function AdminLayout({ children }) {
//   const pathname = usePathname();
//   const [collapsed, setCollapsed] = useState(false);
//   const [ready, setReady] = useState(false);

//   useEffect(() => {
//     const user = getUser();
//     if (!user || user.role_id !== 1) {
//       window.location.href = '/login';
//       return;
//     }
//     setReady(true);
//   }, []);

//   if (!ready) {
//     return (
//       <div style={{ minHeight: '100vh', background: T.bg, display: 'grid', placeItems: 'center', color: T.muted, fontFamily: T.body }}>
//         Loading admin workspace...
//       </div>
//     );
//   }

//   const sidebarWidth = collapsed ? 76 : 248;

//   return (
//     <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', fontFamily: T.body }}>
//       <aside style={{ width: sidebarWidth, background: T.navy, color: '#fff', transition: 'width .2s ease', minHeight: '100vh', borderRight: '1px solid rgba(255,255,255,.08)', position: 'sticky', top: 0, alignSelf: 'flex-start' }}>
//         <div style={{ padding: '18px 14px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
//           <button onClick={() => setCollapsed((v) => !v)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', cursor: 'pointer' }}>
//             {collapsed ? '?' : '?'}
//           </button>
//           {!collapsed && (
//             <div>
//               <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 16 }}>CareOpsX</div>
//               <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>Admin Console</div>
//             </div>
//           )}
//         </div>

//         <nav style={{ padding: '12px 8px' }}>
//           {NAV_ITEMS.map((item) => {
//             const active = pathname === item.href;
//             return (
//               <a
//                 key={item.href}
//                 href={item.href}
//                 title={collapsed ? item.label : ''}
//                 style={{
//                   display: 'flex',
//                   alignItems: 'center',
//                   gap: 10,
//                   justifyContent: collapsed ? 'center' : 'flex-start',
//                   textDecoration: 'none',
//                   padding: collapsed ? '11px 0' : '11px 12px',
//                   borderRadius: 10,
//                   marginBottom: 4,
//                   fontSize: 14,
//                   color: active ? T.teal : 'rgba(255,255,255,.72)',
//                   background: active ? 'rgba(0,180,160,.14)' : 'transparent',
//                   fontWeight: active ? 700 : 500,
//                 }}
//               >
//                 <span style={{ width: 18, textAlign: 'center' }}>{item.icon}</span>
//                 {!collapsed && item.label}
//               </a>
//             );
//           })}
//         </nav>

//         <div style={{ marginTop: 'auto', padding: 12, borderTop: '1px solid rgba(255,255,255,.08)' }}>
//           <button onClick={logout} style={{ width: '100%', border: '1px solid rgba(255,255,255,.2)', background: 'transparent', color: 'rgba(255,255,255,.85)', padding: '9px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
//             {collapsed ? '?' : 'Sign Out'}
//           </button>
//         </div>
//       </aside>

//       <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
//     </div>
//   );
// }


'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getUser, clearAuth } from '@/lib/auth';

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
    <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
      <rect x="9"  y="2"  width="6" height="6" rx="1" fill="white" opacity=".9"/>
      <rect x="9"  y="16" width="6" height="6" rx="1" fill="white" opacity=".9"/>
      <rect x="2"  y="9"  width="6" height="6" rx="1" fill="white" opacity=".6"/>
      <rect x="16" y="9"  width="6" height="6" rx="1" fill="white" opacity=".6"/>
      <rect x="10" y="10" width="4" height="4" rx=".5" fill="#00b4a0"/>
    </svg>
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
      { href:'/admin/setup',        label:'Setup',        Icon:Icons.Staff        },
      { href:'/admin/audit',        label:'Audit Logs',   Icon:Icons.Dashboard    },
    ],
  },
];

function AdminSidebar({ collapsed, onToggle, user }) {
  const pathname  = usePathname();
  const initials  = user?.name ? user.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : 'A';

  return (
    <aside style={{
      width: collapsed ? 68 : 240,
      minHeight: '100vh', background: T.navy,
      display: 'flex', flexDirection: 'column',
      transition: 'width .22s ease', overflow: 'hidden',
      flexShrink: 0, position: 'sticky', top: 0,
      alignSelf: 'flex-start', height: '100vh',
    }}>
      {/* Logo row */}
      <div onClick={onToggle} style={{
        padding: '18px 14px 16px', borderBottom: '1px solid rgba(255,255,255,.08)',
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer', userSelect: 'none', minHeight: 64,
      }}>
        <div style={{ flexShrink: 0 }}><Icons.Logo /></div>
        {!collapsed && (
          <div>
            <div style={{ fontFamily: T.display, fontWeight: 700, color: '#fff', fontSize: 15, letterSpacing: '.3px' }}>
              CareOps<span style={{ color: T.teal }}>X</span>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 1 }}>Admin Console</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: 6 }}>
            {!collapsed && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', fontWeight: 700,
                letterSpacing: '.1em', textTransform: 'uppercase', padding: '8px 10px 5px' }}>
                {group.label}
              </div>
            )}
            {group.items.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <a key={item.href} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: collapsed ? '11px 0' : '9px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 8,
                  background: isActive ? 'rgba(0,180,160,.18)' : 'transparent',
                  color: isActive ? T.teal : 'rgba(255,255,255,.5)',
                  fontFamily: T.body, fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  marginBottom: 2, textDecoration: 'none',
                  transition: 'all .12s',
                  borderLeft: isActive ? `3px solid ${T.teal}` : '3px solid transparent',
                }}>
                  <item.Icon />
                  {!collapsed && item.label}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{ padding: collapsed ? '12px 8px' : '12px 16px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
        {collapsed ? (
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: T.teal,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#fff', margin: '0 auto' }}>
            {initials}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: T.teal,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Admin'}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>Administrator</div>
              </div>
            </div>
            <button onClick={() => { clearAuth(); window.location.href = '/login'; }}
              style={{ width: '100%', padding: '8px', borderRadius: 7,
                border: '1px solid rgba(255,255,255,.12)', background: 'transparent',
                color: 'rgba(255,255,255,.45)', fontFamily: T.body, fontSize: 12,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icons.Logout /> Sign Out
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

export default function AdminLayout({ children }) {
  const router    = useRouter();
  const [user, setUser]           = useState(null);
  const [collapsed, setCollapsed] = useState(true);
  const [ready, setReady]         = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push('/login'); return; }
    if (u.role_id !== 1) { router.push('/login'); return; }
    setUser(u);
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, fontFamily: T.body }}>
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} user={user} />
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}