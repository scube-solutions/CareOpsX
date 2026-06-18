'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

const PORTALS = [
  ['admin','Admin'],['doctor','Doctor'],['reception','Reception'],['lab','Lab'],
  ['pharmacy','Pharmacy'],['analytics','Analytics'],['patient','Patient'],
];
const SEATS = [
  ['admin','Admin'],['doctor','Doctor'],['receptionist','Reception'],['lab','Lab'],
  ['pharmacist','Pharmacy'],['nurse','Nurse'],['hr_manager','HR Mgr'],['billing_executive','Billing'],
  ['reporting','Reporting'],['patient','Patient'],
];
const FEATURES = [['ai_assistant','AI Assistant'],['hrms','HRMS'],['queue_voice','Queue Voice']];

export default function PlansEditor() {
  const [plans, setPlans] = useState([]);
  const [msg, setMsg]     = useState('');
  const [savingKey, setSavingKey] = useState('');

  const load = () => api('/super-admin/plans').then(d => setPlans(d.plans || [])).catch(e => setMsg(e.message));
  useEffect(() => { load(); }, []);

  const patch = (key, field, sub, val) => setPlans(ps => ps.map(p => p.key !== key ? p : {
    ...p, [field]: sub == null ? val : { ...(p[field] || {}), [sub]: val },
  }));

  const save = async (p) => {
    setSavingKey(p.key); setMsg('');
    try {
      await api(`/super-admin/plans/${p.key}`, { method:'PUT', body: JSON.stringify({
        label: p.label, monthly_price: Number(p.monthly_price)||0,
        portal_access: p.portal_access, seat_limits: p.seat_limits, feature_flags: p.feature_flags,
      })});
      setMsg(`✓ ${p.label} saved`); load();
    } catch (e) { setMsg(e.message); } finally { setSavingKey(''); }
  };

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Subscription Plans</h1>
      <p style={s.sub}>Edit what each plan grants. Changes apply to organizations on that plan immediately. (Enterprise/Custom is set per-organization.)</p>
      {msg && <div style={s.msg}>{msg}</div>}

      {plans.map(p => (
        <div key={p.key} style={s.card}>
          <div style={s.cardHead}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <input value={p.label||''} onChange={e=>patch(p.key,'label',null,e.target.value)} style={{...s.input,width:200,fontWeight:700}}/>
              <span style={s.keyTag}>{p.key}</span>
              {p.manual && <span style={s.manualTag}>manual</span>}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <label style={s.priceLbl}>₹/mo</label>
              <input type="number" value={p.monthly_price??0} onChange={e=>patch(p.key,'monthly_price',null,e.target.value)} style={{...s.input,width:90}}/>
              <button onClick={()=>save(p)} disabled={savingKey===p.key} style={s.saveBtn}>{savingKey===p.key?'Saving…':'Save'}</button>
            </div>
          </div>

          {p.manual ? (
            <div style={{ fontSize:13, color:'#64748b', padding:'8px 2px' }}>Enterprise (Custom) access is configured per organization, not here.</div>
          ) : (
            <div style={s.grid}>
              <div>
                <div style={s.colTitle}>Portals</div>
                {PORTALS.map(([k,l])=>(
                  <label key={k} style={s.row}>
                    <input type="checkbox" checked={!!p.portal_access?.[k]} onChange={e=>patch(p.key,'portal_access',k,e.target.checked)}/> {l}
                  </label>
                ))}
              </div>
              <div>
                <div style={s.colTitle}>Seats (-1 = unlimited)</div>
                {SEATS.map(([k,l])=>(
                  <div key={k} style={s.seatRow}>
                    <span style={{ flex:1 }}>{l}</span>
                    <input type="number" value={p.seat_limits?.[k]??0} onChange={e=>patch(p.key,'seat_limits',k,Number(e.target.value))} style={{...s.input,width:64}}/>
                  </div>
                ))}
              </div>
              <div>
                <div style={s.colTitle}>Features</div>
                {FEATURES.map(([k,l])=>(
                  <label key={k} style={s.row}>
                    <input type="checkbox" checked={!!p.feature_flags?.[k]} onChange={e=>patch(p.key,'feature_flags',k,e.target.checked)}/> {l}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const s = {
  page:    { padding:28, maxWidth:1100, margin:'0 auto' },
  h1:      { fontSize:24, fontWeight:800, color:'#0f1f3d', margin:0 },
  sub:     { fontSize:13, color:'#64748b', margin:'6px 0 18px' },
  msg:     { background:'#f0fdfb', border:'1px solid #99f6e4', color:'#0f766e', padding:'8px 12px', borderRadius:8, marginBottom:14, fontSize:13 },
  card:    { background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:18, marginBottom:16 },
  cardHead:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 },
  keyTag:  { fontSize:11, fontWeight:700, color:'#64748b', background:'#f1f5f9', padding:'2px 8px', borderRadius:10 },
  manualTag:{ fontSize:11, fontWeight:700, color:'#92400e', background:'#fffbeb', padding:'2px 8px', borderRadius:10 },
  priceLbl:{ fontSize:12, color:'#64748b' },
  grid:    { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 },
  colTitle:{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', marginBottom:8 },
  row:     { display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#334155', marginBottom:6, cursor:'pointer' },
  seatRow: { display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#334155', marginBottom:6 },
  input:   { padding:'6px 10px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, boxSizing:'border-box' },
  saveBtn: { padding:'8px 18px', background:'#00b4a0', color:'#fff', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer', fontSize:13 },
};
