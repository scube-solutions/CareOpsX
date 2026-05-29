'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const STATUS_OPTS = ['present','absent','half_day','late','on_leave','holiday'];
const STATUS_COLORS = { present:['#f0fdf4','#065f46'], absent:['#fef2f2','#dc2626'], half_day:['#fffbeb','#92400e'], late:['#fffbeb','#b45309'], on_leave:['#eff6ff','#1d4ed8'], holiday:['#f5f3ff','#7c3aed'] };

export default function AttendancePage() {
  const [records, setRecords] = useState([]);
  const [users,   setUsers]   = useState([]);
  const [date,    setDate]    = useState(new Date().toISOString().split('T')[0]);
  const [form,    setForm]    = useState({ user_id:'', status:'present', check_in:'', check_out:'', notes:'' });
  const [msg,     setMsg]     = useState('');
  const [showForm,setShowForm]= useState(false);

  const load = async () => {
    try {
      const [a, u] = await Promise.all([
        api(`/hr/attendance?date=${date}`),
        api('/admin/users'),
      ]);
      setRecords(a.attendance || []);
      setUsers(u.users || []);
    } catch(e) { setMsg(e.message); }
  };
  useEffect(() => { load(); }, [date]);

  const mark = async () => {
    try {
      await api('/hr/attendance', { method:'POST', body:JSON.stringify({ ...form, date }) });
      setMsg('Attendance marked'); setShowForm(false); setForm({ user_id:'', status:'present', check_in:'', check_out:'', notes:'' }); load();
    } catch(e) { setMsg(e.message); }
  };

  const summary = STATUS_OPTS.map(s => ({ s, count: records.filter(r=>r.status===s).length }));

  return (
    <div style={p.page}>
      <div style={p.header}>
        <div><h1 style={p.h1}>Attendance</h1><p style={p.sub}>Daily staff attendance tracking</p></div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{ ...p.input, width:160 }} />
          <button onClick={()=>setShowForm(v=>!v)} style={p.btnPri}>+ Mark Attendance</button>
        </div>
      </div>

      {msg && <div style={p.msg}>{msg}<button onClick={()=>setMsg('')} style={p.msgX}>×</button></div>}

      {/* Summary chips */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        {summary.map(({s,count}) => {
          const [bg,col] = STATUS_COLORS[s] || ['#f8fafc','#475569'];
          return <div key={s} style={{ background:bg, color:col, padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:700 }}>{s.replace('_',' ').toUpperCase()}: {count}</div>;
        })}
      </div>

      {showForm && (
        <div style={{ ...p.card, marginBottom:20, borderLeft:'4px solid #00b4a0' }}>
          <h2 style={p.h2}>Mark Attendance for {date}</h2>
          <div style={p.grid3}>
            <div style={p.fg}><label style={p.label}>Employee</label>
              <select value={form.user_id} onChange={e=>setForm({...form,user_id:e.target.value})} style={p.input}>
                <option value="">Select employee</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
              </select>
            </div>
            <div style={p.fg}><label style={p.label}>Status</label>
              <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} style={p.input}>
                {STATUS_OPTS.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
              </select>
            </div>
            <div style={p.fg}><label style={p.label}>Check In</label><input type="time" value={form.check_in} onChange={e=>setForm({...form,check_in:e.target.value})} style={p.input} /></div>
            <div style={p.fg}><label style={p.label}>Check Out</label><input type="time" value={form.check_out} onChange={e=>setForm({...form,check_out:e.target.value})} style={p.input} /></div>
            <div style={{ ...p.fg, gridColumn:'span 2' }}><label style={p.label}>Notes</label><input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={p.input} /></div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:16 }}>
            <button onClick={mark} style={p.btnPri}>Save</button>
            <button onClick={()=>setShowForm(false)} style={p.btnSec}>Cancel</button>
          </div>
        </div>
      )}

      <div style={p.card}>
        <table style={p.table}>
          <thead><tr>{['Employee','Status','Check In','Check Out','Notes'].map(h=><th key={h} style={p.th}>{h}</th>)}</tr></thead>
          <tbody>
            {records.map(r => {
              const u = r.users || {};
              const [bg,col] = STATUS_COLORS[r.status] || ['#f8fafc','#475569'];
              return (
                <tr key={r.id}>
                  <td style={p.td}><strong>{u.first_name} {u.last_name}</strong></td>
                  <td style={p.td}><span style={{ background:bg, color:col, padding:'2px 10px', borderRadius:12, fontSize:11, fontWeight:700 }}>{r.status?.replace('_',' ')}</span></td>
                  <td style={p.td}>{r.check_in||'–'}</td>
                  <td style={p.td}>{r.check_out||'–'}</td>
                  <td style={p.td}>{r.notes||'–'}</td>
                </tr>
              );
            })}
            {records.length===0 && <tr><td colSpan={5} style={{...p.td,textAlign:'center',color:'#94a3b8',padding:32}}>No attendance records for {date}</td></tr>}
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
};
