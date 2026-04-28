'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AdminPharmacyPage() {
  const [tab, setTab]           = useState('inventory');
  const [inventory, setInventory] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch]     = useState('');
  const [showAdd, setShowAdd]   = useState(false);
  const [showStock, setShowStock] = useState(null);
  const [stockQty, setStockQty] = useState('');
  const [form, setForm]         = useState({ medicine_name: '', category: '', unit: 'tablet', unit_price: '', reorder_level: 10, batch_number: '', expiry_date: '', manufacturer: '' });
  const [msg, setMsg]           = useState('');
  const [saving, setSaving]     = useState(false);

  const loadInventory = async () => {
    try {
      const d = await api(`/pharmacy/inventory${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      setInventory(d.inventory || []);
    } catch (e) { console.error(e); }
  };

  const loadInvoices = async () => {
    try {
      const d = await api('/pharmacy/invoices');
      setInvoices(d.invoices || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadInventory(); }, [search]);
  useEffect(() => { if (tab === 'invoices') loadInvoices(); }, [tab]);

  const addMedicine = async () => {
    if (!form.medicine_name || !form.unit_price) { setMsg('Name and price are required'); return; }
    setSaving(true);
    try {
      await api('/pharmacy/inventory', { method: 'POST', body: JSON.stringify({ ...form, current_stock: 0, unit_price: parseFloat(form.unit_price), reorder_level: parseInt(form.reorder_level) || 10 }) });
      setMsg('Medicine added');
      setShowAdd(false);
      setForm({ medicine_name: '', category: '', unit: 'tablet', unit_price: '', reorder_level: 10, batch_number: '', expiry_date: '', manufacturer: '' });
      loadInventory();
    } catch (e) { setMsg(e.message); } finally { setSaving(false); }
  };

  const addStock = async (id) => {
    const qty = parseInt(stockQty);
    if (!qty || qty <= 0) { setMsg('Enter valid quantity'); return; }
    try {
      await api(`/pharmacy/inventory/${id}/stock`, { method: 'POST', body: JSON.stringify({ quantity: qty }) });
      setMsg('Stock updated'); setShowStock(null); setStockQty('');
      loadInventory();
    } catch (e) { setMsg(e.message); }
  };

  const dispense = async (id) => {
    try {
      await api(`/pharmacy/invoices/${id}/dispense`, { method: 'PATCH' });
      setMsg('Invoice dispensed');
      loadInvoices();
    } catch (e) { setMsg(e.message); }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.h1}>Pharmacy Management</h1>
          <p style={s.sub}>Inventory and invoice management</p>
        </div>
        {tab === 'inventory' && (
          <button onClick={() => setShowAdd(v => !v)} style={s.btnPri}>+ Add Medicine</button>
        )}
      </div>

      {msg && <div style={s.info}>{msg}<button onClick={() => setMsg('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer' }}>×</button></div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #e2e8f0' }}>
        {[['inventory', 'Inventory'], ['invoices', 'Invoices']].map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)} style={{ padding: '.6rem 1.25rem', border: 'none', borderBottom: tab === v ? '2px solid #00b4a0' : '2px solid transparent', background: 'none', color: tab === v ? '#00b4a0' : '#64748b', fontWeight: tab === v ? 700 : 500, cursor: 'pointer', fontSize: '.9rem', marginBottom: -2 }}>
            {label}
          </button>
        ))}
      </div>

      {/* Inventory Tab */}
      {tab === 'inventory' && (
        <>
          {showAdd && (
            <div style={{ ...s.card, marginBottom: 16, borderLeft: '4px solid #00b4a0' }}>
              <h2 style={s.h2}>Add New Medicine</h2>
              <div style={s.grid3}>
                {[['Medicine Name *', 'medicine_name', 'text'], ['Category', 'category', 'text'], ['Unit Price (₹) *', 'unit_price', 'number'], ['Reorder Level', 'reorder_level', 'number'], ['Batch Number', 'batch_number', 'text'], ['Expiry Date', 'expiry_date', 'date'], ['Manufacturer', 'manufacturer', 'text']].map(([l, k, t]) => (
                  <div key={k}>
                    <label style={s.label}>{l}</label>
                    <input type={t} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} style={s.input} />
                  </div>
                ))}
                <div>
                  <label style={s.label}>Unit</label>
                  <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={s.input}>
                    {['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'sachet', 'strip'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button onClick={addMedicine} disabled={saving} style={s.btnPri}>{saving ? 'Adding...' : 'Add Medicine'}</button>
                <button onClick={() => setShowAdd(false)} style={s.btnSec}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search medicines..." style={{ ...s.input, maxWidth: 320 }} />
          </div>

          <div style={s.card}>
            <table style={s.table}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Medicine', 'Category', 'Unit', 'Stock', 'Reorder', 'Price', 'Batch', 'Expiry', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {inventory.map(m => {
                  const isLow     = m.current_stock <= m.reorder_level;
                  const isExpired = m.expiry_date && m.expiry_date <= today;
                  const isSoon    = m.expiry_date && !isExpired && m.expiry_date <= new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9', background: isExpired ? '#fef2f2' : isLow ? '#fffbeb' : 'transparent' }}>
                      <td style={s.td}><span style={{ fontWeight: 600 }}>{m.medicine_name}</span></td>
                      <td style={s.td}>{m.category || '–'}</td>
                      <td style={s.td}>{m.unit}</td>
                      <td style={s.td}>
                        <span style={{ fontWeight: 700, color: isLow ? '#dc2626' : '#10b981' }}>{m.current_stock}</span>
                        {isLow && <span style={{ fontSize: '.7rem', color: '#dc2626', marginLeft: 4 }}>Low</span>}
                      </td>
                      <td style={s.td}>{m.reorder_level}</td>
                      <td style={s.td}>₹{m.unit_price}</td>
                      <td style={s.td}>{m.batch_number || '–'}</td>
                      <td style={s.td}><span style={{ color: isExpired ? '#dc2626' : isSoon ? '#f59e0b' : '#64748b', fontWeight: (isExpired || isSoon) ? 600 : 400 }}>{m.expiry_date || '–'}{isExpired && ' ✕'}{isSoon && ' !'}</span></td>
                      <td style={s.td}>
                        {showStock === m.id ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input type="number" value={stockQty} onChange={e => setStockQty(e.target.value)} style={{ ...s.input, width: 64, padding: '4px 8px' }} placeholder="Qty" />
                            <button onClick={() => addStock(m.id)} style={s.actBtn}>Add</button>
                            <button onClick={() => setShowStock(null)} style={{ ...s.actBtn, color: '#ef4444' }}>×</button>
                          </div>
                        ) : (
                          <button onClick={() => setShowStock(m.id)} style={s.actBtn}>+ Stock</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {inventory.length === 0 && <p style={s.empty}>No medicines found.</p>}
          </div>
        </>
      )}

      {/* Invoices Tab */}
      {tab === 'invoices' && (
        <div style={s.card}>
          <table style={s.table}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Invoice #', 'Patient', 'Items', 'Total', 'Status', 'Created', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={s.td}><span style={{ fontFamily: 'monospace', fontSize: '.8rem', color: '#0f766e' }}>{inv.invoice_number || '–'}</span></td>
                  <td style={s.td}>
                    <div style={{ fontWeight: 600 }}>{`${inv.patients?.first_name || ''} ${inv.patients?.last_name || ''}`.trim() || '–'}</div>
                    <div style={{ fontSize: '.75rem', color: '#64748b' }}>{inv.patients?.patient_uid || ''}</div>
                  </td>
                  <td style={s.td}>{inv.items?.length || '–'}</td>
                  <td style={s.td}>₹{inv.total_amount?.toFixed(2) || '0.00'}</td>
                  <td style={s.td}>
                    <span style={{ background: inv.status === 'dispensed' ? '#dcfce7' : '#fef3c7', color: inv.status === 'dispensed' ? '#166534' : '#92400e', padding: '3px 10px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ ...s.td, fontSize: '.8rem', color: '#64748b' }}>{new Date(inv.created_at).toLocaleDateString('en-IN')}</td>
                  <td style={s.td}>
                    {inv.status === 'pending' && (
                      <button onClick={() => dispense(inv.id)} style={{ ...s.actBtn, background: '#f0fdf4', color: '#065f46' }}>Dispense</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {invoices.length === 0 && <p style={s.empty}>No pharmacy invoices.</p>}
        </div>
      )}
    </div>
  );
}

const s = {
  page:   { padding: '2rem', maxWidth: 1400, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  h1:     { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2:     { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', marginBottom: 12 },
  sub:    { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  card:   { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  grid3:  { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 },
  table:  { width: '100%', borderCollapse: 'collapse' },
  th:     { textAlign: 'left', padding: '10px 12px', fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0' },
  td:     { padding: '10px 12px', fontSize: '.875rem', color: '#334155' },
  label:  { display: 'block', fontSize: '.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 },
  input:  { width: '100%', padding: '.6rem .9rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem', boxSizing: 'border-box' },
  btnPri: { padding: '.6rem 1.2rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem' },
  btnSec: { padding: '.6rem 1rem', background: '#f1f5f9', color: '#0f1f3d', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem' },
  actBtn: { padding: '4px 10px', background: '#f0fdf4', color: '#065f46', border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 },
  info:   { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.875rem', marginBottom: 16, display: 'flex', alignItems: 'center' },
  empty:  { color: '#94a3b8', fontSize: '.875rem', textAlign: 'center', padding: '2rem 0' },
};
