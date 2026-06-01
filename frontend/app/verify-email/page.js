'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { getDashboardRoute } from '@/lib/auth';

export default function VerifyEmailPage() {
  const [email, setEmail]   = useState('');
  const [otp, setOtp]       = useState('');
  const [error, setError]   = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get('email') || '';
    setEmail(e);
    if (e) setNotice(`Enter the 6-digit code sent to ${e}.`);
  }, []);

  const verify = async () => {
    setError('');
    if (!otp || otp.length < 4) { setError('Enter the verification code'); return; }
    setLoading(true);
    try {
      const data = await api('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp, purpose: 'verification' }) });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = getDashboardRoute(data.user.role_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError(''); setResending(true);
    try {
      const data = await api('/auth/send-otp', { method: 'POST', body: JSON.stringify({ email, purpose: 'verification' }) });
      if (data.dev_otp) { setOtp(data.dev_otp); setNotice(`Email delivery unavailable. Your code: ${data.dev_otp}`); }
      else setNotice('A new code has been sent to your email.');
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={s.wrapper}>
      <a href="/" style={{ position: 'absolute', top: 24, left: 28, display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <div style={{ width: 38, height: 38, background: 'linear-gradient(135deg, #1e3f85 0%, #13cfbd 100%)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
            <rect x="10.5" y="4" width="3" height="16" rx="1.5" fill="white"/>
            <rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="white"/>
          </svg>
        </div>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: '#0f1f3d' }}>
          Care<span style={{ color: '#00b4a0' }}>OpsX</span>
        </div>
      </a>

      <div style={s.card}>
        <h1 style={s.title}>Verify Your Email</h1>
        <p style={s.sub}>Confirm your email address to activate your account.</p>

        {notice && <div style={{ ...s.error, background: '#f0fdfb', border: '1px solid #99f6e4', color: '#0f766e' }}>{notice}</div>}
        {error && <div style={s.error}>{error}</div>}

        {!email && (
          <div style={s.fg}>
            <label style={s.label}>Email Address</label>
            <input style={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
        )}

        <div style={s.fg}>
          <label style={s.label}>Verification Code</label>
          <input
            style={{ ...s.input, fontSize: '1.4rem', letterSpacing: '.5em', textAlign: 'center', fontWeight: 700 }}
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••"
            inputMode="numeric"
            maxLength={6}
            onKeyDown={e => { if (e.key === 'Enter') verify(); }}
          />
        </div>

        <button style={{ ...s.btn, opacity: loading ? .7 : 1 }} onClick={verify} disabled={loading}>
          {loading ? 'Verifying…' : 'Verify & Continue →'}
        </button>

        <p style={s.switch}>
          Didn&apos;t get the code?{' '}
          <span onClick={resend} style={{ ...s.link, cursor: 'pointer' }}>{resending ? 'Sending…' : 'Resend Code'}</span>
        </p>
        <p style={s.switch}>
          <a href="/login" style={s.link}>← Back to Sign In</a>
        </p>
      </div>
    </div>
  );
}

const s = {
  wrapper : { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f8fc', padding: '1rem', position: 'relative' },
  card    : { background: '#fff', borderRadius: '16px', padding: '2.5rem', width: '100%', maxWidth: '420px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' },
  title   : { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: '0 0 .25rem' },
  sub     : { fontSize: '.9rem', color: '#64748b', marginBottom: '1.5rem' },
  error   : { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px', padding: '.75rem 1rem', fontSize: '.85rem', marginBottom: '1rem' },
  fg      : { marginBottom: '1rem' },
  label   : { display: 'block', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#475569', marginBottom: '.4rem' },
  input   : { width: '100%', padding: '.7rem 1rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', color: '#1e293b', fontSize: '.9rem', boxSizing: 'border-box', outline: 'none' },
  btn     : { width: '100%', padding: '.85rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', marginTop: '.25rem' },
  switch  : { textAlign: 'center', fontSize: '.85rem', color: '#64748b', marginTop: '1rem' },
  link    : { color: '#00b4a0', fontWeight: 600, textDecoration: 'none' },
};
