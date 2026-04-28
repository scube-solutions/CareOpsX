'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

export default function NewPatientPage() {
  const [form, setForm] = useState({ first_name: '', last_name: '', gender: '', date_of_birth: '', phone: '', alternate_phone: '', email: '', address_line_1: '', address_line_2: '', city: '', state: '', postal_code: '', blood_group: '', allergies: '', existing_conditions: '', chronic_disease_tag: '', emergency_contact_name: '', emergency_contact_relationship: '', emergency_contact_phone: '' });
  const [duplicates, setDuplicates] = useState([]);
  const [dupChecked, setDupChecked] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = e => setForm({ ...form, [e.target.name]: e.target.value });

  const checkDuplicates = async () => {
    if (!form.phone && !form.email) { setError('Enter phone or email to check duplicates'); return; }
    try {
      const data = await api('/patients/check-duplicates', { method: 'POST', body: JSON.stringify({ phone: form.phone, email: form.email, first_name: form.first_name, last_name: form.last_name, date_of_birth: form.date_of_birth }) });
      setDuplicates(data.duplicates || []);
      setDupChecked(true);
      if (data.has_duplicates) setError(`${data.duplicates.length} possible duplicate(s) found. Review before creating.`);
      else { setError(''); }
    } catch (e) { setError(e.message); }
  };

  const submit = async () => {
    if (!dupChecked) { setError('Please check for duplicates first'); return; }
    if (!form.first_name || !form.phone) { setError('First name and phone are required'); return; }
    setLoading(true); setError('');
    try {
      const data = await api('/patients', { method: 'POST', body: JSON.stringify(form) });
      setSuccess(`Patient created! ID: ${data.patient.patient_uid}`);
      setTimeout(() => window.location.href = `/receptionist/patients/${data.patient.id}`, 1500);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const Field = ({ label, name, type = 'text', required, options }) => (
    <div style={s.fg}>
      <label style={s.label}>{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
      {options ? (
        <select name={name} value={form[name]} onChange={handle} style={s.input}>
          <option value="">Select {label}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} name={name} value={form[name]} onChange={handle} style={s.input} />
      )}
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.h1}>Register New Patient</h1>
          <p style={s.sub}>Fill in patient details. Check duplicates before saving.</p>
        </div>
        <a href="/receptionist/dashboard" style={s.back}>← Back</a>
      </div>

      {error && <div style={s.err}>{error}</div>}
      {success && <div style={s.suc}>{success}</div>}

      {dupChecked && duplicates.length > 0 && (
        <div style={{ ...s.card, marginBottom: 16, borderLeft: '4px solid #f59e0b' }}>
          <h3 style={{ margin: '0 0 8px', color: '#92400e', fontSize: '.95rem' }}>⚠ Possible Duplicate Patients Found</h3>
          <table style={s.table}>
            <thead><tr>{['ID', 'Name', 'Phone', 'Email', 'DOB', 'Match Reason', 'Action'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {duplicates.map(d => (
                <tr key={d.id}>
                  <td style={s.td}>{d.patient_uid}</td>
                  <td style={s.td}>{d.first_name} {d.last_name}</td>
                  <td style={s.td}>{d.phone}</td>
                  <td style={s.td}>{d.email || '–'}</td>
                  <td style={s.td}>{d.date_of_birth || '–'}</td>
                  <td style={s.td}><span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 4, fontSize: '.75rem' }}>{d.match_reason}</span></td>
                  <td style={s.td}><a href={`/receptionist/patients/${d.id}`} style={s.link}>Use Existing →</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dupChecked && duplicates.length === 0 && (
        <div style={{ ...s.card, marginBottom: 16, borderLeft: '4px solid #00b4a0' }}>
          <p style={{ margin: 0, color: '#065f46', fontSize: '.875rem' }}>✓ No duplicate patients found. Safe to create.</p>
        </div>
      )}

      <div style={s.card}>
        <h2 style={s.h2}>Personal Information</h2>
        <div style={s.grid3}>
          <Field label="First Name" name="first_name" required />
          <Field label="Last Name" name="last_name" />
          <Field label="Gender" name="gender" options={['Male', 'Female', 'Other']} required />
          <Field label="Date of Birth" name="date_of_birth" type="date" />
          <Field label="Phone" name="phone" type="tel" required />
          <Field label="Alternate Phone" name="alternate_phone" type="tel" />
          <Field label="Email" name="email" type="email" />
          <Field label="Blood Group" name="blood_group" options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']} />
          <Field label="Chronic Disease Tag" name="chronic_disease_tag" />
        </div>

        <h2 style={{ ...s.h2, marginTop: 24 }}>Address</h2>
        <div style={s.grid3}>
          <div style={{ gridColumn: 'span 2' }}><Field label="Address Line 1" name="address_line_1" /></div>
          <Field label="Address Line 2" name="address_line_2" />
          <Field label="City" name="city" />
          <Field label="State" name="state" />
          <Field label="Postal Code" name="postal_code" />
        </div>

        <h2 style={{ ...s.h2, marginTop: 24 }}>Emergency Contact</h2>
        <div style={s.grid3}>
          <Field label="Contact Name" name="emergency_contact_name" />
          <Field label="Relationship" name="emergency_contact_relationship" />
          <Field label="Contact Phone" name="emergency_contact_phone" type="tel" />
        </div>

        <h2 style={{ ...s.h2, marginTop: 24 }}>Medical Info</h2>
        <div style={s.grid2}>
          <div style={s.fg}>
            <label style={s.label}>Allergies</label>
            <textarea name="allergies" value={form.allergies} onChange={handle} style={{ ...s.input, height: 80, resize: 'vertical' }} />
          </div>
          <div style={s.fg}>
            <label style={s.label}>Existing Conditions</label>
            <textarea name="existing_conditions" value={form.existing_conditions} onChange={handle} style={{ ...s.input, height: 80, resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button onClick={checkDuplicates} style={s.btnSec}>Check Duplicates</button>
          <button onClick={submit} disabled={loading || !dupChecked} style={{ ...s.btnPri, opacity: (!dupChecked || loading) ? .5 : 1 }}>
            {loading ? 'Creating...' : 'Create Patient'}
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { padding: '2rem', maxWidth: 1100, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  h1: { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2: { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', margin: '0 0 16px' },
  sub: { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  back: { color: '#00b4a0', textDecoration: 'none', fontSize: '.875rem', fontWeight: 600 },
  card: { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  err: { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.85rem', marginBottom: 12 },
  suc: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.85rem', marginBottom: 12 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  fg: { display: 'flex', flexDirection: 'column' },
  label: { fontSize: '.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 },
  input: { padding: '.65rem .9rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem', outline: 'none', boxSizing: 'border-box', width: '100%' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' },
  th: { textAlign: 'left', padding: '8px 10px', background: '#f8fafc', color: '#64748b', fontWeight: 600, fontSize: '.75rem', textTransform: 'uppercase' },
  td: { padding: '8px 10px', color: '#334155', borderBottom: '1px solid #f1f5f9' },
  link: { color: '#00b4a0', fontWeight: 600, textDecoration: 'none' },
  btnPri: { padding: '.7rem 1.5rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.9rem' },
  btnSec: { padding: '.7rem 1.5rem', background: '#f1f5f9', color: '#0f1f3d', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.9rem' },
};
