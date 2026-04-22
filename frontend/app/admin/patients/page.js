
// 'use client';
// import { useState, useEffect, useCallback } from 'react';
// import { api } from '@/lib/api';
// import { T } from '../layout';

// const GENDER_COLORS = {
//   Male:   { bg:'#eff6ff', text:'#1d4ed8' },
//   Female: { bg:'#fdf2f8', text:'#9d174d' },
//   Other:  { bg:'#f5f3ff', text:'#6d28d9' },
// };

// function AddPatientModal({ onClose, onSuccess }) {
//   const [form, setForm]       = useState({ name:'', phone:'', email:'', age:'', gender:'', blood_group:'', address:'' });
//   const [loading, setLoading] = useState(false);
//   const [error, setError]     = useState('');
//   const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

//   const handleSubmit = async () => {
//     if (!form.name.trim() || !form.phone.trim()) { setError('Name and phone are required.'); return; }
//     setLoading(true); setError('');
//     try {
//       const res = await api.post('/patients', form);
//       onSuccess(res.data.patient);
//     } catch (err) {
//       setError(err.response?.data?.message || 'Failed to create patient.');
//     } finally { setLoading(false); }
//   };

//   const inp = { width:'100%', padding:'10px 14px', borderRadius:8, border:`1px solid ${T.border}`, fontFamily:T.body, fontSize:14, color:T.text, outline:'none', boxSizing:'border-box', background:'#fff' };
//   const lbl = { display:'block', fontSize:13, fontWeight:600, color:T.text, marginBottom:6 };

//   return (
//     <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
//       <div style={{ background:'#fff', borderRadius:16, padding:'28px 32px', width:'100%', maxWidth:500, boxShadow:'0 24px 64px rgba(0,0,0,.15)', maxHeight:'90vh', overflowY:'auto' }}>
//         <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
//           <div>
//             <h3 style={{ fontFamily:T.display, fontSize:18, fontWeight:700, color:T.navy, margin:0 }}>Add Patient</h3>
//             <p style={{ fontSize:12, color:T.muted, margin:'4px 0 0' }}>Create a new patient record</p>
//           </div>
//           <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:T.muted, fontSize:20 }}>x</button>
//         </div>

//         {error && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', color:'#b91c1c', fontSize:13, marginBottom:16 }}>{error}</div>}

//         <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
//           <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
//             <div><label style={lbl}>Full name <span style={{color:'#ef4444'}}>*</span></label><input style={inp} placeholder="Priya Sharma" value={form.name} onChange={e=>upd('name',e.target.value)} /></div>
//             <div><label style={lbl}>Phone <span style={{color:'#ef4444'}}>*</span></label><input style={inp} type="tel" placeholder="9876543210" value={form.phone} onChange={e=>upd('phone',e.target.value)} /></div>
//           </div>
//           <div><label style={lbl}>Email</label><input style={inp} type="email" placeholder="patient@email.com" value={form.email} onChange={e=>upd('email',e.target.value)} /></div>
//           <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
//             <div><label style={lbl}>Age</label><input style={inp} type="number" placeholder="34" min="0" max="120" value={form.age} onChange={e=>upd('age',e.target.value)} /></div>
//             <div>
//               <label style={lbl}>Gender</label>
//               <select style={inp} value={form.gender} onChange={e=>upd('gender',e.target.value)}>
//                 <option value="">Select</option>
//                 <option>Male</option><option>Female</option><option>Other</option>
//               </select>
//             </div>
//             <div>
//               <label style={lbl}>Blood group</label>
//               <select style={inp} value={form.blood_group} onChange={e=>upd('blood_group',e.target.value)}>
//                 <option value="">Select</option>
//                 {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g=><option key={g}>{g}</option>)}
//               </select>
//             </div>
//           </div>
//           <div><label style={lbl}>Address</label><input style={inp} placeholder="Street, City" value={form.address} onChange={e=>upd('address',e.target.value)} /></div>
//         </div>

