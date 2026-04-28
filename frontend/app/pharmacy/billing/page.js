'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function PharmacyBillingPage() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [selectedPrx,   setSelectedPrx]   = useState(null);
  const [inventory,     setInventory]      = useState([]);
  const [items,         setItems]          = useState([]);
  const [medSearch,     setMedSearch]      = useState('');
  const [filteredMeds,  setFilteredMeds]   = useState([]);
  const [discount,      setDiscount]       = useState(0);
  const [paymentMode,   setPaymentMode]    = useState('cash');
  const [msg,           setMsg]            = useState('');
  const [loading,       setLoading]        = useState(false);
  const [loadingPrx,    setLoadingPrx]     = useState(true);
  const [dispensed,     setDispensed]      = useState(null);

  useEffect(() => {
    Promise.all([
      api('/pharmacy/prescriptions'),
      api('/pharmacy/inventory'),
    ]).then(([pd, id]) => {
      setPrescriptions(pd.prescriptions || []);
      setInventory(id.inventory || []);
    }).catch(console.error).finally(() => setLoadingPrx(false));
  }, []);

  // When a prescription is selected, pre-fill items by matching medicine names against inventory
  const selectPrescription = (prx) => {
    setSelectedPrx(prx);
    setMsg('');
    const preItems = (prx.prescription_items || []).map(pi => {
      const match = inventory.find(m => m.medicine_name.toLowerCase() === pi.medicine_name.toLowerCase());
      return {
        medicine_id:     match?.id || null,
        medicine_name:   pi.medicine_name,
        quantity:        1,
        unit_price:      match?.unit_price || 0,
        available_stock: match?.current_stock || 0,
        dosage:          pi.dosage || '',
        frequency:       pi.frequency || '',
        duration:        pi.duration || '',
        from_prx:        true,
        unmatched:       !match,
      };
    });
    setItems(preItems);
    setDiscount(0);
    setPaymentMode('cash');
  };

  const clearSelection = () => {
    setSelectedPrx(null);
    setItems([]);
    setMedSearch('');
    setFilteredMeds([]);
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
      setItems([...items, { medicine_id: med.id, medicine_name: med.medicine_name, quantity: 1, unit_price: med.unit_price, available_stock: med.current_stock, unmatched: false }]);
    }
    setMedSearch('');
    setFilteredMeds([]);
  };

  const updateQty   = (id, qty) => setItems(items.map(i => i.medicine_id === id ? { ...i, quantity: Math.max(1, parseInt(qty) || 1) } : i));
  const updatePrice = (id, price) => setItems(items.map(i => i.medicine_id === id ? { ...i, unit_price: parseFloat(price) || 0 } : i));
  const removeItem  = (idx) => setItems(items.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, i) => s + (Number(i.unit_price || 0) * i.quantity), 0);
  const total    = subtotal - parseFloat(discount || 0);

  const createAndDispense = async () => {
    if (!selectedPrx) { setMsg('Select a prescription first'); return; }
    const billableItems = items.filter(i => i.medicine_id && !i.unmatched);
    if (!billableItems.length) { setMsg('No inventory-matched medicines to bill. Add medicines manually or match them.'); return; }
    setLoading(true); setMsg('');
    try {
      const inv = await api('/pharmacy/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patient_id:      selectedPrx.patient_id,
          prescription_id: selectedPrx.id,
          items: billableItems.map(i => ({ medicine_id: i.medicine_id, medicine_name: i.medicine_name, quantity: i.quantity, unit_price: i.unit_price, total_price: i.unit_price * i.quantity })),
          discount: parseFloat(discount || 0),
        }),
      });
      await api(`/pharmacy/invoices/${inv.invoice.id}/dispense`, {
        method: 'PATCH',
        body: JSON.stringify({ payment_mode: paymentMode, amount_paid: total }),
      });
      setDispensed({ patient: selectedPrx.patients, amount: total, payment_mode: paymentMode });
      // Remove dispensed prescription from list
      setPrescriptions(p => p.filter(x => x.id !== selectedPrx.id));
    } catch (e) { setMsg(e.message); } finally { setLoading(false); }
  };

  if (dispensed) return (
    <div style={s.page}>
      <div style={{ ...s.card, maxWidth: 480, margin: '0 auto', textAlign: 'center', padding: '2.5rem' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>💊</div>
        <h2 style={{ color: '#065f46', margin: '0 0 8px' }}>Dispensed Successfully</h2>
        <p style={{ color: '#64748b', marginBottom: 4 }}>Patient: <strong>{dispensed.patient?.first_name} {dispensed.patient?.last_name}</strong></p>
        <p style={{ color: '#64748b', marginBottom: 20 }}>Amount: <strong>₹{Number(dispensed.amount).toFixed(2)}</strong> via {dispensed.payment_mode}</p>
        <button onClick={() => { setDispensed(null); clearSelection(); }} style={s.btnPri}>← Back to Prescriptions</button>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <div>
          <h1 style={s.h1}>Pharmacy Billing</h1>
          <p style={s.sub}>Select a prescription to dispense medicines</p>
        </div>
        <a href="/pharmacy/inventory" style={s.btnSec}>View Inventory</a>
      </div>

      {msg && <div style={{ background: msg.includes('uccess') ? '#f0fdfb' : '#fef2f2', border: `1px solid ${msg.includes('uccess') ? '#99f6e4' : '#fecaca'}`, color: msg.includes('uccess') ? '#0f766e' : '#b91c1c', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.875rem', marginBottom: 16 }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Left: Pending Prescriptions ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={s.card}>
            <h2 style={s.h2}>Pending Prescriptions ({prescriptions.length})</h2>
            {loadingPrx ? (
              <div style={s.empty}>Loading…</div>
            ) : prescriptions.length === 0 ? (
              <div style={s.empty}>No pending prescriptions</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                {prescriptions.map(prx => {
                  const pat = prx.patients;
                  const medCount = (prx.prescription_items || []).length;
                  const isSelected = selectedPrx?.id === prx.id;
                  return (
                    <div key={prx.id} onClick={() => selectPrescription(prx)}
                      style={{ padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${isSelected ? '#00b4a0' : '#e2e8f0'}`, background: isSelected ? '#f0fdfb' : '#f8fafc', cursor: 'pointer' }}>
                      <div style={{ fontWeight: 700, fontSize: '.875rem', color: '#0f1f3d' }}>
                        {pat ? `${pat.first_name} ${pat.last_name}` : 'Unknown Patient'}
                      </div>
                      {pat?.phone && <div style={{ fontSize: '.75rem', color: '#64748b' }}>{pat.phone}</div>}
                      <div style={{ fontSize: '.75rem', color: '#475569', marginTop: 4 }}>
                        <span style={{ fontWeight: 600, color: '#0f766e' }}>{medCount} medicine{medCount !== 1 ? 's' : ''}</span>
                        {' · '}{prx.doctor_name}
                        {' · '}{new Date(prx.created_at).toLocaleDateString('en-IN')}
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(prx.prescription_items || []).slice(0, 3).map((pi, i) => (
                          <span key={i} style={{ background: '#ccfbf1', color: '#065f46', borderRadius: 4, padding: '1px 7px', fontSize: '.7rem', fontWeight: 600 }}>{pi.medicine_name}</span>
                        ))}
                        {medCount > 3 && <span style={{ color: '#94a3b8', fontSize: '.7rem' }}>+{medCount - 3} more</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Manual add medicine */}
          {selectedPrx && (
            <div style={s.card}>
              <h2 style={s.h2}>Add Medicine Manually</h2>
              <input value={medSearch} onChange={e => searchMeds(e.target.value)} placeholder="Search medicine…" style={s.input} />
              {filteredMeds.length > 0 && (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, marginTop: 8, overflow: 'hidden' }}>
                  {filteredMeds.map(m => (
                    <div key={m.id} onClick={() => addMedicine(m)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
                      <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{m.medicine_name}</div>
                      <div style={{ fontSize: '.75rem', color: '#64748b' }}>₹{m.unit_price} · Stock: {m.current_stock}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Bill Panel ── */}
        <div style={s.card}>
          {!selectedPrx ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💊</div>
              <p>Select a prescription from the left to start billing</p>
            </div>
          ) : (
            <>
              {/* Patient header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h2 style={{ ...s.h2, marginBottom: 4 }}>
                    {selectedPrx.patients?.first_name} {selectedPrx.patients?.last_name}
                  </h2>
                  <div style={{ fontSize: '.8rem', color: '#64748b' }}>
                    {selectedPrx.patients?.patient_uid && <span>{selectedPrx.patients.patient_uid} · </span>}
                    {selectedPrx.patients?.phone} · {selectedPrx.doctor_name}
                  </div>
                </div>
                <button onClick={clearSelection} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
              </div>

              {/* Medicines table */}
              {items.length === 0 ? (
                <div style={{ ...s.empty, padding: '2rem' }}>No medicines — add manually from left panel</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Medicine', 'Rx Info', 'Qty', 'Unit Price', 'Total', ''].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: item.unmatched ? '#fffbeb' : '#fff' }}>
                        <td style={s.td}>
                          <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{item.medicine_name}</div>
                          {item.unmatched && <div style={{ fontSize: '.7rem', color: '#d97706' }}>⚠ Not in inventory — match manually</div>}
                          {!item.unmatched && item.available_stock !== undefined && (
                            <div style={{ fontSize: '.72rem', color: '#94a3b8' }}>Stock: {item.available_stock}</div>
                          )}
                        </td>
                        <td style={{ ...s.td, fontSize: '.75rem', color: '#64748b' }}>
                          {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td style={s.td}>
                          {item.unmatched ? (
                            <span style={{ color: '#94a3b8', fontSize: '.78rem' }}>—</span>
                          ) : (
                            <input type="number" min="1" max={item.available_stock || 999} value={item.quantity}
                              onChange={e => updateQty(item.medicine_id, e.target.value)}
                              style={{ ...s.input, width: 60, textAlign: 'center', padding: '.35rem .4rem' }} />
                          )}
                        </td>
                        <td style={s.td}>
                          {item.unmatched ? (
                            <span style={{ color: '#94a3b8', fontSize: '.78rem' }}>—</span>
                          ) : (
                            <input type="number" min="0" step="0.01" value={item.unit_price}
                              onChange={e => updatePrice(item.medicine_id, e.target.value)}
                              style={{ ...s.input, width: 80, padding: '.35rem .4rem' }} />
                          )}
                        </td>
                        <td style={{ ...s.td, fontWeight: 700 }}>
                          {item.unmatched ? '—' : `₹${(Number(item.unit_price || 0) * item.quantity).toFixed(2)}`}
                        </td>
                        <td style={s.td}>
                          <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Payment section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                <div>
                  <div style={s.fg}>
                    <label style={s.label}>Discount (₹)</label>
                    <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} style={s.input} />
                  </div>
                  <div style={s.fg}>
                    <label style={s.label}>Payment Mode</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[
                        { key: 'cash',      label: '💵 Cash',       available: true  },
                        { key: 'insurance', label: '🏥 Insurance',  available: true  },
                        { key: 'upi',       label: '📱 UPI',        available: false },
                        { key: 'card',      label: '💳 Card',       available: false },
                      ].map(m => (
                        <button key={m.key} onClick={() => m.available && setPaymentMode(m.key)}
                          style={{ padding: '8px 12px', borderRadius: 8, fontSize: '.82rem', fontWeight: 600, cursor: m.available ? 'pointer' : 'not-allowed', textAlign: 'left',
                            border: `1.5px solid ${paymentMode === m.key ? '#0f766e' : '#e2e8f0'}`,
                            background: !m.available ? '#f8fafc' : paymentMode === m.key ? '#f0fdfb' : '#fff',
                            color: !m.available ? '#94a3b8' : paymentMode === m.key ? '#065f46' : '#334155' }}>
                          {m.label}{!m.available && <span style={{ fontSize: '.65rem', marginLeft: 8, opacity: .6 }}>coming soon</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#64748b', fontSize: '.875rem' }}><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#64748b', fontSize: '.875rem' }}><span>Discount</span><span>-₹{parseFloat(discount || 0).toFixed(2)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: '2px solid #e2e8f0', fontWeight: 700, fontSize: '1.1rem', color: '#0f1f3d' }}><span>Total</span><span>₹{total.toFixed(2)}</span></div>
                  <button onClick={createAndDispense} disabled={loading || !paymentMode || items.filter(i => !i.unmatched).length === 0}
                    style={{ ...s.btnPri, width: '100%', marginTop: 14, opacity: (loading || !paymentMode || items.filter(i => !i.unmatched).length === 0) ? .5 : 1 }}>
                    {loading ? 'Processing…' : '💊 Collect Payment & Dispense'}
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
  page:   { padding: '2rem', maxWidth: 1300, margin: '0 auto' },
  topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  h1:     { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2:     { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', marginBottom: 12 },
  sub:    { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  card:   { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  fg:     { marginBottom: 10 },
  label:  { display: 'block', fontSize: '.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: 4 },
  input:  { width: '100%', padding: '.6rem .9rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem', boxSizing: 'border-box' },
  th:     { textAlign: 'left', padding: '8px 10px', background: '#f8fafc', fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' },
  td:     { padding: '10px 10px', verticalAlign: 'middle' },
  empty:  { color: '#94a3b8', fontSize: '.875rem', textAlign: 'center' },
  btnPri: { padding: '.7rem 1.5rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem' },
  btnSec: { padding: '.5rem 1rem', background: '#f1f5f9', color: '#0f1f3d', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem', textDecoration: 'none' },
};
