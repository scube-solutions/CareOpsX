'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { clearAuth } from '@/lib/auth';
import { api } from '@/lib/api';
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
      style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid #dbe4ee', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f1f3d" strokeWidth="2" strokeLinecap="round">
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="20" y2="17" />
      </svg>
    </button>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

const fieldStyle = {
  fg:    { marginBottom: 12 },
  label: { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#475569', marginBottom: 4 },
  input: { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#1e293b', fontSize: 13, boxSizing: 'border-box', outline: 'none' },
};

function ProfileMenu({ user, roleLabel }) {
  const [open, setOpen]         = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm]         = useState({ first_name: '', last_name: '', phone: '' });
  const [pwd, setPwd]           = useState({ current: '', next: '' });
  const [msg, setMsg]           = useState('');
  const [saving, setSaving]     = useState(false);
  const [localUser, setLocalUser] = useState({});
  const ref = useRef(null);

  useEffect(() => {
    try { setLocalUser(JSON.parse(localStorage.getItem('user') || '{}')); } catch {}
  }, []);

  const getInitials = () => {
    if (localUser.first_name) return `${localUser.first_name[0]}${localUser.last_name?.[0] || ''}`.toUpperCase();
    if (localUser.email) return localUser.email[0].toUpperCase();
    return '?';
  };

  const getDisplayName = () =>
    localUser.first_name ? `${localUser.first_name} ${localUser.last_name || ''}`.trim() : (localUser.email || roleLabel);

  const getEmail = () => localUser.email || '';

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openEdit = async () => {
    setOpen(false);
    setMsg('');
    setPwd({ current: '', next: '' });
    setForm({ first_name: localUser.first_name || '', last_name: localUser.last_name || '', phone: localUser.phone || '' });
    try {
      const data = await api('/patients/me');
      const p = data.user || data;
      setForm({ first_name: p.first_name || u.first_name || '', last_name: p.last_name || u.last_name || '', phone: p.phone || u.phone || '' });
    } catch { /* use stored fallback */ }
    setEditOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      await api('/patients/me', {
        method: 'PATCH',
        body: JSON.stringify({ first_name: form.first_name, last_name: form.last_name, phone: form.phone }),
      });
      if (pwd.current && pwd.next) {
        await api('/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ current_password: pwd.current, new_password: pwd.next }),
        });
      }
      const updated = { ...localUser, first_name: form.first_name, last_name: form.last_name, phone: form.phone };
      localStorage.setItem('user', JSON.stringify(updated));
      setLocalUser(updated);
      setMsg('Saved successfully');
      setTimeout(() => setEditOpen(false), 1400);
    } catch (e) {
      setMsg(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: 34, height: 34, borderRadius: '50%', background: theme.teal, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', flexShrink: 0 }}
      >
        {getInitials()}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 42, right: 0, background: '#fff', border: `1px solid ${theme.border}`, borderRadius: 12, boxShadow: '0 8px 32px rgba(15,31,61,.12)', minWidth: 220, zIndex: 200, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid #f1f5f9` }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: theme.navy }}>{getDisplayName()}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{getEmail()}</div>
            <div style={{ fontSize: 11, color: theme.teal, fontWeight: 600, marginTop: 3 }}>{roleLabel}</div>
          </div>
          <button
            onClick={openEdit}
            style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, color: theme.navy, cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            Edit Profile
          </button>
          <div style={{ height: 1, background: '#f1f5f9' }} />
          <button
            onClick={() => { clearAuth(); window.location.href = '/login'; }}
            style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, color: '#ef4444', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            Logout
          </button>
        </div>
      )}

      {editOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 24px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: theme.navy }}>Edit Profile</h2>
              <button onClick={() => setEditOpen(false)} style={{ background: 'none', border: `1px solid ${theme.border}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: '#64748b', fontSize: 16 }}>✕</button>
            </div>

            <div style={fieldStyle.fg}>
              <label style={fieldStyle.label}>Email (cannot be changed)</label>
              <input value={getEmail()} disabled style={{ ...fieldStyle.input, background: '#f8fafc', color: '#94a3b8' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={fieldStyle.fg}>
                <label style={fieldStyle.label}>First Name</label>
                <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} style={fieldStyle.input} />
              </div>
              <div style={fieldStyle.fg}>
                <label style={fieldStyle.label}>Last Name</label>
                <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} style={fieldStyle.input} />
              </div>
            </div>

            <div style={fieldStyle.fg}>
              <label style={fieldStyle.label}>Mobile Number</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={fieldStyle.input} placeholder="10-digit mobile number" />
            </div>

            <div style={{ borderTop: `1px solid ${theme.border}`, margin: '16px 0 14px' }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Change Password (optional)</div>

            <div style={fieldStyle.fg}>
              <label style={fieldStyle.label}>Current Password</label>
              <input type="password" value={pwd.current} onChange={e => setPwd(p => ({ ...p, current: e.target.value }))} style={fieldStyle.input} placeholder="••••••••" />
            </div>
            <div style={fieldStyle.fg}>
              <label style={fieldStyle.label}>New Password</label>
              <input type="password" value={pwd.next} onChange={e => setPwd(p => ({ ...p, next: e.target.value }))} style={fieldStyle.input} placeholder="Min 8 characters" />
            </div>

            {msg && (
              <div style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, marginBottom: 12, background: msg.includes('success') || msg.includes('Saved') ? '#f0fdf4' : '#fef2f2', color: msg.includes('success') || msg.includes('Saved') ? '#15803d' : '#dc2626' }}>
                {msg}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={save} disabled={saving} style={{ flex: 1, padding: 10, borderRadius: 9, border: 'none', background: theme.teal, color: '#fff', fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? .7 : 1, fontSize: 14 }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => setEditOpen(false)} style={{ padding: '10px 16px', borderRadius: 9, border: `1.5px solid ${theme.border}`, background: '#fff', color: theme.navy, cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarContent({ groups, currentRole, onNavigate, collapsed = false }) {
  const pathname = usePathname();

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
        <RoleSwitcher currentRole={currentRole} />
      </div>
    </aside>
  );
}

export default function AppShell({ title, roleLabel, currentRole, groups, user, children, collapsibleDesktop = false, defaultCollapsed = false, settingsHref }) {
  const router = useRouter();
  const [desktopCollapsed, setDesktopCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const closeOnResize = () => { if (window.innerWidth > 1024) setMobileOpen(false); };
    window.addEventListener('resize', closeOnResize);
    return () => window.removeEventListener('resize', closeOnResize);
  }, []);

  return (
    <div className="app-shell" style={{ fontFamily: theme.body }}>
      <div className="app-shell-sidebar-desktop">
        <div style={{ position: 'sticky', top: 0, height: '100vh' }}>
          {collapsibleDesktop ? (
            <div style={{ display: 'flex', height: '100%' }}>
              <SidebarContent groups={groups} currentRole={currentRole} collapsed={desktopCollapsed} />
              <button
                onClick={() => setDesktopCollapsed((v) => !v)}
                aria-label="Toggle sidebar"
                style={{ alignSelf: 'flex-start', marginTop: 18, marginLeft: -12, width: 24, height: 24, borderRadius: 999, border: `1px solid ${theme.border}`, background: '#fff', color: '#475569', cursor: 'pointer', boxShadow: '0 4px 12px rgba(15,31,61,.1)' }}
              >
                {desktopCollapsed ? '›' : '‹'}
              </button>
            </div>
          ) : (
            <SidebarContent groups={groups} currentRole={currentRole} />
          )}
        </div>
      </div>

      {mobileOpen && <div className="app-shell-overlay" onClick={() => setMobileOpen(false)} />}
      <div className={`app-shell-sidebar-mobile${mobileOpen ? ' is-open' : ''}`}>
        <SidebarContent groups={groups} currentRole={currentRole} onNavigate={() => setMobileOpen(false)} />
      </div>

      <main className="app-shell-main">
        {/* Desktop topbar */}
        <div className="app-shell-topbar app-shell-topbar-desktop">
          <div style={{ fontFamily: theme.display, fontWeight: 700, color: theme.navy, fontSize: 18 }}>{title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {settingsHref && (
              <button
                onClick={() => router.push(settingsHref)}
                title="Settings"
                style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${theme.border}`, background: '#fff', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <GearIcon />
              </button>
            )}
            <ProfileMenu user={user} roleLabel={roleLabel} />
          </div>
        </div>

        {/* Mobile topbar */}
        <div className="app-shell-mobilebar">
          <HamburgerButton onClick={() => setMobileOpen(true)} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: theme.display, fontWeight: 700, color: theme.navy, fontSize: 16 }}>{title}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{roleLabel}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            {settingsHref && (
              <button onClick={() => router.push(settingsHref)} style={{ border: `1px solid ${theme.border}`, background: '#fff', borderRadius: 9, padding: '6px 8px', color: theme.navy, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <GearIcon />
              </button>
            )}
            <ProfileMenu user={user} roleLabel={roleLabel} />
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
