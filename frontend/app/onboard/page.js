'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: '₹1,499/mo',
    features: '1 doctor, 4 users, 100 patients, 1 clinic',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '₹2,999/mo',
    features: '5 doctors, 20 users, unlimited patients, full features',
  },
];

const EMPTY = { email: '', display_name: '', org_name: '', phone: '', password: '' };

export default function OnboardPage() {
  const [plan, setPlan]     = useState('basic');
  const [form, setForm]     = useState(EMPTY);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async () => {
    setError('');
    const { email, display_name, org_name, phone, password } = form;
    if (!email || !display_name || !org_name || !phone || !password) {
      setError('All fields are required'); return;
    }
    if (!/^\d{10}$/.test(phone)) { setError('Phone must be 10 digits, no country code'); return; }
    if (password.length < 8)    { setError('Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must have uppercase, lowercase, and number'); return;
    }

    setLoading(true);
    try {
      const data = await api('/auth/admin-register', {
        method: 'POST',
        body: JSON.stringify({ ...form, plan }),
      });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setSuccess(true);
      setTimeout(() => { window.location.href = '/admin/dashboard'; }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.wrapper}>
      {/* Logo */}
      <a href="/" style={s.logo}>
        <div style={s.logoIcon}>
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
            <rect x="10.5" y="4" width="3" height="16" rx="1.5" fill="white"/>
            <rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="white"/>
          </svg>
        </div>
        <div>
          <div style={s.logoName}>Care<span style={{ color: '#00b4a0' }}>OpsX</span></div>
          <div style={s.logoSub}>Healthcare Operations</div>
        </div>
      </a>

      <div style={s.card}>
        {/* Tabs */}
        <div style={s.tabs}>
          <a href="/login" style={s.tab}>Login</a>
          <span style={{ ...s.tab, ...s.tabActive }}>Create an account</span>
        </div>

        {/* Trial banner */}
        <div style={s.banner}>
          🚀 Get started with a <strong>7-day free trial</strong> • No payment required
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h2 style={{ color: '#0f1f3d', margin: '0 0 8px' }}>Clinic Registered!</h2>
            <p style={{ color: '#64748b', fontSize: '.9rem' }}>Redirecting to dashboard…</p>
          </div>
        ) : (
          <>
            {/* Plan selector */}
            <div style={s.fg}>
              <label style={s.label}>Select Plan <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {PLANS.map(p => (
                  <div
                    key={p.id}
                    onClick={() => setPlan(p.id)}
                    style={{ ...s.planCard, ...(plan === p.id ? s.planActive : {}) }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '.95rem', color: '#0f1f3d' }}>{p.name}</div>
                    <div style={{ fontWeight: 700, color: plan === p.id ? '#00b4a0' : '#334155', fontSize: '1rem', margin: '2px 0' }}>{p.price}</div>
                    <div style={{ fontSize: '.72rem', color: '#64748b', lineHeight: 1.4 }}>{p.features}</div>
                  </div>
                ))}
              </div>
            </div>

            {error && <div style={s.error}>{error}</div>}

            <div style={s.fg}>
              <label style={s.label}>Email <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={s.input} type="email" name="email" placeholder="your@email.com" value={form.email} onChange={handle} />
            </div>

            <div style={s.fg}>
              <label style={s.label}>Display Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={s.input} name="display_name" placeholder="Your Name" value={form.display_name} onChange={handle} />
              <span style={s.hint}>Spaces, emojis, and special characters are all allowed</span>
            </div>

            <div style={s.fg}>
              <label style={s.label}>Organization Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={s.input} name="org_name" placeholder="Your Clinic or Organization" value={form.org_name} onChange={handle} />
              <span style={s.hint}>The name of your clinic or organization</span>
            </div>

            <div style={s.fg}>
              <label style={s.label}>Phone Number <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={s.input} type="tel" name="phone" placeholder="10 digit mobile number" value={form.phone} onChange={handle} maxLength={10} />
              <span style={s.hint}>Enter your 10-digit mobile number without country code</span>
            </div>

            <div style={s.fg}>
              <label style={s.label}>Password <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={s.input} type="password" name="password" placeholder="••••••••" value={form.password} onChange={handle} />
              <span style={s.hint}>At least 8 characters with uppercase, lowercase, and number</span>
            </div>

            <button style={{ ...s.btn, opacity: loading ? .7 : 1 }} onClick={submit} disabled={loading}>
              {loading ? 'Creating Account…' : 'Create Account'}
            </button>

            <p style={s.switch}>
              Already have an account?{' '}
              <a href="/login" style={s.link}>Sign in</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  wrapper   : { minHeight: '100vh', background: '#f5f8fc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 1rem 2rem', position: 'relative' },
  logo      : { position: 'absolute', top: 24, left: 28, display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' },
  logoIcon  : { width: 38, height: 38, background: 'linear-gradient(135deg,#1e3f85 0%,#13cfbd 100%)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoName  : { fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: '1.1rem', color: '#0f1f3d', lineHeight: 1.1 },
  logoSub   : { fontSize: '.65rem', color: '#64748b', letterSpacing: '.07em', textTransform: 'uppercase' },
  card      : { background: '#fff', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 440, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' },
  tabs      : { display: 'flex', borderBottom: '1.5px solid #e2e8f0', marginBottom: '1.25rem' },
  tab       : { flex: 1, textAlign: 'center', padding: '.65rem', fontSize: '.9rem', fontWeight: 500, color: '#64748b', cursor: 'pointer', textDecoration: 'none', borderBottom: '2.5px solid transparent', marginBottom: -2 },
  tabActive : { color: '#0f1f3d', fontWeight: 700, borderBottom: '2.5px solid #00b4a0' },
  banner    : { background: 'linear-gradient(135deg,#f0fdfb,#e0f2fe)', border: '1px solid #99f6e4', borderRadius: 10, padding: '.75rem 1rem', fontSize: '.82rem', color: '#0f766e', textAlign: 'center', marginBottom: '1.25rem' },
  planCard  : { border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '.85rem', cursor: 'pointer', transition: 'all .15s' },
  planActive: { border: '2px solid #00b4a0', background: '#f0fdfb' },
  fg        : { marginBottom: '1rem' },
  label     : { display: 'block', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#475569', marginBottom: '.35rem' },
  input     : { width: '100%', padding: '.65rem .9rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem', boxSizing: 'border-box', outline: 'none' },
  hint      : { display: 'block', fontSize: '.72rem', color: '#00b4a0', marginTop: 4 },
  error     : { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '.7rem .9rem', fontSize: '.82rem', marginBottom: '1rem' },
  btn       : { width: '100%', padding: '.8rem', background: '#0f1f3d', color: '#fff', border: 'none', borderRadius: 8, fontSize: '.95rem', fontWeight: 700, cursor: 'pointer', marginTop: '.25rem' },
  switch    : { textAlign: 'center', fontSize: '.82rem', color: '#64748b', marginTop: '1rem', marginBottom: 0 },
  link      : { color: '#00b4a0', fontWeight: 600, textDecoration: 'none' },
};
