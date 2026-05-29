'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function PayrollPage() {
  const [payroll,  setPayroll]  = useState([]);
  const [users,    setUsers]    = useState([]);
  const [structs,  setStructs]  = useState([]);
  const [month,    setMonth]    = useState(new Date().toISOString().slice(0,7));
  const [running,  setRunning]  = useState(false);
  const [msg,      setMsg]      = useState('');
  const [viewSlip, setViewSlip] = useState(null);

  const load = async () => {
    try {
      const [pr, u, ss] = await Promise.all([
        api(`/hr/payroll?month=${month}`),
        api('/admin/users'),
        api('/hr/salary-structures'),
      ]);
      setPayroll(pr.payroll || []);
      setUsers(u.users || []);
      setStructs(ss.structures || []);
    } catch(e) { setMsg(e.message); }
  };
  useEffect(() => { load(); }, [month]);

  const runPayroll = async () => {
    if (!confirm(`Run payroll for ${month}? This will generate payslips for all active staff.`)) return;
    setRunning(true);
    try {
      const records = users.map(u => {
        const struct = structs.find(s => s.role_id === u.role_id) || {};
        const basic       = struct.basic_salary || 0;
        const hra         = struct.hra || 0;
        const allowances  = struct.allowances || 0;
        const deductions  = struct.deductions || 0;
        const gross       = basic + hra + allowances;
        const net         = gross - deductions;
        return { user_id:u.id, basic_salary:basic, hra, allowances, deductions, gross_salary:gross, net_salary:net };
      });
      await api('/hr/payroll/run', { method:'POST', body:JSON.stringify({ pay_month:month, records }) });
      setMsg(`Payroll generated for ${month}`);
      load();
    } catch(e) { setMsg(e.message); }
    finally { setRunning(false); }
  };

  const totalNet   = payroll.reduce((s,r)=>s+(r.net_salary||0),0);
  const totalGross = payroll.reduce((s,r)=>s+(r.gross_salary||0),0);

  return (
    <div style={p.page}>
      <div style={p.header}>
        <div><h1 style={p.h1}>Payroll</h1><p style={p.sub}>Monthly payroll processing and payslips</p></div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={{ ...p.input, width:160 }} />
          <button onClick={runPayroll} disabled={running} style={{ ...p.btnPri, opacity:running?.7:1 }}>{running?'Running…':'Run Payroll'}</button>
        </div>
      </div>

      {msg && <div style={p.msg}>{msg}<button onClick={()=>setMsg('')} style={p.msgX}>×</button></div>}

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        {[['Employees Paid', payroll.length, '#0f1f3d'],
          ['Gross Payroll', `₹${totalGross.toLocaleString()}`, '#1d4ed8'],
          ['Net Payroll',   `₹${totalNet.toLocaleString()}`,   '#065f46']].map(([l,v,c])=>(
          <div key={l} style={{ ...p.card, textAlign:'center', padding:'16px 20px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', marginBottom:6 }}>{l}</div>
            <div style={{ fontSize:24, fontWeight:800, color:c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Payroll table */}
      <div style={p.card}>
        {payroll.length===0 ? (
          <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>
            No payroll for {month}. Click "Run Payroll" to generate.
          </div>
        ) : (
          <table style={p.table}>
            <thead><tr>{['Employee','Basic','HRA','Allowances','Deductions','Gross','Net','Action'].map(h=><th key={h} style={p.th}>{h}</th>)}</tr></thead>
            <tbody>
              {payroll.map(r => {
                const u = r.users || {};
                const fmt = v => `₹${(v||0).toLocaleString()}`;
                return (
                  <tr key={r.id}>
                    <td style={p.td}><strong>{u.first_name} {u.last_name}</strong></td>
                    <td style={p.td}>{fmt(r.basic_salary)}</td>
                    <td style={p.td}>{fmt(r.hra)}</td>
                    <td style={p.td}>{fmt(r.allowances)}</td>
                    <td style={p.td} ><span style={{color:'#dc2626'}}>-{fmt(r.deductions)}</span></td>
                    <td style={p.td}>{fmt(r.gross_salary)}</td>
                    <td style={p.td}><strong style={{color:'#065f46'}}>{fmt(r.net_salary)}</strong></td>
                    <td style={p.td}><button onClick={()=>setViewSlip(r)} style={p.actBtn}>Payslip</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Payslip modal */}
      {viewSlip && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:32, width:'100%', maxWidth:480, boxShadow:'0 24px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:'#0f1f3d' }}>Payslip — {viewSlip.pay_month}</h2>
              <button onClick={()=>setViewSlip(null)} style={{ background:'none', border:'1px solid #e2e8f0', borderRadius:8, padding:'4px 10px', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontWeight:600, fontSize:15 }}>{viewSlip.users?.first_name} {viewSlip.users?.last_name}</div>
              <div style={{ fontSize:12, color:'#64748b' }}>Pay Period: {viewSlip.pay_month}</div>
            </div>
            <div style={{ borderTop:'1px solid #e2e8f0', paddingTop:16 }}>
              {[['Basic Salary', viewSlip.basic_salary], ['HRA', viewSlip.hra], ['Allowances', viewSlip.allowances]].map(([l,v])=>(
                <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:13 }}>
                  <span style={{ color:'#475569' }}>{l}</span><span>₹{(v||0).toLocaleString()}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:13, color:'#dc2626' }}>
                <span>Deductions</span><span>-₹{(viewSlip.deductions||0).toLocaleString()}</span>
              </div>
              <div style={{ borderTop:'2px solid #0f1f3d', marginTop:12, paddingTop:12, display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:15 }}>
                <span>Net Salary</span><span style={{ color:'#065f46' }}>₹{(viewSlip.net_salary||0).toLocaleString()}</span>
              </div>
            </div>
            <button onClick={()=>window.print()} style={{ ...p.btnPri, width:'100%', marginTop:20 }}>Print / Download</button>
          </div>
        </div>
      )}
    </div>
  );
}

const p = {
  page:  { padding:24, fontFamily:"'Instrument Sans',sans-serif" },
  header:{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 },
  h1:    { margin:0, fontSize:22, fontWeight:700, color:'#0f1f3d' },
  sub:   { margin:'4px 0 0', fontSize:13, color:'#64748b' },
  msg:   { background:'#f0fdfb', border:'1px solid #00b4a0', color:'#065f46', padding:'10px 14px', borderRadius:8, marginBottom:16, display:'flex', justifyContent:'space-between', fontSize:13 },
  msgX:  { background:'none', border:'none', cursor:'pointer', fontSize:16 },
  card:  { background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:20 },
  fg:    { display:'flex', flexDirection:'column', gap:4 },
  input: { padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, color:'#0f1f3d', background:'#fff', width:'100%', boxSizing:'border-box' },
  table: { width:'100%', borderCollapse:'collapse' },
  th:    { padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', borderBottom:'2px solid #e2e8f0' },
  td:    { padding:'12px', fontSize:13, color:'#0f1f3d', borderBottom:'1px solid #f1f5f9' },
  btnPri:{ padding:'9px 18px', background:'#00b4a0', color:'#fff', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:13 },
  actBtn:{ padding:'5px 12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, fontSize:12, cursor:'pointer', color:'#0f1f3d' },
};