//         <div style={{ display:'flex', gap:10, marginTop:24 }}>
//           <button onClick={onClose} style={{ flex:1, padding:'11px', border:`1px solid ${T.border}`, borderRadius:8, background:'#fff', fontFamily:T.body, fontSize:14, cursor:'pointer', color:T.muted }}>Cancel</button>
//           <button onClick={handleSubmit} disabled={loading} style={{ flex:2, padding:'11px', border:'none', borderRadius:8, background:loading?T.border:T.teal, color:loading?T.muted:'#fff', fontFamily:T.body, fontSize:14, fontWeight:600, cursor:loading?'wait':'pointer' }}>
//             {loading ? 'Adding...' : 'Add Patient'}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// function PatientDetail({ patient, onClose }) {
//   const [data, setData]       = useState(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     api.get(`/patients/${patient.id}`)
//       .then(r => setData(r.data))
//       .catch(() => setData(null))
//       .finally(() => setLoading(false));
//   }, [patient.id]);

//   const S = { booked:{bg:'#eff6ff',text:'#1d4ed8'}, confirmed:{bg:'#f0fdfb',text:'#0f766e'}, completed:{bg:'#f0fdf4',text:'#15803d'}, cancelled:{bg:'#fef2f2',text:'#b91c1c'}, no_show:{bg:'#fefce8',text:'#a16207'} };

//   return (
//     <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', zIndex:1000, display:'flex', justifyContent:'flex-end' }} onClick={onClose}>
//       <div style={{ width:'100%', maxWidth:440, background:'#fff', height:'100%', overflowY:'auto', padding:'28px 24px', boxShadow:'-12px 0 40px rgba(0,0,0,.12)' }} onClick={e=>e.stopPropagation()}>
//         <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
//           <h3 style={{ fontFamily:T.display, fontSize:18, fontWeight:700, color:T.navy, margin:0 }}>Patient details</h3>
//           <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:T.muted, fontSize:20 }}>x</button>
//         </div>
//         {loading ? <div style={{ textAlign:'center', padding:'48px 0', color:T.muted }}>Loading...</div>
//         : !data    ? <div style={{ textAlign:'center', padding:'48px 0', color:T.muted }}>Could not load patient.</div>
//         : (
//           <>
//             <div style={{ background:T.bg, borderRadius:12, padding:'16px 20px', marginBottom:20 }}>
//               <div style={{ display:'flex', gap:14, alignItems:'center', marginBottom:14 }}>
//                 <div style={{ width:48, height:48, borderRadius:'50%', background:'#e0f7f5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:T.teal, flexShrink:0 }}>
//                   {data.patient.name?.charAt(0).toUpperCase()}
//                 </div>
//                 <div>
//                   <div style={{ fontFamily:T.display, fontWeight:700, color:T.navy, fontSize:16 }}>{data.patient.name}</div>
//                   <div style={{ color:T.muted, fontSize:13 }}>{[data.patient.age && `${data.patient.age} yrs`, data.patient.gender, data.patient.blood_group].filter(Boolean).join(' | ')}</div>
//                 </div>
//               </div>
//               {[
//                 { label:'Phone',  value:data.patient.phone },
//                 { label:'Email',  value:data.patient.email },
//                 { label:'Address',value:data.patient.address },
//                 { label:'Joined', value:data.patient.created_at ? new Date(data.patient.created_at).toLocaleDateString('en-IN') : null },
//               ].filter(r=>r.value).map(r=>(
//                 <div key={r.label} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'5px 0', borderTop:`1px solid ${T.border}` }}>
//                   <span style={{ color:T.muted }}>{r.label}</span>
//                   <span style={{ color:T.text, fontWeight:500 }}>{r.value}</span>
//                 </div>
//               ))}
//             </div>
//             <h4 style={{ fontFamily:T.display, fontWeight:700, color:T.navy, fontSize:14, marginBottom:12 }}>Appointment history ({data.appointments.length})</h4>
//             {data.appointments.length === 0
//               ? <p style={{ color:T.muted, fontSize:13, textAlign:'center', padding:'20px 0' }}>No appointments yet.</p>
//               : data.appointments.map(a => {
//                   const s = S[a.status] || S.booked;
//                   return (
//                     <div key={a.id} style={{ background:T.bg, borderRadius:10, padding:'12px 16px', marginBottom:8 }}>
//                       <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
//                         <div>
//                           <div style={{ fontWeight:600, color:T.navy, fontSize:13 }}>Dr. {a.doctors?.users?.name || '?'}</div>
//                           <div style={{ color:T.muted, fontSize:12 }}>{a.doctors?.specialization}</div>
//                         </div>
//                         <span style={{ background:s.bg, color:s.text, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>{a.status}</span>
//                       </div>
//                       <div style={{ display:'flex', gap:16, fontSize:12, color:T.muted }}>
//                         <span>{a.appointment_date}</span><span>{a.appointment_time}</span>
//                         {a.booking_id && <span style={{ fontFamily:'monospace', color:T.teal }}>{a.booking_id}</span>}
//                       </div>
//                     </div>
//                   );
//                 })
//             }
//           </>
//         )}
//       </div>
//     </div>
//   );
// }

