'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('');
  const [msg,     setMsg]     = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const submit = async () => {
    setError(''); setMsg('');
    if (!email) { setError('Email is required'); return; }
    setLoading(true);
    try {
      const data = await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMsg(data.message);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.wrapper}>
      <a href="/login" style={{ position: 'absolute', top: 24, left: 28, display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <div style={{ width: 38, height: 38, background: 'linear-gradient(135deg, #1e3f85 0%, #13cfbd 100%)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
            <rect x="10.5" y="4" width="3" height="16" rx="1.5" fill="white"/>
            <rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="white"/>
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#0f1f3d', lineHeight: 1.1 }}>Care<span style={{ color: '#00b4a0' }}>OpsX</span></div>
          <div style={{ fontSize: '.65rem', color: '#64748b', letterSpacing: '.07em', textTransform: 'uppercase' }}>Healthcare Operations</div>
        </div>
      </a>

      <div style={s.card}>
        <div style={s.iconWrap}>
          <svg viewBox="0 0 24 24" fill="none" width="26" height="26" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        <h1 style={s.title}>Forgot password?</h1>
        <p style={s.sub}>Enter your registered email and we'll send a reset link.</p>

        {error && <div style={s.error}>{error}</div>}
        {msg   && <div style={s.success}>{msg}</div>}

        {!sent ? (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label style={s.label}>Email Address</label>
              <input
                style={s.input}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
            </div>
            <button style={{ ...s.btn, opacity: loading ? .7 : 1 }} onClick={submit} disabled={loading}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📧</div>
            <p style={{ color: '#64748b', fontSize: '.9rem' }}>Check your inbox. The link expires in <strong>1 hour</strong>.</p>
            <button onClick={() => { setSent(false); setMsg(''); setEmail(''); }} style={{ ...s.btn, marginTop: '1rem', background: '#f1f5f9', color: '#0f1f3d' }}>
              Send again
            </button>
          </div>
        )}

        <p style={s.back}><a href="/login" style={s.link}>← Back to Sign In</a></p>
      </div>
    </div>
  );
}

const s = {
  wrapper : { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f8fc', padding: '1rem', position: 'relative' },
  card    : { background: '#fff', borderRadius: 16, padding: '2.5rem', width: '100%', maxWidth: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' },
  iconWrap: { width: 52, height: 52, background: 'linear-gradient(135deg, #1e3f85 0%, #13cfbd 100%)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' },
  title   : { fontSize: '1.6rem', fontWeight: 700, color: '#0f1f3d', margin: '0 0 .25rem' },
  sub     : { fontSize: '.9rem', color: '#64748b', marginBottom: '1.75rem' },
  error   : { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.85rem', marginBottom: '1rem' },
  success : { background: '#f0fdfb', border: '1px solid #99f6e4', color: '#0f766e', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.85rem', marginBottom: '1rem' },
  label   : { display: 'block', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#475569', marginBottom: '.4rem' },
  input   : { width: '100%', padding: '.7rem 1rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.9rem', boxSizing: 'border-box', outline: 'none' },
  btn     : { width: '100%', padding: '.85rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontSize: '1rem', fontWeight: 600, cursor: 'pointer' },
  back    : { textAlign: 'center', fontSize: '.85rem', color: '#64748b', marginTop: '1.25rem', marginBottom: 0 },
  link    : { color: '#00b4a0', fontWeight: 600, textDecoration: 'none' },
};
