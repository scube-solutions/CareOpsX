'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

const PORTAL_FIELDS = [
  ['admin', 'Admin Portal'],
  ['doctor', 'Doctor Portal'],
  ['patient', 'Patient Portal'],
  ['reception', 'Reception Portal'],
  ['lab', 'Lab Portal'],
  ['pharmacy', 'Pharmacy Portal'],
  ['analytics', 'Analytics / Reporting'],
];

const SEAT_FIELDS = [
  ['admin', 'Admin Seats'],
  ['doctor', 'Doctor Seats'],
  ['receptionist', 'Reception Seats'],
  ['lab', 'Lab Seats'],
  ['pharmacist', 'Pharmacy Seats'],
  ['reporting', 'Reporting Seats'],
];

const emptyOrgForm = {
  organization_name: '',
  organization_code: '',
  slug: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  billing_status: 'trial',
  payment_status: 'pending',
  notes: '',
  seat_limits: { admin: 2, doctor: 3, receptionist: 2, lab: 1, pharmacist: 1, reporting: 1, patient: -1 },
  portal_access: { admin: true, doctor: true, patient: true, reception: true, lab: true, pharmacy: true, analytics: true },
  admin_user: { first_name: '', last_name: '', email: '', password: '', phone: '' },
};

export default function SuperAdminOrganizationsPage() {
  const [summary, setSummary] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(emptyOrgForm);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const loadDetail = useCallback(async (id) => {
    const data = await api(`/super-admin/organizations/${id}`);
    setSelected(data.organization);
    setDetail(data);
  }, []);

  const loadOrganizations = useCallback(async (selectId = null) => {
    setLoading(true);
    try {
      const data = await api('/super-admin/organizations');
      setSummary(data.summary);
      setOrganizations(data.organizations || []);
      const targetId = selectId || selected?.id || data.organizations?.[0]?.id;
      if (targetId) await loadDetail(targetId);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, [loadDetail, selected?.id]);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  const updateFormSeat = (key, value) => setForm((prev) => ({ ...prev, seat_limits: { ...prev.seat_limits, [key]: Number(value || 0) } }));
  const updateFormPortal = (key, value) => setForm((prev) => ({ ...prev, portal_access: { ...prev.portal_access, [key]: value } }));
  const updateSelectedSeat = (key, value) => setSelected((prev) => ({ ...prev, seat_limits: { ...prev.seat_limits, [key]: Number(value || 0) } }));
  const updateSelectedPortal = (key, value) => setSelected((prev) => ({ ...prev, portal_access: { ...prev.portal_access, [key]: value } }));

  const createOrganization = async () => {
    setSaving(true);
    try {
      await api('/super-admin/organizations', { method: 'POST', body: JSON.stringify(form) });
      setMsg('Organization onboarded successfully');
      setForm(emptyOrgForm);
      setShowCreate(false);
      await loadOrganizations();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveOrganization = async () => {
    if (!selected?.id) return;
    setSaving(true);
    try {
      await api(`/super-admin/organizations/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          organization_name: selected.organization_name,
          contact_name: selected.contact_name,
          contact_email: selected.contact_email,
          contact_phone: selected.contact_phone,
          billing_status: selected.billing_status,
          payment_status: selected.payment_status,
          notes: selected.notes,
          seat_limits: selected.seat_limits,
          portal_access: selected.portal_access,
        }),
      });
      setMsg('Organization updated');
      await loadOrganizations(selected.id);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  const setOrganizationStatus = async (status) => {
    if (!selected?.id) return;
    setSaving(true);
    try {
      await api(`/super-admin/organizations/${selected.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMsg(`Organization marked as ${status}`);
      await loadOrganizations(selected.id);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  const impersonate = async () => {
    if (!selected?.id) return;
    setSaving(true);
    try {
      const data = await api(`/super-admin/organizations/${selected.id}/impersonate`, { method: 'POST', body: JSON.stringify({ target_role_id: 1 }) });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/admin/dashboard';
    } catch (e) {
      setMsg(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="responsive-page" style={{ maxWidth: 1480, margin: '0 auto' }}>
      <div className="responsive-header-row" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#0f1f3d', fontFamily: 'var(--font-display)' }}>Organizations</h1>
          <p style={{ margin: '6px 0 0', color: '#64748b' }}>Onboard hospitals, assign seats, manage portal access, and control service status.</p>
        </div>
        <div className="responsive-actions-row">
          <button onClick={() => setShowCreate((value) => !value)} style={styles.primaryBtn}>{showCreate ? 'Close' : '+ Onboard Organization'}</button>
        </div>
      </div>

      {msg && <div style={styles.info}>{msg}<button onClick={() => setMsg('')} style={styles.dismiss}>×</button></div>}

      {summary && (
        <div className="responsive-grid-4" style={{ marginBottom: 24 }}>
          {[
            ['Total Organizations', summary.total_organizations, '#0f1f3d'],
            ['Active', summary.active, '#00b4a0'],
            ['Paused', summary.paused, '#f59e0b'],
            ['Suspended', summary.suspended, '#ef4444'],
          ].map(([label, value, color]) => (
            <div key={label} style={{ ...styles.card, borderTop: `4px solid ${color}` }}>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>
              <div style={{ fontSize: 32, color, fontWeight: 800, marginTop: 8 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div style={{ ...styles.card, marginBottom: 24 }}>
          <h2 style={styles.h2}>New Organization</h2>
          <div className="responsive-grid-2" style={{ gap: 16, marginBottom: 16 }}>
            {[
              ['Organization Name', 'organization_name'],
              ['Organization Code', 'organization_code'],
              ['Slug', 'slug'],
              ['Contact Name', 'contact_name'],
              ['Contact Email', 'contact_email'],
              ['Contact Phone', 'contact_phone'],
            ].map(([label, key]) => (
              <div key={key}>
                <label style={styles.label}>{label}</label>
                <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} style={styles.input} />
              </div>
            ))}
          </div>

          <div className="responsive-grid-2" style={{ gap: 16, marginBottom: 16 }}>
            <div>
              <label style={styles.label}>Initial Admin First Name</label>
              <input value={form.admin_user.first_name} onChange={(e) => setForm({ ...form, admin_user: { ...form.admin_user, first_name: e.target.value } })} style={styles.input} />
            </div>
            <div>
              <label style={styles.label}>Initial Admin Last Name</label>
              <input value={form.admin_user.last_name} onChange={(e) => setForm({ ...form, admin_user: { ...form.admin_user, last_name: e.target.value } })} style={styles.input} />
            </div>
            <div>
              <label style={styles.label}>Initial Admin Email</label>
              <input value={form.admin_user.email} onChange={(e) => setForm({ ...form, admin_user: { ...form.admin_user, email: e.target.value } })} style={styles.input} />
            </div>
            <div>
              <label style={styles.label}>Initial Admin Password</label>
              <input type="password" value={form.admin_user.password} onChange={(e) => setForm({ ...form, admin_user: { ...form.admin_user, password: e.target.value } })} style={styles.input} />
            </div>
          </div>

          <div className="responsive-grid-3" style={{ marginBottom: 16 }}>
            {SEAT_FIELDS.map(([key, label]) => (
              <div key={key}>
                <label style={styles.label}>{label}</label>
                <input type="number" min="0" value={form.seat_limits[key]} onChange={(e) => updateFormSeat(key, e.target.value)} style={styles.input} />
              </div>
            ))}
          </div>

          <div className="responsive-grid-3" style={{ marginBottom: 16 }}>
            {PORTAL_FIELDS.map(([key, label]) => (
              <label key={key} style={styles.toggle}>
                <input type="checkbox" checked={!!form.portal_access[key]} onChange={(e) => updateFormPortal(key, e.target.checked)} />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <button onClick={createOrganization} disabled={saving} style={styles.primaryBtn}>{saving ? 'Creating...' : 'Create Organization'}</button>
        </div>
      )}

      <div className="responsive-split-360">
        <div style={styles.card}>
          <h2 style={styles.h2}>Client Accounts</h2>
          {loading ? <div style={{ color: '#64748b' }}>Loading…</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {organizations.map((org) => (
                <button key={org.id} onClick={() => loadDetail(org.id)} style={{ ...styles.orgItem, borderColor: selected?.id === org.id ? '#00b4a0' : '#e2e8f0', background: selected?.id === org.id ? '#f0fdfa' : '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f1f3d' }}>{org.organization_name}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{org.organization_code} • {org.active_users} active users</div>
                    </div>
                    <span style={{ ...styles.badge, background: statusColor(org.status).bg, color: statusColor(org.status).text }}>{org.status}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={styles.card}>
          {!selected ? (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '4rem 0' }}>Select an organization to manage it.</div>
          ) : (
            <>
              <div className="responsive-header-row" style={{ marginBottom: 16 }}>
                <div>
                  <h2 style={styles.h2}>{selected.organization_name}</h2>
                  <div style={{ fontSize: 13, color: '#64748b' }}>{selected.organization_code} • {selected.slug}</div>
                </div>
                <div className="responsive-actions-row">
                  <button onClick={() => setOrganizationStatus('active')} disabled={saving} style={styles.secondaryBtn}>Activate</button>
                  <button onClick={() => setOrganizationStatus('paused')} disabled={saving} style={styles.secondaryBtn}>Pause</button>
                  <button onClick={() => setOrganizationStatus('suspended')} disabled={saving} style={styles.dangerBtn}>Suspend</button>
                  <button onClick={impersonate} disabled={saving} style={styles.primaryBtn}>Open Admin Portal</button>
                </div>
              </div>

              <div className="responsive-grid-2" style={{ gap: 16, marginBottom: 16 }}>
                {[
                  ['Contact Name', 'contact_name'],
                  ['Contact Email', 'contact_email'],
                  ['Contact Phone', 'contact_phone'],
                  ['Billing Status', 'billing_status'],
                  ['Payment Status', 'payment_status'],
                ].map(([label, key]) => (
                  <div key={key}>
                    <label style={styles.label}>{label}</label>
                    <input value={selected[key] || ''} onChange={(e) => setSelected({ ...selected, [key]: e.target.value })} style={styles.input} />
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={styles.label}>Notes</label>
                <textarea value={selected.notes || ''} onChange={(e) => setSelected({ ...selected, notes: e.target.value })} style={{ ...styles.input, minHeight: 90 }} />
              </div>

              <h3 style={styles.h3}>Seat Controls</h3>
              <div className="responsive-grid-3" style={{ marginBottom: 16 }}>
                {SEAT_FIELDS.map(([key, label]) => (
                  <div key={key}>
                    <label style={styles.label}>{label}</label>
                    <input type="number" min="0" value={selected.seat_limits?.[key] ?? 0} onChange={(e) => updateSelectedSeat(key, e.target.value)} style={styles.input} />
                  </div>
                ))}
              </div>

              <h3 style={styles.h3}>Portal Access</h3>
              <div className="responsive-grid-3" style={{ marginBottom: 16 }}>
                {PORTAL_FIELDS.map(([key, label]) => (
                  <label key={key} style={styles.toggle}>
                    <input type="checkbox" checked={!!selected.portal_access?.[key]} onChange={(e) => updateSelectedPortal(key, e.target.checked)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              <button onClick={saveOrganization} disabled={saving} style={styles.primaryBtn}>{saving ? 'Saving...' : 'Save Organization Settings'}</button>

              {detail?.users?.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h3 style={styles.h3}>Organization Users</h3>
                  <div className="responsive-scroll-x">
                    <table style={styles.table}>
                      <thead>
                        <tr>{['Name', 'Email', 'Role', 'Status'].map((h) => <th key={h} style={styles.th}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {detail.users.map((user) => (
                          <tr key={user.id} style={{ borderBottom: '1px solid #eef2f7' }}>
                            <td style={styles.td}>{user.first_name} {user.last_name}</td>
                            <td style={styles.td}>{user.email}</td>
                            <td style={styles.td}>{roleLabel(user.role_id)}</td>
                            <td style={styles.td}><span style={{ ...styles.badge, background: user.is_active ? '#ecfdf5' : '#fef2f2', color: user.is_active ? '#15803d' : '#dc2626' }}>{user.is_active ? 'Active' : 'Locked'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function roleLabel(roleId) {
  return {
    1: 'Admin',
    2: 'Doctor',
    3: 'Patient',
    5: 'Receptionist',
    6: 'Lab Staff',
    7: 'Pharmacist',
    8: 'Reporting',
    9: 'Super Admin',
  }[roleId] || `Role ${roleId}`;
}

function statusColor(status) {
  if (status === 'active') return { bg: '#ecfdf5', text: '#15803d' };
  if (status === 'paused') return { bg: '#fffbeb', text: '#b45309' };
  if (status === 'suspended') return { bg: '#fef2f2', text: '#dc2626' };
  return { bg: '#f1f5f9', text: '#475569' };
}

const styles = {
  card: { background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, boxShadow: '0 10px 30px rgba(15,31,61,.05)' },
  h2: { margin: 0, color: '#0f1f3d', fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)' },
  h3: { margin: '0 0 12px', color: '#0f1f3d', fontSize: 15, fontWeight: 800 },
  label: { display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em' },
  input: { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #dbe4ee', background: '#f8fafc', color: '#0f1f3d' },
  toggle: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff' },
  primaryBtn: { padding: '11px 16px', borderRadius: 10, border: 'none', background: '#00b4a0', color: '#fff', fontWeight: 700, cursor: 'pointer' },
  secondaryBtn: { padding: '11px 14px', borderRadius: 10, border: '1px solid #dbe4ee', background: '#fff', color: '#0f1f3d', fontWeight: 700, cursor: 'pointer' },
  dangerBtn: { padding: '11px 14px', borderRadius: 10, border: '1px solid #fecaca', background: '#fff5f5', color: '#dc2626', fontWeight: 700, cursor: 'pointer' },
  orgItem: { width: '100%', textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, cursor: 'pointer' },
  badge: { display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 },
  info: { marginBottom: 16, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center' },
  dismiss: { marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 },
  table: { width: '100%', minWidth: 620, borderCollapse: 'collapse', marginTop: 10 },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: 12, color: '#64748b', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '.05em' },
  td: { padding: '10px 12px', fontSize: 14, color: '#334155' },
};
