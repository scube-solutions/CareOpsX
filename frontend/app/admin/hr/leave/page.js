'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const STATUS_COLOR = { pending:['#fffbeb','#92400e'], approved:['#f0fdf4','#065f46'], rejected:['#fef2f2','#dc2626'] };
const LEAVE_TYPES  = ['Sick Leave','Casual Leave','Earned Leave','Maternity Leave','Paternity Leave','Emergency Leave'];

export default function LeavePage() {
  const [leaves,   setLeaves]   = useState([]);
  const [users,    setUsers]    = useState([]);
  const [filter,   setFilter]   = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ user_id:'', leave_type:'Sick Leave', from_date:'', to_date:'', reason:'' });
  const [msg,      setMsg]      = useState('');

  const load = async () => {
    try {
      const [l, u] = await Promise.all([api('/hr/leaves'), api('/admin/users')]);
      setLeaves(l.leaves || []); setUsers(u.users || []);
    } catch(e) { setMsg(e.message); }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await api('/hr/leaves', { method:'POST', body:JSON.stringify(form) });
      setMsg('Leave request submitted'); setShowForm(false); setForm({ user_id:'', leave_type:'Sick Leave', from_date:'', to_date:'', reason:'' }); load();
    } catch(e) { setMsg(e.message); }
  };

  const updateStatus = async (id, status) => {
    try { await api(`/hr/leaves/${id}/status`, { method:'PATCH', body:JSON.stringify({ status }) }); load(); } catch(e) { setMsg(e.message); }
  };

  const filtered = filter === 'all' ? leaves : leaves.filter(l => l.status === filter);

  const days = (from, to) => {
    if (!from || !to) return '–';
    return Math.ceil((new Date(to) - new Date(from)) / 86400000) + 1 + 'd';
  };

  return (
    <div style={p.page}>
      <div style={p.header}>
        <div><h1 style={p.h1}>Leave Management</h1><p style={p.sub}>Requests, approvals, and balances</p></div>
        <button onClick={()=>setShowForm(v=>!v)} style={p.btnPri}>+ New Request</button>
      </div>

      {msg && <div style={p.msg}>{msg}<button onClick={()=>setMsg('')} style={p.msgX}>×</button></div>}

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        {[['Pending', leaves.filter(l=>l.status==='pending').length, '#92400e','#fffbeb'],
          ['Approved',leaves.filter(l=>l.status==='approved').length,'#065f46','#f0fdf4'],
          ['Rejected',leaves.filter(l=>l.status==='rejected').length,'#dc2626','#fef2f2']].map(([l,v,c,bg])=>(
          <div key={l} style={{ ...p.card, textAlign:'center', padding:'16px 20px', background:bg }}>
            <div style={{ fontSize:11, fontWeight:700, color:c, textTransform:'uppercase', marginBottom:6 }}>{l}</div>
            <div style={{ fontSize:28, fontWeight:800, color:c }}>{v}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={{ ...p.card, marginBottom:20, borderLeft:'4px solid #00b4a0' }}>
          <h2 style={p.h2}>New Leave Request</h2>
          <div style={p.grid3}>
            <div style={p.fg}><label style={p.label}>Employee</label>
              <select value={form.user_id} onChange={e=>setForm({...form,user_id:e.target.value})} style={p.input}>
                <option value="">Select</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
              </select>
            </div>
            <div style={p.fg}><label style={p.label}>Leave Type</label>
              <select value={form.leave_type} onChange={e=>setForm({...form,leave_type:e.target.value})} style={p.input}>
                {LEAVE_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={p.fg}><label style={p.label}>From Date</label><input type="date" value={form.from_date} onChange={e=>setForm({...form,from_date:e.target.value})} style={p.input} /></div>
            <div style={p.fg}><label style={p.label}>To Date</label><input type="date" value={form.to_date} onChange={e=>setForm({...form,to_date:e.target.value})} style={p.input} /></div>
            <div style={{ ...p.fg, gridColumn:'span 2' }}><label style={p.label}>Reason</label><input value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} style={p.input} /></div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:16 }}>
            <button onClick={submit} style={p.btnPri}>Submit</button>
            <button onClick={()=>setShowForm(false)} style={p.btnSec}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        {['all','pending','approved','rejected'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 14px', borderRadius:8, border:'1.5px solid', borderColor:filter===f?'#00b4a0':'#e2e8f0', background:filter===f?'#f0fdfb':'#fff', color:filter===f?'#00b4a0':'#475569', fontWeight:filter===f?700:500, fontSize:12, cursor:'pointer' }}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>

      <div style={p.card}>
        <table style={p.table}>
          <thead><tr>{['Employee','Type','From','To','Days','Reason','Status','Actions'].map(h=><th key={h} style={p.th}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(l => {
              const u = l.users || {};
              const [bg,col] = STATUS_COLOR[l.status] || ['#f8fafc','#475569'];
              return (
                <tr key={l.id}>
                  <td style={p.td}><strong>{u.first_name} {u.last_name}</strong></td>
                  <td style={p.td}>{l.leave_type}</td>
                  <td style={p.td}>{l.from_date}</td>
                  <td style={p.td}>{l.to_date}</td>
                  <td style={p.td}>{days(l.from_date,l.to_date)}</td>
                  <td style={p.td}>{l.reason||'–'}</td>
                  <td style={p.td}><span style={{ background:bg, color:col, padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:700 }}>{l.status}</span></td>
                  <td style={p.td}>
                    {l.status==='pending' && (
                      <>
                        <button onClick={()=>updateStatus(l.id,'approved')} style={{ ...p.actBtn, color:'#065f46' }}>Approve</button>
                        <button onClick={()=>updateStatus(l.id,'rejected')} style={{ ...p.actBtn, marginLeft:6, color:'#dc2626' }}>Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length===0 && <tr><td colSpan={8} style={{...p.td,textAlign:'center',color:'#94a3b8',padding:32}}>No leave requests</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const p = {
  page:  { padding:24, fontFamily:"'Instrument Sans',sans-serif" },
  header:{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 },
  h1:    { margin:0, fontSize:22, fontWeight:700, color:'#0f1f3d' },
  h2:    { margin:'0 0 16px', fontSize:16, fontWeight:700, color:'#0f1f3d' },
  sub:   { margin:'4px 0 0', fontSize:13, color:'#64748b' },
  msg:   { background:'#f0fdfb', border:'1px solid #00b4a0', color:'#065f46', padding:'10px 14px', borderRadius:8, marginBottom:16, display:'flex', justifyContent:'space-between', fontSize:13 },
  msgX:  { background:'none', border:'none', cursor:'pointer', fontSize:16 },
  card:  { background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:20 },
  grid3: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 },
  fg:    { display:'flex', flexDirection:'column', gap:4 },
  label: { fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'.05em' },
  input: { padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, color:'#0f1f3d', background:'#fff', width:'100%', boxSizing:'border-box' },
  table: { width:'100%', borderCollapse:'collapse' },
  th:    { padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', borderBottom:'2px solid #e2e8f0' },
  td:    { padding:'12px', fontSize:13, color:'#0f1f3d', borderBottom:'1px solid #f1f5f9' },
  btnPri:{ padding:'9px 18px', background:'#00b4a0', color:'#fff', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:13 },
  btnSec:{ padding:'9px 18px', background:'#fff', color:'#0f1f3d', border:'1.5px solid #e2e8f0', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:13 },
  actBtn:{ padding:'5px 12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, fontSize:12, cursor:'pointer', color:'#0f1f3d' },
};
