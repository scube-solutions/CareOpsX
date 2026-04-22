'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function PharmacyInventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showStock, setShowStock] = useState(null);
  const [form, setForm] = useState({ medicine_name: '', category: '', unit: 'tablet', unit_price: '', reorder_level: 10, batch_number: '', expiry_date: '', manufacturer: '' });
  const [stockQty, setStockQty] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const data = await api(`/pharmacy/inventory${search ? `?search=${search}` : ''}`);
    setInventory(data.inventory || []);
  };

  useEffect(() => { load(); }, [search]);

  const addMedicine = async () => {
    if (!form.medicine_name || !form.unit_price) { setMsg('Name and price required'); return; }
    setLoading(true);
    try {
      await api('/pharmacy/inventory', { method: 'POST', body: JSON.stringify({ ...form, current_stock: 0, unit_price: parseFloat(form.unit_price), reorder_level: parseInt(form.reorder_level) }) });
      setMsg('Medicine added'); setShowAdd(false);
      setForm({ medicine_name: '', category: '', unit: 'tablet', unit_price: '', reorder_level: 10, batch_number: '', expiry_date: '', manufacturer: '' });
      await load();
    } catch (e) { setMsg(e.message); } finally { setLoading(false); }
  };

  const addStock = async (id) => {
    if (!stockQty || parseInt(stockQty) <= 0) { setMsg('Enter valid quantity'); return; }
    try {
      await api(`/pharmacy/inventory/${id}/stock`, { method: 'POST', body: JSON.stringify({ quantity: parseInt(stockQty) }) });
      setMsg('Stock updated'); setShowStock(null); setStockQty('');
      await load();
    } catch (e) { setMsg(e.message); }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.h1}>Pharmacy Inventory</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/pharmacy/alerts" style={s.btnWarn}>⚠ View Alerts</a>
          <button onClick={() => setShowAdd(true)} style={s.btnPri}>+ Add Medicine</button>
        </div>
      </div>

      {msg && <div style={s.info}>{msg}<button onClick={() => setMsg('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer' }}>×</button></div>}

      <div style={{ marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search medicines..." style={{ ...s.input, maxWidth: 360 }} />
      </div>

      {showAdd && (
        <div style={{ ...s.card, marginBottom: 16, borderLeft: '4px solid #00b4a0' }}>
          <h2 style={s.h2}>Add New Medicine</h2>
          <div style={s.grid3}>
            <div style={s.fg}><label style={s.label}>Medicine Name *</label><input value={form.medicine_name} onChange={e => setForm({ ...form, medicine_name: e.target.value })} style={s.input} /></div>
            <div style={s.fg}><label style={s.label}>Category</label><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={s.input} /></div>
            <div style={s.fg}><label style={s.label}>Unit</label>
              <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={s.input}>
                {['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'sachet', 'strip'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div style={s.fg}><label style={s.label}>Unit Price (₹) *</label><input type="number" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })} style={s.input} /></div>
            <div style={s.fg}><label style={s.label}>Reorder Level</label><input type="number" value={form.reorder_level} onChange={e => setForm({ ...form, reorder_level: e.target.value })} style={s.input} /></div>
            <div style={s.fg}><label style={s.label}>Batch Number</label><input value={form.batch_number} onChange={e => setForm({ ...form, batch_number: e.target.value })} style={s.input} /></div>
            <div style={s.fg}><label style={s.label}>Expiry Date</label><input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} style={s.input} /></div>
            <div style={s.fg}><label style={s.label}>Manufacturer</label><input value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} style={s.input} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button onClick={addMedicine} disabled={loading} style={s.btnPri}>{loading ? 'Adding...' : 'Add Medicine'}</button>
            <button onClick={() => setShowAdd(false)} style={s.btnSec}>Cancel</button>
          </div>
        </div>
      )}

      <div style={s.card}>
        <table style={s.table}>
          <thead><tr>{['Medicine', 'Category', 'Unit', 'Stock', 'Reorder Level', 'Unit Price', 'Batch', 'Expiry', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {inventory.map(m => {
              const isLow = m.current_stock <= m.reorder_level;
              const isExpired = m.expiry_date && m.expiry_date <= today;
              const isExpiring = m.expiry_date && !isExpired && m.expiry_date <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              return (
                <tr key={m.id} style={{ background: isExpired ? '#fef2f2' : isLow ? '#fffbeb' : 'transparent' }}>
                  <td style={s.td}><span style={{ fontWeight: 600 }}>{m.medicine_name}</span></td>
                  <td style={s.td}>{m.category || '–'}</td>
                  <td style={s.td}>{m.unit}</td>
                  <td style={s.td}>
                    <span style={{ fontWeight: 700, color: isLow ? '#dc2626' : '#10b981' }}>{m.current_stock}</span>
                    {isLow && <span style={{ fontSize: '.7rem', color: '#dc2626', marginLeft: 4 }}>⚠ Low</span>}
                  </td>
                  <td style={s.td}>{m.reorder_level}</td>
                  <td style={s.td}>₹{m.unit_price}</td>
                  <td style={s.td}>{m.batch_number || '–'}</td>
                  <td style={s.td}>
                    <span style={{ color: isExpired ? '#dc2626' : isExpiring ? '#f59e0b' : '#64748b', fontWeight: isExpired || isExpiring ? 600 : 400 }}>
                      {m.expiry_date || '–'}{isExpired && ' (Expired)'}{isExpiring && ' (Soon)'}
                    </span>
                  </td>
                  <td style={s.td}>
                    {showStock === m.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input type="number" value={stockQty} onChange={e => setStockQty(e.target.value)} style={{ ...s.input, width: 70, padding: '4px 8px' }} placeholder="Qty" />
                        <button onClick={() => addStock(m.id)} style={s.actBtn}>Add</button>
                        <button onClick={() => setShowStock(null)} style={{ ...s.actBtn, color: '#ef4444' }}>×</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowStock(m.id)} style={s.actBtn}>+ Add Stock</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {inventory.length === 0 && <p style={s.empty}>No medicines found</p>}
      </div>
    </div>
  );
}

const s = {
  page: { padding: '2rem', maxWidth: 1400, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  h1: { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2: { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', marginBottom: 14 },
  card: { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 },
  fg: { display: 'flex', flexDirection: 'column' },
  label: { fontSize: '.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: 4 },
  input: { width: '100%', padding: '.6rem .9rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem', boxSizing: 'border-box' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', background: '#f8fafc', fontSize: '.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' },
  td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '.875rem' },
  info: { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.875rem', marginBottom: 16, display: 'flex', alignItems: 'center' },
  btnPri: { padding: '.6rem 1.2rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem' },
  btnSec: { padding: '.6rem 1rem', background: '#f1f5f9', color: '#0f1f3d', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem' },
  btnWarn: { padding: '.6rem 1rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem', textDecoration: 'none' },
  actBtn: { padding: '4px 10px', background: '#f0fdf4', color: '#065f46', border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 },
  empty: { color: '#94a3b8', textAlign: 'center', padding: '2rem' },
};
