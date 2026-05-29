'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const T = { teal: '#00b4a0', navy: '#0f1f3d', bg: '#f5f8fc', border: '#e2e8f0', muted: '#64748b' };

const BULLETS = [
  'Full platform walkthrough tailored to your workflow',
  'Live Q&A with a product specialist',
  'Migration and onboarding guidance',
  'Transparent pricing — no hidden fees',
  'No commitment required',
];

const STATS = [
  { icon: '⚡', val: '20 min', label: 'avg demo length' },
  { icon: '🗓️', val: 'Same day', label: 'scheduling' },
  { icon: '🆓', val: 'Free', label: 'no commitment' },
];

export default function BookDemoPage() {
  const router = useRouter();
  const [form, setForm]       = useState({ name: '', phone: '', email: '', clinic: '', size: '', message: '' });
  const [status, setStatus]   = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handle = e => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.email) { setStatus('Please fill Name, Phone, and Email.'); return; }
    setLoading(true); setStatus('');
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      await fetch(`${API}/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'demo_request',
          to: 'demo@careopsx.co.in',
          subject: `Demo Request from ${form.name}`,
          body: `Name: ${form.name}\nPhone: ${form.phone}\nEmail: ${form.email}\nClinic: ${form.clinic}\nSize: ${form.size}\nMessage: ${form.message}`,
        }),
      });
      setSuccess(true);
    } catch {
      // fallback: open mailto
      window.location.href = `mailto:demo@careopsx.co.in?subject=Demo Request from ${encodeURIComponent(form.name)}&body=${encodeURIComponent(`Name: ${form.name}\nPhone: ${form.phone}\nEmail: ${form.email}\nClinic: ${form.clinic}`)}`;
    } finally { setLoading(false); }
  };

  return (
    <div style={{ fontFamily: "'Instrument Sans',sans-serif", background: T.bg, minHeight: '100vh' }}>

      {/* Nav */}
      <nav style={{ background: '#fff', borderBottom: `1px solid ${T.border}`, padding: '0 5%', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#1e3f85,#13cfbd)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><rect x="10.5" y="4" width="3" height="16" rx="1.5" fill="white"/><rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="white"/></svg>
          </div>
          <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: 16, color: T.navy }}>Care<span style={{ color: T.teal }}>OpsX</span></div>
        </div>
        <button onClick={() => router.push('/')} style={{ fontSize: 13, color: T.muted, background: 'none', border: 'none', cursor: 'pointer' }}>← Back to Home</button>
      </nav>

      {/* Hero strip */}
      <div style={{ background: `linear-gradient(135deg,${T.navy},#1a3260)`, padding: '48px 5%', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,180,160,.15)', border: '1px solid rgba(0,180,160,.3)', borderRadius: 99, padding: '5px 14px', fontSize: 12, fontWeight: 600, color: T.teal, marginBottom: 16 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.teal, display: 'inline-block' }} />Free 20-Minute Demo
        </div>
        <h1 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 'clamp(1.8rem,3.5vw,2.6rem)', color: '#fff', fontWeight: 800, margin: '0 0 12px' }}>See CareOpsX in Action</h1>
        <p style={{ color: 'rgba(255,255,255,.65)', fontSize: '1rem', maxWidth: 500, margin: '0 auto' }}>Tailored walkthrough for your clinic. No slides, just live software.</p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '56px 5%', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 48, alignItems: 'start' }}>

        {/* Left */}
        <div>
          <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: '1.4rem', fontWeight: 800, color: T.navy, marginBottom: 12 }}>What you'll get</h2>
          <p style={{ color: T.muted, fontSize: '0.95rem', marginBottom: 28, lineHeight: 1.7 }}>We'll tailor the session to your clinic's specialty and size. Book in minutes, no commitment needed.</p>

          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {BULLETS.map(b => (
              <li key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 14, color: T.navy }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,180,160,.1)', border: '1.5px solid rgba(0,180,160,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <svg viewBox="0 0 24 24" fill="none" width="11" height="11" stroke="#00b4a0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                {b}
              </li>
            ))}
          </ul>

          <div style={{ display: 'flex', gap: 24, paddingTop: 24, borderTop: `1px solid ${T.border}` }}>
            {STATS.map(st => (
              <div key={st.val} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{st.icon}</div>
                <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: '1.3rem', fontWeight: 800, color: T.navy }}>{st.val}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{st.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Form */}
        <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 20, padding: 36, boxShadow: '0 8px 32px rgba(15,31,61,.07)' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <h3 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: '1.3rem', fontWeight: 700, color: T.navy, marginBottom: 8 }}>Request Received!</h3>
              <p style={{ color: T.muted, fontSize: 14, marginBottom: 24 }}>Our team will reach out within 2 business hours to confirm your demo slot.</p>
              <button onClick={() => router.push('/')} style={{ padding: '10px 24px', background: T.teal, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}>Back to Home</button>
            </div>
          ) : (
            <>
              <h3 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: '1.2rem', fontWeight: 800, color: T.navy, margin: '0 0 6px' }}>Book Your Free Demo</h3>
              <p style={{ color: T.muted, fontSize: 13, margin: '0 0 24px' }}>We'll confirm within 2 business hours.</p>

              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[['name','Full Name','Dr. Priya Rao','text'],['phone','Phone Number','+91 98765 43210','tel']].map(([n,l,p,t]) => (
                    <div key={n}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{l} *</label>
                      <input name={n} type={t} value={form[n]} onChange={handle} placeholder={p} style={inp} required />
                    </div>
                  ))}
                </div>

                <div>
                  <label style={lbl}>Email Address *</label>
                  <input name="email" type="email" value={form.email} onChange={handle} placeholder="you@hospital.com" style={inp} required />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>Clinic / Hospital</label>
                    <input name="clinic" value={form.clinic} onChange={handle} placeholder="City Care Hospital" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Clinic Size</label>
                    <select name="size" value={form.size} onChange={handle} style={inp}>
                      <option value="">Select size</option>
                      <option>Solo practitioner</option>
                      <option>2–5 doctors</option>
                      <option>6–20 doctors</option>
                      <option>20+ doctors</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={lbl}>What would you like to see? (optional)</label>
                  <textarea name="message" value={form.message} onChange={handle} placeholder="e.g. Queue management, billing, lab integration…" style={{ ...inp, minHeight: 90, resize: 'vertical' }} />
                </div>

                {status && <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{status}</p>}

                <button type="submit" disabled={loading} style={{ padding: '13px', background: T.teal, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: loading ? 'default' : 'pointer', opacity: loading ? .7 : 1, boxShadow: '0 6px 20px rgba(0,180,160,.3)' }}>
                  {loading ? 'Sending…' : 'Book Free Demo →'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const inp = { width: '100%', padding: '10px 13px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 13, color: '#0f1f3d', background: '#fff', boxSizing: 'border-box', fontFamily: "'Instrument Sans',sans-serif" };
const lbl = { display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 };
