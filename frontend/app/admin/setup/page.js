'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const ROLE_GUIDE = [
  { role: 'Admin', icon: '🏥', color: '#1d4ed8', bg: '#eff6ff', desc: 'Full access to all hospital modules, billing, reports, and settings', permissions: ['Manage all patients, doctors, and staff', 'Full access to billing, invoices, and financial reports', 'Create and manage user accounts and assign roles', 'Configure hospital settings and system setup', 'View all analytics and audit logs'] },
  { role: 'Doctor', icon: '👨‍⚕️', color: '#065f46', bg: '#f0fdf4', desc: 'Manages own patients — consultations, prescriptions, and lab orders', permissions: ['View and manage assigned patient consultations', 'Create and update prescriptions', 'Order lab tests and view reports', 'Manage own schedule and availability', 'View patient medical history'] },
  { role: 'Receptionist', icon: '🖥️', color: '#92400e', bg: '#fffbeb', desc: 'Front desk operations — patient registration, queue, and appointments', permissions: ['Patient check-in and registration', 'Schedule and manage appointments', 'Queue token management', 'Basic billing and invoice viewing', 'Limited access to patient records'] },
  { role: 'Lab Staff', icon: '🔬', color: '#7c3aed', bg: '#f5f3ff', desc: 'Manages lab orders, sample collection, and report delivery', permissions: ['View and process lab orders', 'Update sample collection status', 'Upload and manage lab reports', 'Access lab test catalog', 'Deliver reports to patients'] },
  { role: 'Pharmacist', icon: '💊', color: '#0e7490', bg: '#ecfeff', desc: 'Manages pharmacy inventory, dispensing, and stock alerts', permissions: ['View pending prescriptions for dispensing', 'Manage medicine inventory and stock', 'Create pharmacy invoices and billing', 'Monitor stock alerts and reorder levels', 'Bulk import medicine catalog'] },
  { role: 'Reporting', icon: '📊', color: '#be185d', bg: '#fdf2f8', desc: 'Read-only access to analytics, revenue, and performance reports', permissions: ['View all analytics dashboards', 'Access revenue and financial reports', 'View doctor performance metrics', 'Lab and pharmacy summary reports', 'Export data and audit summaries'] },
];

const PLANS = {
  trial:        { label: '7-Day Free Trial',  color: '#00b4a0', bg: '#f0fdfb' },
  basic:        { label: 'Basic Plan',         color: '#1d4ed8', bg: '#eff6ff' },
  professional: { label: 'Professional Plan',  color: '#7c3aed', bg: '#f5f3ff' },
  enterprise:   { label: 'Enterprise Plan',    color: '#0f1f3d', bg: '#f8fafc' },
};

const PLAN_FEATURES = {
  trial:        ['Up to 3 Doctors', 'Core HMS Modules', 'Patient & Appointment Management', 'Basic Billing', 'Email Support'],
  basic:        ['Up to 3 Doctor Seats', 'Core HMS Modules', 'Billing & Invoicing', 'Lab & Pharmacy', 'Email Support'],
  professional: ['Unlimited Seats', 'All Modules & Analytics', 'Lab, Pharmacy & Drop-Off', 'Priority Support', 'Advanced Reporting'],
  enterprise:   ['Unlimited Seats', 'Custom Branding', 'Dedicated Account Manager', 'SLA Guarantee', 'Custom Integrations'],
};

async function loadRazorpayScript() {
  if (window.Razorpay) return true;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error('Razorpay SDK failed to load'));
    document.body.appendChild(s);
  });
}

