'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '', confirm_password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handle = e => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async () => {
    setError('');
    const { first_name, last_name, email, phone, password, confirm_password } = form;
    if (!first_name || !last_name || !email || !password) { setError('All fields except phone are required'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm_password) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ first_name, last_name, email, phone, password, role_id: 3 }) });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/patient/dashboard';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ ...s.wrapper, position: 'relative' }}>
      <a href="/" style={{ position: 'absolute', top: 24, left: 28, display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <div style={{ width: 38, height: 38, background: 'linear-gradient(135deg, #1e3f85 0%, #13cfbd 100%)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
            <rect x="10.5" y="4" width="3" height="16" rx="1.5" fill="white"/>
            <rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="white"/>
          </svg>
        </div>
        <div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: '#0f1f3d', lineHeight: 1.1 }}>
            Care<span style={{ color: '#00b4a0' }}>OpsX</span>
          </div>
          <div style={{ fontSize: '.65rem', color: '#64748b', letterSpacing: '.07em', textTransform: 'uppercase' }}>Healthcare Operations</div>
        </div>
      </a>

      <div style={s.card}>
        <h1 style={s.title}>Create Patient Account</h1>
        <p style={s.sub}>Register to book appointments and view your health records</p>

        {error && <div style={s.error}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={s.fg}>
            <label style={s.label}>First Name</label>
            <input style={s.input} name="first_name" placeholder="John" value={form.first_name} onChange={handle}/>
          </div>
          <div style={s.fg}>
            <label style={s.label}>Last Name</label>
            <input style={s.input} name="last_name" placeholder="Doe" value={form.last_name} onChange={handle}/>
          </div>
        </div>

        <div style={s.fg}>
          <label style={s.label}>Email Address</label>
          <input style={s.input} type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handle}/>
        </div>

        <div style={s.fg}>
          <label style={s.label}>Phone (optional)</label>
          <input style={s.input} type="tel" name="phone" placeholder="+91 9876543210" value={form.phone} onChange={handle}/>
        </div>

        <div style={s.fg}>
          <label style={s.label}>Password</label>
          <input style={s.input} type="password" name="password" placeholder="Min 6 characters" value={form.password} onChange={handle}/>
        </div>

        <div style={s.fg}>
          <label style={s.label}>Confirm Password</label>
          <input style={s.input} type="password" name="confirm_password" placeholder="Re-enter password" value={form.confirm_password} onChange={handle}/>
        </div>

        <button style={{ ...s.btn, opacity: loading ? .7 : 1 }} onClick={submit} disabled={loading}>
          {loading ? 'Creating Account…' : 'Create Account →'}
        </button>

        <p style={s.switch}>
          Already have an account?{' '}
          <a href="/login" style={s.link}>Sign In</a>
        </p>
      </div>
    </div>
  );
}

const s = {
  wrapper : { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f8fc', padding: '5rem 1rem 2rem' },
  card    : { background: '#fff', borderRadius: '16px', padding: '2.5rem', width: '100%', maxWidth: '480px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' },
  title   : { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: '0 0 .25rem' },
  sub     : { fontSize: '.9rem', color: '#64748b', marginBottom: '1.5rem' },
  error   : { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px', padding: '.75rem 1rem', fontSize: '.85rem', marginBottom: '1rem' },
  fg      : { marginBottom: '1rem' },
  label   : { display: 'block', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#475569', marginBottom: '.4rem' },
  input   : { width: '100%', padding: '.7rem 1rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', color: '#1e293b', fontSize: '.9rem', boxSizing: 'border-box', outline: 'none' },
  btn     : { width: '100%', padding: '.85rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', marginTop: '.25rem' },
  switch  : { textAlign: 'center', fontSize: '.85rem', color: '#64748b', marginTop: '1.25rem' },
  link    : { color: '#00b4a0', fontWeight: 600, textDecoration: 'none' },
};
