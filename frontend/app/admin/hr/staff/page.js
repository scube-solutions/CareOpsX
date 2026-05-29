'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const ROLE_LABELS = { 1:'Admin', 2:'Doctor', 5:'Receptionist', 6:'Lab Staff', 7:'Pharmacist', 8:'Reporting' };
const DEPT_OPTIONS = ['General','Cardiology','Neurology','Orthopedics','Lab','Pharmacy','Administration','Nursing','Reception'];

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
      setMsg('Saved'); setShowForm(false); setForm({}); setEditing(null); load();
    } catch(e) { setMsg(e.message); }
  };

  const toggle = async (id) => {
    try { await api(`/hr/staff/${id}/toggle`, { method:'PATCH' }); load(); } catch(e) { setMsg(e.message); }
  };

  const filtered = staff.filter(s => {
    const u = s.users || {};
    return `${u.first_name} ${u.last_name} ${u.email} ${s.department || ''}`.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div style={p.page}>
      <div style={p.header}>
        <div>
          <h1 style={p.h1}>Staff Management</h1>
          <p style={p.sub}>All employees across departments</p>
        </div>
        <button onClick={() => { setShowForm(true); setForm({}); setEditing(null); }} style={p.btnPri}>+ Add Staff</button>
      </div>

      {msg && <div style={p.msg}>{msg}<button onClick={()=>setMsg('')} style={p.msgX}>×</button></div>}

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        {[
          ['Total Staff',  staff.length,                                   '#0f1f3d'],
          ['Active',       staff.filter(s=>s.is_active!==false).length,    '#065f46'],
          ['Doctors',      staff.filter(s=>s.users?.role_id===2).length,   '#1d4ed8'],
          ['On Leave',     0,                                               '#92400e'],
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
          <h2 style={p.h2}>{editing ? 'Edit Staff' : 'New Staff Profile'}</h2>
          <div style={p.grid3}>
            <div style={p.fg}><label style={p.label}>User ID (from users table)</label><input value={form.user_id||''} onChange={e=>setForm({...form,user_id:e.target.value})} style={p.input} placeholder="UUID" /></div>
            <div style={p.fg}><label style={p.label}>Employee ID</label><input value={form.employee_id||''} onChange={e=>setForm({...form,employee_id:e.target.value})} style={p.input} placeholder="EMP-001" /></div>
            <div style={p.fg}><label style={p.label}>Department</label>
              <select value={form.department||''} onChange={e=>setForm({...form,department:e.target.value})} style={p.input}>
                <option value="">Select</option>
                {DEPT_OPTIONS.map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
            <div style={p.fg}><label style={p.label}>Designation</label><input value={form.designation||''} onChange={e=>setForm({...form,designation:e.target.value})} style={p.input} placeholder="Senior Nurse" /></div>
            <div style={p.fg}><label style={p.label}>Date of Joining</label><input type="date" value={form.date_of_joining||''} onChange={e=>setForm({...form,date_of_joining:e.target.value})} style={p.input} /></div>
            <div style={p.fg}><label style={p.label}>Employment Type</label>
              <select value={form.employment_type||''} onChange={e=>setForm({...form,employment_type:e.target.value})} style={p.input}>
                <option value="">Select</option>
                {['Full-Time','Part-Time','Contract','Intern'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={p.fg}><label style={p.label}>Emergency Contact</label><input value={form.emergency_contact||''} onChange={e=>setForm({...form,emergency_contact:e.target.value})} style={p.input} /></div>
            <div style={p.fg}><label style={p.label}>Blood Group</label><input value={form.blood_group||''} onChange={e=>setForm({...form,blood_group:e.target.value})} style={p.input} placeholder="A+" /></div>
            <div style={p.fg}><label style={p.label}>Address</label><input value={form.address||''} onChange={e=>setForm({...form,address:e.target.value})} style={p.input} /></div>
          </div>
          <div style={{display:'flex',gap:10,marginTop:16}}>
            <button onClick={save} style={p.btnPri}>Save</button>
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
          <thead><tr>{['Employee','Email','Role','Department','Type','Status','Actions'].map(h=><th key={h} style={p.th}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(s => {
              const u = s.users || {};
              return (
                <tr key={s.id}>
                  <td style={p.td}><strong>{u.first_name} {u.last_name}</strong><div style={{fontSize:11,color:'#94a3b8'}}>{s.employee_id||'–'}</div></td>
                  <td style={p.td}>{u.email}</td>
                  <td style={p.td}><span style={p.badge('#eff6ff','#1d4ed8')}>{ROLE_LABELS[u.role_id]||'Staff'}</span></td>
                  <td style={p.td}>{s.department||'–'}</td>
                  <td style={p.td}>{s.employment_type||'–'}</td>
                  <td style={p.td}><span style={p.badge(s.is_active!==false?'#f0fdf4':'#fef2f2', s.is_active!==false?'#065f46':'#dc2626')}>{s.is_active!==false?'Active':'Inactive'}</span></td>
                  <td style={p.td}>
                    <button onClick={()=>{setEditing(s);setForm({...s});setShowForm(true);}} style={p.actBtn}>Edit</button>
                    <button onClick={()=>toggle(s.id)} style={{...p.actBtn,marginLeft:6,color:s.is_active!==false?'#dc2626':'#065f46'}}>{s.is_active!==false?'Deactivate':'Activate'}</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length===0 && <tr><td colSpan={7} style={{...p.td,textAlign:'center',color:'#94a3b8',padding:32}}>No staff records found</td></tr>}
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
