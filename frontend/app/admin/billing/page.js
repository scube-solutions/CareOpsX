'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { T } from '../layout';

const GST_OPTIONS = [0, 5, 12, 18];
const PAYMENT_MODES = ['cash', 'upi', 'card', 'net_banking'];

const initialInvoiceForm = {
  patient_id: '',
  doctor_id: '',
  consultation_fee: 0,
  medicine_amount: 0,
  test_amount: 0,
  discount: 0,
  gst_percent: 18,
  notes: '',
  payment_mode: 'cash',
};

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (v) => Math.round(v * 100) / 100;

const money = (v) => `Rs ${Number(v || 0).toFixed(2)}`;

export default function AdminBillingPage() {
  const [tab, setTab] = useState('new');
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [form, setForm] = useState(initialInvoiceForm);

  const [historyStatus, setHistoryStatus] = useState('');
  const [historyPatientId, setHistoryPatientId] = useState('');
  const [historyDoctorId, setHistoryDoctorId] = useState('');

  const [paymentModal, setPaymentModal] = useState({ open: false, invoice: null, mode: 'cash', saving: false, error: '' });

  const loadMeta = async () => {
    setLoadingMeta(true);
    try {
      const [patientsRes, doctorsRes] = await Promise.all([
        api('/patients'),
        api('/doctors'),
      ]);

      setPatients(patientsRes.patients || []);
      setDoctors(doctorsRes.doctors || []);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoadingMeta(false);
    }
  };

  const loadInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const params = new URLSearchParams();
      if (historyStatus) params.append('status', historyStatus);
      if (historyPatientId) params.append('patient_id', historyPatientId);
      if (historyDoctorId) params.append('doctor_id', historyDoctorId);

      const query = params.toString();
      const res = await api(`/billing/invoices${query ? `?${query}` : ''}`);
      setInvoices(res.invoices || []);
    } catch (err) {
      console.error(err.message);
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    loadMeta();
    loadInvoices();
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [historyStatus, historyPatientId, historyDoctorId]);

  const selectedDoctor = useMemo(
    () => doctors.find((d) => String(d.id) === String(form.doctor_id)),
    [doctors, form.doctor_id]
  );

  useEffect(() => {
    if (!selectedDoctor) return;
    setForm((prev) => ({
      ...prev,
      consultation_fee: Number(selectedDoctor.consultation_fee || 0),
    }));
  }, [selectedDoctor?.id]);

  const preview = useMemo(() => {
    const consultation = toNumber(form.consultation_fee);
    const medicine = toNumber(form.medicine_amount);
    const test = toNumber(form.test_amount);
    const discount = toNumber(form.discount);
    const gstPercent = toNumber(form.gst_percent);

    const subtotal = round2(consultation + medicine + test);
    const taxable = round2(Math.max(subtotal - discount, 0));
    const gst = round2((taxable * gstPercent) / 100);
    const total = round2(taxable + gst);

    return { subtotal, taxable, gst, total };
  }, [form]);

  const doctorLabel = (doctor) => {
    if (!doctor) return '-';
    const name = `${doctor.users?.first_name || ''} ${doctor.users?.last_name || ''}`.trim() || doctor.users?.name || 'Doctor';
    return `Dr. ${name}`;
  };

  const patientLabel = (patient) => {
    if (!patient) return '-';
    const name = `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || '-';
    return `${name} (${patient.phone || '-'})`;
  };

  const onCreateInvoice = async (e) => {
    e.preventDefault();
    setInvoiceError('');

    if (!form.patient_id || !form.doctor_id) {
      setInvoiceError('Please select both patient and doctor.');
      return;
    }

    setSavingInvoice(true);
    try {
      await api('/billing/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: form.patient_id,
          doctor_id: form.doctor_id,
          consultation_fee: toNumber(form.consultation_fee),
          medicine_amount: toNumber(form.medicine_amount),
          test_amount: toNumber(form.test_amount),
          discount: toNumber(form.discount),
          gst_percent: toNumber(form.gst_percent),
          notes: form.notes || null,
          payment_mode: form.payment_mode,
        }),
      });

      setForm(initialInvoiceForm);
      setTab('history');
      loadInvoices();
    } catch (err) {
      setInvoiceError(err.message || 'Failed to create invoice');
    } finally {
      setSavingInvoice(false);
    }
  };

  const openRecordPayment = (invoice) => {
    setPaymentModal({ open: true, invoice, mode: 'cash', saving: false, error: '' });
  };

  const recordPayment = async () => {
    setPaymentModal((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      await api('/billing/payments', {
        method: 'POST',
        body: JSON.stringify({
          invoice_id: paymentModal.invoice.id,
          payment_mode: paymentModal.mode,
        }),
      });
      setPaymentModal({ open: false, invoice: null, mode: 'cash', saving: false, error: '' });
      loadInvoices();
    } catch (err) {
      setPaymentModal((prev) => ({ ...prev, saving: false, error: err.message || 'Failed to record payment' }));
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <header style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontFamily: T.display, color: T.navy, fontSize: 24 }}>Billing</h1>
        <p style={{ margin: '4px 0 0', color: T.muted, fontSize: 13 }}>Generate invoices with server-side totals and collect payments safely</p>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[
          ['new', 'New Invoice'],
          ['history', 'Invoice History'],
        ].map(([key, label]) => {
          const active = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)} style={{ border: `1px solid ${active ? T.teal : T.border}`, background: active ? '#ecfeff' : '#fff', color: active ? '#0f766e' : T.text, borderRadius: 999, padding: '8px 13px', cursor: 'pointer', fontWeight: 600 }}>
              {label}
            </button>
          );
        })}
      </div>

      {tab === 'new' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 12 }}>
          <form onSubmit={onCreateInvoice} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
            {loadingMeta ? (
              <div style={{ color: T.muted }}>Loading doctors and patients...</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: T.muted, marginBottom: 4 }}>Patient</label>
                    <select value={form.patient_id} onChange={(e) => setForm((prev) => ({ ...prev, patient_id: e.target.value }))} style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 10px' }}>
                      <option value=''>Select patient</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>{patientLabel(p)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: T.muted, marginBottom: 4 }}>Doctor</label>
                    <select value={form.doctor_id} onChange={(e) => setForm((prev) => ({ ...prev, doctor_id: e.target.value }))} style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 10px' }}>
                      <option value=''>Select doctor</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>{doctorLabel(d)} � {d.specialization}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 10 }}>
                  {[
                    ['consultation_fee', 'Consultation Fee'],
                    ['medicine_amount', 'Medicine Amount'],
                    ['test_amount', 'Test Amount'],
                    ['discount', 'Discount'],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label style={{ display: 'block', fontSize: 12, color: T.muted, marginBottom: 4 }}>{label}</label>
                      <input type='number' min='0' step='0.01' value={form[key]} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))} style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 10px' }} />
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, color: T.muted, marginBottom: 6 }}>GST Rate</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {GST_OPTIONS.map((rate) => {
                      const active = Number(form.gst_percent) === rate;
                      return (
                        <button key={rate} type='button' onClick={() => setForm((prev) => ({ ...prev, gst_percent: rate }))} style={{ border: `1px solid ${active ? T.teal : T.border}`, background: active ? '#ecfeff' : '#fff', color: active ? '#0f766e' : T.text, borderRadius: 999, padding: '6px 11px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                          {rate}%
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, color: T.muted, marginBottom: 4 }}>Collect payment now</label>
                  <select value={form.payment_mode} onChange={(e) => setForm((prev) => ({ ...prev, payment_mode: e.target.value }))} style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 10px' }}>
                    {PAYMENT_MODES.map((mode) => (
                      <option key={mode} value={mode}>{mode.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, color: T.muted, marginBottom: 4 }}>Notes</label>
                  <textarea rows={3} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 10px', resize: 'vertical' }} />
                </div>

                {invoiceError && (
                  <div style={{ marginBottom: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 10px', color: '#b91c1c', fontSize: 13 }}>
                    {invoiceError}
                  </div>
                )}

                <button type='submit' disabled={savingInvoice} style={{ border: 'none', background: T.teal, color: '#fff', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', fontWeight: 700 }}>
                  {savingInvoice ? 'Generating...' : 'Generate Invoice'}
                </button>
              </>
            )}
          </form>

          <aside style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ color: T.navy, fontFamily: T.display, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Live Invoice Preview</div>
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, background: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: T.muted }}>Patient</span>
                <span style={{ color: T.text }}>{patientLabel(patients.find((p) => String(p.id) === String(form.patient_id)))}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: T.muted }}>Doctor</span>
                <span style={{ color: T.text }}>{doctorLabel(doctors.find((d) => String(d.id) === String(form.doctor_id)))}</span>
              </div>
              <hr style={{ border: 0, borderTop: `1px solid ${T.border}`, margin: '8px 0' }} />

              {[
                ['Consultation', toNumber(form.consultation_fee)],
                ['Medicines', toNumber(form.medicine_amount)],
                ['Tests', toNumber(form.test_amount)],
                ['Subtotal', preview.subtotal],
                ['Discount', -toNumber(form.discount)],
                [`GST (${toNumber(form.gst_percent)}%)`, preview.gst],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: T.muted }}>{label}</span>
                  <span style={{ color: T.text }}>{money(value)}</span>
                </div>
              ))}

              <hr style={{ border: 0, borderTop: `1px solid ${T.border}`, margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800 }}>
                <span style={{ color: T.navy }}>Total</span>
                <span style={{ color: T.navy }}>{money(preview.total)}</span>
              </div>
              <div style={{ marginTop: 8, color: T.muted, fontSize: 12 }}>
                Payment mode: {form.payment_mode === 'later' ? 'Later (Pending)' : form.payment_mode.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </div>
            </div>
          </aside>
        </div>
      )}

      {tab === 'history' && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: 12, borderBottom: `1px solid ${T.border}`, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <select value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 10px' }}>
              <option value=''>All statuses</option>
              <option value='pending'>Pending</option>
              <option value='paid'>Paid</option>
            </select>
            <select value={historyPatientId} onChange={(e) => setHistoryPatientId(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 10px' }}>
              <option value=''>All patients</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{patientLabel(p)}</option>
              ))}
            </select>
            <select value={historyDoctorId} onChange={(e) => setHistoryDoctorId(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 10px' }}>
              <option value=''>All doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{doctorLabel(d)}</option>
              ))}
            </select>
          </div>

          {loadingInvoices ? (
            <div style={{ padding: 20, color: T.muted }}>Loading invoices...</div>
          ) : invoices.length === 0 ? (
            <div style={{ padding: 20, color: T.muted }}>No invoices found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Invoice', 'Patient', 'Doctor', 'Total', 'Status', 'Action'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 12, color: T.muted, padding: '11px 14px', borderBottom: `1px solid ${T.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const docName = `${inv.doctors?.users?.first_name || ''} ${inv.doctors?.users?.last_name || ''}`.trim() || inv.doctors?.users?.name || 'Doctor';
                    const isPaid = inv.status === 'paid';
                    return (
                      <tr key={inv.id}>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}` }}>
                          <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{inv.invoice_number || inv.id}</div>
                          <div style={{ color: T.muted, fontSize: 11 }}>{(inv.created_at || '').slice(0, 10)}</div>
                        </td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>{`${inv.patients?.first_name || ''} ${inv.patients?.last_name || ''}`.trim() || '-'}<div style={{ color: T.muted, fontSize: 12 }}>{inv.patients?.phone || '-'}</div></td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>Dr. {docName}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}`, fontSize: 13, fontWeight: 700 }}>{money(inv.total_amount || 0)}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}` }}>
                          <span style={{ background: isPaid ? '#dcfce7' : '#fef3c7', color: isPaid ? '#166534' : '#92400e', borderRadius: 999, fontSize: 12, fontWeight: 700, padding: '4px 10px' }}>
                            {isPaid ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}` }}>
                          {isPaid ? (
                            <span style={{ color: T.muted }}>�</span>
                          ) : (
                            <button onClick={() => openRecordPayment(inv)} style={{ border: `1px solid ${T.border}`, background: '#fff', color: T.text, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>
                              Record payment
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {paymentModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.36)', display: 'grid', placeItems: 'center', zIndex: 30 }}>
          <div style={{ width: 'min(460px, 92vw)', background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 16 }}>
            <h3 style={{ margin: 0, fontFamily: T.display, color: T.navy, fontSize: 20 }}>Record Payment</h3>
            <p style={{ margin: '6px 0 10px', color: T.muted, fontSize: 13 }}>Invoice: {paymentModal.invoice?.invoice_number || paymentModal.invoice?.id}</p>

            <label style={{ display: 'block', fontSize: 12, color: T.muted, marginBottom: 4 }}>Payment Mode</label>
            <select value={paymentModal.mode} onChange={(e) => setPaymentModal((prev) => ({ ...prev, mode: e.target.value }))} style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 10px', marginBottom: 10 }}>
              {PAYMENT_MODES.map((mode) => (
                <option key={mode} value={mode}>{mode.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
              ))}
            </select>

            {paymentModal.error && (
              <div style={{ marginBottom: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 10px', color: '#b91c1c', fontSize: 13 }}>
                {paymentModal.error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setPaymentModal({ open: false, invoice: null, mode: 'cash', saving: false, error: '' })}
                disabled={paymentModal.saving}
                style={{ border: `1px solid ${T.border}`, background: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button onClick={recordPayment} disabled={paymentModal.saving} style={{ border: 'none', background: T.teal, color: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>
                {paymentModal.saving ? 'Saving...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
