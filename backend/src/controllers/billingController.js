const supabase = require('../utils/supabase');
const { auditLog } = require('../middlewares/audit');

const generateInvoiceNumber = () => {
  const now = new Date();
  return `INV-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}-${Math.floor(10000+Math.random()*90000)}`;
};

const attachPatients = async (rows, idField = 'patient_id') => {
  const ids = [...new Set(rows.map(r => r[idField]).filter(Boolean))];
  if (!ids.length) return {};
  const { data } = await supabase.from('patients').select('id, first_name, last_name, patient_uid, phone').in('id', ids);
  const map = {};
  (data || []).forEach(p => { map[p.id] = p; });
  return map;
};

const attachDoctorNames = async (rows, idField = 'doctor_id') => {
  const ids = [...new Set(rows.map(r => r[idField]).filter(Boolean))];
  if (!ids.length) return {};
  const { data: doctors } = await supabase.from('doctors').select('id, user_id').in('id', ids);
  if (!doctors?.length) return {};
  const userIds = [...new Set(doctors.map(d => d.user_id).filter(Boolean))];
  const { data: users } = await supabase.from('users').select('id, first_name, last_name').in('id', userIds);
  const userMap = {};
  (users || []).forEach(u => { userMap[u.id] = u; });
  const nameMap = {};
  doctors.forEach(d => {
    const u = userMap[d.user_id];
    nameMap[d.id] = u ? { first_name: u.first_name, last_name: u.last_name } : { first_name: 'Unknown', last_name: '' };
  });
  return nameMap;
};