function SubscriptionTab() {
  const [billingInfo, setBillingInfo] = useState(null);
  const [activePlanTab, setActivePlanTab] = useState(0);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    api('/admin/hospital-profile').then(r => {
      const org = r.organization || r.profile || {};
      setBillingInfo({
        billing_status: org.billing_status || 'trial',
        created_at: org.created_at || new Date().toISOString(),
        trial_days: 7,
      });
    }).catch(() => {
      setBillingInfo({ billing_status: 'trial', created_at: new Date().toISOString(), trial_days: 7 });
    });
  }, []);

  const status    = billingInfo?.billing_status || 'trial';
  const planMeta  = PLANS[status] || PLANS.trial;
  const features  = PLAN_FEATURES[status] || PLAN_FEATURES.trial;
  const startDate = billingInfo ? new Date(billingInfo.created_at) : new Date();
  const trialDays = billingInfo?.trial_days || 7;
  const endDate   = new Date(startDate.getTime() + trialDays * 86400000);
  const daysLeft  = Math.max(0, Math.ceil((endDate - Date.now()) / 86400000));
  const pct       = Math.min(100, Math.max(0, (daysLeft / trialDays) * 100));
  const barColor  = daysLeft <= 2 ? '#ef4444' : daysLeft <= 4 ? '#f59e0b' : '#00b4a0';

  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const PLAN_PRICES = { basic: 299900, professional: 599900, enterprise: null };

  const pay = async (planKey, planLabel) => {
    if (planKey === 'enterprise') { alert('Contact sales@careopsx.co.in for Enterprise pricing.'); return; }
    setPaying(true);
    try {
      await loadRazorpayScript();
      const { order_id, amount, currency } = await api('/billing/razorpay/create-order', {
        method: 'POST',
        body: JSON.stringify({ amount: PLAN_PRICES[planKey], plan: planKey }),
      });
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount, currency, order_id,
        name: 'CareOpsX',
        description: `${planLabel} Subscription`,
        prefill: { name: `${storedUser.first_name || ''} ${storedUser.last_name || ''}`.trim(), email: storedUser.email || '' },
        theme: { color: '#00b4a0' },
        handler: async (response) => {
          try {
            await api('/billing/razorpay/verify', {
              method: 'POST',
              body: JSON.stringify({ ...response, plan: planKey }),
            });
            alert(`✓ Payment successful! Your plan has been upgraded to ${planLabel}.`);
            window.location.reload();
          } catch (e) {
            alert('Payment received but verification failed. Contact support.');
          }
        },
      });
      rzp.on('payment.failed', (r) => alert(`Payment failed: ${r.error.description}`));
      rzp.open();
    } catch (e) {
      alert(e.message || 'Payment initiation failed');
    } finally {
      setPaying(false);
    }
  };

  const planTabs = Object.entries(PLANS).filter(([k]) => k !== 'trial');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f1f3d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f1f3d' }}>Subscription Management</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Status card */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 24, background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#0f1f3d' }}>Subscription Status</span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <span style={{ padding: '6px 14px', borderRadius: 20, background: planMeta.bg, color: planMeta.color, fontWeight: 700, fontSize: 13, border: `1.5px solid ${planMeta.color}` }}>
              {planMeta.label}
            </span>
            {status === 'trial' && (
              <span style={{ padding: '6px 14px', borderRadius: 20, background: '#f8fafc', color: '#64748b', fontWeight: 600, fontSize: 13, border: '1.5px solid #e2e8f0' }}>
                Professional Plan
              </span>
            )}
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Your Plan Includes:</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {features.map(f => (
              <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
                {f}
              </li>
            ))}
          </ul>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#475569' }}>
            Ready for more? Upgrade to <strong>Enterprise</strong> to unlock additional features and limits.
          </div>
        </div>

        {/* Details card */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 24, background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#0f1f3d' }}>Subscription Details</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {[['Start Date', fmt(startDate)], ['Next Renewal Date', fmt(endDate)]].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0f1f3d' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Time Remaining */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 24, background: '#fff', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#0f1f3d' }}>Time Remaining</span>
        </div>
        <div style={{ height: 10, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 99, transition: 'width 0.5s' }} />
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#475569' }}>
          You have <strong style={{ color: barColor }}>{daysLeft} {daysLeft === 1 ? 'day' : 'days'}</strong> remaining.
        </p>
      </div>

      {/* Pricing Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
        {/* Basic */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 20, padding: 28, background: '#fff', position: 'relative', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ position: 'absolute', top: -13, left: 20, background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 999, letterSpacing: '.06em', textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(245,158,11,.35)' }}>Launch Offer</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#0f1f3d', marginBottom: 4 }}>Basic</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>For solo practitioners &amp; small clinics</div>
          </div>
          <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 36, fontWeight: 800, color: '#0f1f3d', lineHeight: 1 }}>₹1,499<span style={{ fontSize: 15, fontWeight: 500, color: '#64748b' }}>/month</span></div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            {['1 doctor + 4 users','Up to 100 patients','Appointment scheduling','Patient management','Basic reports','Email support','1 clinic location'].map(f => (
              <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#0f1f3d' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00b4a0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>{f}
              </li>
            ))}
          </ul>
          <button onClick={() => pay('basic', 'Basic Plan')} disabled={paying} style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff', color: '#0f1f3d', fontWeight: 700, fontSize: 14, cursor: paying ? 'default' : 'pointer', opacity: paying ? .7 : 1 }}>
            {paying ? 'Processing…' : 'Get Started'}
          </button>
        </div>

        {/* Premium */}
        <div style={{ border: '2px solid #00b4a0', borderRadius: 20, padding: 28, background: '#0f1f3d', position: 'relative', display: 'flex', flexDirection: 'column', gap: 18, transform: 'translateY(-6px)', boxShadow: '0 20px 48px rgba(15,31,61,.25)' }}>
          <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: '#00b4a0', color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 14px', borderRadius: 999, letterSpacing: '.06em', textTransform: 'uppercase', boxShadow: '0 4px 14px rgba(0,180,160,.4)', whiteSpace: 'nowrap' }}>Most Popular</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#fff', marginBottom: 4 }}>Premium</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>For growing practices</div>
          </div>
          <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1 }}>₹2,999<span style={{ fontSize: 15, fontWeight: 500, color: '#94a3b8' }}>/month</span></div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            {['Everything in Basic','Up to 5 doctors + 20 users','Unlimited patients','Multi-clinic management (up to 5)','Advanced analytics','Exercise prescriptions','Staff management','OPD & IPD management','Priority support','Complete operation management'].map(f => (
              <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#cbd5e1' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00b4a0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>{f}
              </li>
            ))}
          </ul>
          <button onClick={() => pay('professional', 'Premium Plan')} disabled={paying} style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 10, background: '#00b4a0', color: '#fff', fontWeight: 700, fontSize: 14, cursor: paying ? 'default' : 'pointer', opacity: paying ? .7 : 1, boxShadow: '0 6px 20px rgba(0,180,160,.4)' }}>
            {paying ? 'Processing…' : 'Choose Premium'}
          </button>
        </div>

        {/* Enterprise */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 20, padding: 28, background: '#fff', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#0f1f3d', marginBottom: 4 }}>Enterprise</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>For large organizations</div>
          </div>
          <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 36, fontWeight: 800, color: '#0f1f3d', lineHeight: 1 }}>Custom<span style={{ fontSize: 15, fontWeight: 500, color: '#64748b' }}>/pricing</span></div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            {['Everything in Premium','Unlimited clinics','Custom integrations','Dedicated account manager','Custom training','SLA guarantees','Pharmacy + laboratory integration','White-label options'].map(f => (
              <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#0f1f3d' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00b4a0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>{f}
              </li>
            ))}
          </ul>
          <button onClick={() => alert('Contact sales@careopsx.co.in for Enterprise pricing.')} style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 10, background: '#0f1f3d', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Contact Sales
          </button>
        </div>
      </div>
    </div>
  );
}

function RolePermissionsGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 24, border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: '#f8fafc', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#0f1f3d' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
          Role Permissions Guide
        </span>
        <span style={{ color: '#94a3b8', fontSize: 18, lineHeight: 1 }}>{open ? '∧' : '∨'}</span>
      </button>
      {open && (
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, background: '#fff' }}>
          {ROLE_GUIDE.map(r => (
            <div key={r.role} style={{ border: `1px solid ${r.bg}`, borderRadius: 10, padding: 16, background: r.bg }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{r.icon}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: r.color }}>{r.role}</span>
              </div>
              <p style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', marginBottom: 10 }}>{r.desc}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {r.permissions.map(p => (
                  <li key={p} style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ color: r.color, fontWeight: 700, flexShrink: 0 }}>•</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TABS = ['Profile', 'Organization', 'User Management', 'Subscription', 'Audit Logs'];

export default function SetupPage() {
  const [tab, setTab] = useState(0);
  const [orgSubTab, setOrgSubTab] = useState(0);
  const [profile, setProfile] = useState({ hospital_name: '', address: '', phone: '', email: '', timezone: 'Asia/Kolkata', currency: 'INR', working_days: 'Mon-Sat', working_hours: '9:00-18:00', logo_url: '' });
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [labTests, setLabTests] = useState([]);
  const [labTestForm, setLabTestForm] = useState({ test_name: '', test_code: '', category: '', fee: '', description: '' });
  const [editingLabTest, setEditingLabTest] = useState(null);
  const [specializations, setSpecializations] = useState([]);
  const [specName, setSpecName] = useState('');
  const [apptBlockUser, setApptBlockUser] = useState(null);

  const loadAll = async () => {
    try {
      const [p, b, d, u, lt, sp, rm] = await Promise.all([
        api('/admin/hospital-profile').then(r => r.profile || {}),
        api('/admin/branches').then(r => r.branches || []),
        api('/admin/departments').then(r => r.departments || []),
        api('/admin/users').then(r => r.users || []),
        api('/admin/lab-tests').then(r => r.tests || []),
        api('/admin/specializations').then(r => r.specializations || []),
        api('/admin/rooms').then(r => r.rooms || []).catch(() => []),
      ]);
      setProfile(p || profile);
      setBranches(b);
      setDepartments(d);
      setUsers(u);
      setLabTests(lt);
      setSpecializations(sp);
      setRooms(rm);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadAll(); }, []);

  const ORG_TABS = ['Branches', 'Departments', 'Room Management', 'Lab Tests', 'Specializations'];
  const ROLE_OPTIONS = [{ value: 1, label: 'Admin' }, { value: 2, label: 'Doctor' }, { value: 5, label: 'Receptionist' }, { value: 6, label: 'Lab Staff' }, { value: 7, label: 'Pharmacist' }, { value: 8, label: 'Reporting' }];

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Settings</h1>

      {msg && <div style={s.info}>{msg}<button onClick={() => setMsg('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer' }}>×</button></div>}

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e2e8f0', paddingBottom: 0 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => { setTab(i); setShowForm(false); setForm({}); }}
            style={{ 
              padding: '.75rem 1.5rem', 
              border: 'none', 
              background: 'transparent', 
              color: tab === i ? '#00b4a0' : '#64748b', 
              fontWeight: tab === i ? 700 : 500, 
              cursor: 'pointer', 
              fontSize: '.9rem',
              borderBottom: tab === i ? '3px solid #00b4a0' : '3px solid transparent',
              transition: 'all 0.2s'
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === 0 && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={s.h2}>Hospital Profile</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>HOSPITAL LOGO</div>
                <div style={{ border: '1px dashed #cbd5e1', borderRadius: 8, padding: 8, background: '#f8fafc' }}>
                  {profile.logo_url ? (
                    <img src={profile.logo_url} alt="Logo" style={{ height: 50, borderRadius: 4 }} />
                  ) : (
                    <div style={{ width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 20 }}>🏥</div>
                  )}
                </div>
              </div>
              <button onClick={() => alert('Logo upload feature: This logo will be reflected on all documents and invoices.')} style={s.btnSec}>Update Logo</button>
            </div>
          </div>
          <div style={s.grid3}>
            {[['Hospital Name', 'hospital_name'], ['Phone', 'phone'], ['Email', 'email'], ['Address', 'address'], ['Working Days', 'working_days'], ['Working Hours', 'working_hours'], ['Timezone', 'timezone'], ['Currency', 'currency']].map(([l, k]) => (
              <div key={k} style={s.fg}><label style={s.label}>{l}</label><input value={profile[k] || ''} onChange={e => setProfile({ ...profile, [k]: e.target.value })} style={s.input} /></div>
            ))}
          </div>
          <div style={{ marginTop: 24 }}>
            <button onClick={async () => {
              setLoading(true);
              try {
                await api('/admin/hospital-profile', { method: 'POST', body: JSON.stringify(profile) });
                setMsg('Profile updated successfully');
              } catch (e) { setMsg(e.message); } finally { setLoading(false); }
            }} disabled={loading} style={s.btnPri}>{loading ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      )}

      {/* Organization Tab */}
      {tab === 1 && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: '#f8fafc', padding: 4, borderRadius: 8, width: 'fit-content' }}>
            {ORG_TABS.map((t, i) => (
              <button key={t} onClick={() => { setOrgSubTab(i); setShowForm(false); setForm({}); }}
                style={{ 
                  padding: '.5rem 1rem', 
                  borderRadius: 6, 
                  border: orgSubTab === i ? '1px solid #e2e8f0' : '1px solid transparent', 
                  background: orgSubTab === i ? '#fff' : 'transparent', 
                  color: orgSubTab === i ? '#0f1f3d' : '#64748b', 
                  fontWeight: orgSubTab === i ? 600 : 500, 
                  cursor: 'pointer', 
                  fontSize: '.8rem',
                  boxShadow: orgSubTab === i ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                }}>
                {t}
              </button>
            ))}
          </div>

          {/* Branches */}
          {orgSubTab === 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={() => { setShowForm(true); setForm({}); }} style={s.btnPri}>+ Add Branch</button>
              </div>
              {showForm && (
                <div style={{ ...s.card, marginBottom: 16, borderLeft: '4px solid #00b4a0' }}>
                  <div style={s.grid3}>
                    {[['Branch Name', 'branch_name'], ['City', 'city'], ['Phone', 'phone'], ['Address', 'address'], ['Email', 'email']].map(([l, k]) => (
                      <div key={k} style={s.fg}><label style={s.label}>{l}</label><input value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} style={s.input} /></div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}><button onClick={async () => {
                    try {
                      await api('/admin/branches', { method: 'POST', body: JSON.stringify(form) });
                      setMsg('Branch created'); setShowForm(false); setForm({});
                      await loadAll();
                    } catch (e) { setMsg(e.message); }
                  }} style={s.btnPri}>Create</button><button onClick={() => setShowForm(false)} style={s.btnSec}>Cancel</button></div>
                </div>
              )}
              <div style={s.card}>
                <table style={s.table}>
                  <thead><tr>{['Branch Name', 'City', 'Phone', 'Status'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {branches.map(b => (
                      <tr key={b.id}>
                        <td style={s.td}><strong>{b.branch_name}</strong></td>
                        <td style={s.td}>{b.city || '–'}</td>
                        <td style={s.td}>{b.phone || '–'}</td>
                        <td style={s.td}><span style={{ background: b.is_active ? '#f0fdf4' : '#f1f5f9', color: b.is_active ? '#065f46' : '#94a3b8', padding: '2px 8px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>{b.is_active ? 'Active' : 'Inactive'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Departments */}
          {orgSubTab === 1 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={() => { setShowForm(true); setForm({}); }} style={s.btnPri}>+ Add Department</button>
              </div>
              {showForm && (
                <div style={{ ...s.card, marginBottom: 16, borderLeft: '4px solid #00b4a0' }}>
                  <div style={s.grid3}>
                    {[['Department Name', 'department_name'], ['Code', 'department_code'], ['Default Fee (₹)', 'default_consultation_fee'], ['Department Type', 'department_type']].map(([l, k]) => (
                      <div key={k} style={s.fg}><label style={s.label}>{l}</label><input value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} style={s.input} /></div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}><button onClick={async () => {
                    try {
                      await api('/admin/departments', { method: 'POST', body: JSON.stringify(form) });
                      setMsg('Department created'); setShowForm(false); setForm({});
                      await loadAll();
                    } catch (e) { setMsg(e.message); }
                  }} style={s.btnPri}>Create</button><button onClick={() => setShowForm(false)} style={s.btnSec}>Cancel</button></div>
                </div>
              )}
              <div style={s.card}>
                <table style={s.table}>
                  <thead><tr>{['Department', 'Code', 'Type', 'Default Fee', 'Status', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {departments.map(d => (
                      <tr key={d.id}>
                        <td style={s.td}><strong>{d.department_name}</strong></td>
                        <td style={s.td}>{d.department_code}</td>
                        <td style={s.td}>{d.department_type || '–'}</td>
                        <td style={s.td}>{d.default_consultation_fee ? `₹${d.default_consultation_fee}` : '–'}</td>
                        <td style={s.td}><span style={{ background: d.is_active ? '#f0fdf4' : '#fef2f2', color: d.is_active ? '#065f46' : '#dc2626', padding: '2px 8px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>{d.is_active ? 'Active' : 'Inactive'}</span></td>
                        <td style={s.td}><button onClick={async () => {
                          try { await api(`/admin/departments/${d.id}/toggle`, { method: 'PATCH' }); await loadAll(); }
                          catch (e) { setMsg(e.message); }
                        }} style={s.actBtn}>{d.is_active ? 'Deactivate' : 'Activate'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Room Management */}
          {orgSubTab === 2 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={() => { setShowForm(true); setForm({}); }} style={s.btnPri}>+ Add Room</button>
              </div>
              {showForm && (
                <div style={{ ...s.card, marginBottom: 16, borderLeft: '4px solid #00b4a0' }}>
                  <div style={s.grid3}>
                    {[['Room Name', 'room_name'], ['Room Type', 'room_type'], ['Total Beds', 'total_beds']].map(([l, k]) => (
                      <div key={k} style={s.fg}>
                        <label style={s.label}>{l}</label>
                        <input 
                          type={k === 'total_beds' ? 'number' : 'text'} 
                          value={form[k] || ''} 
                          onChange={e => setForm({ ...form, [k]: e.target.value })} 
                          style={s.input} 
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={async () => {
                      try {
                        await api('/admin/rooms', { method: 'POST', body: JSON.stringify({ ...form, total_beds: parseInt(form.total_beds || 1), available_beds: parseInt(form.total_beds || 1) }) });
                        setMsg('Room created'); setShowForm(false); setForm({});
                        await loadAll();
                      } catch (e) { setMsg(e.message); }
                    }} style={s.btnPri}>Create</button>
                    <button onClick={() => setShowForm(false)} style={s.btnSec}>Cancel</button>
                  </div>
                </div>
              )}
              <div style={s.card}>
                <table style={s.table}>
                  <thead><tr>{['Room Name', 'Type', 'Total Beds', 'Available', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {rooms.map(r => (
                      <tr key={r.id}>
                        <td style={s.td}><strong>{r.room_name}</strong></td>
                        <td style={s.td}>{r.room_type || 'General'}</td>
                        <td style={s.td}>{r.total_beds}</td>
                        <td style={s.td}>{r.available_beds}</td>
                        <td style={s.td}>
                          <button onClick={async () => {
                            if (!confirm('Delete this room?')) return;
                            try { await api(`/admin/rooms/${r.id}`, { method: 'DELETE' }); await loadAll(); }
                            catch (e) { setMsg(e.message); }
                          }} style={{ ...s.actBtn, color: '#dc2626' }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                    {rooms.length === 0 && (
                      <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No rooms added yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lab Tests */}
          {orgSubTab === 3 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={() => { setShowForm(true); setEditingLabTest(null); setLabTestForm({ test_name: '', test_code: '', category: '', fee: '', description: '' }); }} style={s.btnPri}>+ Add Lab Test</button>
              </div>
              {showForm && (
                <div style={{ ...s.card, marginBottom: 16, borderLeft: '4px solid #00b4a0' }}>
                  <h2 style={s.h2}>{editingLabTest ? 'Edit Lab Test' : 'Add New Lab Test'}</h2>
                  <div style={s.grid3}>
                    {[['Test Name *', 'test_name'], ['Test Code', 'test_code'], ['Category', 'category']].map(([l, k]) => (
                      <div key={k} style={s.fg}><label style={s.label}>{l}</label><input value={labTestForm[k] || ''} onChange={e => setLabTestForm({ ...labTestForm, [k]: e.target.value })} style={s.input} /></div>
                    ))}
                    <div style={s.fg}><label style={s.label}>Fee (INR) *</label><input type="number" value={labTestForm.fee || ''} onChange={e => setLabTestForm({ ...labTestForm, fee: e.target.value })} style={s.input} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}><button onClick={async () => {
                    try {
                      if (editingLabTest) await api(`/admin/lab-tests/${editingLabTest.id}`, { method: 'PUT', body: JSON.stringify(labTestForm) });
                      else await api('/admin/lab-tests', { method: 'POST', body: JSON.stringify(labTestForm) });
                      setMsg('Lab test saved'); setShowForm(false); await loadAll();
                    } catch (e) { setMsg(e.message); }
                  }} style={s.btnPri}>Save</button><button onClick={() => setShowForm(false)} style={s.btnSec}>Cancel</button></div>
                </div>
              )}
              <div style={s.card}>
                <table style={s.table}>
                  <thead><tr>{['Name', 'Code', 'Category', 'Fee', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {labTests.map(t => (
                      <tr key={t.id}>
                        <td style={s.td}><strong>{t.test_name}</strong></td>
                        <td style={s.td}>{t.test_code}</td>
                        <td style={s.td}>{t.category}</td>
                        <td style={s.td}>₹{t.fee}</td>
                        <td style={s.td}>
                          <button onClick={() => { setEditingLabTest(t); setLabTestForm(t); setShowForm(true); }} style={s.actBtn}>Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Specializations */}
          {orgSubTab === 4 && (
            <div style={s.card}>
              <h2 style={s.h2}>Specializations</h2>
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <input value={specName} onChange={e => setSpecName(e.target.value)} placeholder="Add new (e.g. Cardiology)" style={{ ...s.input, flex: 1 }} />
                <button onClick={async () => {
                  if (!specName) return;
                  try { await api('/admin/specializations', { method: 'POST', body: JSON.stringify({ name: specName }) }); setSpecName(''); await loadAll(); }
                  catch (e) { setMsg(e.message); }
                }} style={s.btnPri}>Add</button>
              </div>
              <table style={s.table}>
                <thead><tr>{['Name', 'Status', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {specializations.map(sp => (
                    <tr key={sp.id}>
                      <td style={s.td}><strong>{sp.name}</strong></td>
                      <td style={s.td}><span style={{ color: sp.is_active ? '#059669' : '#94a3b8' }}>{sp.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td style={s.td}>
                        <button onClick={async () => {
                          try { await api(`/admin/specializations/${sp.id}/toggle`, { method: 'PATCH' }); await loadAll(); }
                          catch (e) { setMsg(e.message); }
                        }} style={s.actBtn}>{sp.is_active ? 'Deactivate' : 'Activate'}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* User Management Tab */}
      {tab === 2 && (
        <div>
          {/* Highlighted Information */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ ...s.card, padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Total Users</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f1f3d' }}>{users.length}</div>
            </div>
            <div style={{ ...s.card, padding: '1.25rem', textAlign: 'center', borderLeft: '4px solid #00b4a0' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#00b4a0', textTransform: 'uppercase', marginBottom: 8 }}>Doctors</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f1f3d' }}>{users.filter(u => u.role_id === 2).length}</div>
            </div>
            <div style={{ ...s.card, padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Active Staff</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f1f3d' }}>{users.filter(u => u.is_active && u.role_id !== 2).length}</div>
            </div>
            <div style={{ ...s.card, padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Locked</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#dc2626' }}>{users.filter(u => !u.is_active).length}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={() => { setShowForm(true); setForm({ role_id: 5 }); setEditingUser(null); }} style={s.btnPri}>+ Add User</button>
          </div>
          {showForm && (
            <div style={{ ...s.card, marginBottom: 16, borderLeft: '4px solid #00b4a0' }}>
              <h2 style={s.h2}>{editingUser ? 'Edit User' : 'New User'}</h2>
              <div style={s.grid3}>
                {[['First Name', 'first_name'], ['Last Name', 'last_name'], ['Email', 'email'], ['Phone', 'phone'], ['Password', 'password']].map(([l, k]) => (
                  <div key={k} style={s.fg}><label style={s.label}>{l}</label><input type={k === 'password' ? 'password' : 'text'} value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} style={s.input} /></div>
                ))}
              </div>
              <div style={{ ...s.fg, marginTop: 4 }}>
                <label style={s.label}>Assign Roles <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {ROLE_OPTIONS.map(r => {
                    const selected = Array.isArray(form.roles) ? form.roles : [form.role_id].filter(Boolean);
                    const checked = selected.includes(r.value);
                    return (
                      <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 14px', border: `1.5px solid ${checked ? '#00b4a0' : '#e2e8f0'}`, borderRadius: 8, background: checked ? '#f0fdfb' : '#fff', fontSize: 13, fontWeight: checked ? 600 : 500, color: checked ? '#00b4a0' : '#475569', userSelect: 'none' }}>
                        <input type="checkbox" checked={checked} style={{ accentColor: '#00b4a0' }} onChange={e => {
                          const current = Array.isArray(form.roles) ? form.roles : [form.role_id].filter(Boolean);
                          const updated = e.target.checked ? [...current, r.value] : current.filter(x => x !== r.value);
                          setForm({ ...form, roles: updated, role_id: updated[0] || r.value });
                        }} />
                        {r.label}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
                <button onClick={async () => {
                  try {
                    if (editingUser) await api(`/admin/users/${editingUser.id}`, { method: 'PUT', body: JSON.stringify(form) });
                    else await api('/admin/users', { method: 'POST', body: JSON.stringify(form) });
                    setMsg('User saved'); setShowForm(false); await loadAll();
                  } catch (e) { setMsg(e.message); }
                }} style={s.btnPri}>Save</button>
                <button onClick={() => setShowForm(false)} style={s.btnSec}>Cancel</button>
              </div>
            </div>
          )}
          <div style={s.card}>
            <table style={s.table}>
              <thead><tr>{['Name', 'Email', 'Role(s)', 'Status', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {users.map(u => {
                  const userRoles = Array.isArray(u.roles) && u.roles.length ? u.roles : [u.role_id].filter(Boolean);
                  return (
                    <tr key={u.id}>
                      <td style={s.td}><strong>{u.first_name} {u.last_name}</strong></td>
                      <td style={s.td}>{u.email}</td>
                      <td style={s.td}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {userRoles.map(rid => (
                            <span key={rid} style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>
                              {ROLE_OPTIONS.find(r => r.value === rid)?.label || 'Staff'}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={s.td}>
                        <span style={{ background: u.is_active ? '#f0fdf4' : '#fef2f2', color: u.is_active ? '#065f46' : '#dc2626', padding: '2px 8px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>
                          {u.is_active ? 'Active' : 'Locked'}
                        </span>
                      </td>
                      <td style={s.td}>
                        <button onClick={() => {
                          setEditingUser(u);
                          setForm({ ...u, password: '', roles: Array.isArray(u.roles) && u.roles.length ? u.roles : [u.role_id].filter(Boolean) });
                          setShowForm(true);
                        }} style={s.actBtn}>Edit</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Role Permissions Guide */}
          <RolePermissionsGuide />
        </div>
      )}

      {/* Subscription Tab */}
      {tab === 3 && <SubscriptionTab />}

      {/* Audit Logs Tab */}
      {tab === 4 && <AuditLogView />}

      {apptBlockUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', width: 'min(560px, 96vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.2)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#0f1f3d' }}>Cannot Delete User</h3>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 14 }}>
              <strong>{apptBlockUser.user.first_name} {apptBlockUser.user.last_name}</strong> is a doctor with active appointments. Cancel them first.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setApptBlockUser(null)} style={s.btnSec}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditLogView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api('/audit?limit=20');
      setLogs(data.logs || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={s.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={s.h2}>Audit Logs</h2>
        <button onClick={load} style={s.btnSec}>↻ Refresh</button>
      </div>
      {loading ? <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading logs...</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead><tr>{['Timestamp', 'Performed By', 'Action', 'Module', 'IP Address'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={s.td}>{new Date(log.created_at).toLocaleString()}</td>
                  <td style={s.td}><strong>{log.role_name}</strong></td>
                  <td style={s.td}><span style={{ color: '#0f1f3d', fontWeight: 500 }}>{log.action}</span></td>
                  <td style={s.td}><span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: '.7rem' }}>{log.module}</span></td>
                  <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '.75rem', color: '#64748b' }}>{log.ip_address || '—'}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No activity logs found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const s = {
  page: { padding: '2rem', maxWidth: 1300, margin: '0 auto' },
  h1: { fontSize: '1.75rem', fontWeight: 800, color: '#0f1f3d', marginBottom: 24, letterSpacing: '-0.02em' },
  h2: { fontSize: '1.1rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  card: { background: '#fff', borderRadius: 14, padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 },
  fg: { display: 'flex', flexDirection: 'column' },
  label: { fontSize: '.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.02em' },
  input: { width: '100%', padding: '.65rem .9rem', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#f8fafc', color: '#1e293b', fontSize: '.9rem', boxSizing: 'border-box', transition: 'all 0.2s', outline: 'none', ':focus': { borderColor: '#00b4a0', background: '#fff', boxShadow: '0 0 0 3px rgba(0,180,160,0.1)' } },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '12px 14px', background: '#f8fafc', fontSize: '.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '14px 14px', borderBottom: '1px solid #f1f5f9', fontSize: '.85rem', color: '#334155' },
  info: { background: '#f0fdfb', border: '1px solid #ccfbf1', color: '#0f766e', borderRadius: 10, padding: '.85rem 1.25rem', fontSize: '.875rem', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 500 },
  btnPri: { padding: '.75rem 1.5rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '.9rem', boxShadow: '0 2px 4px rgba(0,180,160,0.2)', transition: 'all 0.2s' },
  btnSec: { padding: '.65rem 1.25rem', background: '#fff', color: '#0f1f3d', border: '1px solid #e2e8f0', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: '.85rem', transition: 'all 0.2s' },
  actBtn: { padding: '5px 12px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: '.75rem', fontWeight: 600, transition: 'all 0.2s' },
};