// export default function AdminPatients() {
//   const [patients, setPatients] = useState([]);
//   const [loading, setLoading]   = useState(true);
//   const [error, setError]       = useState('');
//   const [search, setSearch]     = useState('');
//   const [input, setInput]       = useState('');
//   const [showAdd, setShowAdd]   = useState(false);
//   const [selected, setSelected] = useState(null);
//   const [toast, setToast]       = useState('');

//   const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

//   const loadPatients = useCallback(async () => {
//     setLoading(true); setError('');
//     try {
//       const params = search ? `?search=${encodeURIComponent(search)}` : '';
//       const res = await api.get(`/patients${params}`);
//       setPatients(res.data.patients || []);
//     } catch { setError('Failed to load patients.'); }
//     finally { setLoading(false); }
//   }, [search]);

//   useEffect(() => { loadPatients(); }, [loadPatients]);
//   useEffect(() => { const t = setTimeout(() => setSearch(input), 350); return () => clearTimeout(t); }, [input]);

//   return (
//     <>
//       <header style={{ background:T.card, borderBottom:`1px solid ${T.border}`, padding:'14px 28px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:10 }}>
//         <div>
//           <h1 style={{ fontFamily:T.display, fontWeight:700, color:T.navy, fontSize:19, margin:0 }}>Patients</h1>
//           <p style={{ color:T.muted, fontSize:12, margin:0 }}>Manage patient records</p>
//         </div>
//         <button onClick={() => setShowAdd(true)} style={{ marginLeft:'auto', background:T.teal, color:'#fff', border:'none', borderRadius:8, padding:'9px 20px', fontFamily:T.body, fontSize:14, fontWeight:600, cursor:'pointer' }}>
//           + Add Patient
//         </button>
//       </header>

//       <div style={{ padding:'24px 28px' }}>
//         <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:'12px 16px', marginBottom:20, display:'flex', gap:12, alignItems:'center' }}>
//           <div style={{ display:'flex', alignItems:'center', gap:8, background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, padding:'8px 12px', flex:1 }}>
//             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
//             <input type="text" placeholder="Search by name or phone..." value={input} onChange={e=>setInput(e.target.value)}
//               style={{ border:'none', background:'transparent', outline:'none', fontFamily:T.body, fontSize:13, color:T.text, width:'100%' }} />
//           </div>
//           <span style={{ fontSize:13, color:T.muted, whiteSpace:'nowrap' }}>{patients.length} patient{patients.length!==1?'s':''}</span>
//         </div>

//         {error && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'12px 16px', color:'#b91c1c', marginBottom:16, fontSize:14 }}>{error}</div>}

