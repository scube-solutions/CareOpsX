'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function PharmacyBillingPage() {
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [items, setItems] = useState([]);
  const [medSearch, setMedSearch] = useState('');
  const [filteredMeds, setFilteredMeds] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [dispensed, setDispensed] = useState(null);

  useEffect(() => {
    api('/pharmacy/inventory').then(d => setInventory(d.inventory || []));
  }, []);

  const searchPatients = async () => {
    if (!patientSearch) return;
    const data = await api(`/patients?search=${patientSearch}&limit=5`);
    setPatients(data.patients || []);
  };

  const searchMeds = (q) => {
    setMedSearch(q);
    if (!q) { setFilteredMeds([]); return; }
    setFilteredMeds(inventory.filter(m => m.medicine_name.toLowerCase().includes(q.toLowerCase())).slice(0, 8));
  };

  const addMedicine = (med) => {
    const existing = items.find(i => i.medicine_id === med.id);
    if (existing) {
      setItems(items.map(i => i.medicine_id === med.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setItems([...items, { medicine_id: med.id, medicine_name: med.medicine_name, quantity: 1, unit_price: med.unit_price, available_stock: med.current_stock }]);
    }
    setMedSearch('');
    setFilteredMeds([]);
  };

  const updateQty = (id, qty) => setItems(items.map(i => i.medicine_id === id ? { ...i, quantity: Math.max(1, parseInt(qty) || 1) } : i));
  const removeItem = (id) => setItems(items.filter(i => i.medicine_id !== id));

  const subtotal = items.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
  const total = subtotal - parseFloat(discount || 0);

  const createAndDispense = async () => {
    if (!selectedPatient || !items.length) { setMsg('Select patient and add medicines'); return; }
    setLoading(true); setMsg('');
    try {
      const inv = await api('/pharmacy/invoices', { method: 'POST', body: JSON.stringify({ patient_id: selectedPatient.id, items: items.map(i => ({ ...i, total_price: i.unit_price * i.quantity })), discount: parseFloat(discount || 0) }) });
      const disp = await api(`/pharmacy/invoices/${inv.invoice.id}/dispense`, { method: 'PATCH', body: JSON.stringify({ payment_mode: paymentMode, amount_paid: total }) });
      setDispensed(disp.invoice);
      setMsg('Medicines dispensed successfully!');
    } catch (e) { setMsg(e.message); } finally { setLoading(false); }
  };

  if (dispensed) return (
    <div style={s.page}>
      <div style={{ ...s.card, maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>💊</div>
        <h2 style={{ color: '#065f46' }}>Dispensed Successfully</h2>
        <p style={{ color: '#64748b' }}>Amount Collected: <strong>₹{dispensed.amount_paid?.toFixed(2)}</strong></p>
        <button onClick={() => { setDispensed(null); setSelectedPatient(null); setItems([]); setPatientSearch(''); setPatients([]); }} style={s.btnPri}>New Prescription</button>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.h1}>Pharmacy Billing</h1>
        <a href="/pharmacy/inventory" style={s.btnSec}>View Inventory</a>
      </div>

      {msg && <div style={s.info}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
        <div>
          <div style={s.card}>
            <h2 style={s.h2}>Patient</h2>
            {selectedPatient ? (
              <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ fontWeight: 600 }}>{selectedPatient.first_name} {selectedPatient.last_name}</div>
                <div style={{ fontSize: '.8rem', color: '#064e3b' }}>{selectedPatient.patient_uid} • {selectedPatient.phone}</div>
                <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); setPatients([]); }} style={{ marginTop: 6, fontSize: '.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>× Change Patient</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input value={patientSearch} onChange={e => setPatientSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchPatients()} placeholder="Name or phone..." style={{ ...s.input, flex: 1 }} />
                  <button onClick={searchPatients} style={s.btnSm}>Go</button>
                </div>
                {patients.map(p => (
                  <div key={p.id} onClick={() => { setSelectedPatient(p); setPatients([]); setPatientSearch(''); }} style={{ padding: '8px 10px', cursor: 'pointer', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 4, background: '#f8fafc' }}>
                    <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{p.first_name} {p.last_name}</div>
                    <div style={{ fontSize: '.75rem', color: '#64748b' }}>{p.patient_uid} • {p.phone}</div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div style={{ ...s.card, marginTop: 16 }}>
            <h2 style={s.h2}>Add Medicine</h2>
            <input value={medSearch} onChange={e => searchMeds(e.target.value)} placeholder="Search medicine..." style={s.input} />
            {filteredMeds.length > 0 && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, marginTop: 8, overflow: 'hidden' }}>
                {filteredMeds.map(m => (
                  <div key={m.id} onClick={() => addMedicine(m)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: m.current_stock <= m.reorder_level ? '#fffbeb' : '#fff' }}>
                    <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{m.medicine_name}</div>
                    <div style={{ fontSize: '.75rem', color: '#64748b' }}>₹{m.unit_price} • Stock: {m.current_stock} {m.current_stock <= m.reorder_level && '⚠️'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>Prescription Items</h2>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Search and add medicines from the left panel</div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                <thead><tr>
                  <th style={s.th}>Medicine</th>
                  <th style={{ ...s.th, width: 100 }}>Qty</th>
                  <th style={{ ...s.th, width: 110 }}>Unit Price</th>
                  <th style={{ ...s.th, width: 110 }}>Total</th>
                  <th style={{ ...s.th, width: 40 }}></th>
                </tr></thead>
                <tbody>
                  {items.map(i => (
                    <tr key={i.medicine_id}>
                      <td style={s.td}>
                        <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{i.medicine_name}</div>
                        <div style={{ fontSize: '.75rem', color: '#94a3b8' }}>Stock: {i.available_stock}</div>
                      </td>
                      <td style={s.td}><input type="number" min="1" max={i.available_stock} value={i.quantity} onChange={e => updateQty(i.medicine_id, e.target.value)} style={{ ...s.input, width: 70, textAlign: 'center' }} /></td>
                      <td style={s.td}>₹{i.unit_price}</td>
                      <td style={{ ...s.td, fontWeight: 700 }}>₹{(i.unit_price * i.quantity).toFixed(2)}</td>
                      <td style={s.td}><button onClick={() => removeItem(i.medicine_id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem' }}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                <div>
                  <div style={s.fg}><label style={s.label}>Discount (₹)</label><input type="number" value={discount} onChange={e => setDiscount(e.target.value)} style={s.input} /></div>
                  <div style={s.fg}>
                    <label style={s.label}>Payment Mode</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[
                        { key: 'cash',      label: '💵 Cash',        sub: 'Collect at counter', available: true  },
                        { key: 'upi',       label: '📱 UPI',         sub: 'Coming soon',        available: false },
                        { key: 'card',      label: '💳 Card Swipe',  sub: 'Coming soon',        available: false },
                        { key: 'insurance', label: '🏥 Insurance',   sub: 'Cashless claim',     available: true  },
                      ].map(m => (
                        <button key={m.key} onClick={() => m.available && setPaymentMode(m.key)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', borderRadius: 8, fontSize: '.8rem', fontWeight: 600,
                            cursor: m.available ? 'pointer' : 'not-allowed', textAlign: 'left',
                            border: `1.5px solid ${paymentMode === m.key ? '#0f766e' : '#e2e8f0'}`,
                            background: !m.available ? '#f8fafc' : paymentMode === m.key ? '#f0fdfb' : '#fff',
                            color: !m.available ? '#94a3b8' : paymentMode === m.key ? '#065f46' : '#334155' }}>
                          <span>{m.label}</span>
                          <span style={{ fontSize: '.68rem', opacity: .7 }}>{m.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#64748b', fontSize: '.875rem' }}><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#64748b', fontSize: '.875rem' }}><span>Discount</span><span>-₹{parseFloat(discount || 0).toFixed(2)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: '2px solid #e2e8f0', fontWeight: 700, fontSize: '1.1rem', color: '#0f1f3d' }}><span>Total</span><span>₹{total.toFixed(2)}</span></div>
                  {!paymentMode && (
                    <div style={{ marginTop: 12, padding: '8px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: '.78rem', color: '#92400e' }}>
                      Select a payment method before dispensing
                    </div>
                  )}
                  <button onClick={createAndDispense} disabled={loading || !selectedPatient || !paymentMode} style={{ ...s.btnPri, width: '100%', marginTop: 10, opacity: (!selectedPatient || loading || !paymentMode) ? .5 : 1 }}>
                    {loading ? 'Processing...' : '💊 Collect Payment & Dispense'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { padding: '2rem', maxWidth: 1200, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  h1: { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2: { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', marginBottom: 14 },
  card: { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  fg: { marginBottom: 10 },
  label: { display: 'block', fontSize: '.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: 4 },
  input: { width: '100%', padding: '.6rem .9rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem', boxSizing: 'border-box' },
  th: { textAlign: 'left', padding: '8px', background: '#f8fafc', fontSize: '.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' },
  td: { padding: '8px', borderBottom: '1px solid #f1f5f9' },
  info: { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.875rem', marginBottom: 16 },
  btnPri: { padding: '.7rem 1.5rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem' },
  btnSec: { padding: '.5rem 1rem', background: '#f1f5f9', color: '#0f1f3d', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem', textDecoration: 'none' },
  btnSm: { padding: '.55rem .9rem', background: '#0f1f3d', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem' },
};
