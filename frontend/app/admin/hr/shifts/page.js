'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function ShiftsPage() {
  const [shifts,   setShifts]   = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ shift_name:'', start_time:'', end_time:'', break_minutes:30, days_of_week:[], color:'#00b4a0' });
  const [editing,  setEditing]  = useState(null);
  const [msg,      setMsg]      = useState('');

  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const COLORS = ['#00b4a0','#1d4ed8','#7c3aed','#be185d','#92400e','#065f46'];

  const load = async () => {
    try { const d = await api('/hr/shifts'); setShifts(d.shifts || []); } catch(e) { setMsg(e.message); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing) await api(`/hr/shifts/${editing.id}`, { method:'PUT', body:JSON.stringify(form) });
      else         await api('/hr/shifts',                { method:'POST', body:JSON.stringify(form) });
      setMsg('Shift saved'); setShowForm(false); setForm({ shift_name:'', start_time:'', end_time:'', break_minutes:30, days_of_week:[], color:'#00b4a0' }); setEditing(null); load();
    } catch(e) { setMsg(e.message); }
  };

  const del = async (id) => {
    if (!confirm('Delete this shift?')) return;
    try { await api(`/hr/shifts/${id}`, { method:'DELETE' }); load(); } catch(e) { setMsg(e.message); }
  };

  const toggleDay = (day) => {
    const days = form.days_of_week || [];
    setForm({ ...form, days_of_week: days.includes(day) ? days.filter(d=>d!==day) : [...days, day] });
  };

  const duration = (start, end) => {
    if (!start || !end) return '–';
    const [sh,sm] = start.split(':').map(Number);
    const [eh,em] = end.split(':').map(Number);
    const mins = (eh*60+em) - (sh*60+sm);
    return `${Math.floor(mins/60)}h ${mins%60}m`;
  };

  return (
    <div style={p.page}>
      <div style={p.header}>
        <div><h1 style={p.h1}>Shift Management</h1><p style={p.sub}>Define work shifts and schedules</p></div>
        <button onClick={()=>{setShowForm(true);setForm({shift_name:'',start_time:'',end_time:'',break_minutes:30,days_of_week:[],color:'#00b4a0'});setEditing(null);}} style={p.btnPri}>+ Add Shift</button>
      </div>

      {msg && <div style={p.msg}>{msg}<button onClick={()=>setMsg('')} style={p.msgX}>×</button></div>}

      {showForm && (
        <div style={{ ...p.card, marginBottom:20, borderLeft:'4px solid #00b4a0' }}>
          <h2 style={p.h2}>{editing?'Edit Shift':'New Shift'}</h2>
          <div style={p.grid3}>
            <div style={p.fg}><label style={p.label}>Shift Name</label><input value={form.shift_name} onChange={e=>setForm({...form,shift_name:e.target.value})} style={p.input} placeholder="Morning Shift" /></div>
            <div style={p.fg}><label style={p.label}>Start Time</label><input type="time" value={form.start_time} onChange={e=>setForm({...form,start_time:e.target.value})} style={p.input} /></div>
            <div style={p.fg}><label style={p.label}>End Time</label><input type="time" value={form.end_time} onChange={e=>setForm({...form,end_time:e.target.value})} style={p.input} /></div>
            <div style={p.fg}><label style={p.label}>Break (minutes)</label><input type="number" value={form.break_minutes} onChange={e=>setForm({...form,break_minutes:+e.target.value})} style={p.input} /></div>
            <div style={{ ...p.fg, gridColumn:'span 2' }}>
              <label style={p.label}>Working Days</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
                {DAYS.map(d => {
                  const sel = (form.days_of_week||[]).includes(d);
                  return <button key={d} type="button" onClick={()=>toggleDay(d)} style={{ padding:'5px 12px', borderRadius:8, border:`1.5px solid ${sel?'#00b4a0':'#e2e8f0'}`, background:sel?'#f0fdfb':'#fff', color:sel?'#00b4a0':'#475569', fontWeight:sel?700:500, fontSize:12, cursor:'pointer' }}>{d}</button>;
                })}
              </div>
            </div>
            <div style={p.fg}>
              <label style={p.label}>Color Tag</label>
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                {COLORS.map(c=><button key={c} type="button" onClick={()=>setForm({...form,color:c})} style={{ width:28, height:28, borderRadius:'50%', background:c, border:form.color===c?'3px solid #0f1f3d':'3px solid transparent', cursor:'pointer' }} />)}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:16 }}>
            <button onClick={save} style={p.btnPri}>Save</button>
            <button onClick={()=>setShowForm(false)} style={p.btnSec}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
        {shifts.map(s => (
          <div key={s.id} style={{ ...p.card, borderTop:`4px solid ${s.color||'#00b4a0'}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15, color:'#0f1f3d' }}>{s.shift_name}</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{s.start_time} – {s.end_time} · {duration(s.start_time,s.end_time)}</div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={()=>{setEditing(s);setForm({...s,days_of_week:s.days_of_week||[]});setShowForm(true);}} style={p.actBtn}>Edit</button>
                <button onClick={()=>del(s.id)} style={{...p.actBtn,color:'#dc2626'}}>Del</button>
              </div>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {DAYS.map(d => {
                const active = (s.days_of_week||[]).includes(d);
                return <span key={d} style={{ padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600, background:active?(s.color||'#00b4a0'):'#f1f5f9', color:active?'#fff':'#94a3b8' }}>{d}</span>;
              })}
            </div>
            {s.break_minutes > 0 && <div style={{ fontSize:11, color:'#94a3b8', marginTop:8 }}>Break: {s.break_minutes} min</div>}
          </div>
        ))}
        {shifts.length===0 && <div style={{ ...p.card, textAlign:'center', color:'#94a3b8', padding:40, gridColumn:'1/-1' }}>No shifts defined yet</div>}
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
  btnPri:{ padding:'9px 18px', background:'#00b4a0', color:'#fff', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:13 },
  btnSec:{ padding:'9px 18px', background:'#fff', color:'#0f1f3d', border:'1.5px solid #e2e8f0', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:13 },
  actBtn:{ padding:'5px 12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, fontSize:12, cursor:'pointer', color:'#0f1f3d' },
};
