'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const ALL_PORTALS = [
  { key:'admin',     label:'Admin Portal',         seatKey:'admin',        seatLabel:'Admin Seats' },
  { key:'doctor',    label:'Doctor Portal',         seatKey:'doctor',       seatLabel:'Doctor Seats' },
  { key:'reception', label:'Reception Portal',      seatKey:'receptionist', seatLabel:'Reception Seats' },
  { key:'lab',       label:'Lab Portal',            seatKey:'lab',          seatLabel:'Lab Seats' },
  { key:'pharmacy',  label:'Pharmacy Portal',       seatKey:'pharmacist',   seatLabel:'Pharmacy Seats' },
  { key:'analytics', label:'Analytics / Reporting', seatKey:'reporting',    seatLabel:'Reporting Seats' },
  { key:'patient',   label:'Patient Portal',        seatKey:'patient',      seatLabel:'Patient Seats (-1 = unlimited)' },
];

const ROLE_LABELS = { 1:'Admin',2:'Doctor',3:'Patient',5:'Receptionist',6:'Lab Staff',7:'Pharmacist',8:'Reporting',9:'Super Admin' };
const STATUS_STYLE = {
  active:    { bg:'#ecfdf5', color:'#15803d' },
  paused:    { bg:'#fffbeb', color:'#b45309' },
  suspended: { bg:'#fef2f2', color:'#dc2626' },
  inactive:  { bg:'#f1f5f9', color:'#475569' },
};

const emptyCreate = {
  organization_name:'', contact_name:'', contact_email:'', contact_phone:'',
  address:'', domain:'', billing_status:'trial', payment_status:'pending', notes:'',
  portal_access:{ admin:true,doctor:true,patient:true,reception:true,lab:true,pharmacy:true,analytics:true },
  seat_limits:  { admin:2,doctor:3,receptionist:2,lab:1,pharmacist:1,reporting:1,patient:-1 },
  admin_user:{ first_name:'',last_name:'',email:'',password:'' },
};

