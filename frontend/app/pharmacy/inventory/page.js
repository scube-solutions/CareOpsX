'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

const EMPTY_FORM = { medicine_name: '', category: '', unit: 'tablet', unit_price: '', reorder_level: 10, batch_number: '', expiry_date: '', manufacturer: '', barcode: '', initial_stock: '' };

export default function PharmacyInventoryPage() {
  const [inventory, setInventory]   = useState([]);
  const [search, setSearch]         = useState('');
  const [showAdd, setShowAdd]       = useState(false);
  const [showStock, setShowStock]   = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [stockQty, setStockQty]     = useState('');
  const [msg, setMsg]               = useState('');
  const [loading, setLoading]       = useState(false);

  const [editingId, setEditingId]   = useState(null);
  const [editForm, setEditForm]     = useState(EMPTY_FORM);
  const [editLoading, setEditLoading] = useState(false);

  const [deleteId, setDeleteId]     = useState(null);
  const [deleteName, setDeleteName] = useState('');

  const [showBulk, setShowBulk]         = useState(false);
  const [bulkRows, setBulkRows]         = useState([]);
  const [bulkError, setBulkError]       = useState('');
  const [bulkLoading, setBulkLoading]   = useState(false);
  const [bulkFileName, setBulkFileName] = useState('');

  // Scan state
  const [showScan, setShowScan]         = useState(false);
  const [scanBarcode, setScanBarcode]   = useState('');
  const [scanMsg, setScanMsg]           = useState('');
  const [scanLoading, setScanLoading]   = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const scanningRef = useRef(false);

  const CSV_HEADERS = ['medicine_name','category','unit','unit_price','current_stock','reorder_level','batch_number','expiry_date','manufacturer','barcode'];

  const downloadTemplate = () => {
    const sample = [
      CSV_HEADERS.join(','),
      'Paracetamol 500mg,Analgesic,tablet,10,500,50,B001,2026-12-31,Sun Pharma,8901234567890',
      'Amoxicillin 250mg,Antibiotic,capsule,25,200,30,B002,2026-06-30,Cipla,8909876543210',
      'Crocin Syrup,Analgesic,syrup,45,100,20,B003,2026-09-30,GSK,',
    ].join('\n');
    const blob = new Blob([sample], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'medicine_bulk_template.csv'; a.click();
  };

  const parseCSV = (text) => {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return { rows: [], error: 'File must have a header row and at least one data row' };
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ''));
    const nameIdx = headers.indexOf('medicine_name');
    if (nameIdx === -1) return { rows: [], error: 'Column "medicine_name" not found in header' };
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
      if (row.medicine_name) rows.push(row);
    }
    return { rows, error: rows.length ? '' : 'No valid data rows found' };
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBulkFileName(file.name); setBulkError(''); setBulkRows([]);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows, error } = parseCSV(ev.target.result);
      if (error) { setBulkError(error); return; }
      setBulkRows(rows);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const submitBulk = async () => {
    if (!bulkRows.length) return;
    setBulkLoading(true); setBulkError('');
    try {
      const res = await api('/pharmacy/inventory/bulk', { method: 'POST', body: JSON.stringify({ medicines: bulkRows }) });
      setMsg(res.message); setShowBulk(false); setBulkRows([]); setBulkFileName('');
      await load();
    } catch (e) { setBulkError(e.message); } finally { setBulkLoading(false); }
  };

  const load = async () => {
    const data = await api(`/pharmacy/inventory${search ? `?search=${encodeURIComponent(search)}` : ''}`);
    setInventory(data.inventory || []);
  };

  useEffect(() => { load(); }, [search]);

  const addMedicine = async () => {
    if (!form.medicine_name || !form.unit_price) { setMsg('Name and price required'); return; }
    setLoading(true);
    try {
      await api('/pharmacy/inventory', { method: 'POST', body: JSON.stringify({ ...form, current_stock: parseInt(form.initial_stock) || 0, unit_price: parseFloat(form.unit_price), reorder_level: parseInt(form.reorder_level) }) });
      setMsg('Medicine added'); setShowAdd(false); setForm(EMPTY_FORM);
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

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditForm({ medicine_name: m.medicine_name, category: m.category || '', unit: m.unit || 'tablet', unit_price: m.unit_price, reorder_level: m.reorder_level, batch_number: m.batch_number || '', expiry_date: m.expiry_date || '', manufacturer: m.manufacturer || '', barcode: m.barcode || '' });
    setShowAdd(false);
  };

  const saveEdit = async () => {
    if (!editForm.medicine_name || !editForm.unit_price) { setMsg('Name and price required'); return; }
    setEditLoading(true);
    try {
      await api(`/pharmacy/inventory/${editingId}`, { method: 'PUT', body: JSON.stringify({ ...editForm, unit_price: parseFloat(editForm.unit_price), reorder_level: parseInt(editForm.reorder_level) }) });
      setMsg('Medicine updated'); setEditingId(null);
      await load();
    } catch (e) { setMsg(e.message); } finally { setEditLoading(false); }
  };

  const confirmDelete = (m) => { setDeleteId(m.id); setDeleteName(m.medicine_name); };

  const doDelete = async () => {
    try {
      await api(`/pharmacy/inventory/${deleteId}`, { method: 'PUT', body: JSON.stringify({ is_active: false }) });
      setMsg(`${deleteName} removed from inventory`); setDeleteId(null);
      await load();
    } catch (e) { setMsg(e.message); }
  };

  // ── Barcode / Scan ────────────────────────────────────────────────────────────
  const closeScan = () => {
    setShowScan(false); setScanBarcode(''); setScanMsg(''); setScanLoading(false); setCameraActive(false);
  };

  const guessUnit = (text) => {
    const t = (text || '').toLowerCase();
    if (t.includes('syrup') || t.includes('liquid') || t.includes('solution') || t.includes('suspension')) return 'syrup';
    if (t.includes('injection') || t.includes('injectable') || t.includes('infusion')) return 'injection';
    if (t.includes('capsule') || t.includes('cap ') || t.includes('caps')) return 'capsule';
    if (t.includes('cream') || t.includes('ointment') || t.includes('gel') || t.includes('lotion')) return 'cream';
    if (t.includes('drop')) return 'drops';
    if (t.includes('sachet') || t.includes('powder')) return 'sachet';
    if (t.includes('strip') || t.includes('patch')) return 'strip';
    return 'tablet';
  };

  // QR codes on medicine boxes often contain text, not numeric barcodes — parse directly
  const parseTextQR = (raw) => {
    const text = raw.trim();
    if (/^\d{6,14}$/.test(text)) return null;                          // pure numeric = EAN/UPC, skip
    if (/^[A-Z0-9\-]{4,20}$/.test(text) && !text.includes(' ')) return null; // short code ID, skip

    let name = '';
    let manufacturer = '';

    // "FROM THE MAKERS OF :- PRODUCT_NAME & OTHER"
    const fromMakers = text.match(/from\s+the\s+makers\s+of\s*[:\-]*\s*(.+)/i);
    if (fromMakers) {
      name = fromMakers[1].split(/\s*&\s*|\s+AND\s+/i)[0].trim();
    }

    // "Manufactured by: XYZ" / "Product: NAME"
    if (!name) {
      const lines = text.split(/[\n\r|]+/).map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        const mfr  = line.match(/^(?:mfr?d?\s+by|manufactured\s+by|company)\s*[:\-]\s*(.+)/i);
        if (mfr && !manufacturer) { manufacturer = mfr[1].trim(); continue; }
        const prod = line.match(/^(?:product|medicine|drug)\s*[:\-]\s*(.+)/i);
        if (prod && !name) { name = prod[1].trim(); continue; }
      }
      // fallback: first line that looks like a product name (no colon, ≤80 chars)
      if (!name) name = lines.find(l => l.length <= 80 && !l.includes(':')) || lines[0] || '';
    }

    if (!name) return null;
    return { medicine_name: name, manufacturer, unit: guessUnit(name + ' ' + text) };
  };

  const fetchExternalDetails = async (barcode) => {
    const parseOFF = (p) => {
      const name = p.product_name_en || p.product_name || p.generic_name || '';
      if (!name) return null;
      const qty = p.quantity || '';
      const cat = (p.categories_tags?.[0] || '').replace(/^(en|fr|de):/, '');
      return { medicine_name: (name + (qty ? ` ${qty}` : '')).trim(), manufacturer: p.brands || '', category: cat, unit: guessUnit(name + ' ' + cat) };
    };

    // 1. Open Products Facts (medicines, health products — better than food DB)
    try {
      const res  = await fetch(`https://world.openproductsfacts.org/api/v0/product/${barcode}.json`);
      const data = await res.json();
      if (data.status === 1 && data.product) { const r = parseOFF(data.product); if (r) return r; }
    } catch (_) {}

    // 2. Open Food Facts
    try {
      const res  = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await res.json();
      if (data.status === 1 && data.product) { const r = parseOFF(data.product); if (r) return r; }
    } catch (_) {}

    // 3. Open Beauty Facts (OTC topicals, cosmetics with medicinal claims)
    try {
      const res  = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${barcode}.json`);
      const data = await res.json();
      if (data.status === 1 && data.product) { const r = parseOFF(data.product); if (r) return r; }
    } catch (_) {}

    // 4. Datakick (free product DB)
    try {
      const res  = await fetch(`https://www.datakick.org/api/items/${barcode}`);
      const data = await res.json();
      if (data.name) return { medicine_name: data.name, manufacturer: data.brand_name || '', category: '', unit: guessUnit(data.name) };
    } catch (_) {}

    // 5. UPC Item DB
    try {
      const res  = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
      const data = await res.json();
      if (data.items?.length > 0) {
        const item = data.items[0];
        const name = item.title || item.description || '';
        if (name) return { medicine_name: name, manufacturer: item.brand || '', category: item.category || '', unit: guessUnit(name) };
      }
    } catch (_) {}

    return null;
  };

  const handleBarcodeDetected = async (barcode) => {
    const code = (barcode || '').trim();
    if (!code || scanningRef.current) return;
    scanningRef.current = true;
    setScanLoading(true);
    setScanMsg(`Looking up: ${code}…`);
    try {
      const data = await api(`/pharmacy/inventory/barcode/${encodeURIComponent(code)}`);
      if (data.found && data.medicine) {
        closeScan();
        setShowStock(data.medicine.id);
        setMsg(`Found: ${data.medicine.medicine_name} — enter quantity to add stock`);
      } else {
        setScanMsg('Not in inventory. Extracting details…');
        // Text QR codes (medicine box QR with product info) — parse directly, skip external APIs
        const textResult = parseTextQR(code);
        const ext = textResult || await fetchExternalDetails(code);
        closeScan();
        setForm({
          ...EMPTY_FORM,
          barcode:        code,
          medicine_name:  ext?.medicine_name || '',
          manufacturer:   ext?.manufacturer  || '',
          category:       ext?.category      || '',
          unit:           ext?.unit          || 'tablet',
        });
        setShowAdd(true);
        setMsg(ext?.medicine_name
          ? `Details fetched for "${ext.medicine_name}". Verify and add price.`
          : `New barcode ${code}. No match in drug databases — fill details manually.`
        );
      }
    } catch (e) {
      setScanMsg('Lookup failed: ' + e.message);
      setScanLoading(false);
    }
    scanningRef.current = false;
    setScanLoading(false);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.h1}>Pharmacy Inventory</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/pharmacy/alerts" style={s.btnWarn}>⚠ View Alerts</a>
          <button onClick={() => { setShowScan(true); setShowBulk(false); setShowAdd(false); setEditingId(null); }} style={s.btnScan}>⬛ Scan Barcode</button>
          <button onClick={() => { setShowBulk(v => !v); setShowAdd(false); setEditingId(null); }} style={s.btnGray}>↑ Bulk Upload</button>
          <button onClick={() => { setShowAdd(v => !v); setEditingId(null); setShowBulk(false); }} style={s.btnPri}>+ Add Medicine</button>
        </div>
      </div>

      {msg && <div style={s.info}>{msg}<button onClick={() => setMsg('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer' }}>×</button></div>}

      {/* Delete confirmation */}
      {deleteId && (
        <div style={s.overlay}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '2rem', maxWidth: 380, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🗑</div>
            <h2 style={{ color: '#0f1f3d', margin: '0 0 8px' }}>Remove Medicine</h2>
            <p style={{ color: '#64748b', marginBottom: 20 }}>Remove <strong>{deleteName}</strong> from inventory? Stock data is preserved but it won't appear in billing.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteId(null)} style={s.btnSec}>Cancel</button>
              <button onClick={doDelete} style={{ ...s.btnPri, background: '#ef4444' }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Scan Modal */}
      {showScan && (
        <div style={s.overlay}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '1.75rem', width: '90%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f1f3d' }}>⬛ Scan Barcode / QR</h2>
                <p style={{ margin: '4px 0 0', fontSize: '.8rem', color: '#64748b' }}>USB scanner gun, camera, or type manually</p>
              </div>
              <button onClick={closeScan} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
            </div>

            {/* USB scanner / manual input */}
            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>Barcode / QR Code</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={scanBarcode}
                  onChange={e => setScanBarcode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleBarcodeDetected(scanBarcode)}
                  placeholder="Point USB scanner here or type barcode..."
                  autoFocus
                  style={{ ...s.input, flex: 1 }}
                  disabled={scanLoading}
                />
                <button
                  onClick={() => handleBarcodeDetected(scanBarcode)}
                  disabled={scanLoading || !scanBarcode.trim()}
                  style={{ ...s.btnPri, whiteSpace: 'nowrap', opacity: (!scanBarcode.trim() || scanLoading) ? 0.5 : 1 }}
                >
                  {scanLoading ? 'Searching…' : 'Lookup'}
                </button>
              </div>
              <p style={{ fontSize: '.75rem', color: '#94a3b8', margin: '6px 0 0' }}>
                USB/BT scanner gun: just focus this field and scan — it auto-types + submits.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              <span style={{ fontSize: '.75rem', color: '#94a3b8', fontWeight: 600 }}>OR USE CAMERA</span>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            </div>

            <button
              onClick={() => setCameraActive(v => !v)}
              style={{ ...s.btnSec, width: '100%', textAlign: 'center', marginBottom: cameraActive ? 12 : 0, background: cameraActive ? '#fef2f2' : '#f1f5f9', color: cameraActive ? '#b91c1c' : '#0f1f3d', borderColor: cameraActive ? '#fecaca' : '#e2e8f0' }}
            >
              {cameraActive ? '⏹ Stop Camera' : '📷 Enable Camera Scan'}
            </button>

            {cameraActive && (
              <BarcodeScanner
                onDetect={handleBarcodeDetected}
                onError={err => setScanMsg('Camera error: ' + err)}
              />
            )}

            {scanMsg && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: scanMsg.includes('error') || scanMsg.includes('failed') ? '#fef2f2' : '#f0fdfb', borderRadius: 8, fontSize: '.85rem', color: scanMsg.includes('error') || scanMsg.includes('failed') ? '#b91c1c' : '#0f766e', fontWeight: 500 }}>
                {scanMsg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Upload Panel */}
      {showBulk && (
        <div style={{ ...s.card, marginBottom: 16, borderLeft: '4px solid #6366f1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <h2 style={{ ...s.h2, color: '#4f46e5' }}>↑ Bulk Upload Medicines</h2>
              <p style={{ fontSize: '.8rem', color: '#64748b', margin: 0 }}>Upload a CSV file. Required column: <code>medicine_name</code>. Optional: category, unit, unit_price, current_stock, reorder_level, batch_number, expiry_date, manufacturer.</p>
            </div>
            <button onClick={downloadTemplate} style={{ ...s.btnSec, whiteSpace: 'nowrap', flexShrink: 0 }}>⬇ Download Template</button>
          </div>

          {bulkError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: '.85rem', marginBottom: 12 }}>{bulkError}</div>}

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '.6rem 1.2rem', background: '#eff6ff', border: '1.5px dashed #93c5fd', borderRadius: 8, color: '#1d4ed8', fontWeight: 600, fontSize: '.875rem' }}>
            📂 {bulkFileName || 'Choose CSV file'}
            <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>

          {bulkRows.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: '.875rem', color: '#0f1f3d' }}>{bulkRows.length} rows ready to import</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setBulkRows([]); setBulkFileName(''); }} style={s.btnSec}>Clear</button>
                  <button onClick={submitBulk} disabled={bulkLoading} style={s.btnPri}>{bulkLoading ? 'Importing…' : `Import ${bulkRows.length} Medicines`}</button>
                </div>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 260, border: '1px solid #e2e8f0', borderRadius: 8, overflowY: 'auto' }}>
                <table style={{ ...s.table, minWidth: 700 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                      {['Medicine Name','Category','Unit','Price','Stock','Reorder','Batch','Expiry','Manufacturer','Barcode'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ ...s.td, fontWeight: 600 }}>{r.medicine_name || <span style={{ color: '#ef4444' }}>MISSING</span>}</td>
                        <td style={s.td}>{r.category || '–'}</td>
                        <td style={s.td}>{r.unit || 'tablet'}</td>
                        <td style={s.td}>₹{r.unit_price || 0}</td>
                        <td style={s.td}>{r.current_stock || 0}</td>
                        <td style={s.td}>{r.reorder_level || 10}</td>
                        <td style={s.td}>{r.batch_number || '–'}</td>
                        <td style={s.td}>{r.expiry_date || '–'}</td>
                        <td style={s.td}>{r.manufacturer || '–'}</td>
                        <td style={s.td}>{r.barcode ? <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#f0fdfb', color: '#0f766e', padding: '2px 6px', borderRadius: 4 }}>{r.barcode}</span> : <span style={{ color: '#cbd5e1' }}>–</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search medicines..." style={{ ...s.input, maxWidth: 360 }} />
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ ...s.card, marginBottom: 16, borderLeft: '4px solid #00b4a0' }}>
          <h2 style={s.h2}>Add New Medicine</h2>
          <MedicineForm form={form} setForm={setForm} s={s} autoFocusName={!!form.barcode} />
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button onClick={addMedicine} disabled={loading} style={s.btnPri}>{loading ? 'Adding...' : 'Add Medicine'}</button>
            <button onClick={() => setShowAdd(false)} style={s.btnSec}>Cancel</button>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editingId && (
        <div style={{ ...s.card, marginBottom: 16, borderLeft: '4px solid #6366f1' }}>
          <h2 style={{ ...s.h2, color: '#4f46e5' }}>Edit Medicine</h2>
          <MedicineForm form={editForm} setForm={setEditForm} s={s} />
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button onClick={saveEdit} disabled={editLoading} style={{ ...s.btnPri, background: '#6366f1' }}>{editLoading ? 'Saving...' : 'Save Changes'}</button>
            <button onClick={() => setEditingId(null)} style={s.btnSec}>Cancel</button>
          </div>
        </div>
      )}

      <div style={s.card}>
        <table style={s.table}>
          <thead>
            <tr>
              {['Medicine', 'Category', 'Unit', 'Barcode', 'Stock', 'Reorder Level', 'Unit Price', 'Batch', 'Expiry', 'Actions'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inventory.map(m => {
              const isLow      = m.current_stock <= m.reorder_level;
              const isExpired  = m.expiry_date && m.expiry_date <= today;
              const isExpiring = m.expiry_date && !isExpired && m.expiry_date <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              const isEditing  = editingId === m.id;
              return (
                <tr key={m.id} style={{ background: isEditing ? '#f5f3ff' : isExpired ? '#fef2f2' : isLow ? '#fffbeb' : 'transparent' }}>
                  <td style={s.td}><span style={{ fontWeight: 600 }}>{m.medicine_name}</span></td>
                  <td style={s.td}>{m.category || '–'}</td>
                  <td style={s.td}>{m.unit}</td>
                  <td style={s.td}>
                    {m.barcode
                      ? <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#f0fdfb', color: '#0f766e', padding: '2px 6px', borderRadius: 4 }}>{m.barcode}</span>
                      : <span style={{ color: '#cbd5e1', fontSize: 12 }}>–</span>}
                  </td>
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
                  <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {showStock === m.id ? (
                        <>
                          <input type="number" value={stockQty} onChange={e => setStockQty(e.target.value)} style={{ ...s.input, width: 70, padding: '4px 8px' }} placeholder="Qty" autoFocus />
                          <button onClick={() => addStock(m.id)} style={s.actGreen}>Add</button>
                          <button onClick={() => setShowStock(null)} style={s.actGhost}>×</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setShowStock(m.id)} style={s.actGreen}>+ Stock</button>
                          <button onClick={() => startEdit(m)} style={s.actBlue}>✏ Edit</button>
                          <button onClick={() => confirmDelete(m)} style={s.actRed}>🗑</button>
                        </>
                      )}
                    </div>
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

// ── Camera Barcode Scanner Component ─────────────────────────────────────────
function BarcodeScanner({ onDetect, onError }) {
  const videoRef    = useRef(null);
  const readerRef   = useRef(null);
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  useEffect(() => {
    let lastCode = '';
    let lastTime = 0;
    const start = async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/library');
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;
        const devices = await reader.listVideoInputDevices();
        const deviceId = devices[0]?.deviceId;
        await reader.decodeFromVideoDevice(deviceId, videoRef.current, (result) => {
          if (!result) return;
          const text = result.getText();
          const now  = Date.now();
          if (text === lastCode && now - lastTime < 2000) return;
          lastCode = text; lastTime = now;
          onDetectRef.current(text);
        });
      } catch (e) {
        if (onError) onError(e.message);
      }
    };
    start();
    return () => { try { readerRef.current?.reset(); } catch (_) {} };
  }, []);

  return (
    <div>
      <video ref={videoRef} style={{ width: '100%', maxHeight: 280, borderRadius: 8, background: '#111', display: 'block' }} />
      <p style={{ fontSize: '.75rem', color: '#64748b', textAlign: 'center', margin: '8px 0 0' }}>
        Point camera at barcode or QR code — auto-detects
      </p>
    </div>
  );
}

// ── Medicine Form ─────────────────────────────────────────────────────────────
function MedicineForm({ form, setForm, s, autoFocusName = false }) {
  return (
    <div style={s.grid3}>
      <div style={s.fg}><label style={s.label}>Medicine Name *</label><input autoFocus={autoFocusName} value={form.medicine_name} onChange={e => setForm(f => ({ ...f, medicine_name: e.target.value }))} style={s.input} placeholder="e.g. Paracetamol 500mg" /></div>
      <div style={s.fg}><label style={s.label}>Category</label><input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={s.input} placeholder="e.g. Analgesic" /></div>
      <div style={s.fg}><label style={s.label}>Unit</label>
        <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={s.input}>
          {['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'sachet', 'strip'].map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div style={s.fg}><label style={s.label}>Unit Price (₹) *</label><input type="number" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} style={s.input} placeholder="0.00" /></div>
      <div style={s.fg}><label style={s.label}>Initial Stock (qty)</label><input type="number" value={form.initial_stock} onChange={e => setForm(f => ({ ...f, initial_stock: e.target.value }))} style={s.input} placeholder="0" /></div>
      <div style={s.fg}><label style={s.label}>Reorder Level</label><input type="number" value={form.reorder_level} onChange={e => setForm(f => ({ ...f, reorder_level: e.target.value }))} style={s.input} /></div>
      <div style={s.fg}><label style={s.label}>Barcode / QR</label><input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} style={s.input} placeholder="Optional — scan or type" /></div>
      <div style={s.fg}><label style={s.label}>Batch Number</label><input value={form.batch_number} onChange={e => setForm(f => ({ ...f, batch_number: e.target.value }))} style={s.input} /></div>
      <div style={s.fg}><label style={s.label}>Expiry Date</label><input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} style={s.input} /></div>
      <div style={s.fg}><label style={s.label}>Manufacturer</label><input value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} style={s.input} /></div>
    </div>
  );
}

const s = {
  page:     { padding: '2rem', maxWidth: 1400, margin: '0 auto' },
  header:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  h1:       { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2:       { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', marginBottom: 14 },
  card:     { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  grid3:    { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 },
  fg:       { display: 'flex', flexDirection: 'column' },
  label:    { fontSize: '.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: 4 },
  input:    { width: '100%', padding: '.6rem .9rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem', boxSizing: 'border-box' },
  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  table:    { width: '100%', borderCollapse: 'collapse' },
  th:       { textAlign: 'left', padding: '10px 12px', background: '#f8fafc', fontSize: '.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' },
  td:       { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '.875rem' },
  info:     { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.875rem', marginBottom: 16, display: 'flex', alignItems: 'center' },
  btnPri:   { padding: '.6rem 1.2rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem' },
  btnScan:  { padding: '.6rem 1.2rem', background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem' },
  btnGray:  { padding: '.6rem 1.2rem', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem' },
  btnSec:   { padding: '.6rem 1rem', background: '#f1f5f9', color: '#0f1f3d', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem' },
  btnWarn:  { padding: '.6rem 1rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem', textDecoration: 'none' },
  actGreen: { padding: '4px 10px', background: '#f0fdf4', color: '#065f46', border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 },
  actBlue:  { padding: '4px 10px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 },
  actRed:   { padding: '4px 8px',  background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 },
  actGhost: { padding: '4px 8px',  background: 'none',    color: '#94a3b8', border: 'none',              borderRadius: 6, cursor: 'pointer', fontSize: '.9rem' },
  empty:    { color: '#94a3b8', textAlign: 'center', padding: '2rem' },
};
