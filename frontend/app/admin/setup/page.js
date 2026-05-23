'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const TABS = ['Profile', 'Organization', 'User Management', 'Subscription', 'Audit Logs'];

export default function SetupPage() {
  const [tab, setTab] = useState(0);
  const [orgSubTab, setOrgSubTab] = useState(0);
  const [profile, setProfile] = useState({ hospital_name: '', address: '', phone: '', email: '', timezone: 'Asia/Kolkata', currency: 'INR', working_days: 'Mon-Sat', working_hours: '9:00-18:00', logo_url: '' });
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [labTests, setLabTests] = useState([]);
  const [labTestForm, setLabTestForm] = useState({ test_name: '', test_code: '', category: '', fee: '', description: '' });
  const [editingLabTest, setEditingLabTest] = useState(null);
  const [specializations, setSpecializations] = useState([]);
  const [specName, setSpecName] = useState('');
  const [apptBlockUser, setApptBlockUser] = useState(null);

  const loadAll = async () => {
    try {
      const [p, b, d, u, lt, sp, rm] = await Promise.all([
        api('/admin/hospital-profile').then(r => r.profile || {}),
        api('/admin/branches').then(r => r.branches || []),
        api('/admin/departments').then(r => r.departments || []),
        api('/admin/users').then(r => r.users || []),
        api('/admin/lab-tests').then(r => r.tests || []),
        api('/admin/specializations').then(r => r.specializations || []),
        api('/admin/rooms').then(r => r.rooms || []),
      ]);
      setProfile(p || profile);
      setBranches(b);
      setDepartments(d);
      setUsers(u);
      setLabTests(lt);
      setSpecializations(sp);
      setRooms(rm);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadAll(); }, []);

  const ORG_TABS = ['Branches', 'Departments', 'Room Management', 'Lab Tests', 'Specializations'];

  const ROLE_OPTIONS = [{ value: 1, label: 'Admin' }, { value: 2, label: 'Doctor' }, { value: 5, label: 'Receptionist' }, { value: 6, label: 'Lab Staff' }, { value: 7, label: 'Pharmacist' }, { value: 8, label: 'Reporting' }];

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Settings</h1>

      {msg && <div style={s.info}>{msg}<button onClick={() => setMsg('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer' }}>×</button></div>}

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e2e8f0', paddingBottom: 0 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => { setTab(i); setShowForm(false); setForm({}); }}
            style={{ 
              padding: '.75rem 1.5rem', 
              border: 'none', 
              background: 'transparent', 
              color: tab === i ? '#00b4a0' : '#64748b', 
              fontWeight: tab === i ? 700 : 500, 
              cursor: 'pointer', 
              fontSize: '.9rem',
              borderBottom: tab === i ? '3px solid #00b4a0' : '3px solid transparent',
              transition: 'all 0.2s'
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === 0 && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={s.h2}>Profile Settings</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
              {profile.logo_url && <img src={profile.logo_url} alt="Logo" style={{ height: 40, borderRadius: 4 }} />}
              <button onClick={() => alert('Logo upload feature coming soon')} style={s.btnSec}>Update Logo</button>
            </div>
          </div>
          <div style={s.grid3}>
            {[['Hospital Name', 'hospital_name'], ['Phone', 'phone'], ['Email', 'email'], ['Address', 'address'], ['Working Days', 'working_days'], ['Working Hours', 'working_hours'], ['Timezone', 'timezone'], ['Currency', 'currency']].map(([l, k]) => (
              <div key={k} style={s.fg}><label style={s.label}>{l}</label><input value={profile[k] || ''} onChange={e => setProfile({ ...profile, [k]: e.target.value })} style={s.input} /></div>
            ))}
          </div>
          <div style={{ marginTop: 20 }}>
            <button onClick={async () => {
              setLoading(true);
              try {
                await api('/admin/hospital-profile', { method: 'POST', body: JSON.stringify(profile) });
                setMsg('Profile updated successfully');
              } catch (e) { setMsg(e.message); } finally { setLoading(false); }
            }} disabled={loading} style={s.btnPri}>{loading ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      )}

      {/* Organization Tab */}
      {tab === 1 && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: '#f8fafc', padding: 4, borderRadius: 8, width: 'fit-content' }}>
            {ORG_TABS.map((t, i) => (
              <button key={t} onClick={() => { setOrgSubTab(i); setShowForm(false); setForm({}); }}
                style={{ 
                  padding: '.5rem 1rem', 
                  borderRadius: 6, 
                  border: 'none', 
                  background: orgSubTab === i ? '#fff' : 'transparent', 
                  color: orgSubTab === i ? '#0f1f3d' : '#64748b', 
                  fontWeight: orgSubTab === i ? 600 : 500, 
                  cursor: 'pointer', 
                  fontSize: '.8rem',
                  boxShadow: orgSubTab === i ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                }}>
                {t}
              </button>
            ))}
          </div>

          {/* Branches */}
          {orgSubTab === 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={() => { setShowForm(true); setForm({}); }} style={s.btnPri}>+ Add Branch</button>
              </div>
              {showForm && (
                <div style={{ ...s.card, marginBottom: 16, borderLeft: '4px solid #00b4a0' }}>
                  <div style={s.grid3}>
                    {[['Branch Name', 'branch_name'], ['City', 'city'], ['Phone', 'phone'], ['Address', 'address'], ['Email', 'email']].map(([l, k]) => (
                      <div key={k} style={s.fg}><label style={s.label}>{l}</label><input value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} style={s.input} /></div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}><button onClick={async () => {
                    try {
                      await api('/admin/branches', { method: 'POST', body: JSON.stringify(form) });
                      setMsg('Branch created'); setShowForm(false); setForm({});
                      await loadAll();
                    } catch (e) { setMsg(e.message); }
                  }} style={s.btnPri}>Create</button><button onClick={() => setShowForm(false)} style={s.btnSec}>Cancel</button></div>
                </div>
              )}
              <div style={s.card}>
                <table style={s.table}>
                  <thead><tr>{['Branch Name', 'City', 'Phone', 'Status'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {branches.map(b => (
                      <tr key={b.id}>
                        <td style={s.td}><strong>{b.branch_name}</strong></td>
                        <td style={s.td}>{b.city || '–'}</td>
                        <td style={s.td}>{b.phone || '–'}</td>
                        <td style={s.td}><span style={{ background: b.is_active ? '#f0fdf4' : '#f1f5f9', color: b.is_active ? '#065f46' : '#94a3b8', padding: '2px 8px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>{b.is_active ? 'Active' : 'Inactive'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Departments */}
          {orgSubTab === 1 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={() => { setShowForm(true); setForm({}); }} style={s.btnPri}>+ Add Department</button>
              </div>
              {showForm && (
                <div style={{ ...s.card, marginBottom: 16, borderLeft: '4px solid #00b4a0' }}>
                  <div style={s.grid3}>
                    {[['Department Name', 'department_name'], ['Code', 'department_code'], ['Default Fee (₹)', 'default_consultation_fee'], ['Department Type', 'department_type']].map(([l, k]) => (
                      <div key={k} style={s.fg}><label style={s.label}>{l}</label><input value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} style={s.input} /></div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}><button onClick={async () => {
                    try {
                      await api('/admin/departments', { method: 'POST', body: JSON.stringify(form) });
                      setMsg('Department created'); setShowForm(false); setForm({});
                      await loadAll();
                    } catch (e) { setMsg(e.message); }
                  }} style={s.btnPri}>Create</button><button onClick={() => setShowForm(false)} style={s.btnSec}>Cancel</button></div>
                </div>
              )}
              <div style={s.card}>
                <table style={s.table}>
                  <thead><tr>{['Department', 'Code', 'Type', 'Default Fee', 'Status', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {departments.map(d => (
                      <tr key={d.id}>
                        <td style={s.td}><strong>{d.department_name}</strong></td>
                        <td style={s.td}>{d.department_code}</td>
                        <td style={s.td}>{d.department_type || '–'}</td>
                        <td style={s.td}>{d.default_consultation_fee ? `₹${d.default_consultation_fee}` : '–'}</td>
                        <td style={s.td}><span style={{ background: d.is_active ? '#f0fdf4' : '#fef2f2', color: d.is_active ? '#065f46' : '#dc2626', padding: '2px 8px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>{d.is_active ? 'Active' : 'Inactive'}</span></td>
                        <td style={s.td}><button onClick={async () => {
                          try { await api(`/admin/departments/${d.id}/toggle`, { method: 'PATCH' }); await loadAll(); }
                          catch (e) { setMsg(e.message); }
                        }} style={s.actBtn}>{d.is_active ? 'Deactivate' : 'Activate'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Room Management */}
          {orgSubTab === 2 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={() => { setShowForm(true); setForm({}); }} style={s.btnPri}>+ Add Room</button>
              </div>
              {showForm && (
                <div style={{ ...s.card, marginBottom: 16, borderLeft: '4px solid #00b4a0' }}>
                  <div style={s.grid3}>
                    {[['Room Name', 'room_name'], ['Room Type', 'room_type'], ['Total Beds', 'total_beds']].map(([l, k]) => (
                      <div key={k} style={s.fg}>
                        <label style={s.label}>{l}</label>
                        <input 
                          type={k === 'total_beds' ? 'number' : 'text'} 
                          value={form[k] || ''} 
                          onChange={e => setForm({ ...form, [k]: e.target.value })} 
                          style={s.input} 
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={async () => {
                      try {
                        await api('/admin/rooms', { method: 'POST', body: JSON.stringify({ ...form, total_beds: parseInt(form.total_beds || 1), available_beds: parseInt(form.total_beds || 1) }) });
                        setMsg('Room created'); setShowForm(false); setForm({});
                        await loadAll();
                      } catch (e) { setMsg(e.message); }
                    }} style={s.btnPri}>Create</button>
                    <button onClick={() => setShowForm(false)} style={s.btnSec}>Cancel</button>
                  </div>
                </div>
              )}
              <div style={s.card}>
                <table style={s.table}>
                  <thead><tr>{['Room Name', 'Type', 'Total Beds', 'Available', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {rooms.map(r => (
                      <tr key={r.id}>
                        <td style={s.td}><strong>{r.room_name}</strong></td>
                        <td style={s.td}>{r.room_type || 'General'}</td>
                        <td style={s.td}>{r.total_beds}</td>
                        <td style={s.td}>{r.available_beds}</td>
                        <td style={s.td}>
                          <button onClick={async () => {
                            if (!confirm('Delete this room?')) return;
                            try { await api(`/admin/rooms/${r.id}`, { method: 'DELETE' }); await loadAll(); }
                            catch (e) { setMsg(e.message); }
                          }} style={{ ...s.actBtn, color: '#dc2626' }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                    {rooms.length === 0 && (
                      <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No rooms added yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lab Tests */}
          {orgSubTab === 3 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={() => { setShowForm(true); setEditingLabTest(null); setLabTestForm({ test_name: '', test_code: '', category: '', fee: '', description: '' }); }} style={s.btnPri}>+ Add Lab Test</button>
              </div>
              {showForm && (
                <div style={{ ...s.card, marginBottom: 16, borderLeft: '4px solid #00b4a0' }}>
                  <h2 style={s.h2}>{editingLabTest ? 'Edit Lab Test' : 'Add New Lab Test'}</h2>
                  <div style={s.grid3}>
                    {[['Test Name *', 'test_name'], ['Test Code', 'test_code'], ['Category', 'category']].map(([l, k]) => (
                      <div key={k} style={s.fg}><label style={s.label}>{l}</label><input value={labTestForm[k] || ''} onChange={e => setLabTestForm({ ...labTestForm, [k]: e.target.value })} style={s.input} /></div>
                    ))}
                    <div style={s.fg}><label style={s.label}>Fee (INR) *</label><input type="number" value={labTestForm.fee || ''} onChange={e => setLabTestForm({ ...labTestForm, fee: e.target.value })} style={s.input} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}><button onClick={async () => {
                    try {
                      if (editingLabTest) await api(`/admin/lab-tests/${editingLabTest.id}`, { method: 'PUT', body: JSON.stringify(labTestForm) });
                      else await api('/admin/lab-tests', { method: 'POST', body: JSON.stringify(labTestForm) });
                      setMsg('Lab test saved'); setShowForm(false); await loadAll();
                    } catch (e) { setMsg(e.message); }
                  }} style={s.btnPri}>Save</button><button onClick={() => setShowForm(false)} style={s.btnSec}>Cancel</button></div>
                </div>
              )}
              <div style={s.card}>
                <table style={s.table}>
                  <thead><tr>{['Name', 'Code', 'Category', 'Fee', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {labTests.map(t => (
                      <tr key={t.id}>
                        <td style={s.td}><strong>{t.test_name}</strong></td>
                        <td style={s.td}>{t.test_code}</td>
                        <td style={s.td}>{t.category}</td>
                        <td style={s.td}>₹{t.fee}</td>
                        <td style={s.td}>
                          <button onClick={() => { setEditingLabTest(t); setLabTestForm(t); setShowForm(true); }} style={s.actBtn}>Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Specializations */}
          {orgSubTab === 4 && (
            <div style={s.card}>
              <h2 style={s.h2}>Specializations</h2>
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <input value={specName} onChange={e => setSpecName(e.target.value)} placeholder="Add new (e.g. Cardiology)" style={{ ...s.input, flex: 1 }} />
                <button onClick={async () => {
                  if (!specName) return;
                  try { await api('/admin/specializations', { method: 'POST', body: JSON.stringify({ name: specName }) }); setSpecName(''); await loadAll(); }
                  catch (e) { setMsg(e.message); }
                }} style={s.btnPri}>Add</button>
              </div>
              <table style={s.table}>
                <thead><tr>{['Name', 'Status', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {specializations.map(sp => (
                    <tr key={sp.id}>
                      <td style={s.td}><strong>{sp.name}</strong></td>
                      <td style={s.td}><span style={{ color: sp.is_active ? '#059669' : '#94a3b8' }}>{sp.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td style={s.td}>
                        <button onClick={async () => {
                          try { await api(`/admin/specializations/${sp.id}/toggle`, { method: 'PATCH' }); await loadAll(); }
                          catch (e) { setMsg(e.message); }
                        }} style={s.actBtn}>{sp.is_active ? 'Deactivate' : 'Activate'}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* User Management Tab */}
      {tab === 2 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={() => { setShowForm(true); setForm({ role_id: 5 }); setEditingUser(null); }} style={s.btnPri}>+ Add User</button>
          </div>
          {showForm && (
            <div style={{ ...s.card, marginBottom: 16, borderLeft: '4px solid #00b4a0' }}>
              <h2 style={s.h2}>{editingUser ? 'Edit User' : 'New User'}</h2>
              <div style={s.grid3}>
                {[['First Name', 'first_name'], ['Last Name', 'last_name'], ['Email', 'email'], ['Phone', 'phone'], ['Password', 'password']].map(([l, k]) => (
                  <div key={k} style={s.fg}><label style={s.label}>{l}</label><input type={k === 'password' ? 'password' : 'text'} value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} style={s.input} /></div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
                <button onClick={async () => {
                  try {
                    if (editingUser) await api(`/admin/users/${editingUser.id}`, { method: 'PUT', body: JSON.stringify(form) });
                    else await api('/admin/users', { method: 'POST', body: JSON.stringify(form) });
                    setMsg('User saved'); setShowForm(false); await loadAll();
                  } catch (e) { setMsg(e.message); }
                }} style={s.btnPri}>Save</button>
                <button onClick={() => setShowForm(false)} style={s.btnSec}>Cancel</button>
              </div>
            </div>
          )}
          <div style={s.card}>
            <table style={s.table}>
              <thead><tr>{['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={s.td}><strong>{u.first_name} {u.last_name}</strong></td>
                    <td style={s.td}>{u.email}</td>
                    <td style={s.td}>{ROLE_OPTIONS.find(r => r.value === (u.roles?.[0] || u.role_id))?.label || 'Staff'}</td>
                    <td style={s.td}>{u.is_active ? 'Active' : 'Inactive'}</td>
                    <td style={s.td}>
                      <button onClick={() => { 
                        setEditingUser(u); 
                        setForm({ ...u, password: '' }); 
                        setShowForm(true); 
                      }} style={s.actBtn}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subscription Tab */}
      {tab === 3 && (
        <div style={s.card}>
          <h2 style={s.h2}>Subscription Plans</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginTop: 20 }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 25, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Basic Plan</div>
              <div style={{ fontSize: 32, fontWeight: 800, margin: '15px 0' }}>₹2,999<span style={{ fontSize: 16, color: '#64748b' }}>/month</span></div>
              <ul style={{ textAlign: 'left', fontSize: 14, color: '#475569', marginBottom: 25 }}>
                <li>Up to 2 Admin Seats</li>
                <li>Up to 3 Doctor Seats</li>
                <li>Core HMS Modules</li>
              </ul>
              <button style={{ ...s.btnPri, width: '100%' }} onClick={() => alert('Razorpay integration coming soon')}>Subscribe Now</button>
            </div>
            <div style={{ border: '2px solid #00b4a0', borderRadius: 12, padding: 25, textAlign: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#00b4a0', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>MOST POPULAR</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#00b4a0', textTransform: 'uppercase' }}>Professional Plan</div>
              <div style={{ fontSize: 32, fontWeight: 800, margin: '15px 0' }}>₹5,999<span style={{ fontSize: 16, color: '#64748b' }}>/month</span></div>
              <ul style={{ textAlign: 'left', fontSize: 14, color: '#475569', marginBottom: 25 }}>
                <li>Unlimited Seats</li>
                <li>All Modules & Analytics</li>
                <li>Priority Support</li>
              </ul>
              <button style={{ ...s.btnPri, width: '100%' }} onClick={() => alert('Razorpay integration coming soon')}>Subscribe Now</button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Tab */}
      {tab === 4 && <AuditLogView />}

      {apptBlockUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', width: 'min(560px, 96vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.2)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#0f1f3d' }}>Cannot Delete User</h3>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 14 }}>
              <strong>{apptBlockUser.user.first_name} {apptBlockUser.user.last_name}</strong> is a doctor with active appointments. Cancel them first.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setApptBlockUser(null)} style={s.btnSec}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditLogView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api('/audit?limit=20');
      setLogs(data.logs || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={s.card}>
      <h2 style={s.h2}>Recent Activity</h2>
      {loading ? <div>Loading logs...</div> : (
        <table style={s.table}>
          <thead><tr>{['Time', 'User', 'Action', 'Module'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td style={s.td}>{new Date(log.created_at).toLocaleString()}</td>
                <td style={s.td}>{log.role_name}</td>
                <td style={s.td}>{log.action}</td>
                <td style={s.td}>{log.module}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const s = {
  page: { padding: '2rem', maxWidth: 1300, margin: '0 auto' },
  h1: { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', marginBottom: 20 },
  h2: { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', marginBottom: 16 },
  card: { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 },
  fg: { display: 'flex', flexDirection: 'column' },
  label: { fontSize: '.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: 4 },
  input: { width: '100%', padding: '.6rem .9rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem', boxSizing: 'border-box' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', background: '#f8fafc', fontSize: '.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' },
  td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '.875rem' },
  info: { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.875rem', marginBottom: 16, display: 'flex', alignItems: 'center' },
  btnPri: { padding: '.6rem 1.2rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem' },
  btnSec: { padding: '.6rem 1rem', background: '#f1f5f9', color: '#0f1f3d', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem' },
  actBtn: { padding: '4px 10px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 },
};
