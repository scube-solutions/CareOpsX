'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const TABS = ['Staff', 'Attendance', 'Leave', 'Payroll', 'Shifts'];

// ─── shared styles ────────────────────────────────────────────────────────────
const s = {
  page:   { padding: 24, fontFamily: "'Instrument Sans',sans-serif" },
  h1:     { margin: 0, fontSize: 22, fontWeight: 700, color: '#0f1f3d' },
  h2:     { margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#0f1f3d' },
  sub:    { margin: '4px 0 0', fontSize: 13, color: '#64748b' },
  hdr:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  msg:    { background: '#f0fdfb', border: '1px solid #00b4a0', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between', fontSize: 13 },
  msgX:   { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 },
  card:   { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 },
  grid3:  { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 },
  fg:     { display: 'flex', flexDirection: 'column', gap: 4 },
  label:  { fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.05em' },
  input:  { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#0f1f3d', background: '#fff', width: '100%', boxSizing: 'border-box' },
  table:  { width: '100%', borderCollapse: 'collapse' },
  th:     { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' },
  td:     { padding: '12px', fontSize: 13, color: '#0f1f3d', borderBottom: '1px solid #f1f5f9' },
  btnPri: { padding: '9px 18px', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 },
  btnSec: { padding: '9px 18px', background: '#fff', color: '#0f1f3d', border: '1.5px solid #e2e8f0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 },
  actBtn: { padding: '5px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#0f1f3d' },
  badge:  (bg, col) => ({ background: bg, color: col, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, display: 'inline-block' }),
  statCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', textAlign: 'center' },
};

const ROLE_LABELS   = { 1: 'Admin', 2: 'Doctor', 5: 'Receptionist', 6: 'Lab Staff', 7: 'Pharmacist', 8: 'Reporting' };
const DEPT_OPTIONS  = ['General', 'Cardiology', 'Neurology', 'Orthopedics', 'Lab', 'Pharmacy', 'Administration', 'Nursing', 'Reception'];
const LEAVE_TYPES   = ['Sick Leave', 'Casual Leave', 'Earned Leave', 'Maternity Leave', 'Paternity Leave', 'Emergency Leave'];
const ATTEND_STATUS = ['present', 'absent', 'half_day', 'late', 'on_leave', 'holiday'];
const ATTEND_COLORS = { present: ['#f0fdf4','#065f46'], absent: ['#fef2f2','#dc2626'], half_day: ['#fffbeb','#92400e'], late: ['#fffbeb','#b45309'], on_leave: ['#eff6ff','#1d4ed8'], holiday: ['#f5f3ff','#7c3aed'] };
const LEAVE_COLORS  = { pending: ['#fffbeb','#92400e'], approved: ['#f0fdf4','#065f46'], rejected: ['#fef2f2','#dc2626'] };
const SHIFT_DAYS    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const SHIFT_COLORS  = ['#00b4a0','#1d4ed8','#7c3aed','#be185d','#92400e','#065f46'];

// ─── Staff Tab ────────────────────────────────────────────────────────────────
function StaffTab({ users }) {
  const [staff,    setStaff]    = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({});
  const [editing,  setEditing]  = useState(null);
  const [msg,      setMsg]      = useState('');
  const [search,   setSearch]   = useState('');

  const load = async () => { try { setStaff((await api('/hr/staff')).staff || []); } catch(e) { setMsg(e.message); } };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing) await api(`/hr/staff/${editing.id}`, { method: 'PUT',  body: JSON.stringify(form) });
      else         await api('/hr/staff',                { method: 'POST', body: JSON.stringify(form) });
      setMsg('Saved'); setShowForm(false); setForm({}); setEditing(null); load();
    } catch(e) { setMsg(e.message); }
  };

  const toggle = async (id) => { try { await api(`/hr/staff/${id}/toggle`, { method: 'PATCH' }); load(); } catch(e) { setMsg(e.message); } };

  const filtered = staff.filter(st => {
    const u = st.users || {};
    return `${u.first_name} ${u.last_name} ${u.email} ${st.department || ''}`.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div>
      <div style={s.hdr}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, flex: 1, marginRight: 16 }}>
          {[['Total', staff.length, '#0f1f3d'], ['Active', staff.filter(x => x.is_active !== false).length, '#065f46'], ['Doctors', staff.filter(x => x.users?.role_id === 2).length, '#1d4ed8'], ['Inactive', staff.filter(x => x.is_active === false).length, '#dc2626']].map(([l,v,c]) => (
            <div key={l} style={s.statCard}><div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>{l}</div><div style={{ fontSize: 22, fontWeight: 800, color: c }}>{v}</div></div>
          ))}
        </div>
        <button onClick={() => { setShowForm(true); setForm({}); setEditing(null); }} style={s.btnPri}>+ Add Staff</button>
      </div>

      {msg && <div style={s.msg}>{msg}<button onClick={() => setMsg('')} style={s.msgX}>×</button></div>}

      {showForm && (
        <div style={{ ...s.card, marginBottom: 20, borderLeft: '4px solid #00b4a0' }}>
          <h2 style={s.h2}>{editing ? 'Edit Staff' : 'New Staff Profile'}</h2>
          <div style={s.grid3}>
            <div style={s.fg}><label style={s.label}>Employee (User)</label>
              <select value={form.user_id || ''} onChange={e => setForm({ ...form, user_id: e.target.value })} style={s.input}>
                <option value="">Select user</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name} — {ROLE_LABELS[u.role_id] || 'Staff'}</option>)}
              </select>
            </div>
            <div style={s.fg}><label style={s.label}>Employee ID</label><input value={form.employee_id || ''} onChange={e => setForm({ ...form, employee_id: e.target.value })} style={s.input} placeholder="EMP-001" /></div>
            <div style={s.fg}><label style={s.label}>Department</label>
              <select value={form.department || ''} onChange={e => setForm({ ...form, department: e.target.value })} style={s.input}>
                <option value="">Select</option>
                {DEPT_OPTIONS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div style={s.fg}><label style={s.label}>Designation</label><input value={form.designation || ''} onChange={e => setForm({ ...form, designation: e.target.value })} style={s.input} /></div>
            <div style={s.fg}><label style={s.label}>Date of Joining</label><input type="date" value={form.date_of_joining || ''} onChange={e => setForm({ ...form, date_of_joining: e.target.value })} style={s.input} /></div>
            <div style={s.fg}><label style={s.label}>Employment Type</label>
              <select value={form.employment_type || ''} onChange={e => setForm({ ...form, employment_type: e.target.value })} style={s.input}>
                <option value="">Select</option>
                {['Full-Time', 'Part-Time', 'Contract', 'Intern'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={s.fg}><label style={s.label}>Blood Group</label><input value={form.blood_group || ''} onChange={e => setForm({ ...form, blood_group: e.target.value })} style={s.input} placeholder="A+" /></div>
            <div style={s.fg}><label style={s.label}>Emergency Contact</label><input value={form.emergency_contact || ''} onChange={e => setForm({ ...form, emergency_contact: e.target.value })} style={s.input} /></div>
            <div style={s.fg}><label style={s.label}>Address</label><input value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} style={s.input} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={save} style={s.btnPri}>Save</button>
            <button onClick={() => { setShowForm(false); setEditing(null); setForm({}); }} style={s.btnSec}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, department…" style={{ ...s.input, maxWidth: 340 }} />
      </div>

      <div style={s.card}>
        <table style={s.table}>
          <thead><tr>{['Employee', 'Email', 'Role', 'Department', 'Type', 'Status', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(st => {
              const u = st.users || {};
              return (
                <tr key={st.id}>
                  <td style={s.td}><strong>{u.first_name} {u.last_name}</strong><div style={{ fontSize: 11, color: '#94a3b8' }}>{st.employee_id || '–'}</div></td>
                  <td style={s.td}>{u.email}</td>
                  <td style={s.td}><span style={s.badge('#eff6ff', '#1d4ed8')}>{ROLE_LABELS[u.role_id] || 'Staff'}</span></td>
                  <td style={s.td}>{st.department || '–'}</td>
                  <td style={s.td}>{st.employment_type || '–'}</td>
                  <td style={s.td}><span style={s.badge(st.is_active !== false ? '#f0fdf4' : '#fef2f2', st.is_active !== false ? '#065f46' : '#dc2626')}>{st.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                  <td style={s.td}>
                    <button onClick={() => { setEditing(st); setForm({ ...st }); setShowForm(true); }} style={s.actBtn}>Edit</button>
                    <button onClick={() => toggle(st.id)} style={{ ...s.actBtn, marginLeft: 6, color: st.is_active !== false ? '#dc2626' : '#065f46' }}>{st.is_active !== false ? 'Deactivate' : 'Activate'}</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: '#94a3b8', padding: 32 }}>No staff records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────
function AttendanceTab({ users }) {
  const [records,  setRecords]  = useState([]);
  const [date,     setDate]     = useState(new Date().toISOString().split('T')[0]);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ user_id: '', status: 'present', check_in: '', check_out: '', notes: '' });
  const [msg,      setMsg]      = useState('');

  const load = async () => { try { setRecords((await api(`/hr/attendance?date=${date}`)).attendance || []); } catch(e) { setMsg(e.message); } };
  useEffect(() => { load(); }, [date]);

  const mark = async () => {
    try {
      await api('/hr/attendance', { method: 'POST', body: JSON.stringify({ ...form, date }) });
      setMsg('Marked'); setShowForm(false); setForm({ user_id: '', status: 'present', check_in: '', check_out: '', notes: '' }); load();
    } catch(e) { setMsg(e.message); }
  };

  return (
    <div>
      <div style={{ ...s.hdr, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ATTEND_STATUS.map(st => {
            const [bg, col] = ATTEND_COLORS[st] || ['#f8fafc', '#475569'];
            const count = records.filter(r => r.status === st).length;
            return <div key={st} style={{ background: bg, color: col, padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{st.replace('_', ' ')}: {count}</div>;
          })}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...s.input, width: 160 }} />
          <button onClick={() => setShowForm(v => !v)} style={s.btnPri}>+ Mark</button>
        </div>
      </div>

      {msg && <div style={s.msg}>{msg}<button onClick={() => setMsg('')} style={s.msgX}>×</button></div>}

      {showForm && (
        <div style={{ ...s.card, marginBottom: 20, borderLeft: '4px solid #00b4a0' }}>
          <h2 style={s.h2}>Mark Attendance — {date}</h2>
          <div style={s.grid3}>
            <div style={s.fg}><label style={s.label}>Employee</label>
              <select value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })} style={s.input}>
                <option value="">Select</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
              </select>
            </div>
            <div style={s.fg}><label style={s.label}>Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={s.input}>
                {ATTEND_STATUS.map(st => <option key={st} value={st}>{st.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div style={s.fg}><label style={s.label}>Check In</label><input type="time" value={form.check_in} onChange={e => setForm({ ...form, check_in: e.target.value })} style={s.input} /></div>
            <div style={s.fg}><label style={s.label}>Check Out</label><input type="time" value={form.check_out} onChange={e => setForm({ ...form, check_out: e.target.value })} style={s.input} /></div>
            <div style={{ ...s.fg, gridColumn: 'span 2' }}><label style={s.label}>Notes</label><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={s.input} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={mark} style={s.btnPri}>Save</button>
            <button onClick={() => setShowForm(false)} style={s.btnSec}>Cancel</button>
          </div>
        </div>
      )}

      <div style={s.card}>
        <table style={s.table}>
          <thead><tr>{['Employee', 'Status', 'Check In', 'Check Out', 'Notes'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {records.map(r => {
              const u = r.users || {};
              const [bg, col] = ATTEND_COLORS[r.status] || ['#f8fafc', '#475569'];
              return (
                <tr key={r.id}>
                  <td style={s.td}><strong>{u.first_name} {u.last_name}</strong></td>
                  <td style={s.td}><span style={s.badge(bg, col)}>{r.status?.replace('_', ' ')}</span></td>
                  <td style={s.td}>{r.check_in || '–'}</td>
                  <td style={s.td}>{r.check_out || '–'}</td>
                  <td style={s.td}>{r.notes || '–'}</td>
                </tr>
              );
            })}
            {records.length === 0 && <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', color: '#94a3b8', padding: 32 }}>No records for {date}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Leave Tab ────────────────────────────────────────────────────────────────
function LeaveTab({ users }) {
  const [leaves,   setLeaves]   = useState([]);
  const [filter,   setFilter]   = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ user_id: '', leave_type: 'Sick Leave', from_date: '', to_date: '', reason: '' });
  const [msg,      setMsg]      = useState('');

  const load = async () => { try { setLeaves((await api('/hr/leaves')).leaves || []); } catch(e) { setMsg(e.message); } };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try { await api('/hr/leaves', { method: 'POST', body: JSON.stringify(form) }); setMsg('Submitted'); setShowForm(false); load(); } catch(e) { setMsg(e.message); }
  };
  const updateStatus = async (id, status) => {
    try { await api(`/hr/leaves/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); load(); } catch(e) { setMsg(e.message); }
  };

  const filtered = filter === 'all' ? leaves : leaves.filter(l => l.status === filter);
  const days = (a, b) => !a || !b ? '–' : (Math.ceil((new Date(b) - new Date(a)) / 86400000) + 1) + 'd';

  return (
    <div>
      <div style={s.hdr}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, flex: 1, marginRight: 16 }}>
          {[['Pending', 'pending', '#92400e', '#fffbeb'], ['Approved', 'approved', '#065f46', '#f0fdf4'], ['Rejected', 'rejected', '#dc2626', '#fef2f2']].map(([l, st, c, bg]) => (
            <div key={l} style={{ ...s.statCard, background: bg }}><div style={{ fontSize: 10, fontWeight: 700, color: c, textTransform: 'uppercase', marginBottom: 4 }}>{l}</div><div style={{ fontSize: 22, fontWeight: 800, color: c }}>{leaves.filter(x => x.status === st).length}</div></div>
          ))}
        </div>
        <button onClick={() => setShowForm(v => !v)} style={s.btnPri}>+ New Request</button>
      </div>

      {msg && <div style={s.msg}>{msg}<button onClick={() => setMsg('')} style={s.msgX}>×</button></div>}

      {showForm && (
        <div style={{ ...s.card, marginBottom: 20, borderLeft: '4px solid #00b4a0' }}>
          <h2 style={s.h2}>New Leave Request</h2>
          <div style={s.grid3}>
            <div style={s.fg}><label style={s.label}>Employee</label>
              <select value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })} style={s.input}>
                <option value="">Select</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
              </select>
            </div>
            <div style={s.fg}><label style={s.label}>Leave Type</label>
              <select value={form.leave_type} onChange={e => setForm({ ...form, leave_type: e.target.value })} style={s.input}>
                {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={s.fg}><label style={s.label}>From</label><input type="date" value={form.from_date} onChange={e => setForm({ ...form, from_date: e.target.value })} style={s.input} /></div>
            <div style={s.fg}><label style={s.label}>To</label><input type="date" value={form.to_date} onChange={e => setForm({ ...form, to_date: e.target.value })} style={s.input} /></div>
            <div style={{ ...s.fg, gridColumn: 'span 2' }}><label style={s.label}>Reason</label><input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} style={s.input} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={submit} style={s.btnPri}>Submit</button>
            <button onClick={() => setShowForm(false)} style={s.btnSec}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {['all', 'pending', 'approved', 'rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid', borderColor: filter === f ? '#00b4a0' : '#e2e8f0', background: filter === f ? '#f0fdfb' : '#fff', color: filter === f ? '#00b4a0' : '#475569', fontWeight: filter === f ? 700 : 500, fontSize: 12, cursor: 'pointer' }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div style={s.card}>
        <table style={s.table}>
          <thead><tr>{['Employee', 'Type', 'From', 'To', 'Days', 'Reason', 'Status', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(l => {
              const u = l.users || {};
              const [bg, col] = LEAVE_COLORS[l.status] || ['#f8fafc', '#475569'];
              return (
                <tr key={l.id}>
                  <td style={s.td}><strong>{u.first_name} {u.last_name}</strong></td>
                  <td style={s.td}>{l.leave_type}</td>
                  <td style={s.td}>{l.from_date}</td>
                  <td style={s.td}>{l.to_date}</td>
                  <td style={s.td}>{days(l.from_date, l.to_date)}</td>
                  <td style={s.td}>{l.reason || '–'}</td>
                  <td style={s.td}><span style={s.badge(bg, col)}>{l.status}</span></td>
                  <td style={s.td}>
                    {l.status === 'pending' && (
                      <>
                        <button onClick={() => updateStatus(l.id, 'approved')} style={{ ...s.actBtn, color: '#065f46' }}>Approve</button>
                        <button onClick={() => updateStatus(l.id, 'rejected')} style={{ ...s.actBtn, marginLeft: 6, color: '#dc2626' }}>Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={8} style={{ ...s.td, textAlign: 'center', color: '#94a3b8', padding: 32 }}>No leave requests</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Payroll Tab ──────────────────────────────────────────────────────────────
function PayrollTab({ users }) {
  const [payroll,  setPayroll]  = useState([]);
  const [structs,  setStructs]  = useState([]);
  const [month,    setMonth]    = useState(new Date().toISOString().slice(0, 7));
  const [running,  setRunning]  = useState(false);
  const [viewSlip, setViewSlip] = useState(null);
  const [msg,      setMsg]      = useState('');

  const load = async () => {
    try {
      const [pr, ss] = await Promise.all([api(`/hr/payroll?month=${month}`), api('/hr/salary-structures')]);
      setPayroll(pr.payroll || []); setStructs(ss.structures || []);
    } catch(e) { setMsg(e.message); }
  };
  useEffect(() => { load(); }, [month]);

  const runPayroll = async () => {
    if (!confirm(`Run payroll for ${month}?`)) return;
    setRunning(true);
    try {
      const records = users.map(u => {
        const st = structs.find(x => x.role_id === u.role_id) || {};
        const gross = (st.basic_salary || 0) + (st.hra || 0) + (st.allowances || 0);
        return { user_id: u.id, basic_salary: st.basic_salary || 0, hra: st.hra || 0, allowances: st.allowances || 0, deductions: st.deductions || 0, gross_salary: gross, net_salary: gross - (st.deductions || 0) };
      });
      await api('/hr/payroll/run', { method: 'POST', body: JSON.stringify({ pay_month: month, records }) });
      setMsg('Payroll generated'); load();
    } catch(e) { setMsg(e.message); }
    finally { setRunning(false); }
  };

  const fmt = v => `₹${(v || 0).toLocaleString()}`;
  const totalNet = payroll.reduce((a, r) => a + (r.net_salary || 0), 0);

  return (
    <div>
      <div style={s.hdr}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, flex: 1, marginRight: 16 }}>
          {[['Employees', payroll.length, '#0f1f3d'], ['Gross', `₹${payroll.reduce((a,r)=>a+(r.gross_salary||0),0).toLocaleString()}`, '#1d4ed8'], ['Net', `₹${totalNet.toLocaleString()}`, '#065f46']].map(([l, v, c]) => (
            <div key={l} style={s.statCard}><div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>{l}</div><div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div></div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...s.input, width: 160 }} />
          <button onClick={runPayroll} disabled={running} style={{ ...s.btnPri, opacity: running ? .7 : 1 }}>{running ? 'Running…' : 'Run Payroll'}</button>
        </div>
      </div>

      {msg && <div style={s.msg}>{msg}<button onClick={() => setMsg('')} style={s.msgX}>×</button></div>}

      <div style={s.card}>
        {payroll.length === 0
          ? <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No payroll for {month}. Click "Run Payroll" to generate.</div>
          : (
            <table style={s.table}>
              <thead><tr>{['Employee', 'Basic', 'HRA', 'Allowances', 'Deductions', 'Gross', 'Net', ''].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {payroll.map(r => {
                  const u = r.users || {};
                  return (
                    <tr key={r.id}>
                      <td style={s.td}><strong>{u.first_name} {u.last_name}</strong></td>
                      <td style={s.td}>{fmt(r.basic_salary)}</td>
                      <td style={s.td}>{fmt(r.hra)}</td>
                      <td style={s.td}>{fmt(r.allowances)}</td>
                      <td style={s.td}><span style={{ color: '#dc2626' }}>-{fmt(r.deductions)}</span></td>
                      <td style={s.td}>{fmt(r.gross_salary)}</td>
                      <td style={s.td}><strong style={{ color: '#065f46' }}>{fmt(r.net_salary)}</strong></td>
                      <td style={s.td}><button onClick={() => setViewSlip(r)} style={s.actBtn}>Payslip</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>

      {viewSlip && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 440, boxShadow: '0 24px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Payslip — {viewSlip.pay_month}</h2>
              <button onClick={() => setViewSlip(null)} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{viewSlip.users?.first_name} {viewSlip.users?.last_name}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Pay Period: {viewSlip.pay_month}</div>
            {[['Basic Salary', viewSlip.basic_salary], ['HRA', viewSlip.hra], ['Allowances', viewSlip.allowances]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}><span style={{ color: '#475569' }}>{l}</span><span>{fmt(v)}</span></div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#dc2626' }}><span>Deductions</span><span>-{fmt(viewSlip.deductions)}</span></div>
            <div style={{ borderTop: '2px solid #0f1f3d', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15 }}><span>Net Salary</span><span style={{ color: '#065f46' }}>{fmt(viewSlip.net_salary)}</span></div>
            <button onClick={() => window.print()} style={{ ...s.btnPri, width: '100%', marginTop: 20 }}>Print / Download</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shifts Tab ───────────────────────────────────────────────────────────────
function ShiftsTab() {
  const [shifts,   setShifts]   = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ shift_name: '', start_time: '', end_time: '', break_minutes: 30, days_of_week: [], color: '#00b4a0' });
  const [editing,  setEditing]  = useState(null);
  const [msg,      setMsg]      = useState('');

  const load = async () => { try { setShifts((await api('/hr/shifts')).shifts || []); } catch(e) { setMsg(e.message); } };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing) await api(`/hr/shifts/${editing.id}`, { method: 'PUT',  body: JSON.stringify(form) });
      else         await api('/hr/shifts',                { method: 'POST', body: JSON.stringify(form) });
      setMsg('Saved'); setShowForm(false); setForm({ shift_name: '', start_time: '', end_time: '', break_minutes: 30, days_of_week: [], color: '#00b4a0' }); setEditing(null); load();
    } catch(e) { setMsg(e.message); }
  };

  const del = async (id) => { if (!confirm('Delete?')) return; try { await api(`/hr/shifts/${id}`, { method: 'DELETE' }); load(); } catch(e) { setMsg(e.message); } };
  const toggleDay = d => { const days = form.days_of_week || []; setForm({ ...form, days_of_week: days.includes(d) ? days.filter(x => x !== d) : [...days, d] }); };
  const duration  = (a, b) => { if (!a || !b) return '–'; const [ah,am]=[...a.split(':').map(Number)],[bh,bm]=[...b.split(':').map(Number)],m=(bh*60+bm)-(ah*60+am); return `${Math.floor(m/60)}h ${m%60}m`; };

  return (
    <div>
      <div style={{ ...s.hdr, marginBottom: 16 }}>
        <p style={s.sub}>{shifts.length} shift{shifts.length !== 1 ? 's' : ''} defined</p>
        <button onClick={() => { setShowForm(true); setForm({ shift_name: '', start_time: '', end_time: '', break_minutes: 30, days_of_week: [], color: '#00b4a0' }); setEditing(null); }} style={s.btnPri}>+ Add Shift</button>
      </div>

      {msg && <div style={s.msg}>{msg}<button onClick={() => setMsg('')} style={s.msgX}>×</button></div>}

      {showForm && (
        <div style={{ ...s.card, marginBottom: 20, borderLeft: '4px solid #00b4a0' }}>
          <h2 style={s.h2}>{editing ? 'Edit Shift' : 'New Shift'}</h2>
          <div style={s.grid3}>
            <div style={s.fg}><label style={s.label}>Shift Name</label><input value={form.shift_name} onChange={e => setForm({ ...form, shift_name: e.target.value })} style={s.input} placeholder="Morning Shift" /></div>
            <div style={s.fg}><label style={s.label}>Start Time</label><input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} style={s.input} /></div>
            <div style={s.fg}><label style={s.label}>End Time</label><input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} style={s.input} /></div>
            <div style={s.fg}><label style={s.label}>Break (min)</label><input type="number" value={form.break_minutes} onChange={e => setForm({ ...form, break_minutes: +e.target.value })} style={s.input} /></div>
            <div style={{ ...s.fg, gridColumn: 'span 2' }}>
              <label style={s.label}>Working Days</label>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                {SHIFT_DAYS.map(d => { const sel = (form.days_of_week || []).includes(d); return <button key={d} type="button" onClick={() => toggleDay(d)} style={{ padding: '5px 10px', borderRadius: 8, border: `1.5px solid ${sel ? '#00b4a0' : '#e2e8f0'}`, background: sel ? '#f0fdfb' : '#fff', color: sel ? '#00b4a0' : '#475569', fontWeight: sel ? 700 : 500, fontSize: 12, cursor: 'pointer' }}>{d}</button>; })}
              </div>
            </div>
            <div style={s.fg}>
              <label style={s.label}>Color</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {SHIFT_COLORS.map(c => <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: form.color === c ? '3px solid #0f1f3d' : '3px solid transparent', cursor: 'pointer' }} />)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={save} style={s.btnPri}>Save</button>
            <button onClick={() => setShowForm(false)} style={s.btnSec}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
        {shifts.map(sh => (
          <div key={sh.id} style={{ ...s.card, borderTop: `4px solid ${sh.color || '#00b4a0'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div><div style={{ fontWeight: 700, fontSize: 15 }}>{sh.shift_name}</div><div style={{ fontSize: 12, color: '#64748b' }}>{sh.start_time} – {sh.end_time} · {duration(sh.start_time, sh.end_time)}</div></div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setEditing(sh); setForm({ ...sh, days_of_week: sh.days_of_week || [] }); setShowForm(true); }} style={s.actBtn}>Edit</button>
                <button onClick={() => del(sh.id)} style={{ ...s.actBtn, color: '#dc2626' }}>Del</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {SHIFT_DAYS.map(d => { const on = (sh.days_of_week || []).includes(d); return <span key={d} style={{ padding: '2px 7px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: on ? (sh.color || '#00b4a0') : '#f1f5f9', color: on ? '#fff' : '#94a3b8' }}>{d}</span>; })}
            </div>
          </div>
        ))}
        {shifts.length === 0 && <div style={{ ...s.card, textAlign: 'center', color: '#94a3b8', padding: 40, gridColumn: '1/-1' }}>No shifts defined</div>}
      </div>
    </div>
  );
}

// ─── Main HRMS Page ───────────────────────────────────────────────────────────
export default function HRMSPage() {
  const [tab,   setTab]   = useState(0);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api('/admin/users').then(d => setUsers(d.users || [])).catch(() => {});
  }, []);

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={s.h1}>HRMS</h1>
        <p style={s.sub}>Human Resource Management — Staff, Attendance, Leave, Payroll, Shifts</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 24 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{ padding: '.75rem 1.5rem', border: 'none', background: 'transparent', color: tab === i ? '#00b4a0' : '#64748b', fontWeight: tab === i ? 700 : 500, cursor: 'pointer', fontSize: '.9rem', borderBottom: tab === i ? '3px solid #00b4a0' : '3px solid transparent', transition: 'all .2s' }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && <StaffTab users={users} />}
      {tab === 1 && <AttendanceTab users={users} />}
      {tab === 2 && <LeaveTab users={users} />}
      {tab === 3 && <PayrollTab users={users} />}
      {tab === 4 && <ShiftsTab />}
    </div>
  );
}
