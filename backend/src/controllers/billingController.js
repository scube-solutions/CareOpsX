const { auditLog } = require('../middlewares/audit');
const { getUserOrganizationId } = require('../utils/organizationAccess');

const generateInvoiceNumber = () => {
  const now = new Date();
  return `INV-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}-${Math.floor(10000+Math.random()*90000)}`;
};

const attachPatients = async (rows, idField = 'patient_id', db) => {
  const ids = [...new Set(rows.map(r => r[idField]).filter(Boolean))];
  if (!ids.length) return {};
  const result = await db.query(
    'SELECT id, first_name, last_name, patient_uid, phone FROM patients WHERE id = ANY($1)',
    [ids]
  );
  const map = {};
  (result.rows || []).forEach(p => { map[p.id] = p; });
  return map;
};

const attachDoctorNames = async (rows, idField = 'doctor_id', db) => {
  const ids = [...new Set(rows.map(r => r[idField]).filter(Boolean))];
  if (!ids.length) return {};
  const doctorsResult = await db.query('SELECT id, user_id FROM doctors WHERE id = ANY($1)', [ids]);
  const doctors = doctorsResult.rows || [];
  if (!doctors.length) return {};
  const userIds = [...new Set(doctors.map(d => d.user_id).filter(Boolean))];
  const usersResult = await db.query('SELECT id, first_name, last_name FROM users WHERE id = ANY($1)', [userIds]);
  const userMap = {};
  (usersResult.rows || []).forEach(u => { userMap[u.id] = u; });
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
    const db = req.db;
    const { patient_id, status, invoice_type, date_from, date_to, page = 1, limit = 20 } = req.query;
    const parsedLimit = parseInt(limit) || 20;
    const offset = (parseInt(page) - 1) * parsedLimit;
    const organizationId = getUserOrganizationId(req);

    let queryText = 'SELECT * FROM invoices';
    let countQueryText = 'SELECT COUNT(*)::int FROM invoices';
    const conditions = [];
    const params = [];

    if (organizationId) {
      params.push(organizationId);
      conditions.push(`organization_id = $${params.length}`);
    }

    if (patient_id) {
      params.push(patient_id);
      conditions.push(`patient_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (invoice_type) {
      params.push(invoice_type);
      conditions.push(`invoice_type = $${params.length}`);
    }
    if (date_from) {
      params.push(`${date_from}T00:00:00`);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (date_to) {
      params.push(`${date_to}T23:59:59`);
      conditions.push(`created_at <= $${params.length}`);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      queryText += whereClause;
      countQueryText += whereClause;
    }

    const countResult = await db.query(countQueryText, params);
    const count = countResult.rows[0].count;

    queryText += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parsedLimit, offset);

    const result = await db.query(queryText, params);
    const data = result.rows || [];

    const patientMap = await attachPatients(data, 'patient_id', db);
    const doctorMap = await attachDoctorNames(data, 'doctor_id', db);

    const invoices = data.map(inv => ({
      ...inv,
      patients: patientMap[inv.patient_id] || null,
      doctors: inv.doctor_id ? { users: doctorMap[inv.doctor_id] || null } : null,
    }));

    return res.json({ invoices, total: count, page: parseInt(page), limit: parsedLimit });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Invoice By ID ─────────────────────────────────────────────────────────
const getInvoiceById = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = getUserOrganizationId(req);
    
    let queryText = 'SELECT * FROM invoices WHERE id = $1';
    const params = [req.params.id];
    if (organizationId) {
      params.push(organizationId);
      queryText += ' AND organization_id = $2';
    }
    queryText += ' LIMIT 1';

    const result = await db.query(queryText, params);
    const data = result.rows[0];
    if (!data) return res.status(404).json({ error: 'Invoice not found' });

    const [itemsResult, paymentsResult] = await Promise.all([
      db.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [data.id]),
      db.query('SELECT * FROM payments WHERE invoice_id = $1', [data.id])
    ]);
    data.invoice_items = itemsResult.rows || [];
    data.payments = paymentsResult.rows || [];

    const patientMap = await attachPatients([data], 'patient_id', db);
    const doctorMap = await attachDoctorNames([data], 'doctor_id', db);

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
    const db = req.db;
    const {
      patient_id, doctor_id, appointment_id, consultation_id, invoice_type,
      items, discount, tax_percent,
      consultation_fee, medicine_amount, test_amount, gst_percent, payment_mode,
      notes
    } = req.body;
    if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });

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

    const organizationId = getUserOrganizationId(req);
    const invoice_number = generateInvoiceNumber();

    const insertResult = await db.query(
      `INSERT INTO invoices (invoice_number, patient_id, doctor_id, appointment_id, consultation_id, invoice_type, subtotal, discount, tax_percent, tax_amount, total_amount, paid_amount, balance_amount, status, notes, organization_id, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        invoice_number,
        patient_id,
        doctor_id || null,
        appointment_id || null,
        consultation_id || null,
        invoice_type || 'consultation',
        subtotal,
        discountAmt,
        effectiveTaxPct,
        taxAmt,
        total,
        0,
        total,
        'pending',
        notes || null,
        organizationId || null,
        req.user.id,
        new Date().toISOString()
      ]
    );
    const inv = insertResult.rows[0];

    if (itemList.length) {
      const rows = [];
      const values = [];
      itemList.forEach((i, idx) => {
        const baseIdx = idx * 6;
        rows.push(`($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}, $${baseIdx + 6})`);
        values.push(
          inv.id,
          i.description,
          i.quantity || 1,
          i.unit_price,
          Number(i.unit_price) * Number(i.quantity || 1),
          i.item_type || 'service'
        );
      });

      const itemInsertText = `
        INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price, item_type)
        VALUES ${rows.join(', ')}
      `;
      await db.query(itemInsertText, values);
    }

    if (payment_mode && payment_mode !== 'later' && total > 0) {
      await db.query(
        `INSERT INTO payments (invoice_id, amount, payment_mode, payment_date, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          inv.id,
          total,
          payment_mode,
          new Date().toISOString(),
          req.user.id,
          new Date().toISOString()
        ]
      );
      await db.query(
        "UPDATE invoices SET paid_amount = $1, balance_amount = 0, status = 'paid' WHERE id = $2",
        [total, inv.id]
      );
      inv.status = 'paid';
      inv.paid_amount = total;
    }

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'CREATE_INVOICE', module: 'Billing', entity_type: 'invoice', entity_id: inv.id });
    return res.status(201).json({ message: 'Invoice created', invoice: inv });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Record Payment ────────────────────────────────────────────────────────────
const recordPayment = async (req, res) => {
  try {
    const db = req.db;
    const { invoice_id, amount, payment_mode, payment_date, notes } = req.body;
    if (!invoice_id) return res.status(400).json({ error: 'invoice_id is required' });

    const invResult = await db.query(
      'SELECT total_amount, paid_amount, balance_amount, status FROM invoices WHERE id = $1 LIMIT 1',
      [invoice_id]
    );
    const inv = invResult.rows[0];
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    const payAmount = amount !== undefined ? parseFloat(amount) : parseFloat(inv.balance_amount || inv.total_amount);

    const organizationId = getUserOrganizationId(req);
    const payResult = await db.query(
      `INSERT INTO payments (invoice_id, amount, payment_mode, payment_date, notes, organization_id, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        invoice_id,
        payAmount,
        payment_mode || 'cash',
        payment_date || new Date().toISOString(),
        notes || null,
        organizationId || null,
        req.user.id,
        new Date().toISOString()
      ]
    );
    const pay = payResult.rows[0];

    const newPaid = parseFloat(inv.paid_amount || 0) + payAmount;
    const newBalance = parseFloat(inv.total_amount) - newPaid;
    const newStatus = newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'pending';

    await db.query(
      'UPDATE invoices SET paid_amount = $1, balance_amount = $2, status = $3, updated_by = $4 WHERE id = $5',
      [newPaid, Math.max(0, newBalance), newStatus, req.user.id, invoice_id]
    );

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'RECORD_PAYMENT', module: 'Billing', entity_type: 'payment', entity_id: pay.id, new_data: { invoice_id, amount: payAmount } });
    return res.status(201).json({ message: 'Payment recorded', payment: pay, invoice_status: newStatus });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Process Refund ────────────────────────────────────────────────────────────
const processRefund = async (req, res) => {
  try {
    const db = req.db;
    const { invoice_id, refund_amount, refund_reason, payment_mode } = req.body;
    if (!invoice_id || !refund_amount || !refund_reason) return res.status(400).json({ error: 'invoice_id, refund_amount, and refund_reason required' });

    const invResult = await db.query('SELECT paid_amount, total_amount, status FROM invoices WHERE id = $1 LIMIT 1', [invoice_id]);
    const inv = invResult.rows[0];
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (parseFloat(refund_amount) > parseFloat(inv.paid_amount)) return res.status(400).json({ error: 'Refund amount exceeds paid amount' });

    const updateResult = await db.query(
      `UPDATE invoices 
       SET refund_amount = $1, refund_reason = $2, refund_payment_mode = $3, status = 'refunded', refunded_by = $4, refunded_at = $5
       WHERE id = $6
       RETURNING *`,
      [
        parseFloat(refund_amount),
        refund_reason,
        payment_mode || 'cash',
        req.user.id,
        new Date().toISOString(),
        invoice_id
      ]
    );
    const data = updateResult.rows[0];

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'PROCESS_REFUND', module: 'Billing', entity_type: 'invoice', entity_id: invoice_id, new_data: { refund_amount, refund_reason } });
    return res.json({ message: 'Refund processed', invoice: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Payment Register ──────────────────────────────────────────────────────
const getPaymentRegister = async (req, res) => {
  try {
    const db = req.db;
    const { date_from, date_to, payment_mode } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const organizationId = getUserOrganizationId(req);

    let queryText = 'SELECT *, invoice_id FROM payments';
    const conditions = [];
    const params = [];

    params.push(`${date_from || today}T00:00:00`, `${date_to || today}T23:59:59`);
    conditions.push('payment_date >= $1 AND payment_date <= $2');

    if (organizationId) {
      params.push(organizationId);
      conditions.push(`organization_id = $${params.length}`);
    }
    if (payment_mode) {
      params.push(payment_mode);
      conditions.push(`payment_mode = $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }
    queryText += ' ORDER BY payment_date DESC';

    const paymentsResult = await db.query(queryText, params);
    const payments = paymentsResult.rows || [];

    const invoiceIds = [...new Set(payments.map(p => p.invoice_id).filter(Boolean))];
    const invoiceMap = {};
    if (invoiceIds.length) {
      const invsResult = await db.query('SELECT id, invoice_number, invoice_type, total_amount, patient_id FROM invoices WHERE id = ANY($1)', [invoiceIds]);
      const invs = invsResult.rows || [];
      const patientMap = await attachPatients(invs, 'patient_id', db);
      invs.forEach(inv => {
        invoiceMap[inv.id] = { ...inv, patients: patientMap[inv.patient_id] || null };
      });
    }

    const result = payments.map(p => ({ ...p, invoices: invoiceMap[p.invoice_id] || null }));
    const total = result.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    return res.json({ payments: result, total_collected: total });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Reception Payment History (consultation + lab only) ───────────────────────
const getReceptionPayments = async (req, res) => {
  try {
    const db = req.db;
    const { patient_id, date_from, date_to, status } = req.query;
    const organizationId = getUserOrganizationId(req);

    let queryText = "SELECT * FROM invoices WHERE invoice_type IN ('consultation', 'lab')";
    const conditions = [];
    const params = [];

    if (organizationId) {
      params.push(organizationId);
      conditions.push(`organization_id = $${params.length}`);
    }
    if (patient_id) {
      params.push(patient_id);
      conditions.push(`patient_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (date_from) {
      params.push(date_from);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (date_to) {
      params.push(date_to + 'T23:59:59');
      conditions.push(`created_at <= $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += ' AND ' + conditions.join(' AND ');
    }
    queryText += ' ORDER BY created_at DESC';

    const result = await db.query(queryText, params);
    const rows = result.rows || [];

    const ids = [...new Set(rows.map(r => r.patient_id).filter(Boolean))];
    const pMap = {};
    if (ids.length) {
      const ptsResult = await db.query('SELECT id, first_name, last_name, patient_uid, phone FROM patients WHERE id = ANY($1)', [ids]);
      (ptsResult.rows || []).forEach(p => { pMap[p.id] = p; });
    }

    return res.json({
      invoices: rows.map(inv => ({ ...inv, patients: pMap[inv.patient_id] || null })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Patient: own billing invoices ─────────────────────────────────────────────
const getMyInvoices = async (req, res) => {
  try {
    const db = req.db;
    
    let patResult = await db.query('SELECT id FROM patients WHERE user_id = $1 LIMIT 1', [req.user.id]);
    let patRec = patResult.rows[0];

    if (!patRec && req.user.email) {
      const byEmailResult = await db.query('SELECT id FROM patients WHERE email = $1 LIMIT 1', [req.user.email]);
      const byEmail = byEmailResult.rows[0];
      if (byEmail) {
        patRec = byEmail;
        await db.query('UPDATE patients SET user_id = $1 WHERE id = $2', [req.user.id, byEmail.id]);
      }
    }

    if (!patRec) return res.json({ invoices: [] });

    const invoicesResult = await db.query(
      'SELECT * FROM invoices WHERE patient_id = $1 ORDER BY created_at DESC',
      [patRec.id]
    );
    return res.json({ invoices: invoicesResult.rows || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Razorpay Subscription ────────────────────────────────────────────────────
const createRazorpayOrder = async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ error: 'Razorpay is not configured on this server. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.' });
    }
    const Razorpay = require('razorpay');
    const { amount, plan } = req.body;
    if (!amount || !plan) return res.status(400).json({ error: 'amount and plan are required' });

    const rz = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const { organizationId } = await require('../utils/organizationAccess').getOrganizationContext(req);

    const order = await rz.orders.create({
      amount,
      currency: 'INR',
      receipt: `org_${organizationId}_${Date.now()}`,
      notes: { plan, organization_id: String(organizationId) },
    });

    return res.json({ order_id: order.id, amount: order.amount, currency: order.currency });
  } catch (err) {
    console.error('Razorpay create-order error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

const verifyRazorpayPayment = async (req, res) => {
  try {
    const crypto = require('crypto');
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment signature verification failed' });
    }

    const db = req.db || require('../utils/db');
    const { organizationId } = await require('../utils/organizationAccess').getOrganizationContext(req);

    await db.query(
      'UPDATE superadmin.organizations SET billing_status = $1, payment_status = $2 WHERE id = $3',
      [plan, 'paid', organizationId]
    );

    return res.json({ success: true, message: 'Payment verified and plan upgraded' });
  } catch (err) {
    console.error('Razorpay verify error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getInvoices, getInvoiceById, createInvoice, recordPayment, processRefund, getPaymentRegister, getReceptionPayments, getMyInvoices, createRazorpayOrder, verifyRazorpayPayment };
