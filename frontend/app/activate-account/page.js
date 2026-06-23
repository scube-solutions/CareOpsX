'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

const ROUTES = {
  1: '/admin/dashboard', 2: '/doctor/dashboard', 3: '/patient/dashboard',
  5: '/receptionist/dashboard', 6: '/lab/dashboard', 7: '/pharmacy/dashboard',
  8: '/admin/analytics', 9: '/cxadmin/organizations', 10: '/doctor/dashboard', 11: '/admin/hr', 12: '/admin/billing',
};

function ActivateAccountForm() {
  const token = useSearchParams().get('token');
  const [state, setState] = useState('working'); // working | error
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setState('error'); setError('No activation token found. Please use the link from your email.'); return; }
    (async () => {
      try {
        const data = await api('/auth/activate-account', { method: 'POST', body: JSON.stringify({ token }) });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = ROUTES[data.user.role_id] || '/login';
      } catch (e) {
        setState('error'); setError(e.message);
      }
    })();
  }, [token]);

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <div style={s.iconWrap}>
          <svg viewBox="0 0 24 24" fill="none" width="26" height="26" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        {state === 'working' ? (
          <>
            <h1 style={s.title}>Activating your account…</h1>
            <p style={s.sub}>Please wait, this only takes a moment.</p>
          </>
        ) : (
          <>
            <h1 style={s.title}>Activation failed</h1>
            <div style={s.error}>{error}</div>
            <a href="/login" style={{ ...s.btn, display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: '1rem' }}>Go to Sign In</a>
            <p style={s.back}><a href="/register" style={s.link}>Register again</a></p>
          </>
        )}
      </div>
    </div>
  );
}

export default function ActivateAccountPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f8fc', color: '#64748b' }}>Loading…</div>}>
      <ActivateAccountForm />
    </Suspense>
  );
}

const s = {
  wrapper : { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f8fc', padding: '1rem' },
  card    : { background: '#fff', borderRadius: 16, padding: '2.5rem', width: '100%', maxWidth: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', textAlign: 'center' },
  iconWrap: { width: 52, height: 52, background: 'linear-gradient(135deg, #1e3f85 0%, #13cfbd 100%)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' },
  title   : { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: '0 0 .25rem' },
  sub     : { fontSize: '.9rem', color: '#64748b', marginBottom: '1rem' },
  error   : { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.85rem', marginBottom: '1rem' },
  btn     : { width: '100%', padding: '.85rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontSize: '1rem', fontWeight: 600, cursor: 'pointer' },
  back    : { textAlign: 'center', fontSize: '.85rem', color: '#64748b', marginTop: '1rem', marginBottom: 0 },
  link    : { color: '#00b4a0', fontWeight: 600, textDecoration: 'none' },
};
