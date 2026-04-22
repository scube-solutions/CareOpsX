'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const TABS = ['Hospital Profile', 'Branches', 'Departments', 'Users', 'Lab Tests'];

export default function SetupPage() {
  const [tab, setTab] = useState(0);
  const [profile, setProfile] = useState({ hospital_name: '', address: '', phone: '', email: '', timezone: 'Asia/Kolkata', currency: 'INR', working_days: 'Mon-Sat', working_hours: '9:00-18:00' });
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [labTests, setLabTests] = useState([]);
  const [labTestForm, setLabTestForm] = useState({ test_name: '', test_code: '', category: '', fee: '', description: '' });
  const [editingLabTest, setEditingLabTest] = useState(null);

  const loadAll = async () => {
    try {
      const [p, b, d, u, lt] = await Promise.all([
        api('/admin/hospital-profile').then(r => r.profile || {}),
        api('/admin/branches').then(r => r.branches || []),
        api('/admin/departments').then(r => r.departments || []),
        api('/admin/users').then(r => r.users || []),
        api('/admin/lab-tests').then(r => r.tests || []),
      ]);
      setProfile(p || profile);
      setBranches(b);
      setDepartments(d);
      setUsers(u);
      setLabTests(lt);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadAll(); }, []);

  const saveProfile = async () => {
    setLoading(true);
    try {
      await api('/admin/hospital-profile', { method: 'POST', body: JSON.stringify(profile) });
      setMsg('Hospital profile saved');
    } catch (e) { setMsg(e.message); } finally { setLoading(false); }
  };

  const createBranch = async () => {
    try {
      await api('/admin/branches', { method: 'POST', body: JSON.stringify(form) });
      setMsg('Branch created'); setShowForm(false); setForm({});
      await loadAll();
    } catch (e) { setMsg(e.message); }
  };

  const createDepartment = async () => {
    try {
      await api('/admin/departments', { method: 'POST', body: JSON.stringify(form) });
      setMsg('Department created'); setShowForm(false); setForm({});
      await loadAll();
    } catch (e) { setMsg(e.message); }
  };

  const toggleDept = async (id) => {
    try {
      await api(`/admin/departments/${id}/toggle`, { method: 'PATCH' });
      await loadAll();
    } catch (e) { setMsg(e.message); }
  };

  const toggleUser = async (id) => {
    try {
      await api(`/admin/users/${id}/toggle`, { method: 'PATCH' });
      await loadAll();
    } catch (e) { setMsg(e.message); }
  };

  const createUser = async () => {
    const selectedRoles = form.roles || [form.role_id || 5];
    try {
      await api('/admin/users', { method: 'POST', body: JSON.stringify({ ...form, role_id: selectedRoles[0], roles: selectedRoles }) });
      setMsg('User created'); setShowForm(false); setForm({});
      await loadAll();
    } catch (e) { setMsg(e.message); }
  };

  const deleteUser = async () => {
    if (!selectedUser) return;
    try {
      await api(`/admin/users/${selectedUser.id}`, { method: 'DELETE' });
      setMsg(`User "${selectedUser.first_name} ${selectedUser.last_name}" deleted`);
      setSelectedUser(null);
      setConfirmDelete(false);
      await loadAll();
    } catch (e) { setMsg(e.message); setConfirmDelete(false); }
  };

  const saveLabTest = async () => {
    if (!labTestForm.test_name || !labTestForm.fee) { setMsg('Test name and fee are required'); return; }
    setLoading(true);
    try {
      if (editingLabTest) {
        await api(`/admin/lab-tests/${editingLabTest.id}`, { method: 'PUT', body: JSON.stringify(labTestForm) });
        setMsg('Lab test updated');
      } else {
        await api('/admin/lab-tests', { method: 'POST', body: JSON.stringify(labTestForm) });
        setMsg('Lab test added');
      }
      setLabTestForm({ test_name: '', test_code: '', category: '', fee: '', description: '' });
      setEditingLabTest(null);
      setShowForm(false);
      await loadAll();
    } catch (e) { setMsg(e.message); } finally { setLoading(false); }
  };

  const deleteLabTest = async (id) => {
    if (!confirm('Delete this test?')) return;
    try {
      await api(`/admin/lab-tests/${id}`, { method: 'DELETE' });
      setMsg('Lab test deleted');
      await loadAll();
    } catch (e) { setMsg(e.message); }
  };

  const ROLE_OPTIONS = [{ value: 1, label: 'Admin' }, { value: 2, label: 'Doctor' }, { value: 5, label: 'Receptionist' }, { value: 6, label: 'Lab Staff' }, { value: 7, label: 'Pharmacist' }, { value: 8, label: 'Reporting' }];

  return (
    <div style={s.page}>
      <h1 style={s.h1}>System Setup</h1>

      {msg && <div style={s.info}>{msg}<button onClick={() => setMsg('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer' }}>×</button></div>}

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f1f5f9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => { setTab(i); setShowForm(false); setForm({}); }}
            style={{ padding: '.5rem 1.2rem', borderRadius: 8, border: 'none', background: tab === i ? '#fff' : 'transparent', color: tab === i ? '#0f1f3d' : '#64748b', fontWeight: tab === i ? 700 : 500, cursor: 'pointer', boxShadow: tab === i ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '.875rem' }}>
            {t}
          </button>
        ))}
      </div>

      {/* Hospital Profile */}
      {tab === 0 && (
        <div style={s.card}>
          <h2 style={s.h2}>Hospital Profile</h2>
          <div style={s.grid3}>
            {[['Hospital Name', 'hospital_name'], ['Phone', 'phone'], ['Email', 'email'], ['Address', 'address'], ['Working Days', 'working_days'], ['Working Hours', 'working_hours'], ['Timezone', 'timezone'], ['Currency', 'currency']].map(([l, k]) => (
              <div key={k} style={s.fg}><label style={s.label}>{l}</label><input value={profile[k] || ''} onChange={e => setProfile({ ...profile, [k]: e.target.value })} style={s.input} /></div>
            ))}
          </div>
          <button onClick={saveProfile} disabled={loading} style={s.btnPri}>{loading ? 'Saving...' : 'Save Profile'}</button>
        </div>
      )}

      {/* Branches */}
      {tab === 1 && (
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
              <div style={{ display: 'flex', gap: 10 }}><button onClick={createBranch} style={s.btnPri}>Create</button><button onClick={() => setShowForm(false)} style={s.btnSec}>Cancel</button></div>
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
      {tab === 2 && (
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
              <div style={{ display: 'flex', gap: 10 }}><button onClick={createDepartment} style={s.btnPri}>Create</button><button onClick={() => setShowForm(false)} style={s.btnSec}>Cancel</button></div>
            </div>
          )}
          <div style={s.card}>
            <table style={s.table}>
              <thead><tr>{['Department', 'Code', 'Type', 'Default Fee', 'Status', 'Toggle'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {departments.map(d => (
                  <tr key={d.id}>
                    <td style={s.td}><strong>{d.department_name}</strong></td>
                    <td style={s.td}>{d.department_code}</td>
                    <td style={s.td}>{d.department_type || '–'}</td>
                    <td style={s.td}>{d.default_consultation_fee ? `₹${d.default_consultation_fee}` : '–'}</td>
                    <td style={s.td}><span style={{ background: d.is_active ? '#f0fdf4' : '#fef2f2', color: d.is_active ? '#065f46' : '#dc2626', padding: '2px 8px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>{d.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td style={s.td}><button onClick={() => toggleDept(d.id)} style={s.actBtn}>{d.is_active ? 'Deactivate' : 'Activate'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lab Tests */}
      {tab === 4 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={() => { setShowForm(true); setEditingLabTest(null); setLabTestForm({ test_name: '', test_code: '', category: '', fee: '', description: '' }); }} style={s.btnPri}>+ Add Lab Test</button>
          </div>

          {showForm && (
            <div style={{ ...s.card, marginBottom: 16, borderLeft: '4px solid #00b4a0' }}>
              <h2 style={s.h2}>{editingLabTest ? 'Edit Lab Test' : 'Add New Lab Test'}</h2>
              <div style={s.grid3}>
                {[['Test Name *', 'test_name'], ['Test Code', 'test_code'], ['Category', 'category']].map(([l, k]) => (
                  <div key={k} style={s.fg}>
                    <label style={s.label}>{l}</label>
                    <input value={labTestForm[k] || ''} onChange={e => setLabTestForm({ ...labTestForm, [k]: e.target.value })} style={s.input} placeholder={k === 'category' ? 'e.g. Haematology, Biochemistry' : ''} />
                  </div>
                ))}
                <div style={s.fg}>
                  <label style={s.label}>Fee (₹) *</label>
                  <input type="number" min="0" value={labTestForm.fee || ''} onChange={e => setLabTestForm({ ...labTestForm, fee: e.target.value })} style={s.input} placeholder="0.00" />
                </div>
                <div style={{ ...s.fg, gridColumn: 'span 2' }}>
                  <label style={s.label}>Description</label>
                  <input value={labTestForm.description || ''} onChange={e => setLabTestForm({ ...labTestForm, description: e.target.value })} style={s.input} placeholder="Brief description (optional)" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={saveLabTest} disabled={loading} style={s.btnPri}>{loading ? 'Saving...' : editingLabTest ? 'Update Test' : 'Add Test'}</button>
                <button onClick={() => { setShowForm(false); setEditingLabTest(null); }} style={s.btnSec}>Cancel</button>
              </div>
            </div>
          )}

          <div style={s.card}>
            {labTests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🧪</div>
                No lab tests added yet. Click "Add Lab Test" to begin.
              </div>
            ) : (
              <table style={s.table}>
                <thead>
                  <tr>
                    {['Test Name', 'Code', 'Category', 'Fee (₹)', 'Description', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {labTests.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={s.td}><strong>{t.test_name}</strong></td>
                      <td style={s.td}><span style={{ fontFamily: 'monospace', fontSize: '.8rem', background: '#f0fdfb', color: '#0f766e', padding: '2px 6px', borderRadius: 4 }}>{t.test_code || '—'}</span></td>
                      <td style={s.td}>{t.category || '—'}</td>
                      <td style={{ ...s.td, fontWeight: 700, color: '#0f766e' }}>₹{parseFloat(t.fee || 0).toFixed(2)}</td>
                      <td style={{ ...s.td, fontSize: '.8rem', color: '#64748b' }}>{t.description || '—'}</td>
                      <td style={s.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setEditingLabTest(t); setLabTestForm({ test_name: t.test_name, test_code: t.test_code || '', category: t.category || '', fee: String(t.fee || ''), description: t.description || '' }); setShowForm(true); }} style={s.actBtn}>Edit</button>
                          <button onClick={() => deleteLabTest(t.id)} style={{ ...s.actBtn, color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Users */}
      {tab === 3 && (
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {selectedUser && !confirmDelete && (
                <>
                  <span style={{ fontSize: '.875rem', color: '#475569' }}>
                    Selected: <strong>{selectedUser.first_name} {selectedUser.last_name}</strong>
                  </span>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    style={{ padding: '6px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem' }}>
                    🗑 Delete User
                  </button>
                  <button onClick={() => setSelectedUser(null)} style={{ ...s.btnSec, padding: '5px 10px', fontSize: '.78rem' }}>Deselect</button>
                </>
              )}
              {confirmDelete && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 14px' }}>
                  <span style={{ fontSize: '.875rem', color: '#dc2626', fontWeight: 600 }}>
                    Delete "{selectedUser.first_name} {selectedUser.last_name}"? This cannot be undone.
                  </span>
                  <button onClick={deleteUser} style={{ padding: '5px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: '.8rem' }}>Confirm Delete</button>
                  <button onClick={() => setConfirmDelete(false)} style={{ ...s.btnSec, padding: '5px 10px', fontSize: '.78rem' }}>Cancel</button>
                </div>
              )}
            </div>
            <button onClick={() => { setShowForm(true); setForm({ role_id: 5 }); setSelectedUser(null); }} style={s.btnPri}>+ Add User</button>
          </div>

          {showForm && (
            <div style={{ ...s.card, marginBottom: 16, borderLeft: '4px solid #00b4a0' }}>
              <div style={s.grid3}>
                {[['First Name', 'first_name'], ['Last Name', 'last_name'], ['Email', 'email'], ['Phone', 'phone'], ['Password', 'password']].map(([l, k]) => (
                  <div key={k} style={s.fg}><label style={s.label}>{l}</label><input type={k === 'password' ? 'password' : 'text'} value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} style={s.input} /></div>
                ))}
                <div style={s.fg}><label style={s.label}>Roles (select one or more; first = primary login role)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    {ROLE_OPTIONS.map(r => {
                      const roles = form.roles || [form.role_id || 5];
                      const checked = roles.includes(r.value);
                      return (
                        <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '.85rem', padding: '4px 10px', border: `1px solid ${checked ? '#00b4a0' : '#e2e8f0'}`, borderRadius: 6, background: checked ? '#f0fdfb' : '#fff', color: checked ? '#0f766e' : '#334155', fontWeight: checked ? 600 : 400 }}>
                          <input type="checkbox" checked={checked} onChange={() => {
                            const cur = form.roles || [form.role_id || 5];
                            const next = cur.includes(r.value) ? cur.filter(x => x !== r.value) : [...cur, r.value];
                            setForm({ ...form, roles: next.length ? next : [r.value], role_id: next[0] || r.value });
                          }} style={{ margin: 0 }} />
                          {r.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}><button onClick={createUser} style={s.btnPri}>Create User</button><button onClick={() => setShowForm(false)} style={s.btnSec}>Cancel</button></div>
            </div>
          )}

          <div style={s.card}>
            {!selectedUser && <p style={{ fontSize: '.8rem', color: '#94a3b8', marginBottom: 10 }}>Click a row to select a user, then use the delete button above.</p>}
            <table style={s.table}>
              <thead><tr>{['Name', 'Email', 'Phone', 'Role', 'Status', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {users.map(u => {
                  const isSelected = selectedUser?.id === u.id;
                  return (
                    <tr key={u.id}
                      onClick={() => { setSelectedUser(isSelected ? null : u); setConfirmDelete(false); }}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: isSelected ? '#fef2f2' : 'transparent', outline: isSelected ? '2px solid #fca5a5' : 'none' }}>
                      <td style={s.td}><strong>{u.first_name} {u.last_name}</strong></td>
                      <td style={s.td}>{u.email}</td>
                      <td style={s.td}>{u.phone || '–'}</td>
                      <td style={s.td}>
                        {((u.roles && u.roles.length ? u.roles : [u.role_id]).map(rid => (
                          <span key={rid} style={{ display: 'inline-block', background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600, marginRight: 4, marginBottom: 2 }}>
                            {ROLE_OPTIONS.find(r => r.value === rid)?.label || `Role ${rid}`}
                          </span>
                        )))}
                      </td>
                      <td style={s.td}><span style={{ background: u.is_active ? '#f0fdf4' : '#fef2f2', color: u.is_active ? '#065f46' : '#dc2626', padding: '2px 8px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>{u.is_active ? 'Active' : 'Locked'}</span></td>
                      <td style={s.td} onClick={e => e.stopPropagation()}><button onClick={() => toggleUser(u.id)} style={s.actBtn}>{u.is_active ? 'Lock' : 'Unlock'}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
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
