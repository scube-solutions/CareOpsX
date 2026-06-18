'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// Shows the org's plan + premium features. Locked features offer "Request Access"
// which raises a request to the super admin (support team follows up).
export default function PlanFeaturesCard() {
  const [info, setInfo] = useState(null);
  const [msg, setMsg]   = useState('');

  const load = () => api('/admin/plan-info').then(setInfo).catch(()=>{});
  useEffect(() => { load(); }, []);

  const request = async (feature, label) => {
    setMsg('');
    try {
      const d = await api('/admin/request-feature', { method:'POST', body: JSON.stringify({ feature, message:`Requesting access to ${label}` }) });
      setMsg(d.message); load();
    } catch (e) { setMsg(e.message); }
  };

  if (!info) return null;
  const locked = info.features.filter(f => !f.enabled);
  if (locked.length === 0) return null; // everything already unlocked — hide card

  return (
    <div style={st.card}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
        <div style={{ fontWeight:800, fontSize:15, color:'#0f1f3d' }}>✨ More features available</div>
        <span style={st.plan}>{info.plan} plan</span>
      </div>
      <p style={{ fontSize:13, color:'#64748b', margin:'0 0 14px' }}>
        Your plan doesn&apos;t include these yet. Raise a request — our support team will contact you to enable them.
      </p>
      {msg && <div style={st.msg}>{msg}</div>}
      <div style={st.grid}>
        {locked.map(f => (
          <div key={f.key} style={st.feat}>
            <div>
              <div style={{ fontWeight:700, fontSize:13, color:'#0f1f3d' }}>{f.label}</div>
              <div style={{ fontSize:12, color:'#64748b' }}>{f.desc}</div>
            </div>
            {f.requested
              ? <span style={st.requested}>Requested ✓</span>
              : <button onClick={()=>request(f.key, f.label)} style={st.reqBtn}>Request Access</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

const st = {
  card: { background:'#fff', border:'1px solid #e2e8f0', borderLeft:'4px solid #00b4a0', borderRadius:14, padding:'18px 20px', marginBottom:24 },
  plan: { fontSize:11, fontWeight:700, color:'#0f766e', background:'#f0fdfb', padding:'3px 10px', borderRadius:12, textTransform:'capitalize' },
  msg:  { background:'#f0fdfb', border:'1px solid #99f6e4', color:'#0f766e', padding:'8px 12px', borderRadius:8, marginBottom:12, fontSize:13 },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:12 },
  feat: { display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'12px 14px', border:'1px solid #e2e8f0', borderRadius:10, background:'#f8fafc' },
  reqBtn:{ padding:'7px 14px', background:'#00b4a0', color:'#fff', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer', fontSize:12, whiteSpace:'nowrap' },
  requested:{ fontSize:12, fontWeight:700, color:'#166534', whiteSpace:'nowrap' },
};
