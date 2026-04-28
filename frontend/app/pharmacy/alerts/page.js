'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function PharmacyAlertsPage() {
  const [alerts, setAlerts]   = useState({ low_stock: [], expiring_soon: [], expired: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('low_stock');

  useEffect(() => {
    api('/pharmacy/inventory/alerts')
      .then(d => setAlerts({ low_stock: d.low_stock || [], expiring_soon: d.expiring_soon || [], expired: d.expired || [] }))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const items = alerts[tab] || [];

  const daysUntilExpiry = date => {
    if (!date) return null;
    return Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
  };

  if (loading) return <div style={s.center}>Loading alerts…</div>;

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={s.h1}>Stock Alerts</h1>
        <p style={s.sub}>Items needing immediate attention</p>
      </div>

      {/* Summary badges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { key: 'low_stock',     label: 'Low Stock',     color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', icon: '⚠️' },
          { key: 'expiring_soon', label: 'Expiring Soon', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', icon: '📅' },
          { key: 'expired',       label: 'Expired',       color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: '🚫' },
        ].map(c => (
          <button key={c.key} onClick={() => setTab(c.key)} style={{
            background: tab === c.key ? c.bg : '#fff',
            border: `2px solid ${tab === c.key ? c.color : '#e2e8f0'}`,
            borderRadius: 12, padding: '18px 20px',
            display: 'flex', alignItems: 'center', gap: 14,
            cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ fontSize: 28 }}>{c.icon}</span>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: c.color, lineHeight: 1 }}>{alerts[c.key].length}</div>
              <div style={{ fontSize: '.8rem', color: '#64748b', fontWeight: 600, marginTop: 2 }}>{c.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          No items in this category
        </div>
      ) : (
        <div style={s.card}>
          <table style={s.table}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Medicine', 'Category', 'Stock', 'Reorder Level', tab !== 'low_stock' ? 'Expiry Date' : null, 'Unit Price', 'Action'].filter(Boolean).map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(m => {
                const days = daysUntilExpiry(m.expiry_date);
                const isLow = m.current_stock <= m.reorder_level;
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={s.td}>
                      <div style={{ fontWeight: 600, color: '#0f1f3d' }}>{m.medicine_name}</div>
                      {m.batch_number && <div style={{ fontSize: '.75rem', color: '#94a3b8' }}>Batch: {m.batch_number}</div>}
                    </td>
                    <td style={s.td}>{m.category || '—'}</td>
                    <td style={s.td}>
                      <span style={{ fontWeight: 700, color: isLow ? '#ef4444' : '#166534' }}>
                        {m.current_stock} {m.unit}
                      </span>
                    </td>
                    <td style={s.td}>{m.reorder_level} {m.unit}</td>
                    {tab !== 'low_stock' && (
                      <td style={s.td}>
                        <span style={{ color: days !== null && days <= 0 ? '#7c3aed' : days !== null && days <= 30 ? '#ef4444' : '#64748b', fontWeight: 600 }}>
                          {m.expiry_date || '—'}
                          {days !== null && <span style={{ fontSize: '.75rem', marginLeft: 6 }}>({days <= 0 ? 'EXPIRED' : `${days}d left`})</span>}
                        </span>
                      </td>
                    )}
                    <td style={s.td}>₹{Number(m.unit_price || 0).toFixed(2)}</td>
                    <td style={s.td}>
                      <a href="/pharmacy/inventory" style={{ color: '#00b4a0', fontWeight: 600, fontSize: '.8rem', textDecoration: 'none' }}>
                        View →
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const s = {
  page:   { padding: '2rem', maxWidth: 1100, margin: '0 auto' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#64748b' },
  h1:     { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  sub:    { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  card:   { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  table:  { width: '100%', borderCollapse: 'collapse' },
  th:     { textAlign: 'left', padding: '10px 12px', fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0' },
  td:     { padding: '10px 12px', fontSize: '.875rem', color: '#334155' },
};