export default function OrganizationsPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const urlOrgId     = searchParams.get('org');
  const urlNew       = searchParams.get('new');

  const [orgs,setOrgs]             = useState([]);
  const [summary,setSummary]       = useState(null);
  const [selected,setSelected]     = useState(null);
  const [detail,setDetail]         = useState(null);
  const [view,setView]             = useState('list');
  const [loading,setLoading]       = useState(true);
  const [saving,setSaving]         = useState(false);
  const [msg,setMsg]               = useState({ text:'',type:'info' });
  const [form,setForm]             = useState(emptyCreate);
  const [orgCode,setOrgCode]       = useState('');
  const [resetModal,setResetModal] = useState(null);
  const [newPwd,setNewPwd]         = useState('');

  const flash = (text,type='info') => { setMsg({text,type}); setTimeout(()=>setMsg({text:'',type:'info'}),4000); };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('/super-admin/organizations');
      setSummary(data.summary);
      setOrgs(data.organizations||[]);
    } catch(e){ flash(e.message,'error'); } finally{ setLoading(false); }
  },[]);

  const loadDetail = useCallback(async(id) => {
    try{
      const data = await api(`/super-admin/organizations/${id}`);
      setSelected({...data.organization});
      setDetail(data);
    } catch(e){ flash(e.message,'error'); }
  },[]);

  const loadNextCode = useCallback(async()=>{
    try{ const r=await api('/super-admin/next-org-code'); setOrgCode(r.org_code); } catch{ setOrgCode(''); }
  },[]);

  useEffect(()=>{ loadAll(); },[loadAll]);

  // React to URL params: ?org=ID opens detail, ?new=1 opens create form
  useEffect(() => {
    if (urlNew === '1') {
      loadNextCode().then(() => { setForm(emptyCreate); setView('create'); });
    } else if (urlOrgId) {
      setView('detail');
      loadDetail(urlOrgId);
    } else {
      setView('list');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlOrgId, urlNew]);

  const handleCreateOpen = () => router.push('/cxadmin/organizations?new=1');

  const handleCreate = async()=>{
    if(!form.organization_name.trim()) return flash('Organization name is required','error');
    setSaving(true);
    try{
      await api('/super-admin/organizations',{method:'POST',body:JSON.stringify(form)});
      flash('Organization onboarded ✓','success');
      await loadAll();
      router.push('/cxadmin/organizations');
    } catch(e){ flash(e.message,'error'); } finally{ setSaving(false); }
  };

  const handleSelect = async(org)=>{ router.push(`/cxadmin/organizations?org=${org.id}`); };

  const handleSave = async()=>{
    if(!selected?.id) return;
    setSaving(true);
    try{
      await api(`/super-admin/organizations/${selected.id}`,{method:'PUT',body:JSON.stringify({
        organization_name:selected.organization_name, contact_name:selected.contact_name,
        contact_email:selected.contact_email, contact_phone:selected.contact_phone,
        billing_status:selected.billing_status, payment_status:selected.payment_status,
        notes:selected.notes, seat_limits:selected.seat_limits, portal_access:selected.portal_access,
      })});
      flash('Saved ✓','success');
      await loadAll(); await loadDetail(selected.id);
    } catch(e){ flash(e.message,'error'); } finally{ setSaving(false); }
  };

  const setStatus = async(status)=>{
    if(!selected?.id) return;
    setSaving(true);
    try{
      await api(`/super-admin/organizations/${selected.id}/status`,{method:'PATCH',body:JSON.stringify({status})});
      flash(`Status → ${status}`,'success');
      await loadAll(); await loadDetail(selected.id);
    } catch(e){ flash(e.message,'error'); } finally{ setSaving(false); }
  };

  const impersonate = async()=>{
    if(!selected?.id) return;
    try{
      const data=await api(`/super-admin/organizations/${selected.id}/impersonate`,{method:'POST',body:JSON.stringify({target_role_id:1})});
      localStorage.setItem('token',data.token);
      localStorage.setItem('user',JSON.stringify(data.user));
      window.location.href='/admin/dashboard';
    } catch(e){ flash(e.message,'error'); }
  };

  const handleResetPwd = async()=>{
    if(!resetModal||!newPwd) return;
    try{
      await api(`/super-admin/organizations/${selected.id}/reset-user-password`,{method:'POST',body:JSON.stringify({user_id:resetModal.user_id,new_password:newPwd})});
      flash(`Password reset for ${resetModal.name} ✓`,'success');
      setResetModal(null); setNewPwd('');
    } catch(e){ flash(e.message,'error'); }
  };

  const deleteUser = async(userId,name)=>{
    if(!confirm(`Deactivate "${name}"? They will lose all access.`)) return;
    try{
      await api(`/super-admin/organizations/${selected.id}/users/${userId}`,{method:'DELETE'});
      flash(`${name} deactivated ✓`,'success');
      await loadDetail(selected.id);
    } catch(e){ flash(e.message,'error'); }
  };

  const deleteOrg = async()=>{
    if(!confirm(`Archive "${selected?.organization_name}"? Data kept 30 days.`)) return;
    try{
      await api(`/super-admin/organizations/${selected.id}`,{method:'DELETE'});
      flash('Organization archived. Data retained 30 days.','success');
      setSelected(null); setDetail(null); setView('list'); await loadAll();
    } catch(e){ flash(e.message,'error'); }
  };

  const toggleFormPortal=(key,val)=>setForm(p=>({...p,portal_access:{...p.portal_access,[key]:val}}));
  const setFormSeat=(k,v)=>setForm(p=>({...p,seat_limits:{...p.seat_limits,[k]:Number(v)}}));
  const toggleSelPortal=(key,val)=>setSelected(p=>({...p,portal_access:{...p.portal_access,[key]:val}}));
  const setSelSeat=(k,v)=>setSelected(p=>({...p,seat_limits:{...p.seat_limits,[k]:Number(v)}}));

  const PortalRows = ({access,seats,onToggle,onSeat})=> ALL_PORTALS.map(p=>{
    const enabled=!!access?.[p.key];
    return(
      <div key={p.key} style={{marginBottom:10,borderRadius:10,border:`1.5px solid ${enabled?'#00b4a0':'#e2e8f0'}`,background:enabled?'#f0fdfa':'#f8fafc'}}>
        <label style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:'pointer'}}>
          <input type="checkbox" checked={enabled} onChange={e=>onToggle(p.key,e.target.checked)}/>
          <span style={{fontWeight:700,fontSize:13,color:enabled?'#0f766e':'#64748b'}}>{p.label}</span>
        </label>
        {enabled&&(
          <div style={{padding:'0 14px 12px',display:'flex',alignItems:'center',gap:10}}>
            <label style={{fontSize:12,color:'#64748b',flex:1}}>{p.seatLabel}</label>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <button onClick={()=>onSeat(p.seatKey,Math.max(-1,(seats?.[p.seatKey]||0)-1))} style={S.stepBtn}>−</button>
              <input type="number" value={seats?.[p.seatKey]??1} onChange={e=>onSeat(p.seatKey,e.target.value)} style={{...S.input,width:60,textAlign:'center',padding:'6px 4px'}}/>
              <button onClick={()=>onSeat(p.seatKey,(seats?.[p.seatKey]||0)+1)} style={S.stepBtn}>＋</button>
            </div>
          </div>
        )}
      </div>
    );
  });

  return(
    <div style={{minHeight:'100%'}}>
      <div style={S.main}>
        {msg.text&&(
          <div style={{...S.flash,background:msg.type==='error'?'#fef2f2':msg.type==='success'?'#f0fdf4':'#eff6ff',color:msg.type==='error'?'#dc2626':msg.type==='success'?'#15803d':'#1d4ed8',borderColor:msg.type==='error'?'#fecaca':msg.type==='success'?'#bbf7d0':'#bfdbfe'}}>
            {msg.text}<button onClick={()=>setMsg({text:'',type:'info'})} style={S.flashX}>×</button>
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {view==='list'&&(
          <div>
            <div style={S.pageHead}>
              <div>
                <h1 style={S.h1}>Organizations</h1>
                <p style={{margin:'4px 0 0',color:'#64748b',fontSize:14}}>Click an org card or use the panel to manage. Onboard new clients with ＋.</p>
              </div>
              <button onClick={handleCreateOpen} style={S.primaryBtn}>＋ Onboard Organization</button>
            </div>
            {summary&&(
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:24}}>
                {[['Total',summary.total_organizations,'#0f1f3d'],['Active',summary.active,'#00b4a0'],['Paused',summary.paused,'#f59e0b'],['Suspended',summary.suspended,'#ef4444']].map(([l,v,c])=>(
                  <div key={l} style={{...S.card,borderTop:`4px solid ${c}`,textAlign:'center'}}>
                    <div style={{fontSize:11,color:'#64748b',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em'}}>{l}</div>
                    <div style={{fontSize:32,fontWeight:800,color:c,marginTop:6}}>{v}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:14}}>
              {orgs.map(org=>{
                const ss=STATUS_STYLE[org.status]||STATUS_STYLE.inactive;
                return(
                  <button key={org.id} onClick={()=>handleSelect(org)} style={S.orgCard}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                      <div style={{width:40,height:40,borderRadius:10,background:'linear-gradient(135deg,#1e3f85,#00b4a0)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:18}}>
                        {org.organization_name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{...S.badge,background:ss.bg,color:ss.color}}>{org.status}</span>
                    </div>
                    <div style={{fontWeight:800,fontSize:15,color:'#0f1f3d',marginBottom:4,textAlign:'left'}}>{org.organization_name}</div>
                    <div style={{fontSize:12,color:'#64748b',textAlign:'left'}}>{org.organization_code} · {org.active_users} users</div>
                  </button>
                );
              })}
              <button onClick={handleCreateOpen} style={{...S.orgCard,border:'2px dashed #cbd5e1',background:'#f8fafc',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,minHeight:110}}>
                <span style={{fontSize:28,color:'#00b4a0'}}>＋</span>
                <span style={{fontSize:13,fontWeight:700,color:'#64748b'}}>Onboard New</span>
              </button>
            </div>
          </div>
        )}

        {/* ── CREATE VIEW ── */}
        {view==='create'&&(
          <div>
            <div style={S.pageHead}>
              <div>
                <h1 style={S.h1}>Onboard New Organization</h1>
                <p style={{margin:'4px 0 0',color:'#64748b',fontSize:14}}>Org code is auto-assigned ({orgCode}). Fill in the details below.</p>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>router.push('/cxadmin/organizations')} style={S.secondaryBtn}>← Cancel</button>
                <button onClick={handleCreate} disabled={saving} style={S.primaryBtn}>{saving?'Creating…':'Create Organization'}</button>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
              <div style={S.card}>
                <h2 style={S.h2}>Organization Details</h2>
                <div style={S.fg}><label style={S.label}>Organization Name *</label>
                  <input style={S.input} value={form.organization_name} onChange={e=>setForm(p=>({...p,organization_name:e.target.value}))} placeholder="City General Hospital"/></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div style={S.fg}><label style={S.label}>Org Code (auto)</label>
                    <input style={{...S.input,background:'#f1f5f9',color:'#94a3b8'}} value={orgCode} readOnly/></div>
                  <div style={S.fg}><label style={S.label}>Domain (optional)</label>
                    <input style={S.input} value={form.domain} onChange={e=>setForm(p=>({...p,domain:e.target.value}))} placeholder="hospital.com"/></div>
                </div>
                <div style={S.fg}><label style={S.label}>Contact Full Name</label>
                  <input style={S.input} value={form.contact_name} onChange={e=>setForm(p=>({...p,contact_name:e.target.value}))}/></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div style={S.fg}><label style={S.label}>Contact Email</label>
                    <input style={S.input} type="email" value={form.contact_email} onChange={e=>setForm(p=>({...p,contact_email:e.target.value}))}/></div>
                  <div style={S.fg}><label style={S.label}>Contact Phone</label>
                    <input style={S.input} value={form.contact_phone} onChange={e=>setForm(p=>({...p,contact_phone:e.target.value}))}/></div>
                </div>
                <div style={S.fg}><label style={S.label}>Address</label>
                  <textarea style={{...S.input,minHeight:60}} value={form.address} onChange={e=>setForm(p=>({...p,address:e.target.value}))} placeholder="Street, City, State, PIN"/></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div style={S.fg}><label style={S.label}>Billing Status</label>
                    <select style={S.input} value={form.billing_status} onChange={e=>setForm(p=>({...p,billing_status:e.target.value}))}>
                      <option value="trial">Trial</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
                  <div style={S.fg}><label style={S.label}>Payment Status</label>
                    <select style={S.input} value={form.payment_status} onChange={e=>setForm(p=>({...p,payment_status:e.target.value}))}>
                      <option value="pending">Pending</option><option value="paid">Paid</option><option value="failed">Failed</option></select></div>
                </div>
                <div style={S.fg}><label style={S.label}>Notes</label>
                  <textarea style={{...S.input,minHeight:60}} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/></div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <div style={S.card}>
                  <h2 style={S.h2}>Portals & Seats</h2>
                  <p style={{fontSize:12,color:'#64748b',marginBottom:14}}>Enable portals first, then set seat count for each.</p>
                  <PortalRows access={form.portal_access} seats={form.seat_limits} onToggle={toggleFormPortal} onSeat={setFormSeat}/>
                </div>
                <div style={S.card}>
                  <h2 style={S.h2}>Initial Admin Account</h2>
                  <p style={{fontSize:12,color:'#64748b',marginBottom:14}}>Creates the first admin login for this organization.</p>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <div style={S.fg}><label style={S.label}>First Name</label>
                      <input style={S.input} value={form.admin_user.first_name} onChange={e=>setForm(p=>({...p,admin_user:{...p.admin_user,first_name:e.target.value}}))}/></div>
                    <div style={S.fg}><label style={S.label}>Last Name</label>
                      <input style={S.input} value={form.admin_user.last_name} onChange={e=>setForm(p=>({...p,admin_user:{...p.admin_user,last_name:e.target.value}}))}/></div>
                  </div>
                  <div style={S.fg}><label style={S.label}>Email (used to login)</label>
                    <input style={S.input} type="email" value={form.admin_user.email} onChange={e=>setForm(p=>({...p,admin_user:{...p.admin_user,email:e.target.value}}))}/></div>
                  <div style={S.fg}><label style={S.label}>Password</label>
                    <input style={S.input} type="password" value={form.admin_user.password} onChange={e=>setForm(p=>({...p,admin_user:{...p.admin_user,password:e.target.value}}))}/></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── DETAIL VIEW ── */}
        {view==='detail'&&selected&&(
          <div>
            <div style={S.pageHead}>
              <div>
                <h1 style={S.h1}>{selected.organization_name}</h1>
                <div style={{fontSize:13,color:'#64748b',marginTop:4}}>
                  {selected.organization_code} &nbsp;·&nbsp;
                  <span style={{...S.badge,...(STATUS_STYLE[selected.status]||STATUS_STYLE.inactive)}}>{selected.status}</span>
                </div>
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <button onClick={()=>setStatus('active')} disabled={saving} style={S.secondaryBtn}>Activate</button>
                <button onClick={()=>setStatus('paused')} disabled={saving} style={S.secondaryBtn}>Pause</button>
                <button onClick={()=>setStatus('suspended')} disabled={saving} style={S.dangerBtn}>Suspend</button>
                <button onClick={impersonate} disabled={saving} style={S.primaryBtn}>↗ Open Portal</button>
                <button onClick={handleSave} disabled={saving} style={{...S.primaryBtn,background:'#1e3f85'}}>{saving?'Saving…':'Save Changes'}</button>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20}}>
              <div style={S.card}>
                <h2 style={S.h2}>Contact & Billing</h2>
                {[['Contact Name','contact_name'],['Contact Email','contact_email'],['Contact Phone','contact_phone']].map(([l,k])=>(
                  <div key={k} style={S.fg}><label style={S.label}>{l}</label>
                    <input style={S.input} value={selected[k]||''} onChange={e=>setSelected(p=>({...p,[k]:e.target.value}))}/></div>
                ))}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  {[['Billing Status','billing_status',['trial','active','inactive']],['Payment Status','payment_status',['pending','paid','failed']]].map(([l,k,opts])=>(
                    <div key={k} style={S.fg}><label style={S.label}>{l}</label>
                      <select style={S.input} value={selected[k]||''} onChange={e=>setSelected(p=>({...p,[k]:e.target.value}))}>
                        {opts.map(o=><option key={o} value={o}>{o}</option>)}</select></div>
                  ))}
                </div>
                <div style={S.fg}><label style={S.label}>Notes</label>
                  <textarea style={{...S.input,minHeight:70}} value={selected.notes||''} onChange={e=>setSelected(p=>({...p,notes:e.target.value}))}/></div>
              </div>
              <div style={S.card}>
                <h2 style={S.h2}>Portals & Seats</h2>
                <PortalRows access={selected.portal_access} seats={selected.seat_limits} onToggle={toggleSelPortal} onSeat={setSelSeat}/>
              </div>
            </div>

            {detail?.users?.length>0&&(
              <div style={{...S.card,marginBottom:20}}>
                <h2 style={{...S.h2,marginBottom:14}}>Users</h2>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',minWidth:560}}>
                    <thead><tr>{['Name','Email','Role','Status','Actions'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {detail.users.map(u=>(
                        <tr key={u.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                          <td style={S.td}>{u.first_name} {u.last_name}</td>
                          <td style={S.td}>{u.email}</td>
                          <td style={S.td}>{ROLE_LABELS[u.role_id]||`Role ${u.role_id}`}</td>
                          <td style={S.td}><span style={{...S.badge,background:u.is_active?'#ecfdf5':'#fef2f2',color:u.is_active?'#15803d':'#dc2626'}}>{u.is_active?'Active':'Inactive'}</span></td>
                          <td style={{...S.td,display:'flex',gap:6}}>
                            <button onClick={()=>{setResetModal({user_id:u.id,name:`${u.first_name} ${u.last_name}`});setNewPwd('');}} style={S.miniBtn}>🔑 Reset Pwd</button>
                            <button onClick={()=>deleteUser(u.id,`${u.first_name} ${u.last_name}`)} style={{...S.miniBtn,color:'#dc2626',borderColor:'#fecaca'}}>🗑 Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{...S.card,border:'1.5px solid #fecaca',background:'#fff5f5'}}>
              <h2 style={{...S.h2,color:'#dc2626',marginBottom:8}}>Danger Zone</h2>
              <p style={{fontSize:13,color:'#7f1d1d',marginBottom:14}}>Archiving suspends all access immediately. Clinical data retained for 30 days, then permanently deleted. A copy is emailed to you.</p>
              <button onClick={deleteOrg} style={{...S.dangerBtn,background:'#dc2626',color:'#fff',border:'none'}}>Archive & Delete Organization</button>
            </div>
          </div>
        )}
      </div>

      {/* PASSWORD RESET MODAL */}
      {resetModal&&(
        <div style={S.overlay}>
          <div style={S.modal}>
            <h2 style={{...S.h2,marginBottom:6}}>Reset Password</h2>
            <p style={{fontSize:13,color:'#64748b',marginBottom:16}}>Set a new password for <strong>{resetModal.name}</strong></p>
            <label style={S.label}>New Password (min. 8 chars)</label>
            <input style={{...S.input,marginBottom:16}} type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)} placeholder="••••••••"/>
            <div style={{display:'flex',gap:10}}>
              <button onClick={handleResetPwd} disabled={newPwd.length<8} style={{...S.primaryBtn,opacity:newPwd.length<8?.5:1}}>Set Password</button>
              <button onClick={()=>{setResetModal(null);setNewPwd('');}} style={S.secondaryBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S={
  aside:      {width:240,minWidth:200,background:'#fff',borderRight:'1px solid #e2e8f0',display:'flex',flexDirection:'column',flexShrink:0},
  asideHeader:{padding:'14px 12px 10px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #e2e8f0'},
  addBtn:     {width:28,height:28,borderRadius:8,border:'1.5px solid #00b4a0',background:'#f0fdfa',color:'#00b4a0',cursor:'pointer',fontWeight:800,fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'},
  orgRow:     {display:'block',width:'100%',padding:'10px 14px',textAlign:'left',border:'none',borderBottom:'1px solid #f1f5f9',cursor:'pointer'},
  main:       {padding:'24px 28px',background:'#f5f8fc',minHeight:'100vh'},
  pageHead:   {display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,flexWrap:'wrap',gap:12},
  h1:         {margin:0,fontSize:24,fontWeight:800,color:'#0f1f3d',fontFamily:'var(--font-display)'},
  h2:         {margin:'0 0 14px',fontSize:16,fontWeight:800,color:'#0f1f3d'},
  card:       {background:'#fff',borderRadius:14,border:'1px solid #e2e8f0',padding:20,boxShadow:'0 2px 12px rgba(15,31,61,.04)'},
  orgCard:    {textAlign:'left',border:'1px solid #e2e8f0',borderRadius:14,padding:16,cursor:'pointer',background:'#fff',width:'100%'},
  fg:         {marginBottom:12},
  label:      {display:'block',marginBottom:5,fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.06em'},
  input:      {width:'100%',padding:'10px 12px',borderRadius:9,border:'1.5px solid #dbe4ee',background:'#f8fafc',color:'#0f1f3d',fontSize:13,boxSizing:'border-box'},
  badge:      {display:'inline-flex',padding:'2px 8px',borderRadius:99,fontSize:11,fontWeight:700},
  primaryBtn: {padding:'10px 18px',borderRadius:9,border:'none',background:'#00b4a0',color:'#fff',fontWeight:700,cursor:'pointer',fontSize:13},
  secondaryBtn:{padding:'10px 16px',borderRadius:9,border:'1.5px solid #dbe4ee',background:'#fff',color:'#0f1f3d',fontWeight:700,cursor:'pointer',fontSize:13},
  dangerBtn:  {padding:'10px 16px',borderRadius:9,border:'1.5px solid #fecaca',background:'#fff5f5',color:'#dc2626',fontWeight:700,cursor:'pointer',fontSize:13},
  stepBtn:    {width:30,height:30,borderRadius:7,border:'1.5px solid #dbe4ee',background:'#fff',cursor:'pointer',fontWeight:800,fontSize:16,color:'#0f1f3d'},
  miniBtn:    {padding:'4px 10px',borderRadius:7,border:'1.5px solid #dbe4ee',background:'#fff',cursor:'pointer',fontSize:12,fontWeight:600,color:'#334155'},
  th:         {textAlign:'left',padding:'10px 12px',fontSize:11,color:'#64748b',borderBottom:'1px solid #e2e8f0',textTransform:'uppercase',letterSpacing:'.05em',fontWeight:700},
  td:         {padding:'10px 12px',fontSize:13,color:'#334155'},
  flash:      {marginBottom:16,border:'1px solid',borderRadius:10,padding:'10px 14px',display:'flex',alignItems:'center',fontSize:13},
  flashX:     {marginLeft:'auto',background:'none',border:'none',cursor:'pointer',fontSize:18,lineHeight:1},
  overlay:    {position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999},
  modal:      {background:'#fff',borderRadius:16,padding:28,width:'100%',maxWidth:400,boxShadow:'0 20px 60px rgba(0,0,0,.2)'},
  empty:      {padding:'20px 14px',color:'#94a3b8',fontSize:13},
};
