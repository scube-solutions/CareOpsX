'use client';
import { useState } from 'react';
import { api }      from '@/lib/api';

export default function LoginPage() {
  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async () => {
    setError('');
    if (!form.email || !form.password) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    try {
      const data = await api('/auth/login', {
        method : 'POST',
        body   : JSON.stringify(form)
      });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user',  JSON.stringify(data.user));

      // Role-based redirect
      const routes = {
        1: '/admin/dashboard',
        2: '/doctor/dashboard',
        3: '/patient/dashboard',
        5: '/receptionist/dashboard',
        6: '/lab/dashboard',
        7: '/pharmacy/dashboard',
        8: '/admin/analytics',
      };
      window.location.href = routes[data.user.role_id] || '/login';

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>

        {/* Logo */}
        <div style={styles.logo}>
          <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
            <rect x="9" y="2"  width="6" height="6" rx="1" fill="white" opacity=".9"/>
            <rect x="9" y="16" width="6" height="6" rx="1" fill="white" opacity=".9"/>
            <rect x="2" y="9"  width="6" height="6" rx="1" fill="white" opacity=".6"/>
            <rect x="16" y="9" width="6" height="6" rx="1" fill="white" opacity=".6"/>
            <rect x="10" y="10" width="4" height="4" rx=".5" fill="#00b4a0"/>
          </svg>
        </div>
        <h1 style={styles.title}>Welcome back</h1>
        <p style={styles.sub}>Sign in to your CareOpsX account</p>

        {/* Error */}
        {error && <div style={styles.error}>{error}</div>}

        {/* Fields */}
        <div style={styles.fg}>
          <label style={styles.label}>Email Address</label>
          <input
            style={styles.input}
            type="email"
            name="email"
            placeholder="admin@careopsx.com"
            value={form.email}
            onChange={handle}
          />
        </div>

        <div style={styles.fg}>
          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            name="password"
            placeholder="••••••••"
            value={form.password}
            onChange={handle}
          />
        </div>

        {/* Submit */}
        <button
          style={{ ...styles.btn, opacity: loading ? .7 : 1 }}
          onClick={submit}
          disabled={loading}
        >
          {loading ? 'Signing in…' : 'Sign In →'}
        </button>

        <p style={styles.switch}>
          Don't have an account?{' '}
          <a href="/register" style={styles.link}>Register free</a>
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrapper : { minHeight:'100vh', display:'flex', alignItems:'center',
              justifyContent:'center', background:'#f5f8fc', padding:'1rem' },
  card    : { background:'#fff', borderRadius:'16px', padding:'2.5rem',
              width:'100%', maxWidth:'420px',
              boxShadow:'0 4px 24px rgba(0,0,0,0.08)',
              border:'1px solid #e2e8f0' },
  logo    : { width:'52px', height:'52px', background:'#0f1f3d',
              borderRadius:'12px', display:'flex', alignItems:'center',
              justifyContent:'center', marginBottom:'1.25rem' },
  title   : { fontFamily:"'Bricolage Grotesque', sans-serif", fontSize:'1.6rem',
              fontWeight:700, color:'#0f1f3d', margin:'0 0 .25rem' },
  sub     : { fontSize:'.9rem', color:'#64748b', marginBottom:'1.75rem' },
  error   : { background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626',
              borderRadius:'8px', padding:'.75rem 1rem',
              fontSize:'.85rem', marginBottom:'1rem' },
  fg      : { marginBottom:'1rem' },
  label   : { display:'block', fontSize:'.75rem', fontWeight:600,
              textTransform:'uppercase', letterSpacing:'.06em',
              color:'#475569', marginBottom:'.4rem' },
  input   : { width:'100%', padding:'.7rem 1rem', border:'1.5px solid #e2e8f0',
              borderRadius:'8px', background:'#f8fafc', color:'#1e293b',
              fontSize:'.9rem', boxSizing:'border-box', outline:'none' },
  btn     : { width:'100%', padding:'.85rem', background:'#00b4a0',
              color:'#fff', border:'none', borderRadius:'8px',
              fontSize:'1rem', fontWeight:600, cursor:'pointer',
              marginTop:'.5rem' },
  switch  : { textAlign:'center', fontSize:'.85rem',
              color:'#64748b', marginTop:'1.25rem' },
  link    : { color:'#00b4a0', fontWeight:600, textDecoration:'none' }
};