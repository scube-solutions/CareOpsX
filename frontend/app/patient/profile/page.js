'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

function TopNav() {
  return (
    <nav style={{ background: '#0f1f3d', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
      <a href="/patient/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #1e3f85 0%, #13cfbd 100%)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
            <rect x="10.5" y="4" width="3" height="16" rx="1.5" fill="white"/>
            <rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="white"/>
          </svg>
        </div>
        <span style={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>Care<span style={{ color: '#00b4a0' }}>OpsX</span></span>
      </a>
      <a href="/patient/dashboard" style={{ marginLeft: 'auto', fontSize: '.8rem', color: 'rgba(255,255,255,.6)', textDecoration: 'none' }}>← Dashboard</a>
    </nav>
  );
}

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const GENDERS      = ['Male','Female','Other','Prefer not to say'];

export default function PatientProfilePage() {
  const [profile, setProfile] = useState(null);
  const [form,    setForm]    = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/patients/me')
      .then(d => { setProfile(d.patient); setForm(d.patient); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const res = await api('/patients/me', {
        method: 'PATCH',
        body: JSON.stringify({
          first_name: form.first_name,
          last_name:  form.last_name,
          phone:      form.phone,
          date_of_birth: form.date_of_birth,
          gender:     form.gender,
          blood_group: form.blood_group,
          address:    form.address,
          emergency_contact_name:  form.emergency_contact_name,
          emergency_contact_phone: form.emergency_contact_phone,
        }),
      });
      setProfile(res.patient); setForm(res.patient);
      setEditing(false); setMsg('Profile updated successfully');
    } catch (e) { setMsg(e.message); } finally { setSaving(false); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f8fc' }}>
      <TopNav />
      <div style={s.center}>Loading…</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f5f8fc' }}>
      <TopNav />
      <div style={s.page}>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={s.h1}>My Profile</h1>
            <p style={s.sub}>View and edit your personal details</p>
          </div>
          {!editing ? (
            <button onClick={() => { setEditing(true); setMsg(''); }} style={s.btnPri}>✏ Edit Profile</button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={save} disabled={saving} style={s.btnPri}>{saving ? 'Saving…' : 'Save Changes'}</button>
              <button onClick={() => { setEditing(false); setForm(profile); setMsg(''); }} style={s.btnSec}>Cancel</button>
            </div>
          )}
        </div>

        {msg && (
          <div style={{ background: msg.includes('uccessfully') ? '#f0fdfb' : '#fef2f2', border: `1px solid ${msg.includes('uccessfully') ? '#99f6e4' : '#fecaca'}`, color: msg.includes('uccessfully') ? '#0f766e' : '#b91c1c', borderRadius: 8, padding: '.75rem 1rem', marginBottom: 20, fontSize: '.875rem' }}>
            {msg}
          </div>
        )}

        {/* Avatar + UID */}
        <div style={{ ...s.card, display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #1e3f85 0%, #13cfbd 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '1.6rem', flexShrink: 0 }}>
            {(profile?.first_name?.[0] || 'P').toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#0f1f3d' }}>{profile?.first_name} {profile?.last_name}</div>
            {profile?.patient_uid && <div style={{ fontSize: '.8rem', color: '#64748b', marginTop: 2 }}>Patient ID: <strong>{profile.patient_uid}</strong></div>}
            {profile?.email && <div style={{ fontSize: '.8rem', color: '#64748b' }}>{profile.email}</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Personal Info */}
          <div style={s.card}>
            <h2 style={s.h2}>Personal Information</h2>
            <div style={s.grid2}>
              <Field label="First Name" value={form?.first_name} editing={editing} onChange={v => set('first_name', v)} />
              <Field label="Last Name"  value={form?.last_name}  editing={editing} onChange={v => set('last_name', v)} />
              <Field label="Phone"      value={form?.phone}      editing={editing} onChange={v => set('phone', v)} type="tel" />
              <Field label="Date of Birth" value={form?.date_of_birth} editing={editing} onChange={v => set('date_of_birth', v)} type="date" />
              <SelectField label="Gender" value={form?.gender} editing={editing} onChange={v => set('gender', v)} options={GENDERS} />
              <SelectField label="Blood Group" value={form?.blood_group} editing={editing} onChange={v => set('blood_group', v)} options={BLOOD_GROUPS} />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={s.label}>Address</label>
              {editing ? (
                <textarea value={form?.address || ''} onChange={e => set('address', e.target.value)} style={{ ...s.input, height: 70, resize: 'vertical', width: '100%', boxSizing: 'border-box' }} />
              ) : (
                <div style={s.value}>{profile?.address || '—'}</div>
              )}
            </div>
          </div>

          {/* Emergency Contact */}
          <div style={s.card}>
            <h2 style={s.h2}>Emergency Contact</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Contact Name"  value={form?.emergency_contact_name}  editing={editing} onChange={v => set('emergency_contact_name', v)} />
              <Field label="Contact Phone" value={form?.emergency_contact_phone} editing={editing} onChange={v => set('emergency_contact_phone', v)} type="tel" />
            </div>

            <div style={{ marginTop: 24 }}>
              <h2 style={s.h2}>Quick Links</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { href: '/patient/prescriptions', label: '💊 My Prescriptions' },
                  { href: '/patient/payments',      label: '💳 Payment History' },
                  { href: '/patient/lab',           label: '🧪 Lab Reports' },
                  { href: '/patient/followups',     label: '📅 Follow-ups' },
                ].map(l => (
                  <a key={l.href} href={l.href} style={{ display: 'block', padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', color: '#0f1f3d', textDecoration: 'none', fontSize: '.875rem', fontWeight: 600 }}>
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, editing, onChange, type = 'text' }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</label>
      {editing ? (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
          style={{ width: '100%', padding: '.55rem .8rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem', boxSizing: 'border-box' }} />
      ) : (
        <div style={{ fontSize: '.875rem', color: value ? '#0f1f3d' : '#94a3b8', fontWeight: value ? 500 : 400 }}>{value || '—'}</div>
      )}
    </div>
  );
}

function SelectField({ label, value, editing, onChange, options }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</label>
      {editing ? (
        <select value={value || ''} onChange={e => onChange(e.target.value)}
          style={{ width: '100%', padding: '.55rem .8rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem', boxSizing: 'border-box' }}>
          <option value="">Select…</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <div style={{ fontSize: '.875rem', color: value ? '#0f1f3d' : '#94a3b8', fontWeight: value ? 500 : 400 }}>{value || '—'}</div>
      )}
    </div>
  );
}

const s = {
  page:  { padding: '2rem', maxWidth: 1000, margin: '0 auto' },
  center:{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#64748b' },
  h1:    { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2:    { fontSize: '.95rem', fontWeight: 700, color: '#0f1f3d', marginBottom: 16 },
  sub:   { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  card:  { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  label: { display: 'block', fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 },
  input: { padding: '.55rem .8rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem' },
  value: { fontSize: '.875rem', color: '#0f1f3d', fontWeight: 500 },
  btnPri:{ padding: '.6rem 1.2rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem' },
  btnSec:{ padding: '.6rem 1rem', background: '#f1f5f9', color: '#0f1f3d', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem' },
};
