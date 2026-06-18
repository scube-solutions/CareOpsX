'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

const FEATURE_LABEL = { ai_assistant:'AI Assistant', hrms:'HRMS', queue_voice:'Queue Voice' };
const STATUS_STYLE = {
  pending:  ['#fffbeb','#92400e'], approved: ['#f0fdf4','#166534'], rejected: ['#fef2f2','#dc2626'],
};

export default function FeatureRequests() {
  const [reqs, setReqs] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [msg, setMsg]   = useState('');

  const load = () => api(`/super-admin/feature-requests${filter?`?status=${filter}`:''}`).then(d=>setReqs(d.requests||[])).catch(e=>setMsg(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const handle = async (id, action) => {
    let admin_note = '';
    if (action === 'reject') admin_note = prompt('Reason (optional):') || '';
    try { const d = await api(`/super-admin/feature-requests/${id}`, { method:'PATCH', body: JSON.stringify({ action, admin_note }) }); setMsg(d.message); load(); }
    catch (e) { setMsg(e.message); }
  };

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Feature Requests</h1>
      <p style={s.sub}>Organizations requesting access to premium features. Approve after payment to grant access instantly.</p>
      {msg && <div style={s.msg}>{msg}</div>}

      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {['pending','approved','rejected',''].map(f=>(
          <button key={f||'all'} onClick={()=>setFilter(f)} style={{...s.tab, ...(filter===f?s.tabActive:{})}}>{f||'All'}</button>
        ))}
      </div>

      <div style={s.card}>
        <table style={s.table}>
          <thead><tr>{['Organization','Feature','Message','Status','When','Actions'].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {reqs.map(r=>{
              const [bg,col]=STATUS_STYLE[r.status]||STATUS_STYLE.pending;
              return (
                <tr key={r.id}>
                  <td style={s.td}><strong>{r.organization?.organization_name||'—'}</strong><div style={{fontSize:11,color:'#94a3b8'}}>{r.organization?.plan}</div></td>
                  <td style={s.td}>{r.request_type==='plan'?`Plan → ${r.target_plan}`:(FEATURE_LABEL[r.feature]||r.feature)}</td>
                  <td style={{...s.td,maxWidth:260,color:'#64748b'}}>{r.message||'—'}</td>
                  <td style={s.td}><span style={{background:bg,color:col,padding:'2px 8px',borderRadius:12,fontSize:11,fontWeight:700}}>{r.status}</span></td>
                  <td style={s.td}>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td style={s.td}>
                    {r.status==='pending' ? (
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>handle(r.id,'approve')} style={{...s.actBtn,background:'#00b4a0',color:'#fff',border:'none'}}>Approve</button>
                        <button onClick={()=>handle(r.id,'reject')} style={{...s.actBtn,color:'#dc2626',borderColor:'#fecaca'}}>Reject</button>
                      </div>
                    ) : <span style={{fontSize:12,color:'#94a3b8'}}>{r.admin_note||'—'}</span>}
                  </td>
                </tr>
              );
            })}
            {reqs.length===0 && <tr><td colSpan={6} style={{...s.td,textAlign:'center',color:'#94a3b8',padding:30}}>No {filter} requests.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const s = {
  page:  { padding:28, maxWidth:1100, margin:'0 auto' },
  h1:    { fontSize:24, fontWeight:800, color:'#0f1f3d', margin:0 },
  sub:   { fontSize:13, color:'#64748b', margin:'6px 0 18px' },
  msg:   { background:'#f0fdfb', border:'1px solid #99f6e4', color:'#0f766e', padding:'8px 12px', borderRadius:8, marginBottom:14, fontSize:13 },
  tab:   { padding:'7px 16px', borderRadius:8, border:'1.5px solid #e2e8f0', background:'#fff', color:'#475569', fontWeight:600, cursor:'pointer', fontSize:13, textTransform:'capitalize' },
  tabActive:{ borderColor:'#00b4a0', background:'#f0fdfb', color:'#00b4a0' },
  card:  { background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:6, overflowX:'auto' },
  table: { width:'100%', borderCollapse:'collapse' },
  th:    { textAlign:'left', padding:'12px 14px', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', borderBottom:'2px solid #e2e8f0' },
  td:    { padding:'12px 14px', fontSize:13, color:'#0f1f3d', borderBottom:'1px solid #f1f5f9' },
  actBtn:{ padding:'5px 12px', borderRadius:7, border:'1.5px solid #e2e8f0', background:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' },
};
