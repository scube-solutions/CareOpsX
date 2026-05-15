'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getUser, clearAuth } from '@/lib/auth';
import { api } from '@/lib/api';

/* ── Icons ───────────────────────────────────────────────────── */
const IcOrg    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>;
const IcKey    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L22 7l-3-3"/></svg>;
const IcLogout = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IcChevron = ({ open }) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}><polyline points="9 18 15 12 9 6"/></svg>;
const STATUS_DOT = { active:'#00b4a0', paused:'#f59e0b', suspended:'#ef4444', inactive:'#94a3b8' };

export default function CxAdminLayout({ children }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [user, setUser]         = useState(null);
  const [ready, setReady]       = useState(false);
  const [orgs, setOrgs]         = useState([]);
  const [orgsOpen, setOrgsOpen] = useState(true);   // accordion open by default
  const [pwdModal, setPwdModal] = useState(false);
  const [pwd, setPwd]           = useState({ current:'', next:'', confirm:'' });
  const [pwdMsg, setPwdMsg]     = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  /* ── Auth check ────────────────────────────────────────────── */
  useEffect(() => {
    const u = getUser();
    const roles = Array.isArray(u?.roles) && u.roles.length ? u.roles : [u?.role_id];
    if (!u || !roles.includes(9)) { window.location.href = '/login'; return; }
    setUser(u);
    setReady(true);
  }, []);

  /* ── Load orgs for sidebar ─────────────────────────────────── */
  const loadOrgs = useCallback(async () => {
    try {
      const data = await api('/super-admin/organizations');
      setOrgs(data.organizations || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { if (ready) loadOrgs(); }, [ready, loadOrgs]);

  /* ── Change password ───────────────────────────────────────── */
  const handleChangePwd = async () => {
    if (!pwd.next || pwd.next.length < 8) return setPwdMsg('New password must be at least 8 characters.');
    if (pwd.next !== pwd.confirm) return setPwdMsg('Passwords do not match.');
    setPwdSaving(true); setPwdMsg('');
    try {
      await api('/auth/change-password', { method:'POST', body: JSON.stringify({ current_password: pwd.current, new_password: pwd.next }) });
      setPwdMsg('✓ Password changed successfully.');
      setTimeout(() => { setPwdModal(false); setPwd({ current:'', next:'', confirm:'' }); setPwdMsg(''); }, 1800);
    } catch (e) {
      setPwdMsg(e.message || 'Failed to change password.');
    } finally { setPwdSaving(false); }
  };

  if (!ready) return null;

  const initials = user?.first_name
    ? `${user.first_name[0]}${user.last_name?.[0] || ''}`.toUpperCase()
    : 'SA';

  /* ── Derive selected org from URL query or pathname ─────────── */
  const urlOrgId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('org')
    : null;

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f5f8fc' }}>

      {/* ══════ SIDEBAR ══════ */}
      <aside style={S.aside}>

        {/* Logo */}
        <div style={S.logoRow}>
          <div style={S.logoBox}>
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
              <rect x="10.5" y="4" width="3" height="16" rx="1.5" fill="white"/>
              <rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="white"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:14, color:'#fff', lineHeight:1.1 }}>Care<span style={{ color:'#00b4a0' }}>OpsX</span></div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,.3)', textTransform:'uppercase', letterSpacing:'.08em' }}>Platform Control</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'10px 8px', overflowY:'auto' }}>

          {/* Organizations accordion */}
          <button onClick={() => setOrgsOpen(o => !o)} style={S.accordionBtn}>
            <span style={{ display:'flex', alignItems:'center', gap:8 }}>
              <IcOrg />
              <span style={{ fontSize:13, fontWeight:600 }}>Organizations</span>
            </span>
            <IcChevron open={orgsOpen} />
          </button>

          {orgsOpen && (
            <div style={{ paddingLeft:8, marginBottom:6 }}>
              {/* "All orgs" link */}
              <a href="/cxadmin/organizations" style={{
                ...S.orgLink,
                background: pathname === '/cxadmin/organizations' && !urlOrgId ? 'rgba(0,180,160,.14)' : 'transparent',
                color: pathname === '/cxadmin/organizations' && !urlOrgId ? '#00b4a0' : 'rgba(255,255,255,.55)',
              }}>
                All Organizations
              </a>

              {orgs.map(org => {
                const isSelected = urlOrgId === String(org.id);
                return (
                  <a key={org.id} href={`/cxadmin/organizations?org=${org.id}`} style={{
                    ...S.orgLink,
                    background: isSelected ? 'rgba(0,180,160,.14)' : 'transparent',
                    color: isSelected ? '#00b4a0' : 'rgba(255,255,255,.55)',
                  }}>
                    <span style={{ width:7, height:7, borderRadius:'50%', background: STATUS_DOT[org.status] || '#94a3b8', flexShrink:0, display:'inline-block' }} />
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{org.organization_name}</span>
                  </a>
                );
              })}

              {/* Onboard new */}
              <a href="/cxadmin/organizations?new=1" style={{ ...S.orgLink, color:'rgba(0,180,160,.7)', fontWeight:600 }}>
                ＋ Onboard New
              </a>
            </div>
          )}
        </nav>

        {/* Bottom section */}
        <div style={S.bottom}>
          {/* User info */}
          <div style={S.userRow}>
            <div style={S.avatar}>{initials}</div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {user?.first_name} {user?.last_name}
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>Super Admin</div>
            </div>
          </div>

          {/* Change Password */}
          <button onClick={() => { setPwdModal(true); setPwdMsg(''); setPwd({ current:'', next:'', confirm:'' }); }} style={S.bottomBtn}>
            <IcKey /> Change Password
          </button>

          {/* Sign Out */}
          <button onClick={() => { clearAuth(); window.location.href = '/login'; }} style={{ ...S.bottomBtn, color:'rgba(255,100,100,.7)', borderColor:'rgba(255,100,100,.2)' }}>
            <IcLogout /> Sign Out
          </button>
        </div>
      </aside>

      {/* ══════ MAIN CONTENT ══════ */}
      <main style={{ flex:1, overflowY:'auto' }}>
        {children}
      </main>

      {/* ══════ CHANGE PASSWORD MODAL ══════ */}
      {pwdModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <h2 style={{ margin:'0 0 6px', fontSize:18, fontWeight:800, color:'#0f1f3d' }}>Change Password</h2>
            <p style={{ fontSize:13, color:'#64748b', marginBottom:18 }}>Update your super admin account password.</p>

            {[
              ['Current Password', 'current'],
              ['New Password (min. 8 chars)', 'next'],
              ['Confirm New Password', 'confirm'],
            ].map(([label, key]) => (
              <div key={key} style={{ marginBottom:12 }}>
                <label style={S.label}>{label}</label>
                <input type="password" style={S.input}
                  value={pwd[key]}
                  onChange={e => setPwd(p => ({ ...p, [key]: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
            ))}

            {pwdMsg && (
              <div style={{ fontSize:13, marginBottom:14, color: pwdMsg.startsWith('✓') ? '#15803d' : '#dc2626', background: pwdMsg.startsWith('✓') ? '#f0fdf4' : '#fef2f2', padding:'8px 12px', borderRadius:8 }}>
                {pwdMsg}
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={handleChangePwd} disabled={pwdSaving || pwd.next.length < 8} style={{ ...S.primaryBtn, opacity: pwdSaving || pwd.next.length < 8 ? .6 : 1 }}>
                {pwdSaving ? 'Saving…' : 'Update Password'}
              </button>
              <button onClick={() => setPwdModal(false)} style={S.secondaryBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  aside:       { width:228, minHeight:'100vh', background:'#0f1f3d', display:'flex', flexDirection:'column', flexShrink:0, position:'sticky', top:0, height:'100vh' },
  logoRow:     { padding:'16px 14px', borderBottom:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', gap:10 },
  logoBox:     { width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#1e3f85,#13cfbd)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  accordionBtn:{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 10px', borderRadius:9, border:'none', background:'rgba(255,255,255,.05)', color:'rgba(255,255,255,.75)', cursor:'pointer', marginBottom:4 },
  orgLink:     { display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:8, fontSize:12, fontWeight:500, textDecoration:'none', marginBottom:2, transition:'all .1s' },
  bottom:      { padding:'10px 10px 14px', borderTop:'1px solid rgba(255,255,255,.08)' },
  userRow:     { display:'flex', alignItems:'center', gap:10, padding:'10px 4px 12px' },
  avatar:      { width:34, height:34, borderRadius:'50%', background:'#00b4a0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0 },
  bottomBtn:   { width:'100%', display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,.12)', background:'transparent', color:'rgba(255,255,255,.6)', cursor:'pointer', fontSize:12, fontWeight:500, marginBottom:6 },
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 },
  modal:       { background:'#fff', borderRadius:16, padding:28, width:'100%', maxWidth:400, boxShadow:'0 24px 60px rgba(0,0,0,.25)' },
  label:       { display:'block', marginBottom:5, fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.06em' },
  input:       { width:'100%', padding:'10px 12px', borderRadius:9, border:'1.5px solid #dbe4ee', background:'#f8fafc', color:'#0f1f3d', fontSize:13, boxSizing:'border-box' },
  primaryBtn:  { padding:'10px 18px', borderRadius:9, border:'none', background:'#00b4a0', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:13 },
  secondaryBtn:{ padding:'10px 16px', borderRadius:9, border:'1.5px solid #dbe4ee', background:'#fff', color:'#0f1f3d', fontWeight:700, cursor:'pointer', fontSize:13 },
};