// ── Get Invoices ──────────────────────────────────────────────────────────────
const getInvoices = async (req, res) => {
  try {
    const { patient_id, status, invoice_type, date_from, date_to, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase.from('invoices')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (patient_id) query = query.eq('patient_id', patient_id);
    if (status) query = query.eq('status', status);
    if (invoice_type) query = query.eq('invoice_type', invoice_type);
    if (date_from) query = query.gte('created_at', `${date_from}T00:00:00`);
    if (date_to) query = query.lte('created_at', `${date_to}T23:59:59`);

    const { data, error, count } = await query;
    if (error) throw error;

    const patientMap = await attachPatients(data || []);
    const doctorMap = await attachDoctorNames(data || []);

    const invoices = (data || []).map(inv => ({
      ...inv,
      patients: patientMap[inv.patient_id] || null,
      doctors: inv.doctor_id ? { users: doctorMap[inv.doctor_id] || null } : null,
    }));

    return res.json({ invoices, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Invoice By ID ─────────────────────────────────────────────────────────
const getInvoiceById = async (req, res) => {
  try {
    const { data, error } = await supabase.from('invoices')
      .select('*, invoice_items(*), payments(*)')
      .eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Invoice not found' });

    const patientMap = await attachPatients([data]);
    const doctorMap = await attachDoctorNames([data]);

    return res.json({
      invoice: {
        ...data,
        patients: patientMap[data.patient_id] || null,
        doctors: data.doctor_id ? { users: doctorMap[data.doctor_id] || null } : null,
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Create Invoice ────────────────────────────────────────────────────────────
const createInvoice = async (req, res) => {
  try {
    const {
      patient_id, doctor_id, appointment_id, consultation_id, invoice_type,
      items, discount, tax_percent,
      consultation_fee, medicine_amount, test_amount, gst_percent, payment_mode,
      notes
    } = req.body;
    if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });

    // Accept either items[] array or flat fee fields from the billing UI
    let itemList = items || [];
    if (!itemList.length) {
      if (Number(consultation_fee) > 0) itemList.push({ description: 'Consultation Fee', unit_price: Number(consultation_fee), quantity: 1, item_type: 'consultation' });
      if (Number(medicine_amount)   > 0) itemList.push({ description: 'Medicines',        unit_price: Number(medicine_amount),   quantity: 1, item_type: 'medicine' });
      if (Number(test_amount)       > 0) itemList.push({ description: 'Lab Tests',         unit_price: Number(test_amount),       quantity: 1, item_type: 'lab' });
    }

    const effectiveTaxPct = gst_percent !== undefined ? Number(gst_percent) : Number(tax_percent || 0);
    const discountAmt = Number(discount || 0);
    const subtotal = itemList.reduce((sum, i) => sum + (Number(i.unit_price) * Number(i.quantity || 1)), 0);
    const taxable = Math.max(subtotal - discountAmt, 0);
    const taxAmt = (taxable * effectiveTaxPct) / 100;
    const total = taxable + taxAmt;

    const invoice_number = generateInvoiceNumber();
    const { data: inv, error: invErr } = await supabase.from('invoices').insert([{
      invoice_number,
      patient_id,
      doctor_id: doctor_id || null,
      appointment_id: appointment_id || null,
      consultation_id: consultation_id || null,
      invoice_type: invoice_type || 'consultation',
      subtotal,
      discount: discountAmt,
      tax_percent: effectiveTaxPct,
      tax_amount: taxAmt,
      total_amount: total,
      paid_amount: 0,
      balance_amount: total,
      status: 'pending',
      notes: notes || null,
      created_by: req.user.id,
      created_at: new Date().toISOString()
    }]).select('*').single();

    if (invErr) throw invErr;

    if (itemList.length) {
      const rows = itemList.map(i => ({
        invoice_id: inv.id,
        description: i.description,
        quantity: i.quantity || 1,
        unit_price: i.unit_price,
        total_price: Number(i.unit_price) * Number(i.quantity || 1),
        item_type: i.item_type || 'service'
      }));
      await supabase.from('invoice_items').insert(rows);
    }

    // If payment_mode is not 'later', immediately record full payment
    if (payment_mode && payment_mode !== 'later' && total > 0) {
      await supabase.from('payments').insert([{
        invoice_id: inv.id,
        amount: total,
        payment_mode,
        payment_date: new Date().toISOString(),
        created_by: req.user.id,
        created_at: new Date().toISOString()
      }]);
      await supabase.from('invoices').update({ paid_amount: total, balance_amount: 0, status: 'paid' }).eq('id', inv.id);
      inv.status = 'paid';
      inv.paid_amount = total;
    }

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'CREATE_INVOICE', module: 'Billing', entity_type: 'invoice', entity_id: inv.id });
    return res.status(201).json({ message: 'Invoice created', invoice: inv });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Record Payment ────────────────────────────────────────────────────────────
const recordPayment = async (req, res) => {
  try {
    const { invoice_id, amount, payment_mode, payment_date, notes } = req.body;
    if (!invoice_id) return res.status(400).json({ error: 'invoice_id is required' });

    const { data: inv } = await supabase.from('invoices').select('total_amount, paid_amount, balance_amount, status').eq('id', invoice_id).single();
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    const payAmount = amount !== undefined ? parseFloat(amount) : parseFloat(inv.balance_amount || inv.total_amount);

    const { data: pay, error: payErr } = await supabase.from('payments').insert([{
      invoice_id,
      amount: payAmount,
      payment_mode: payment_mode || 'cash',
      payment_date: payment_date || new Date().toISOString(),
      notes: notes || null,
      created_by: req.user.id,
      created_at: new Date().toISOString()
    }]).select('*').single();

    if (payErr) throw payErr;

    const newPaid = parseFloat(inv.paid_amount || 0) + payAmount;
    const newBalance = parseFloat(inv.total_amount) - newPaid;
    const newStatus = newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'pending';

    await supabase.from('invoices').update({ paid_amount: newPaid, balance_amount: Math.max(0, newBalance), status: newStatus, updated_by: req.user.id }).eq('id', invoice_id);

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'RECORD_PAYMENT', module: 'Billing', entity_type: 'payment', entity_id: pay.id, new_data: { invoice_id, amount: payAmount } });
    return res.status(201).json({ message: 'Payment recorded', payment: pay, invoice_status: newStatus });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Process Refund ────────────────────────────────────────────────────────────
const processRefund = async (req, res) => {
  try {
    const { invoice_id, refund_amount, refund_reason, payment_mode } = req.body;
    if (!invoice_id || !refund_amount || !refund_reason) return res.status(400).json({ error: 'invoice_id, refund_amount, and refund_reason required' });

    const { data: inv } = await supabase.from('invoices').select('paid_amount, total_amount, status').eq('id', invoice_id).single();
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (parseFloat(refund_amount) > parseFloat(inv.paid_amount)) return res.status(400).json({ error: 'Refund amount exceeds paid amount' });

    const { data, error } = await supabase.from('invoices').update({
      refund_amount: parseFloat(refund_amount),
      refund_reason,
      refund_payment_mode: payment_mode || 'cash',
      status: 'refunded',
      refunded_by: req.user.id,
      refunded_at: new Date().toISOString()
    }).eq('id', invoice_id).select('*').single();

    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'PROCESS_REFUND', module: 'Billing', entity_type: 'invoice', entity_id: invoice_id, new_data: { refund_amount, refund_reason } });
    return res.json({ message: 'Refund processed', invoice: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Payment Register ──────────────────────────────────────────────────────
const getPaymentRegister = async (req, res) => {
  try {
    const { date_from, date_to, payment_mode } = req.query;
    const today = new Date().toISOString().split('T')[0];

    let query = supabase.from('payments')
      .select('*, invoice_id')
      .order('payment_date', { ascending: false })
      .gte('payment_date', `${date_from || today}T00:00:00`)
      .lte('payment_date', `${date_to || today}T23:59:59`);

    if (payment_mode) query = query.eq('payment_mode', payment_mode);

    const { data: payments, error } = await query;
    if (error) throw error;

    // Attach invoice info separately
    const invoiceIds = [...new Set((payments || []).map(p => p.invoice_id).filter(Boolean))];
    const invoiceMap = {};
    if (invoiceIds.length) {
      const { data: invs } = await supabase.from('invoices').select('id, invoice_number, invoice_type, total_amount, patient_id').in('id', invoiceIds);
      const patientMap = await attachPatients(invs || []);
      (invs || []).forEach(inv => {
        invoiceMap[inv.id] = { ...inv, patients: patientMap[inv.patient_id] || null };
      });
    }

    const result = (payments || []).map(p => ({ ...p, invoices: invoiceMap[p.invoice_id] || null }));
    const total = result.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    return res.json({ payments: result, total_collected: total });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Reception Payment History (consultation + lab only) ───────────────────────
const getReceptionPayments = async (req, res) => {
  try {
    const { patient_id, date_from, date_to, status } = req.query;
    let query = supabase.from('invoices')
      .select('*')
      .in('invoice_type', ['consultation', 'lab'])
      .order('created_at', { ascending: false });

    if (patient_id) query = query.eq('patient_id', patient_id);
    if (status)     query = query.eq('status', status);
    if (date_from)  query = query.gte('created_at', date_from);
    if (date_to)    query = query.lte('created_at', date_to + 'T23:59:59');

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    const ids = [...new Set(rows.map(r => r.patient_id).filter(Boolean))];
    const pMap = {};
    if (ids.length) {
      const { data: pts } = await supabase.from('patients')
        .select('id, first_name, last_name, patient_uid, phone').in('id', ids);
      (pts || []).forEach(p => { pMap[p.id] = p; });
    }

    return res.json({
      invoices: rows.map(inv => ({ ...inv, patients: pMap[inv.patient_id] || null })),
    });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Patient: own billing invoices ─────────────────────────────────────────────
const getMyInvoices = async (req, res) => {
  try {
    let { data: patRec } = await supabase.from('patients').select('id').eq('user_id', req.user.id).single();

    // Fallback: receptionist-created patients have user_id=null — match by email and link
    if (!patRec && req.user.email) {
      const { data: byEmail } = await supabase.from('patients').select('id').eq('email', req.user.email).maybeSingle();
      if (byEmail) {
        patRec = byEmail;
        await supabase.from('patients').update({ user_id: req.user.id }).eq('id', byEmail.id);
      }
    }

    if (!patRec) return res.json({ invoices: [] });

    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('patient_id', patRec.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json({ invoices: invoices || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getInvoices, getInvoiceById, createInvoice, recordPayment, processRefund, getPaymentRegister, getReceptionPayments, getMyInvoices };
