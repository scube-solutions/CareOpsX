'use client';
import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';

const STATUS_COLORS = {
  ordered:          '#f59e0b',
  sample_collected: '#3b82f6',
  processing:       '#8b5cf6',
  ready:            '#10b981',
  delivered:        '#64748b',
  cancelled:        '#ef4444',
};
const STATUS_ORDER = ['ordered', 'sample_collected', 'processing', 'ready', 'delivered'];
const NEXT = { ordered: 'sample_collected', sample_collected: 'processing', processing: 'ready', ready: 'delivered' };

export default function LabOrdersPage() {
  const [orders, setOrders]         = useState([]);
  const [selected, setSelected]     = useState(null);
  const [filter, setFilter]         = useState('');
  const [showReport, setShowReport] = useState(false);
  const [uploadMode, setUploadMode] = useState('manual'); // 'manual' | 'file'
  const [reportForm, setReportForm] = useState({ findings: '', remarks: '', is_normal: true, report_url: '' });
  const [fileInfo, setFileInfo]     = useState(null);   // { name, base64, type }
  const [uploading, setUploading]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState('');
  const [labPayMode, setLabPayMode]           = useState('');
  const [labPayCollected, setLabPayCollected] = useState(false);
  const [labPayAmount, setLabPayAmount]       = useState('');
  const fileRef                     = useRef();

  const load = async () => {
    try {
      const data = await api(`/lab/orders${filter ? `?status=${filter}` : ''}`);
      setOrders(data.lab_orders || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, [filter]);

  // Reset payment state when selected order changes
  useEffect(() => {
    setLabPayMode('');
    setLabPayCollected(false);
    setLabPayAmount('');
  }, [selected?.id]);

  const collectLabPayment = async () => {
    if (!labPayAmount || parseFloat(labPayAmount) <= 0) { setMsg('Enter a valid test fee amount'); return; }
    try {
      await api('/billing/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: selected.patient_id,
          doctor_id:  selected.doctor_id || null,
          test_amount: parseFloat(labPayAmount),
          payment_mode: labPayMode,
          invoice_type: 'lab',
        }),
      });
      await updateStatus(selected.id, 'sample_collected');
      setLabPayCollected(true);
      setMsg('Payment collected — order advanced to Sample Collected');
    } catch (e) { setMsg(e.message); }
  };

  const updateStatus = async (id, status) => {
    try {
      await api(`/lab/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMsg(`Status updated to ${status.replace(/_/g, ' ')}`);
      load();
    } catch (e) { setMsg(e.message); }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const base64 = ev.target.result.split(',')[1];
      setFileInfo({ name: file.name, base64, type: file.type });
    };
    reader.readAsDataURL(file);
  };

  const uploadFile = async () => {
    if (!fileInfo) return null;
    setUploading(true);
    try {
      const { url } = await api('/lab/upload-file', {
        method: 'POST',
        body: JSON.stringify({ base64: fileInfo.base64, filename: fileInfo.name, content_type: fileInfo.type }),
      });
      return url;
    } catch (e) {
      setMsg('File upload failed: ' + e.message);
      return null;
    } finally { setUploading(false); }
  };

  const submitReport = async () => {
    if (!selected) return;

    let report_url = reportForm.report_url;

    if (uploadMode === 'file') {
      if (!fileInfo) { setMsg('Please select a file to upload'); return; }
      report_url = await uploadFile();
      if (!report_url) return;
    } else {
      if (!reportForm.findings) { setMsg('Findings are required'); return; }
    }

    setSaving(true);
    try {
      await api('/lab/reports', {
        method: 'POST',
        body: JSON.stringify({
          lab_order_id:    selected.id,
          patient_id:      selected.patient_id,
          doctor_id:       selected.doctor_id,
          consultation_id: selected.consultation_id,
          ...reportForm,
          report_url,
        }),
      });
      setMsg('Report submitted successfully');
      setShowReport(false);
      setSelected(null);
      setFileInfo(null);
      setReportForm({ findings: '', remarks: '', is_normal: true, report_url: '' });
      load();
    } catch (e) { setMsg(e.message); } finally { setSaving(false); }
  };

  const openReportForm = (o) => {
    setSelected(o);
    setShowReport(true);
    setUploadMode('manual');
    setFileInfo(null);
    setReportForm({ findings: '', remarks: '', is_normal: true, report_url: '' });
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.h1}>Lab Orders</h1>
          <p style={s.sub}>Manage all lab test orders</p>
        </div>
        <button onClick={load} style={s.btnSec}>↻ Refresh</button>
      </div>

      {msg && (
        <div style={s.info}>
          {msg}
          <button onClick={() => setMsg('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[{ v: '', label: 'All' }, ...STATUS_ORDER.map(st => ({ v: st, label: st.replace(/_/g, ' ') }))].map(f => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            style={{ padding: '5px 14px', borderRadius: 20, border: `1.5px solid ${filter === f.v ? '#00b4a0' : '#e2e8f0'}`, background: filter === f.v ? '#00b4a0' : '#fff', color: filter === f.v ? '#fff' : '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '.8rem', textTransform: 'capitalize' }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 20 }}>
        {/* Orders table */}
        <div style={s.card}>
          {orders.length === 0
            ? <p style={s.empty}>No orders found.</p>
            : (
              <table style={s.table}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Patient', 'Test', 'Urgency', 'Ordered At', 'Status', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} onClick={() => { setSelected(o); setShowReport(false); }}
                      style={{ cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: selected?.id === o.id ? '#f0f9ff' : 'transparent' }}>
                      <td style={s.td}>
                        <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{o.patients?.first_name} {o.patients?.last_name}</div>
                        <div style={{ fontSize: '.75rem', color: '#64748b' }}>{o.patients?.patient_uid}</div>
                      </td>
                      <td style={s.td}>
                        <span style={{ fontWeight: 600 }}>{o.test_name}</span>
                        {o.test_code && <div style={{ fontSize: '.75rem', color: '#64748b' }}>{o.test_code}</div>}
                      </td>
                      <td style={s.td}>
                        <span style={{ background: o.urgency === 'urgent' ? '#fef3c7' : '#f1f5f9', color: o.urgency === 'urgent' ? '#92400e' : '#64748b', padding: '2px 8px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>
                          {o.urgency}
                        </span>
                      </td>
                      <td style={{ ...s.td, fontSize: '.8rem', color: '#64748b' }}>{new Date(o.ordered_at).toLocaleString('en-IN')}</td>
                      <td style={s.td}>
                        <span style={{ background: (STATUS_COLORS[o.status] || '#94a3b8') + '20', color: STATUS_COLORS[o.status] || '#94a3b8', padding: '3px 10px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600 }}>
                          {(o.status || '').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={s.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {NEXT[o.status] && (
                            <button onClick={e => { e.stopPropagation(); updateStatus(o.id, NEXT[o.status]); }}
                              style={{ ...s.actBtn, color: STATUS_COLORS[NEXT[o.status]], borderColor: STATUS_COLORS[NEXT[o.status]] + '60' }}>
                              → {NEXT[o.status].replace(/_/g, ' ')}
                            </button>
                          )}
                          {['processing', 'ready'].includes(o.status) && (
                            <button onClick={e => { e.stopPropagation(); openReportForm(o); }}
                              style={{ ...s.actBtn, background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>
                              Upload Report
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>

        {/* Detail / Report panel */}
        {selected && (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={s.h2}>Order Detail</h2>
              <button onClick={() => { setSelected(null); setShowReport(false); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>

            {/* Patient / test info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {[
                ['Patient',    `${selected.patients?.first_name || ''} ${selected.patients?.last_name || ''}`.trim()],
                ['Patient ID', selected.patients?.patient_uid || '–'],
                ['Phone',      selected.patients?.phone || '–'],
                ['Test',       selected.test_name],
                ['Test Code',  selected.test_code || '–'],
                ['Status',     (selected.status || '').replace(/_/g, ' ')],
                ['Urgency',    selected.urgency],
                ['Doctor',     `${selected.doctors?.users?.first_name || ''} ${selected.doctors?.users?.last_name || ''}`.trim() || '–'],
                ['Notes',      selected.notes || '–'],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '.78rem', color: '#94a3b8' }}>{l}</span>
                  <span style={{ fontSize: '.84rem', fontWeight: 600, color: '#0f1f3d', textAlign: 'right', maxWidth: '62%' }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Payment collection — only for new orders */}
            {selected.status === 'ordered' && !labPayCollected && (
              <div style={{ marginBottom: 16, background: '#fafafa', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '1rem' }}>
                <div style={{ fontWeight: 700, color: '#0f1f3d', marginBottom: 10, fontSize: '.875rem' }}>💰 Collect Test Fee</div>
                <div style={{ marginBottom: 10 }}>
                  <label style={s.label}>Test Fee (₹)</label>
                  <input type="number" min="0" placeholder="Enter amount" value={labPayAmount}
                    onChange={e => setLabPayAmount(e.target.value)}
                    style={{ ...s.input, width: '100%' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {[
                    { key: 'cash', label: '💵 Cash',       sub: 'Collect at counter', available: true  },
                    { key: 'upi',  label: '📱 UPI',        sub: 'Coming soon',        available: false },
                    { key: 'card', label: '💳 Card Swipe', sub: 'Coming soon',        available: false },
                  ].map(m => (
                    <button key={m.key} onClick={() => m.available && setLabPayMode(m.key)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: 8, fontSize: '.8rem', fontWeight: 600,
                        cursor: m.available ? 'pointer' : 'not-allowed',
                        border: `1.5px solid ${labPayMode === m.key ? '#0f766e' : '#e2e8f0'}`,
                        background: !m.available ? '#f8fafc' : labPayMode === m.key ? '#f0fdfb' : '#fff',
                        color: !m.available ? '#94a3b8' : labPayMode === m.key ? '#065f46' : '#334155' }}>
                      <span>{m.label}</span>
                      <span style={{ fontSize: '.68rem', opacity: .7 }}>{m.sub}</span>
                    </button>
                  ))}
                </div>
                <button onClick={collectLabPayment} disabled={!labPayMode || !labPayAmount}
                  style={{ ...s.btnPri, width: '100%', opacity: (!labPayMode || !labPayAmount) ? .5 : 1 }}>
                  ✓ Collect & Advance to Sample Collection
                </button>
              </div>
            )}
            {selected.status === 'ordered' && labPayCollected && (
              <div style={{ marginBottom: 14, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#15803d', fontWeight: 600, fontSize: 13 }}>
                ✅ Payment collected — sample collection in progress
              </div>
            )}

            {showReport ? (
              <div>
                {/* Mode tabs */}
                <div style={{ display: 'flex', gap: 0, marginBottom: 14, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  {['manual', 'file'].map(m => (
                    <button key={m} onClick={() => { setUploadMode(m); setFileInfo(null); }}
                      style={{ flex: 1, padding: '8px', background: uploadMode === m ? '#0f1f3d' : '#f8fafc', color: uploadMode === m ? '#fff' : '#64748b', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '.8rem' }}>
                      {m === 'manual' ? '✏️ Type Manually' : '📎 Upload File'}
                    </button>
                  ))}
                </div>

                {uploadMode === 'manual' ? (
                  <div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={s.label}>Findings *</label>
                      <textarea value={reportForm.findings} onChange={e => setReportForm({ ...reportForm, findings: e.target.value })}
                        style={{ ...s.input, height: 80, width: '100%', resize: 'vertical' }} placeholder="Enter test findings..." />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={s.label}>Remarks</label>
                      <textarea value={reportForm.remarks} onChange={e => setReportForm({ ...reportForm, remarks: e.target.value })}
                        style={{ ...s.input, height: 60, width: '100%', resize: 'vertical' }} placeholder="Additional remarks..." />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={s.label}>Report URL (optional)</label>
                      <input value={reportForm.report_url} onChange={e => setReportForm({ ...reportForm, report_url: e.target.value })}
                        style={{ ...s.input, width: '100%' }} placeholder="https://..." />
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Drop zone */}
                    <div
                      onClick={() => fileRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = ev => setFileInfo({ name: file.name, base64: ev.target.result.split(',')[1], type: file.type });
                          reader.readAsDataURL(file);
                        }
                      }}
                      style={{ border: '2px dashed #bfdbfe', borderRadius: 10, padding: '2rem', textAlign: 'center', cursor: 'pointer', background: fileInfo ? '#f0fdf4' : '#f8fbff', marginBottom: 10 }}>
                      {fileInfo ? (
                        <div>
                          <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>✅</div>
                          <div style={{ fontWeight: 600, color: '#166534', fontSize: '.875rem' }}>{fileInfo.name}</div>
                          <div style={{ fontSize: '.75rem', color: '#64748b', marginTop: 4 }}>Click to change file</div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: '2rem', marginBottom: 8 }}>📄</div>
                          <div style={{ fontWeight: 600, color: '#1d4ed8', fontSize: '.875rem' }}>Click or drag & drop</div>
                          <div style={{ fontSize: '.75rem', color: '#64748b', marginTop: 4 }}>PDF, DOC, DOCX, JPG, PNG</div>
                        </div>
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleFileChange} style={{ display: 'none' }} />

                    <div style={{ marginBottom: 10 }}>
                      <label style={s.label}>Findings (optional summary)</label>
                      <textarea value={reportForm.findings} onChange={e => setReportForm({ ...reportForm, findings: e.target.value })}
                        style={{ ...s.input, height: 60, width: '100%', resize: 'vertical' }} placeholder="Brief summary of findings..." />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={s.label}>Remarks</label>
                      <textarea value={reportForm.remarks} onChange={e => setReportForm({ ...reportForm, remarks: e.target.value })}
                        style={{ ...s.input, height: 50, width: '100%', resize: 'vertical' }} />
                    </div>
                  </div>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: '.875rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={reportForm.is_normal} onChange={e => setReportForm({ ...reportForm, is_normal: e.target.checked })} />
                  Results within normal range
                </label>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={submitReport} disabled={saving || uploading} style={s.btnPri}>
                    {uploading ? 'Uploading file...' : saving ? 'Saving...' : 'Submit Report'}
                  </button>
                  <button onClick={() => setShowReport(false)} style={s.btnSec}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => openReportForm(selected)} style={{ ...s.btnPri, width: '100%' }}>
                Upload / Submit Report
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  page:   { padding: '2rem', maxWidth: 1400, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  h1:     { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2:     { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', margin: 0 },
  sub:    { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  card:   { background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  table:  { width: '100%', borderCollapse: 'collapse' },
  th:     { textAlign: 'left', padding: '10px 12px', fontSize: '.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0' },
  td:     { padding: '10px 12px', fontSize: '.875rem', color: '#334155' },
  label:  { display: 'block', fontSize: '.72rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 },
  input:  { padding: '.55rem .85rem', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: '.875rem', boxSizing: 'border-box' },
  btnPri: { padding: '.6rem 1.2rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem' },
  btnSec: { padding: '.6rem 1rem', background: '#f1f5f9', color: '#0f1f3d', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem' },
  actBtn: { padding: '4px 10px', background: '#f0fdf4', color: '#065f46', border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 },
  info:   { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.875rem', marginBottom: 16, display: 'flex', alignItems: 'center' },
  empty:  { color: '#94a3b8', fontSize: '.875rem', textAlign: 'center', padding: '2rem 0' },
};
