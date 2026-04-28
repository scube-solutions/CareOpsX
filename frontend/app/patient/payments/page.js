'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

function TopNav() {
  return (
    <nav style={{ background: '#0f1f3d', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
      <a href="/patient/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #1e3f85 0%, #13cfbd 100%)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
            <rect x="10.5" y="4" width="3" height="16" rx="1.5" fill="white"/>
            <rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="white"/>
          </svg>
        </div>
        <span style={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>Care<span style={{ color: '#00b4a0' }}>OpsX</span></span>
      </a>
      <a href="/patient/dashboard" style={{ marginLeft: 'auto', fontSize: '.8rem', color: 'rgba(255,255,255,.6)', textDecoration: 'none' }}>← Dashboard</a>
    </nav>
  );
}

const TYPE_META = {
  consultation: { label: 'Consultation',  color: '#1d4ed8', bg: '#eff6ff' },
  pharmacy:     { label: 'Pharmacy',       color: '#0f766e', bg: '#f0fdfb' },
  lab:          { label: 'Lab',            color: '#7c3aed', bg: '#f5f3ff' },
  other:        { label: 'Other',          color: '#64748b', bg: '#f1f5f9' },
};

const STATUS_META = {
  paid:       { label: 'Paid',       color: '#166534', bg: '#f0fdf4' },
  pending:    { label: 'Pending',    color: '#92400e', bg: '#fffbeb' },
  partial:    { label: 'Partial',    color: '#1d4ed8', bg: '#eff6ff' },
  dispensed:  { label: 'Dispensed', color: '#166534', bg: '#f0fdf4' },
  cancelled:  { label: 'Cancelled', color: '#b91c1c', bg: '#fef2f2' },
  refunded:   { label: 'Refunded',  color: '#7c3aed', bg: '#f5f3ff' },
};

export default function PatientPaymentsPage() {
  const [records,  setRecords]  = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all'); // all | consultation | pharmacy | lab

  useEffect(() => {
    Promise.all([
      api('/billing/invoices/my').catch(() => ({ invoices: [] })),
      api('/pharmacy/invoices/my').catch(() => ({ invoices: [] })),
    ]).then(([bill, pharm]) => {
      const billing = (bill.invoices || []).map(inv => ({
        id:          `B-${inv.id}`,
        raw_id:      inv.id,
        source:      'billing',
        type:        inv.invoice_type || 'consultation',
        amount:      Number(inv.total_amount || 0),
        paid:        Number(inv.paid_amount || 0),
        balance:     Number(inv.balance_amount || 0),
        status:      inv.status || 'pending',
        date:        inv.created_at,
        invoice_no:  inv.invoice_number || `INV-${inv.id}`,
        payment_mode: (inv.payments?.[0]?.payment_mode) || null,
        items:       inv.invoice_items || [],
        notes:       inv.notes || null,
      }));

      const pharmacy = (pharm.invoices || []).map(inv => ({
        id:          `P-${inv.id}`,
        raw_id:      inv.id,
        source:      'pharmacy',
        type:        'pharmacy',
        amount:      Number(inv.total_amount || 0),
        paid:        Number(inv.total_amount || 0),
        balance:     0,
        status:      inv.status || 'pending',
        date:        inv.created_at,
        invoice_no:  `PH-${inv.id}`,
        payment_mode: inv.payment_mode || null,
        items:       (inv.pharmacy_invoice_items || []).map(i => ({
          description: i.medicine_name,
          quantity:    i.quantity,
          unit_price:  Number(i.unit_price),
          amount:      Number(i.total_price),
        })),
        notes:       inv.notes || null,
      }));

      const all = [...billing, ...pharmacy].sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecords(all);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? records : records.filter(r => r.type === filter);

  const totalPaid = records.filter(r => ['paid','dispensed'].includes(r.status)).reduce((s, r) => s + r.paid, 0);
  const totalDue  = records.reduce((s, r) => s + (r.balance || 0), 0);

  const printInvoice = (rec) => {
    const rows = rec.items.map(i =>
      `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${i.description || i.medicine_name || ''}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${i.quantity || 1}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">₹${Number(i.unit_price || i.unit_rate || 0).toFixed(2)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">₹${Number(i.amount || i.total_price || 0).toFixed(2)}</td></tr>`
    ).join('');
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>${rec.invoice_no}</title><style>body{font-family:sans-serif;padding:32px;color:#1e293b}table{width:100%;border-collapse:collapse}th{background:#f8fafc;padding:8px 10px;text-align:left;font-size:.75rem;text-transform:uppercase;color:#64748b}</style></head><body>
      <div style="display:flex;justify-content:space-between;margin-bottom:24px">
        <div><h2 style="margin:0;color:#0f1f3d">CareOpsX</h2><div style="font-size:.75rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em">${TYPE_META[rec.type]?.label || rec.type} Invoice</div></div>
        <div style="text-align:right"><div style="font-size:1.1rem;font-weight:700">${rec.invoice_no}</div><div style="font-size:.8rem;color:#64748b">${new Date(rec.date).toLocaleDateString('en-IN',{year:'numeric',month:'long',day:'numeric'})}</div></div>
      </div>
      <table style="margin-bottom:20px"><thead><tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="text-align:right;border-top:2px solid #e2e8f0;padding-top:12px">
        <div style="font-weight:700;font-size:1.1rem">Total: ₹${rec.amount.toFixed(2)}</div>
        <div style="color:#166534;font-size:.875rem;margin-top:4px">Paid: ₹${rec.paid.toFixed(2)}</div>
        ${rec.balance > 0 ? `<div style="color:#b91c1c;font-size:.875rem">Balance Due: ₹${rec.balance.toFixed(2)}</div>` : ''}
        ${rec.payment_mode ? `<div style="color:#64748b;font-size:.8rem;margin-top:4px">Payment: ${rec.payment_mode}</div>` : ''}
      </div>
      <script>window.onload=()=>{window.print();}<\/script></body></html>`);
    w.document.close();
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f8fc' }}>
      <TopNav />
      <div style={s.center}>Loading…</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f5f8fc' }}>
      <TopNav />
      <div style={s.page}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={s.h1}>Payment History</h1>
          <p style={s.sub}>{records.length} record{records.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Paid',     value: `₹${totalPaid.toFixed(2)}`,  color: '#0f766e', bg: '#f0fdfb', border: '#99f6e4' },
            { label: 'Balance Due',    value: `₹${totalDue.toFixed(2)}`,   color: totalDue > 0 ? '#b91c1c' : '#0f766e', bg: totalDue > 0 ? '#fef2f2' : '#f0fdf4', border: totalDue > 0 ? '#fecaca' : '#bbf7d0' },
            { label: 'Total Records',  value: records.length,              color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
          ].map(c => (
            <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: '1.2rem 1.5rem' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
              <div style={{ fontSize: '.8rem', color: '#64748b', marginTop: 6, fontWeight: 600 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', width: 'fit-content' }}>
          {[['all','All'],['consultation','Consultation'],['pharmacy','Pharmacy'],['lab','Lab']].map(([key, label]) => (
            <button key={key} onClick={() => { setFilter(key); setSelected(null); }}
              style={{ padding: '8px 18px', background: filter === key ? '#0f1f3d' : '#f8fafc', color: filter === key ? '#fff' : '#64748b', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '.82rem' }}>
              {label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ ...s.card, textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
            <p style={{ color: '#64748b' }}>No payment records in this category.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 20 }}>
            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(rec => {
                const typeMeta   = TYPE_META[rec.type]   || TYPE_META.other;
                const statusMeta = STATUS_META[rec.status] || STATUS_META.pending;
                const isSelected = selected?.id === rec.id;
                return (
                  <div key={rec.id} onClick={() => setSelected(isSelected ? null : rec)}
                    style={{ ...s.card, cursor: 'pointer', borderLeft: `4px solid ${isSelected ? '#00b4a0' : 'transparent'}`, background: isSelected ? '#f0fdfb' : '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ background: typeMeta.bg, color: typeMeta.color, padding: '2px 8px', borderRadius: 6, fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase' }}>{typeMeta.label}</span>
                            <span style={{ background: statusMeta.bg, color: statusMeta.color, padding: '2px 8px', borderRadius: 6, fontSize: '.72rem', fontWeight: 600 }}>{statusMeta.label}</span>
                          </div>
                          <div style={{ fontWeight: 700, color: '#0f1f3d', fontSize: '.9rem' }}>{rec.invoice_no}</div>
                          <div style={{ fontSize: '.78rem', color: '#64748b', marginTop: 2 }}>{new Date(rec.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                          {rec.payment_mode && <div style={{ fontSize: '.75rem', color: '#475569', marginTop: 2 }}>💳 {rec.payment_mode}</div>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f1f3d' }}>₹{rec.amount.toFixed(2)}</div>
                        {rec.paid > 0 && rec.paid < rec.amount && (
                          <div style={{ fontSize: '.75rem', color: '#0f766e' }}>Paid: ₹{rec.paid.toFixed(2)}</div>
                        )}
                        {rec.balance > 0 && (
                          <div style={{ fontSize: '.75rem', color: '#b91c1c', fontWeight: 600 }}>Due: ₹{rec.balance.toFixed(2)}</div>
                        )}
                      </div>
                    </div>
                    {rec.items.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {rec.items.slice(0, 4).map((item, i) => (
                          <span key={i} style={{ background: '#f1f5f9', color: '#475569', borderRadius: 5, padding: '1px 8px', fontSize: '.72rem' }}>
                            {item.description || item.medicine_name || item.test_name || ''}
                          </span>
                        ))}
                        {rec.items.length > 4 && <span style={{ fontSize: '.72rem', color: '#94a3b8' }}>+{rec.items.length - 4} more</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Detail panel */}
            {selected && (
              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h2 style={s.h2}>Invoice Details</h2>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => printInvoice(selected)} style={{ background: '#0f1f3d', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer' }}>🖨 Print</button>
                    <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                  </div>
                </div>

                {/* Meta */}
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: '#0f1f3d', fontSize: '.875rem' }}>{selected.invoice_no}</span>
                    <span style={{ background: (TYPE_META[selected.type]||TYPE_META.other).bg, color: (TYPE_META[selected.type]||TYPE_META.other).color, padding: '1px 8px', borderRadius: 6, fontSize: '.72rem', fontWeight: 700 }}>{(TYPE_META[selected.type]||TYPE_META.other).label}</span>
                  </div>
                  <div style={{ fontSize: '.78rem', color: '#64748b' }}>{new Date(selected.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  {selected.payment_mode && <div style={{ fontSize: '.75rem', color: '#475569', marginTop: 4 }}>Payment: {selected.payment_mode}</div>}
                </div>

                {/* Items */}
                {selected.items.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Items</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {selected.items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#f8fafc', borderRadius: 7, border: '1px solid #e2e8f0' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '.83rem', color: '#0f1f3d' }}>{item.description || item.medicine_name || ''}</div>
                            {item.quantity > 1 && <div style={{ fontSize: '.72rem', color: '#64748b' }}>Qty: {item.quantity} × ₹{Number(item.unit_price || item.unit_rate || 0).toFixed(2)}</div>}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '.875rem', color: '#0f1f3d' }}>₹{Number(item.amount || item.total_price || 0).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Totals */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '.875rem', color: '#64748b' }}><span>Total Amount</span><span>₹{selected.amount.toFixed(2)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '.875rem', color: '#0f766e', fontWeight: 600 }}><span>Paid</span><span>₹{selected.paid.toFixed(2)}</span></div>
                  {selected.balance > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '.875rem', color: '#b91c1c', fontWeight: 700 }}><span>Balance Due</span><span>₹{selected.balance.toFixed(2)}</span></div>
                  )}
                  {selected.notes && (
                    <div style={{ marginTop: 10, padding: '8px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, fontSize: '.8rem', color: '#92400e' }}>
                      <strong>Note:</strong> {selected.notes}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  page:  { padding: '2rem', maxWidth: 1100, margin: '0 auto' },
  center:{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#64748b' },
  h1:    { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2:    { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', margin: 0 },
  sub:   { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  card:  { background: '#fff', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
};
