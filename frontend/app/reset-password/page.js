'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [form,    setForm]    = useState({ new_password: '', confirm: '' });
  const [error,   setError]   = useState('');
  const [msg,     setMsg]     = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  useEffect(() => {
    if (!token) setError('No reset token found. Please request a new reset link.');
  }, [token]);

  const submit = async () => {
    setError('');
    if (!form.new_password) { setError('Password is required'); return; }
    if (form.new_password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (form.new_password !== form.confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const data = await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: form.new_password }),
      });
      setMsg(data.message);
      setDone(true);
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
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>

        <h1 style={s.title}>Set new password</h1>
        <p style={s.sub}>Choose a strong password for your account.</p>

        {error && <div style={s.error}>{error}</div>}
        {msg   && <div style={s.success}>{msg}</div>}

        {!done ? (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label style={s.label}>New Password</label>
              <input
                style={s.input}
                type="password"
                placeholder="Min. 6 characters"
                value={form.new_password}
                onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
              />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={s.label}>Confirm Password</label>
              <input
                style={s.input}
                type="password"
                placeholder="Repeat password"
                value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
            </div>
            <button style={{ ...s.btn, opacity: loading || !token ? .6 : 1 }} onClick={submit} disabled={loading || !token}>
              {loading ? 'Saving…' : 'Reset Password'}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
            <p style={{ color: '#0f766e', fontWeight: 600 }}>Password updated!</p>
            <a href="/login" style={{ ...s.btn, display: 'block', textAlign: 'center', marginTop: '1.25rem', textDecoration: 'none' }}>
              Go to Sign In
            </a>
          </div>
        )}

        <p style={s.back}><a href="/forgot-password" style={s.link}>Request a new link</a></p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f8fc', color: '#64748b' }}>Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
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
