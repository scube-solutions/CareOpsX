'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const ROLE_LABELS = { 1:'Admin', 2:'Doctor', 5:'Receptionist', 6:'Lab Staff', 7:'Pharmacist', 8:'Reporting', 10:'Nurse', 11:'HR Manager' };
const ROLE_OPTIONS = [
  { value:2, label:'Doctor' }, { value:10, label:'Nurse' }, { value:5, label:'Receptionist' },
  { value:6, label:'Lab Staff' }, { value:7, label:'Pharmacist' }, { value:11, label:'HR Manager' },
  { value:8, label:'Reporting' }, { value:1, label:'Admin' },
];
const DEPT_OPTIONS = ['General','Cardiology','Neurology','Orthopedics','Lab','Pharmacy','Administration','Nursing','Reception'];
const STATUS_OPTIONS = ['Active','Inactive','On Leave','Probation'];

export default function StaffPage() {
  const [staff, setStaff]       = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({});
  const [editing, setEditing]   = useState(null);
  const [msg, setMsg]           = useState('');
  const [search, setSearch]     = useState('');

  const load = async () => {
    try { const d = await api('/hr/staff'); setStaff(d.staff || []); } catch(e) { setMsg(e.message); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing) await api(`/hr/staff/${editing.id}`, { method:'PUT', body:JSON.stringify(form) });
      else         await api('/hr/staff',                { method:'POST', body:JSON.stringify(form) });
      setMsg(editing ? 'Employee updated' : 'Employee created'); setShowForm(false); setForm({}); setEditing(null); load();
    } catch(e) { setMsg(e.message); }
  };

  const toggle = async (id) => {
    try { await api(`/hr/staff/${id}/toggle`, { method:'PATCH' }); load(); } catch(e) { setMsg(e.message); }
  };

  const invite = async (id) => {
    try { const d = await api(`/hr/staff/${id}/invite`, { method:'POST' }); setMsg(d.message + (d.activate_url ? ` — ${d.activate_url}` : '')); load(); }
    catch(e) { setMsg(e.message); }
  };

  const startEdit = (s) => {
    setEditing(s);
    setForm({
      employee_id: s.employee_id || '', full_name: s.full_name || `${s.users?.first_name||''} ${s.users?.last_name||''}`.trim(),
      email: s.email || s.users?.email || '', mobile: s.mobile || s.users?.phone || '',
      department: s.department || '', designation: s.designation || '',
      role_id: s.role_id || s.users?.role_id || '', employment_type: s.employment_type || '',
      employment_status: s.employment_status || (s.is_active === false ? 'Inactive' : 'Active'),
      date_of_joining: s.date_of_joining || '', blood_group: s.blood_group || '',
      emergency_contact: s.emergency_contact || '', address: s.address || '',
    });
    setShowForm(true);
  };

  const filtered = staff.filter(s => {
    const name = s.full_name || `${s.users?.first_name||''} ${s.users?.last_name||''}`;
    const email = s.email || s.users?.email || '';
    return `${name} ${email} ${s.department || ''} ${s.employee_id || ''}`.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div style={p.page}>
      <div style={p.header}>
        <div>
          <h1 style={p.h1}>Staff Management</h1>
          <p style={p.sub}>All employees across departments</p>
        </div>
        <button onClick={() => { setShowForm(true); setForm({ employment_status:'Active', create_login:false }); setEditing(null); }} style={p.btnPri}>+ Add Employee</button>
      </div>

      {msg && <div style={p.msg}>{msg}<button onClick={()=>setMsg('')} style={p.msgX}>×</button></div>}

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        {[
          ['Total Staff',  staff.length,                                                          '#0f1f3d'],
          ['Active',       staff.filter(s=>s.is_active!==false).length,                           '#065f46'],
          ['With Login',   staff.filter(s=>!!s.user_id).length,                                   '#1d4ed8'],
          ['On Leave',     staff.filter(s=>s.employment_status==='On Leave').length,              '#92400e'],
        ].map(([l,v,c]) => (
          <div key={l} style={p.statCard}>
            <div style={p.statLabel}>{l}</div>
            <div style={{ ...p.statVal, color:c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div style={{ ...p.card, marginBottom:20, borderLeft:'4px solid #00b4a0' }}>
          <h2 style={p.h2}>{editing ? 'Edit Employee' : 'New Employee'}</h2>
          <div style={p.grid3}>
            <div style={p.fg}><label style={p.label}>Employee ID</label><input value={form.employee_id||''} onChange={e=>setForm({...form,employee_id:e.target.value})} style={p.input} placeholder="EMP-001" /></div>
            <div style={p.fg}><label style={p.label}>Full Name *</label><input value={form.full_name||''} onChange={e=>setForm({...form,full_name:e.target.value})} style={p.input} placeholder="Jane Doe" /></div>
            <div style={p.fg}><label style={p.label}>Email *</label><input type="email" value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})} style={p.input} placeholder="jane@hospital.com" /></div>
            <div style={p.fg}><label style={p.label}>Mobile Number</label><input value={form.mobile||''} onChange={e=>setForm({...form,mobile:e.target.value})} style={p.input} placeholder="9876543210" /></div>
            <div style={p.fg}><label style={p.label}>Department</label>
              <select value={form.department||''} onChange={e=>setForm({...form,department:e.target.value})} style={p.input}>
                <option value="">Select</option>
                {DEPT_OPTIONS.map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
            <div style={p.fg}><label style={p.label}>Designation</label><input value={form.designation||''} onChange={e=>setForm({...form,designation:e.target.value})} style={p.input} placeholder="Senior Nurse" /></div>
            <div style={p.fg}><label style={p.label}>Assigned Role{form.create_login ? ' *' : ''}</label>
              <select value={form.role_id||''} onChange={e=>setForm({...form,role_id:e.target.value})} style={p.input}>
                <option value="">Select</option>
                {ROLE_OPTIONS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div style={p.fg}><label style={p.label}>Employment Status</label>
              <select value={form.employment_status||'Active'} onChange={e=>setForm({...form,employment_status:e.target.value})} style={p.input}>
                {STATUS_OPTIONS.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={p.fg}><label style={p.label}>Employment Type</label>
              <select value={form.employment_type||''} onChange={e=>setForm({...form,employment_type:e.target.value})} style={p.input}>
                <option value="">Select</option>
                {['Full-Time','Part-Time','Contract','Intern'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={p.fg}><label style={p.label}>Date of Joining</label><input type="date" value={form.date_of_joining||''} onChange={e=>setForm({...form,date_of_joining:e.target.value})} style={p.input} /></div>
            <div style={p.fg}><label style={p.label}>Emergency Contact</label><input value={form.emergency_contact||''} onChange={e=>setForm({...form,emergency_contact:e.target.value})} style={p.input} /></div>
            <div style={p.fg}><label style={p.label}>Blood Group</label><input value={form.blood_group||''} onChange={e=>setForm({...form,blood_group:e.target.value})} style={p.input} placeholder="A+" /></div>
            <div style={p.fg}><label style={p.label}>Address</label><input value={form.address||''} onChange={e=>setForm({...form,address:e.target.value})} style={p.input} /></div>
          </div>
          {!editing && (
            <label style={{ display:'flex', alignItems:'center', gap:10, marginTop:16, padding:'12px 14px', background:'#f0fdfb', border:'1px solid #99f6e4', borderRadius:8, cursor:'pointer' }}>
              <input type="checkbox" checked={!!form.create_login} onChange={e=>setForm({...form,create_login:e.target.checked})} style={{ width:16, height:16 }} />
              <div>
                <div style={{ fontWeight:700, fontSize:13, color:'#0f766e' }}>Create System Login</div>
                <div style={{ fontSize:11, color:'#0f766e' }}>Creates a linked user account in User Management. You can then invite them to activate it.</div>
              </div>
            </label>
          )}
          <div style={{display:'flex',gap:10,marginTop:16}}>
            <button onClick={save} style={p.btnPri}>{editing ? 'Update' : 'Create Employee'}</button>
            <button onClick={()=>{setShowForm(false);setEditing(null);setForm({});}} style={p.btnSec}>Cancel</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom:12 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, email, department…" style={{...p.input, maxWidth:340}} />
      </div>

      {/* Table */}
      <div style={p.card}>
        <table style={p.table}>
          <thead><tr>{['Employee','Email','Role','Department','Login','Status','Actions'].map(h=><th key={h} style={p.th}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(s => {
              const u = s.users || {};
              const name = s.full_name || `${u.first_name||''} ${u.last_name||''}`.trim() || '–';
              const email = s.email || u.email || '–';
              const roleId = s.role_id || u.role_id;
              const hasLogin = !!s.user_id;
              const inviteStatus = u.invite_status; // null | invited | active
              const loginBadge = !hasLogin
                ? p.badge('#f1f5f9','#64748b')
                : inviteStatus === 'active' ? p.badge('#f0fdf4','#065f46')
                : inviteStatus === 'invited' ? p.badge('#fffbeb','#92400e')
                : p.badge('#eff6ff','#1d4ed8');
              const loginLabel = !hasLogin ? 'No login' : inviteStatus === 'active' ? 'Activated' : inviteStatus === 'invited' ? 'Invited' : 'Pending';
              return (
                <tr key={s.id}>
                  <td style={p.td}><strong>{name}</strong><div style={{fontSize:11,color:'#94a3b8'}}>{s.employee_id||'–'}{s.designation?` · ${s.designation}`:''}</div></td>
                  <td style={p.td}>{email}</td>
                  <td style={p.td}><span style={p.badge('#eff6ff','#1d4ed8')}>{ROLE_LABELS[roleId]||'Staff'}</span></td>
                  <td style={p.td}>{s.department||'–'}</td>
                  <td style={p.td}><span style={loginBadge}>{loginLabel}</span></td>
                  <td style={p.td}><span style={p.badge(s.is_active!==false?'#f0fdf4':'#fef2f2', s.is_active!==false?'#065f46':'#dc2626')}>{s.employment_status||(s.is_active!==false?'Active':'Inactive')}</span></td>
                  <td style={p.td}>
                    <button onClick={()=>startEdit(s)} style={p.actBtn}>Edit</button>
                    {hasLogin && inviteStatus !== 'active' && (
                      <button onClick={()=>invite(s.id)} style={{...p.actBtn,marginLeft:6,color:'#1d4ed8'}}>{inviteStatus === 'invited' ? 'Re-invite' : 'Invite'}</button>
                    )}
                    <button onClick={()=>toggle(s.id)} style={{...p.actBtn,marginLeft:6,color:s.is_active!==false?'#dc2626':'#065f46'}}>{s.is_active!==false?'Deactivate':'Activate'}</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length===0 && <tr><td colSpan={7} style={{...p.td,textAlign:'center',color:'#94a3b8',padding:32}}>No employee records found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const p = {
  page:     { padding:24, fontFamily:"'Instrument Sans',sans-serif" },
  header:   { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 },
  h1:       { margin:0, fontSize:22, fontWeight:700, color:'#0f1f3d' },
  h2:       { margin:'0 0 16px', fontSize:16, fontWeight:700, color:'#0f1f3d' },
  sub:      { margin:'4px 0 0', fontSize:13, color:'#64748b' },
  msg:      { background:'#f0fdfb', border:'1px solid #00b4a0', color:'#065f46', padding:'10px 14px', borderRadius:8, marginBottom:16, display:'flex', justifyContent:'space-between', fontSize:13 },
  msgX:     { background:'none', border:'none', cursor:'pointer', fontSize:16 },
  card:     { background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:20 },
  statCard: { background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'16px 20px', textAlign:'center' },
  statLabel:{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', marginBottom:6 },
  statVal:  { fontSize:28, fontWeight:800 },
  grid3:    { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 },
  fg:       { display:'flex', flexDirection:'column', gap:4 },
  label:    { fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'.05em' },
  input:    { padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, color:'#0f1f3d', background:'#fff', width:'100%', boxSizing:'border-box' },
  table:    { width:'100%', borderCollapse:'collapse' },
  th:       { padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', borderBottom:'2px solid #e2e8f0' },
  td:       { padding:'12px', fontSize:13, color:'#0f1f3d', borderBottom:'1px solid #f1f5f9' },
  btnPri:   { padding:'9px 18px', background:'#00b4a0', color:'#fff', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:13 },
  btnSec:   { padding:'9px 18px', background:'#fff', color:'#0f1f3d', border:'1.5px solid #e2e8f0', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:13 },
  actBtn:   { padding:'5px 12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, fontSize:12, cursor:'pointer', color:'#0f1f3d' },
  badge:    (bg,col) => ({ background:bg, color:col, padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:600 }),
};
