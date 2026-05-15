'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { clearAuth } from '@/lib/auth';
import RoleSwitcher from '@/lib/RoleSwitcher';

const theme = {
  teal: '#00b4a0',
  navy: '#0f1f3d',
  border: '#e2e8f0',
  display: "'Bricolage Grotesque', sans-serif",
  body: "'Instrument Sans', sans-serif",
};

function Logo() {
  return (
    <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #1e3f85 0%, #13cfbd 100%)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
        <rect x="10.5" y="4" width="3" height="16" rx="1.5" fill="white" />
        <rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="white" />
      </svg>
    </div>
  );
}

function HamburgerButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Open navigation"
      style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        border: '1px solid #dbe4ee',
        background: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f1f3d" strokeWidth="2" strokeLinecap="round">
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="20" y2="17" />
      </svg>
    </button>
  );
}

function SidebarContent({ groups, currentRole, roleLabel, user, onNavigate, collapsed = false }) {
  const pathname = usePathname();
  const initials = user?.name ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : roleLabel.slice(0, 1).toUpperCase();

  return (
    <aside
      style={{
        width: collapsed ? 76 : 240,
        minHeight: '100%',
        background: theme.navy,
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,.08)',
        fontFamily: theme.body,
      }}
    >
      <div style={{ padding: collapsed ? '16px 14px' : '16px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Logo />
        {!collapsed && (
          <div>
            <div style={{ fontFamily: theme.display, fontWeight: 700, color: '#fff', fontSize: 15 }}>
              Care<span style={{ color: theme.teal }}>OpsX</span>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{roleLabel}</div>
          </div>
        )}
      </div>

      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {groups.map((group) => (
          <div key={group.label} style={{ marginBottom: 8 }}>
            {!collapsed && group.label && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', padding: '6px 10px' }}>
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.Icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: 10,
                    padding: collapsed ? '11px 0' : '10px 12px',
                    borderRadius: 9,
                    background: isActive ? 'rgba(0,180,160,.16)' : 'transparent',
                    color: isActive ? theme.teal : 'rgba(255,255,255,.68)',
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 500,
                    textDecoration: 'none',
                    marginBottom: 4,
                    borderLeft: isActive ? `3px solid ${theme.teal}` : '3px solid transparent',
                  }}
                >
                  {Icon ? <Icon /> : <span style={{ width: 18, textAlign: 'center' }}>•</span>}
                  {!collapsed && item.label}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ padding: collapsed ? '12px 8px' : '12px 16px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
        {!collapsed && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: theme.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || roleLabel}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{roleLabel}</div>
              </div>
            </div>
            <RoleSwitcher currentRole={currentRole} />
          </>
        )}

        <button
          onClick={() => {
            clearAuth();
            window.location.href = '/login';
          }}
          style={{
            width: '100%',
            marginTop: collapsed ? 0 : 10,
            padding: '9px 10px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,.18)',
            background: 'transparent',
            color: 'rgba(255,255,255,.8)',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          {collapsed ? '↩' : 'Sign Out'}
        </button>
      </div>
    </aside>
  );
}

export default function AppShell({ title, roleLabel, currentRole, groups, user, children, collapsibleDesktop = false, defaultCollapsed = false }) {
  const router = useRouter();
  const [desktopCollapsed, setDesktopCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const closeOnResize = () => {
      if (window.innerWidth > 1024) setMobileOpen(false);
    };
    window.addEventListener('resize', closeOnResize);
    return () => window.removeEventListener('resize', closeOnResize);
  }, []);

  return (
    <div className="app-shell" style={{ fontFamily: theme.body }}>
      <div className="app-shell-sidebar-desktop">
        <div style={{ position: 'sticky', top: 0, height: '100vh' }}>
          {collapsibleDesktop ? (
            <div style={{ display: 'flex', height: '100%' }}>
              <SidebarContent groups={groups} currentRole={currentRole} roleLabel={roleLabel} user={user} collapsed={desktopCollapsed} />
              <button
                onClick={() => setDesktopCollapsed((value) => !value)}
                aria-label="Toggle sidebar"
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 18,
                  marginLeft: -12,
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  border: `1px solid ${theme.border}`,
                  background: '#fff',
                  color: '#475569',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(15,31,61,.1)',
                }}
              >
                {desktopCollapsed ? '›' : '‹'}
              </button>
            </div>
          ) : (
            <SidebarContent groups={groups} currentRole={currentRole} roleLabel={roleLabel} user={user} />
          )}
        </div>
      </div>

      {mobileOpen && <div className="app-shell-overlay" onClick={() => setMobileOpen(false)} />}
      <div className={`app-shell-sidebar-mobile${mobileOpen ? ' is-open' : ''}`}>
        <SidebarContent groups={groups} currentRole={currentRole} roleLabel={roleLabel} user={user} onNavigate={() => setMobileOpen(false)} />
      </div>

      <main className="app-shell-main">
        <div className="app-shell-mobilebar">
          <HamburgerButton onClick={() => setMobileOpen(true)} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: theme.display, fontWeight: 700, color: theme.navy, fontSize: 16 }}>{title}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{roleLabel}</div>
          </div>
          <button
            onClick={() => router.push('/')}
            style={{ marginLeft: 'auto', border: `1px solid ${theme.border}`, background: '#fff', borderRadius: 10, padding: '8px 10px', color: theme.navy, cursor: 'pointer', fontSize: 13 }}
          >
            Home
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