//         <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, overflow:'hidden' }}>
//           {loading ? (
//             <div style={{ textAlign:'center', padding:'64px 0', color:T.muted }}>Loading patients...</div>
//           ) : patients.length === 0 ? (
//             <div style={{ textAlign:'center', padding:'64px 0', color:T.muted }}>
//               <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.border} strokeWidth="1.5" style={{marginBottom:12}}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
//               <p style={{ marginBottom:12 }}>{input ? 'No patients found.' : 'No patients yet.'}</p>
//               {!input && <button onClick={() => setShowAdd(true)} style={{ background:T.teal, color:'#fff', border:'none', borderRadius:8, padding:'10px 24px', fontFamily:T.body, fontWeight:600, cursor:'pointer' }}>Add first patient</button>}
//             </div>
//           ) : (
//             <div style={{ overflowX:'auto' }}>
//               <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:T.body, fontSize:13 }}>
//                 <thead>
//                   <tr style={{ borderBottom:`2px solid ${T.border}`, background:T.bg }}>
//                     {['Patient','Age','Gender','Blood','Phone','Appointments','Joined',''].map(h=>(
//                       <th key={h} style={{ padding:'11px 16px', textAlign:'left', fontWeight:600, color:T.muted, whiteSpace:'nowrap', fontSize:11, textTransform:'uppercase', letterSpacing:'.04em' }}>{h}</th>
//                     ))}
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {patients.map((p, idx) => {
//                     const gc = GENDER_COLORS[p.gender] || {};
//                     return (
//                       <tr key={p.id} style={{ borderBottom:`1px solid ${T.border}`, background:idx%2===0?'#fff':'#fafbfc' }}>
//                         <td style={{ padding:'12px 16px' }}>
//                           <div style={{ display:'flex', alignItems:'center', gap:10 }}>
//                             <div style={{ width:34, height:34, borderRadius:'50%', background:'#e0f7f5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:T.teal, flexShrink:0 }}>
//                               {p.name?.charAt(0).toUpperCase()}
//                             </div>
//                             <div>
//                               <div style={{ fontWeight:600, color:T.text }}>{p.name}</div>
//                               {p.email && <div style={{ fontSize:11, color:T.muted }}>{p.email}</div>}
//                             </div>
//                           </div>
//                         </td>
//                         <td style={{ padding:'12px 16px', color:T.muted }}>{p.age || '-'}</td>
//                         <td style={{ padding:'12px 16px' }}>
//                           {p.gender ? <span style={{ ...gc, padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:600 }}>{p.gender}</span> : '-'}
//                         </td>
//                         <td style={{ padding:'12px 16px', color:T.muted, fontWeight:600 }}>{p.blood_group || '-'}</td>
//                         <td style={{ padding:'12px 16px', color:T.text, fontFamily:'monospace', fontSize:12 }}>{p.phone}</td>
//                         <td style={{ padding:'12px 16px', textAlign:'center' }}>
//                           <span style={{ background:'#f0fdfb', color:T.teal, fontWeight:700, padding:'3px 10px', borderRadius:20, fontSize:12 }}>{p.appointment_count}</span>
//                         </td>
//                         <td style={{ padding:'12px 16px', color:T.muted, whiteSpace:'nowrap' }}>
//                           {p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '-'}
//                         </td>
//                         <td style={{ padding:'12px 16px' }}>
//                           <button onClick={() => setSelected(p)} style={{ padding:'5px 14px', border:`1px solid ${T.border}`, borderRadius:6, background:'#fff', fontFamily:T.body, fontSize:12, cursor:'pointer', color:T.text }}>
//                             View
//                           </button>
//                         </td>
//                       </tr>
//                     );
//                   })}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </div>
//       </div>

//       {showAdd  && <AddPatientModal onClose={() => setShowAdd(false)} onSuccess={p => { setShowAdd(false); showToast(`${p.first_name} added`); loadPatients(); }} />}
//       {selected && <PatientDetail patient={selected} onClose={() => setSelected(null)} />}

//       {toast && (
//         <div style={{ position:'fixed', bottom:28, right:28, background:T.teal, color:'#fff', padding:'12px 20px', borderRadius:10, fontFamily:T.body, fontWeight:600, fontSize:14, zIndex:2000 }}>
//           {toast}
//         </div>
//       )}
//     </>
//   );
// }

'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { T } from '../layout';

const GENDER_COLORS = {
  Male:   { bg:'#eff6ff', text:'#1d4ed8' },
  Female: { bg:'#fdf2f8', text:'#9d174d' },
  Other:  { bg:'#f5f3ff', text:'#6d28d9' },
};

function AddPatientModal({ onClose, onSuccess }) {
  const [form, setForm]       = useState({ name:'', phone:'', email:'', age:'', gender:'', blood_group:'', address:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim()) { setError('Name and phone are required.'); return; }
    setLoading(true); setError('');
    try {
      const parts = form.name.trim().split(/\s+/);
      const first_name = parts[0];
      const last_name = parts.slice(1).join(' ') || '';
      const { name, age, ...rest } = form;
      const payload = { ...rest, first_name, last_name };
      if (age) payload.date_of_birth = null;
      const res = await api('/patients', { method: 'POST', body: JSON.stringify(payload) });
      onSuccess(res.patient);
    } catch (err) {
      setError(err.message || 'Failed to create patient.');
    } finally { setLoading(false); }
  };

  const inp = { width:'100%', padding:'10px 14px', borderRadius:8, border:`1px solid ${T.border}`, fontFamily:T.body, fontSize:14, color:T.text, outline:'none', boxSizing:'border-box', background:'#fff' };
  const lbl = { display:'block', fontSize:13, fontWeight:600, color:T.text, marginBottom:6 };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
      <div style={{ background:'#fff', borderRadius:16, padding:'28px 32px', width:'100%', maxWidth:500, boxShadow:'0 24px 64px rgba(0,0,0,.15)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <h3 style={{ fontFamily:T.display, fontSize:18, fontWeight:700, color:T.navy, margin:0 }}>Add Patient</h3>
            <p style={{ fontSize:12, color:T.muted, margin:'4px 0 0' }}>Create a new patient record</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:T.muted, fontSize:20 }}>x</button>
        </div>

        {error && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', color:'#b91c1c', fontSize:13, marginBottom:16 }}>{error}</div>}

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div><label style={lbl}>Full name <span style={{color:'#ef4444'}}>*</span></label><input style={inp} placeholder="Priya Sharma" value={form.name} onChange={e=>upd('name',e.target.value)} /></div>
            <div><label style={lbl}>Phone <span style={{color:'#ef4444'}}>*</span></label><input style={inp} type="tel" placeholder="9876543210" value={form.phone} onChange={e=>upd('phone',e.target.value)} /></div>
          </div>
          <div><label style={lbl}>Email</label><input style={inp} type="email" placeholder="patient@email.com" value={form.email} onChange={e=>upd('email',e.target.value)} /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
            <div><label style={lbl}>Age</label><input style={inp} type="number" placeholder="34" min="0" max="120" value={form.age} onChange={e=>upd('age',e.target.value)} /></div>
            <div>
              <label style={lbl}>Gender</label>
              <select style={inp} value={form.gender} onChange={e=>upd('gender',e.target.value)}>
                <option value="">Select</option>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Blood group</label>
              <select style={inp} value={form.blood_group} onChange={e=>upd('blood_group',e.target.value)}>
                <option value="">Select</option>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g=><option key={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div><label style={lbl}>Address</label><input style={inp} placeholder="Street, City" value={form.address} onChange={e=>upd('address',e.target.value)} /></div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:24 }}>
          <button onClick={onClose} style={{ flex:1, padding:'11px', border:`1px solid ${T.border}`, borderRadius:8, background:'#fff', fontFamily:T.body, fontSize:14, cursor:'pointer', color:T.muted }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} style={{ flex:2, padding:'11px', border:'none', borderRadius:8, background:loading?T.border:T.teal, color:loading?T.muted:'#fff', fontFamily:T.body, fontSize:14, fontWeight:600, cursor:loading?'wait':'pointer' }}>
            {loading ? 'Adding...' : 'Add Patient'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PatientDetail({ patient, onClose }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`/patients/${patient.id}`)
      .then(r => setData(r))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [patient.id]);

  const S = { booked:{bg:'#eff6ff',text:'#1d4ed8'}, confirmed:{bg:'#f0fdfb',text:'#0f766e'}, completed:{bg:'#f0fdf4',text:'#15803d'}, cancelled:{bg:'#fef2f2',text:'#b91c1c'}, no_show:{bg:'#fefce8',text:'#a16207'} };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', zIndex:1000, display:'flex', justifyContent:'flex-end' }} onClick={onClose}>
      <div style={{ width:'100%', maxWidth:440, background:'#fff', height:'100%', overflowY:'auto', padding:'28px 24px', boxShadow:'-12px 0 40px rgba(0,0,0,.12)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h3 style={{ fontFamily:T.display, fontSize:18, fontWeight:700, color:T.navy, margin:0 }}>Patient details</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:T.muted, fontSize:20 }}>x</button>
        </div>
        {loading ? <div style={{ textAlign:'center', padding:'48px 0', color:T.muted }}>Loading...</div>
        : !data    ? <div style={{ textAlign:'center', padding:'48px 0', color:T.muted }}>Could not load patient.</div>
        : (
          <>
            <div style={{ background:T.bg, borderRadius:12, padding:'16px 20px', marginBottom:20 }}>
              <div style={{ display:'flex', gap:14, alignItems:'center', marginBottom:14 }}>
                <div style={{ width:48, height:48, borderRadius:'50%', background:'#e0f7f5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:T.teal, flexShrink:0 }}>
                  {(data.patient.first_name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontFamily:T.display, fontWeight:700, color:T.navy, fontSize:16 }}>{data.patient.first_name} {data.patient.last_name}</div>
                  <div style={{ color:T.muted, fontSize:13 }}>{[data.patient.date_of_birth && `${Math.floor((Date.now()-new Date(data.patient.date_of_birth))/31557600000)} yrs`, data.patient.gender, data.patient.blood_group].filter(Boolean).join(' | ')}</div>
                </div>
              </div>
              {[
                { label:'Phone',  value:data.patient.phone },
                { label:'Email',  value:data.patient.email },
                { label:'Address',value:data.patient.address },
                { label:'Joined', value:data.patient.created_at ? new Date(data.patient.created_at).toLocaleDateString('en-IN') : null },
              ].filter(r=>r.value).map(r=>(
                <div key={r.label} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'5px 0', borderTop:`1px solid ${T.border}` }}>
                  <span style={{ color:T.muted }}>{r.label}</span>
                  <span style={{ color:T.text, fontWeight:500 }}>{r.value}</span>
                </div>
              ))}
            </div>
            <h4 style={{ fontFamily:T.display, fontWeight:700, color:T.navy, fontSize:14, marginBottom:12 }}>Appointment history ({data.appointments.length})</h4>
            {data.appointments.length === 0
              ? <p style={{ color:T.muted, fontSize:13, textAlign:'center', padding:'20px 0' }}>No appointments yet.</p>
              : data.appointments.map(a => {
                  const s = S[a.status] || S.booked;
                  return (
                    <div key={a.id} style={{ background:T.bg, borderRadius:10, padding:'12px 16px', marginBottom:8 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                        <div>
                          <div style={{ fontWeight:600, color:T.navy, fontSize:13 }}>Dr. {a.doctors?.users?.name || '?'}</div>
                          <div style={{ color:T.muted, fontSize:12 }}>{a.doctors?.specialization}</div>
                        </div>
                        <span style={{ background:s.bg, color:s.text, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>{a.status}</span>
                      </div>
                      <div style={{ display:'flex', gap:16, fontSize:12, color:T.muted }}>
                        <span>{a.appointment_date}</span><span>{a.appointment_time}</span>
                        {a.booking_id && <span style={{ fontFamily:'monospace', color:T.teal }}>{a.booking_id}</span>}
                      </div>
                    </div>
                  );
                })
            }
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminPatients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [input, setInput]       = useState('');
  const [showAdd, setShowAdd]   = useState(false);
  const [selected, setSelected] = useState(null);
  const [toast, setToast]       = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deletingId, setDeletingId]       = useState(null);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const onDeletePatient = async () => {
    if (!deleteConfirm) return;
    setDeletingId(deleteConfirm.id);
    try {
      await api(`/patients/${deleteConfirm.id}`, { method: 'DELETE' });
      setDeleteConfirm(null);
      showToast(`${deleteConfirm.first_name} ${deleteConfirm.last_name} deleted`);
      await loadPatients();
    } catch (err) {
      alert(err.message || 'Failed to delete patient');
    } finally {
      setDeletingId(null);
    }
  };

  const loadPatients = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await api(`/patients${params}`);
      setPatients(res.patients || []);
    } catch (e) { setError(e.message || 'Failed to load patients.'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { loadPatients(); }, [loadPatients]);
  useEffect(() => { const t = setTimeout(() => setSearch(input), 350); return () => clearTimeout(t); }, [input]);

  return (
    <>
      <header style={{ background:T.card, borderBottom:`1px solid ${T.border}`, padding:'14px 28px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:10 }}>
        <div>
          <h1 style={{ fontFamily:T.display, fontWeight:700, color:T.navy, fontSize:19, margin:0 }}>Patients</h1>
          <p style={{ color:T.muted, fontSize:12, margin:0 }}>Manage patient records</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ marginLeft:'auto', background:T.teal, color:'#fff', border:'none', borderRadius:8, padding:'9px 20px', fontFamily:T.body, fontSize:14, fontWeight:600, cursor:'pointer' }}>
          + Add Patient
        </button>
      </header>

      <div style={{ padding:'24px 28px' }}>
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:'12px 16px', marginBottom:20, display:'flex', gap:12, alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, padding:'8px 12px', flex:1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" placeholder="Search by name or phone..." value={input} onChange={e=>setInput(e.target.value)}
              style={{ border:'none', background:'transparent', outline:'none', fontFamily:T.body, fontSize:13, color:T.text, width:'100%' }} />
          </div>
          <span style={{ fontSize:13, color:T.muted, whiteSpace:'nowrap' }}>{patients.length} patient{patients.length!==1?'s':''}</span>
        </div>

        {error && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'12px 16px', color:'#b91c1c', marginBottom:16, fontSize:14 }}>{error}</div>}

        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, overflow:'hidden' }}>
          {loading ? (
            <div style={{ textAlign:'center', padding:'64px 0', color:T.muted }}>Loading patients...</div>
          ) : patients.length === 0 ? (
            <div style={{ textAlign:'center', padding:'64px 0', color:T.muted }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.border} strokeWidth="1.5" style={{marginBottom:12}}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <p style={{ marginBottom:12 }}>{input ? 'No patients found.' : 'No patients yet.'}</p>
              {!input && <button onClick={() => setShowAdd(true)} style={{ background:T.teal, color:'#fff', border:'none', borderRadius:8, padding:'10px 24px', fontFamily:T.body, fontWeight:600, cursor:'pointer' }}>Add first patient</button>}
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:T.body, fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:`2px solid ${T.border}`, background:T.bg }}>
                    {['Patient','Age','Gender','Blood','Phone','Appointments','Joined',''].map(h=>(
                      <th key={h} style={{ padding:'11px 16px', textAlign:'left', fontWeight:600, color:T.muted, whiteSpace:'nowrap', fontSize:11, textTransform:'uppercase', letterSpacing:'.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p, idx) => {
                    const gc = GENDER_COLORS[p.gender] || {};
                    const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim();
                    const age = p.date_of_birth ? Math.floor((Date.now() - new Date(p.date_of_birth)) / 31557600000) : null;
                    return (
                      <tr key={p.id} style={{ borderBottom:`1px solid ${T.border}`, background:idx%2===0?'#fff':'#fafbfc' }}>
                        <td style={{ padding:'12px 16px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{ width:34, height:34, borderRadius:'50%', background:'#e0f7f5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:T.teal, flexShrink:0 }}>
                              {(p.first_name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight:600, color:T.text }}>{fullName || '–'}</div>
                              {p.email && <div style={{ fontSize:11, color:T.muted }}>{p.email}</div>}
                              {p.patient_uid && <div style={{ fontSize:10, color:T.teal, fontFamily:'monospace' }}>{p.patient_uid}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:'12px 16px', color:T.muted }}>{age ?? '-'}</td>
                        <td style={{ padding:'12px 16px' }}>
                          {p.gender ? <span style={{ ...gc, padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:600 }}>{p.gender}</span> : '-'}
                        </td>
                        <td style={{ padding:'12px 16px', color:T.muted, fontWeight:600 }}>{p.blood_group || '-'}</td>
                        <td style={{ padding:'12px 16px', color:T.text, fontFamily:'monospace', fontSize:12 }}>{p.phone}</td>
                        <td style={{ padding:'12px 16px', textAlign:'center' }}>
                          <span style={{ background:'#f0fdfb', color:T.teal, fontWeight:700, padding:'3px 10px', borderRadius:20, fontSize:12 }}>{p.appointment_count}</span>
                        </td>
                        <td style={{ padding:'12px 16px', color:T.muted, whiteSpace:'nowrap' }}>
                          {p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '-'}
                        </td>
                        <td style={{ padding:'12px 16px' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={() => setSelected(p)} style={{ padding:'5px 12px', border:`1px solid ${T.border}`, borderRadius:6, background:'#fff', fontFamily:T.body, fontSize:12, cursor:'pointer', color:T.text }}>
                              View
                            </button>
                            <button onClick={() => setDeleteConfirm(p)} style={{ padding:'5px 12px', border:'1px solid #fecaca', borderRadius:6, background:'#fef2f2', fontFamily:T.body, fontSize:12, cursor:'pointer', color:'#b91c1c', fontWeight:600 }}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showAdd  && <AddPatientModal onClose={() => setShowAdd(false)} onSuccess={p => { setShowAdd(false); showToast(`${p.first_name} added`); loadPatients(); }} />}
      {selected && <PatientDetail patient={selected} onClose={() => setSelected(null)} />}

      {deleteConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.45)', display:'grid', placeItems:'center', zIndex:1100 }}>
          <div style={{ background:'#fff', borderRadius:14, padding:'28px 32px', width:'min(420px, 92vw)', boxShadow:'0 24px 64px rgba(0,0,0,.18)' }}>
            <h3 style={{ margin:'0 0 8px', fontFamily:T.display, color:T.navy, fontSize:18 }}>Delete Patient</h3>
            <p style={{ margin:'0 0 20px', color:T.muted, fontSize:14 }}>
              Are you sure you want to delete <strong>{deleteConfirm.first_name} {deleteConfirm.last_name}</strong>? This cannot be undone.
            </p>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={() => setDeleteConfirm(null)} disabled={!!deletingId}
                style={{ border:`1px solid ${T.border}`, background:'#fff', borderRadius:8, padding:'9px 18px', cursor:'pointer', fontFamily:T.body }}>
                Cancel
              </button>
              <button onClick={onDeletePatient} disabled={!!deletingId}
                style={{ border:'none', background:'#dc2626', color:'#fff', borderRadius:8, padding:'9px 18px', cursor:'pointer', fontFamily:T.body, fontWeight:600 }}>
                {deletingId ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:'fixed', bottom:28, right:28, background:T.teal, color:'#fff', padding:'12px 20px', borderRadius:10, fontFamily:T.body, fontWeight:600, fontSize:14, zIndex:2000 }}>
          {toast}
        </div>
      )}
    </>
  );
}