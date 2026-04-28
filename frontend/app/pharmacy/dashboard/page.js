'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function PharmacyDashboardPage() {
  const [inventory, setInventory] = useState([]);
  const [alerts, setAlerts]       = useState({ low_stock: [], expiring_soon: [], expired: [] });
  const [invoices, setInvoices]   = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      api('/pharmacy/inventory?limit=1000'),
      api('/pharmacy/inventory/alerts'),
      api('/pharmacy/invoices?limit=5'),
    ]).then(([inv, alrt, inv2]) => {
      setInventory(inv.inventory || inv.data || []);
      setAlerts({ low_stock: alrt.low_stock || [], expiring_soon: alrt.expiring_soon || [], expired: alrt.expired || [] });
      setInvoices(inv2.invoices || inv2.data || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const totalItems   = inventory.length;
  const totalValue   = inventory.reduce((s, m) => s + Number(m.unit_price || 0) * Number(m.current_stock || 0), 0);
  const lowCount     = alerts.low_stock.length;
  const expiryCount  = alerts.expiring_soon.length + alerts.expired.length;

  const STATUS_STYLE = {
    pending:   { bg: '#fffbeb', text: '#92400e', label: 'Pending' },
    dispensed: { bg: '#f0fdf4', text: '#166534', label: 'Dispensed' },
    cancelled: { bg: '#fef2f2', text: '#b91c1c', label: 'Cancelled' },
  };

  if (loading) return <div style={s.center}>Loading…</div>;

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={s.h1}>Pharmacy Dashboard</h1>
        <p style={s.sub}>Inventory overview and recent activity</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Medicines',  value: totalItems,                    color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Inventory Value',  value: `₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: '#0f766e', bg: '#f0fdfb' },
          { label: 'Low Stock Alerts', value: lowCount,                      color: '#d97706', bg: '#fffbeb' },
          { label: 'Expiry Alerts',    value: expiryCount,                   color: '#dc2626', bg: '#fef2f2' },
        ].map(c => (
          <div key={c.label} style={{ ...s.card, background: c.bg, border: `1px solid ${c.color}22` }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: '.8rem', color: '#64748b', marginTop: 6, fontWeight: 600 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Low Stock */}
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={s.h2}>Low Stock ({lowCount})</h2>
            <a href="/pharmacy/alerts" style={{ fontSize: '.78rem', color: '#00b4a0', fontWeight: 600, textDecoration: 'none' }}>View all →</a>
          </div>
          {alerts.low_stock.length === 0 ? (
            <div style={s.empty}>All stock levels OK</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.low_stock.slice(0, 6).map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#fffbeb', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '.85rem', color: '#0f1f3d' }}>{m.medicine_name}</div>
                    {m.batch_number && <div style={{ fontSize: '.72rem', color: '#94a3b8' }}>Batch: {m.batch_number}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '.85rem' }}>{m.current_stock} {m.unit}</div>
                    <div style={{ fontSize: '.72rem', color: '#94a3b8' }}>Min: {m.reorder_level}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expiring Soon */}
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={s.h2}>Expiring Soon ({alerts.expiring_soon.length})</h2>
            <a href="/pharmacy/alerts" style={{ fontSize: '.78rem', color: '#00b4a0', fontWeight: 600, textDecoration: 'none' }}>View all →</a>
          </div>
          {alerts.expiring_soon.length === 0 ? (
            <div style={s.empty}>No items expiring soon</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.expiring_soon.slice(0, 6).map(m => {
                const days = m.expiry_date ? Math.ceil((new Date(m.expiry_date) - new Date()) / 86400000) : null;
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#fef2f2', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '.85rem', color: '#0f1f3d' }}>{m.medicine_name}</div>
                      <div style={{ fontSize: '.72rem', color: '#94a3b8' }}>Stock: {m.current_stock} {m.unit}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '.82rem' }}>{m.expiry_date}</div>
                      {days !== null && <div style={{ fontSize: '.72rem', color: '#dc2626' }}>{days}d left</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Invoices */}
      <div style={{ ...s.card, marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={s.h2}>Recent Invoices</h2>
          <a href="/pharmacy/billing" style={{ fontSize: '.78rem', color: '#00b4a0', fontWeight: 600, textDecoration: 'none' }}>New Invoice →</a>
        </div>
        {invoices.length === 0 ? (
          <div style={s.empty}>No invoices yet</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Invoice #', 'Patient', 'Total', 'Status', 'Date'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const st = STATUS_STYLE[inv.status] || STATUS_STYLE.pending;
                const patient = inv.patients;
                return (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={s.td}><span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '.82rem', color: '#0f1f3d' }}>{inv.invoice_number || `#${inv.id}`}</span></td>
                    <td style={s.td}>
                      {patient ? <span style={{ fontWeight: 600, fontSize: '.85rem' }}>{patient.first_name} {patient.last_name}</span> : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={s.td}><span style={{ fontWeight: 700, color: '#0f766e' }}>₹{Number(inv.total_amount || 0).toFixed(2)}</span></td>
                    <td style={s.td}>
                      <span style={{ background: st.bg, color: st.text, padding: '2px 10px', borderRadius: 10, fontSize: '.75rem', fontWeight: 600 }}>{st.label}</span>
                    </td>
                    <td style={{ ...s.td, fontSize: '.78rem', color: '#64748b' }}>{inv.created_at ? new Date(inv.created_at).toLocaleDateString('en-IN') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const s = {
  page:  { padding: '2rem', maxWidth: 1200, margin: '0 auto' },
  center:{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#64748b' },
  h1:    { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2:    { fontSize: '1rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  sub:   { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  card:  { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  empty: { color: '#94a3b8', fontSize: '.875rem', textAlign: 'center', padding: '2rem' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th:    { textAlign: 'left', padding: '10px 12px', fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0' },
  td:    { padding: '10px 12px', fontSize: '.875rem', color: '#334155', verticalAlign: 'middle' },
};
