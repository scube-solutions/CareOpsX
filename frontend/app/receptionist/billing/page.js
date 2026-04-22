'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

const PAY_MODES = [
  { key: 'cash', label: '💵 Cash',       sub: 'Collect at counter', available: true  },
  { key: 'upi',  label: '📱 UPI',        sub: 'Coming soon',        available: false },
  { key: 'card', label: '💳 Card Swipe', sub: 'Coming soon',        available: false },
];

export default function ReceptionistBillingPage() {
  const [tab, setTab] = useState('collect');

  // Patient search
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [patient, setPatient] = useState(null);

  // Payment type
  const [payType, setPayType] = useState('consultation');

  // Consultation
  const [consultFee, setConsultFee] = useState('');
  const [consultNotes, setConsultNotes] = useState('');

  // Lab
  const [labOrders, setLabOrders] = useState([]);
  const [labOrder, setLabOrder] = useState(null);
  const [labFee, setLabFee] = useState('');

  // Payment
  const [payMode, setPayMode] = useState('');

  // History
  const [invoices, setInvoices] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('');
  const [loadingHist, setLoadingHist] = useState(false);

  const [msg, setMsg] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);

  const loadHistory = useCallback(async () => {
    setLoadingHist(true);
    try {
      const q = historyFilter ? `?invoice_type=${historyFilter}` : '';
      const d = await api(`/billing/reception-payments${q}`);
      setInvoices(d.invoices || []);
    } catch (e) { console.error(e); }
    finally { setLoadingHist(false); }
  }, [historyFilter]);

  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab, loadHistory]);

  const searchPatients = async () => {
    if (!patientQuery.trim()) return;
    const d = await api(`/patients?search=${encodeURIComponent(patientQuery)}&limit=6`);
    setPatientResults(d.patients || []);
  };

  const selectPatient = async (p) => {
    setPatient(p); setPatientResults([]); setPatientQuery('');
    setLabOrder(null); setLabFee(''); setPayMode(''); setConsultFee(''); setConsultNotes('');
    setMsg({ type: '', text: '' });
    try {
      const d = await api(`/lab/orders?patient_id=${p.id}`);
      setLabOrders((d.lab_orders || []).filter(o => o.payment_status !== 'paid'));
    } catch { setLabOrders([]); }
  };

  const pickLabOrder = (o) => {
    setLabOrder(o);
    setLabFee(o.test_fee ? String(o.test_fee) : '');
  };

  const collectPayment = async () => {
    if (!patient)  { setMsg({ type: 'error', text: 'Select a patient' }); return; }
    if (!payMode)  { setMsg({ type: 'error', text: 'Select a payment method' }); return; }
    const amount = parseFloat(payType === 'consultation' ? consultFee : labFee);
    if (!amount || amount <= 0) { setMsg({ type: 'error', text: 'Enter a valid fee amount' }); return; }

    setSaving(true); setMsg({ type: '', text: '' });
    try {
      const inv = await api('/billing/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patient_id:    patient.id,
          invoice_type:  payType,
          payment_mode:  payMode,
          ...(payType === 'consultation'
            ? { consultation_fee: amount, notes: consultNotes || null }
            : { test_amount: amount, notes: labOrder ? `Lab test: ${labOrder.test_name}` : null }),
        }),
      });

      if (payType === 'lab' && labOrder) {
        await api(`/lab/orders/${labOrder.id}/payment`, {
          method: 'PATCH',
          body: JSON.stringify({ payment_status: 'paid', payment_source: 'reception', payment_amount: amount }),
        });
        if (labOrder.status === 'ordered') {
          await api(`/lab/orders/${labOrder.id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'sample_collected' }),
          });
        }
      }

      setSuccess({ invoice: inv.invoice, amount, payType, patient });
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Failed to record payment' });
    } finally { setSaving(false); }
  };

  const reset = () => {
    setPatient(null); setPatientQuery(''); setPatientResults([]);
    setPayType('consultation'); setConsultFee(''); setConsultNotes('');
    setLabOrders([]); setLabOrder(null); setLabFee('');
    setPayMode(''); setSuccess(null); setMsg({ type: '', text: '' });
  };

  /* ── Success screen ── */
  if (success) return (
    <div style={s.page}>
      <div style={{ ...s.card, maxWidth: 460, margin: '0 auto', textAlign: 'center', padding: '2.5rem' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
        <h2 style={{ color: '#065f46', margin: '0 0 6px' }}>Payment Collected</h2>
        <p style={{ color: '#64748b', margin: '0 0 4px', fontSize: '.875rem' }}>Invoice #{success.invoice?.invoice_number}</p>
        <p style={{ color: '#64748b', margin: '0 0 18px', fontSize: '.875rem' }}>
          {success.patient.first_name} {success.patient.last_name} — {success.payType === 'consultation' ? 'Consultation Fee' : 'Lab Test Fee'}
        </p>
        <div style={{ fontWeight: 800, fontSize: '2rem', color: '#0f1f3d', marginBottom: 24 }}>₹{success.amount.toFixed(2)}</div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={reset} style={s.btnPri}>+ New Payment</button>
          <button onClick={() => { setSuccess(null); setTab('history'); }} style={s.btnSec}>View History</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.h1}>Reception Payments</h1>
          <p style={s.sub}>Collect consultation fees and lab test payments</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', width: 'fit-content' }}>
        {[['collect', '💰 Collect Payment'], ['history', '📋 Payment History']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: '9px 22px', background: tab === k ? '#0f1f3d' : '#f8fafc', color: tab === k ? '#fff' : '#64748b', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '.85rem' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── COLLECT TAB ── */}
      {tab === 'collect' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Patient search */}
            <div style={s.card}>
              <h2 style={s.h2}>Patient</h2>
              {patient ? (
                <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontWeight: 700 }}>{patient.first_name} {patient.last_name}</div>
                  <div style={{ fontSize: '.78rem', color: '#065f46', marginTop: 2 }}>{patient.patient_uid} • {patient.phone}</div>
                  <button onClick={reset} style={{ marginTop: 6, fontSize: '.73rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>× Change patient</button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input value={patientQuery} onChange={e => setPatientQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && searchPatients()}
                      placeholder="Name or phone..." style={{ ...s.input, flex: 1 }} />
                    <button onClick={searchPatients} style={s.btnSm}>Go</button>
                  </div>
                  {patientResults.map(p => (
                    <div key={p.id} onClick={() => selectPatient(p)}
                      style={{ padding: '8px 10px', cursor: 'pointer', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 4, background: '#f8fafc' }}>
                      <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{p.first_name} {p.last_name}</div>
                      <div style={{ fontSize: '.73rem', color: '#64748b' }}>{p.patient_uid} • {p.phone}</div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Payment type */}
            <div style={s.card}>
              <h2 style={s.h2}>Payment Type</h2>
              {[
                { key: 'consultation', icon: '🩺', label: 'Consultation Fee', sub: 'Appointment / OPD visit' },
                { key: 'lab',         icon: '🧪', label: 'Lab Test Fee',      sub: 'Diagnostic test payment' },
              ].map(t => (
                <button key={t.key}
                  onClick={() => { setPayType(t.key); setPayMode(''); setLabOrder(null); setLabFee(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px',
                    borderRadius: 8, marginBottom: 8, cursor: 'pointer', textAlign: 'left',
                    border: `1.5px solid ${payType === t.key ? '#0f766e' : '#e2e8f0'}`,
                    background: payType === t.key ? '#f0fdfb' : '#f8fafc',
                    color: payType === t.key ? '#065f46' : '#334155' }}>
                  <span style={{ fontSize: 20 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '.85rem' }}>{t.label}</div>
                    <div style={{ fontSize: '.72rem', opacity: .7, marginTop: 1 }}>{t.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div style={s.card}>
            {!patient ? (
              <div style={{ textAlign: 'center', padding: '5rem 2rem', color: '#94a3b8' }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>👤</div>
                Search and select a patient to begin
              </div>
            ) : (
              <>
                <h2 style={s.h2}>{payType === 'consultation' ? '🩺 Consultation Fee Details' : '🧪 Lab Test Payment'}</h2>

                {payType === 'consultation' ? (
                  <>
                    <div style={s.fg}>
                      <label style={s.label}>Consultation Fee (₹) *</label>
                      <input type="number" min="0" placeholder="Enter fee amount" value={consultFee}
                        onChange={e => setConsultFee(e.target.value)} style={s.input} />
                    </div>
                    <div style={{ ...s.fg, marginBottom: 20 }}>
                      <label style={s.label}>Notes <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                      <input placeholder="e.g. OPD visit, follow-up consultation..." value={consultNotes}
                        onChange={e => setConsultNotes(e.target.value)} style={s.input} />
                    </div>
                  </>
                ) : (
                  <>
                    {labOrders.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <label style={s.label}>Pending Lab Orders — select to auto-fill fee</label>
                        {labOrders.map(o => (
                          <button key={o.id} onClick={() => pickLabOrder(o)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
                              padding: '10px 12px', borderRadius: 8, marginBottom: 6, cursor: 'pointer', textAlign: 'left',
                              border: `1.5px solid ${labOrder?.id === o.id ? '#0f766e' : '#e2e8f0'}`,
                              background: labOrder?.id === o.id ? '#f0fdfb' : '#f8fafc' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '.875rem', color: '#0f1f3d' }}>{o.test_name}</div>
                              {o.test_code && <div style={{ fontSize: '.73rem', color: '#64748b' }}>{o.test_code}</div>}
                            </div>
                            <span style={{ fontSize: '.73rem', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                              {o.urgency === 'urgent' ? '⚡ Urgent' : 'Normal'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {labOrders.length === 0 && (
                      <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
                        No pending lab orders found — enter fee manually below.
                      </div>
                    )}
                    <div style={{ ...s.fg, marginBottom: 20 }}>
                      <label style={s.label}>Test Fee (₹) *</label>
                      <input type="number" min="0" placeholder="Enter test fee amount" value={labFee}
                        onChange={e => setLabFee(e.target.value)} style={s.input} />
                    </div>
                  </>
                )}

                {/* Amount summary strip */}
                {((payType === 'consultation' && consultFee) || (payType === 'lab' && labFee)) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f0fdfb', border: '1px solid #99f6e4', borderRadius: 10, marginBottom: 18 }}>
                    <span style={{ fontWeight: 600, color: '#0f766e' }}>Amount to collect</span>
                    <span style={{ fontWeight: 800, fontSize: '1.5rem', color: '#0f766e' }}>
                      ₹{parseFloat(payType === 'consultation' ? (consultFee || 0) : (labFee || 0)).toFixed(2)}
                    </span>
                  </div>
                )}

                {/* Payment method */}
                <label style={s.label}>Payment Method</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                  {PAY_MODES.map(m => (
                    <button key={m.key} onClick={() => m.available && setPayMode(m.key)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '11px 14px', borderRadius: 8, fontWeight: 600, fontSize: '.875rem',
                        cursor: m.available ? 'pointer' : 'not-allowed',
                        border: `1.5px solid ${payMode === m.key ? '#0f766e' : '#e2e8f0'}`,
                        background: !m.available ? '#f8fafc' : payMode === m.key ? '#f0fdfb' : '#fff',
                        color: !m.available ? '#94a3b8' : payMode === m.key ? '#065f46' : '#334155' }}>
                      <span>{m.label}</span>
                      <span style={{ fontSize: '.72rem', opacity: .7 }}>{m.sub}</span>
                    </button>
                  ))}
                </div>

                {msg.text && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 14,
                    background: msg.type === 'error' ? '#fef2f2' : '#f0fdf4',
                    color: msg.type === 'error' ? '#b91c1c' : '#15803d',
                    border: `1px solid ${msg.type === 'error' ? '#fecaca' : '#bbf7d0'}` }}>
                    {msg.text}
                  </div>
                )}

                <button onClick={collectPayment} disabled={saving || !payMode}
                  style={{ ...s.btnPri, width: '100%', opacity: (saving || !payMode) ? .5 : 1, fontSize: '1rem', padding: '13px' }}>
                  {saving ? 'Processing...' : '✓ Confirm & Collect Payment'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div style={s.card}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '.8rem', fontWeight: 600, color: '#64748b' }}>Show:</span>
            {[['', 'All'], ['consultation', '🩺 Consultation'], ['lab', '🧪 Lab']].map(([v, l]) => (
              <button key={v} onClick={() => setHistoryFilter(v)}
                style={{ padding: '5px 14px', borderRadius: 20, fontSize: '.8rem', fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${historyFilter === v ? '#00b4a0' : '#e2e8f0'}`,
                  background: historyFilter === v ? '#00b4a0' : '#fff',
                  color: historyFilter === v ? '#fff' : '#64748b' }}>
                {l}
              </button>
            ))}
            <button onClick={loadHistory} style={{ marginLeft: 'auto', ...s.btnSec }}>↻ Refresh</button>
          </div>

          {loadingHist ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading...</div>
          ) : invoices.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
              No payment records found.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Invoice #', 'Date', 'Patient', 'Type', 'Amount', 'Method', 'Status'].map(h => <th key={h} style={s.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => {
                    const stColor = { paid: ['#dcfce7','#166534'], pending: ['#fef9c3','#92400e'], partial: ['#fef3c7','#b45309'] }[inv.status] || ['#f1f5f9','#64748b'];
                    return (
                      <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={s.td}><span style={{ fontFamily: 'monospace', fontSize: '.78rem', color: '#0f766e', background: '#f0fdfb', padding: '2px 6px', borderRadius: 4 }}>{inv.invoice_number}</span></td>
                        <td style={{ ...s.td, fontSize: '.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(inv.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td style={s.td}>
                          <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{inv.patients?.first_name} {inv.patients?.last_name}</div>
                          <div style={{ fontSize: '.73rem', color: '#64748b' }}>{inv.patients?.patient_uid}</div>
                        </td>
                        <td style={s.td}>
                          <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '.73rem', fontWeight: 600, textTransform: 'capitalize',
                            background: inv.invoice_type === 'consultation' ? '#eff6ff' : '#fef3c7',
                            color:      inv.invoice_type === 'consultation' ? '#1d4ed8' : '#92400e' }}>
                            {inv.invoice_type}
                          </span>
                        </td>
                        <td style={{ ...s.td, fontWeight: 700, color: '#0f1f3d' }}>₹{parseFloat(inv.total_amount || 0).toFixed(2)}</td>
                        <td style={{ ...s.td, fontSize: '.8rem', textTransform: 'uppercase', color: '#475569' }}>{inv.payment_mode || '—'}</td>
                        <td style={s.td}><span style={{ background: stColor[0], color: stColor[1], padding: '2px 10px', borderRadius: 12, fontSize: '.73rem', fontWeight: 600, textTransform: 'capitalize' }}>{inv.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  page:   { padding: '2rem', maxWidth: 1200, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  h1:     { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2:     { fontSize: '.75rem', fontWeight: 700, color: '#0f1f3d', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 14px' },
  sub:    { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  card:   { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  fg:     { marginBottom: 12 },
  label:  { display: 'block', fontSize: '.72rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 },
  input:  { width: '100%', padding: '.65rem .9rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem', boxSizing: 'border-box' },
  table:  { width: '100%', borderCollapse: 'collapse' },
  th:     { textAlign: 'left', padding: '10px 14px', fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0' },
  td:     { padding: '11px 14px', fontSize: '.875rem', color: '#334155' },
  btnPri: { padding: '.7rem 1.5rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem' },
  btnSec: { padding: '.5rem 1rem', background: '#f1f5f9', color: '#0f1f3d', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem' },
  btnSm:  { padding: '.55rem .9rem', background: '#0f1f3d', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem' },
};
