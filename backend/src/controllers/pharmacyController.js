const { auditLog } = require('../middlewares/audit');
const { getUserOrganizationId } = require('../utils/organizationAccess');

// ── Inventory ─────────────────────────────────────────────────────────────────
const getInventory = async (req, res) => {
  try {
    const db = req.db;
    const { search, low_stock, expiring_soon } = req.query;
    const organizationId = getUserOrganizationId(req);

    let queryText = 'SELECT * FROM pharmacy_inventory WHERE is_active = true';
    const params = [];
    const conditions = [];

    if (organizationId) {
      params.push(organizationId);
      conditions.push(`organization_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`medicine_name ILIKE $${params.length}`);
    }
    if (low_stock === 'true') {
      conditions.push('current_stock <= reorder_level');
    }

    if (conditions.length) {
      queryText += ' AND ' + conditions.join(' AND ');
    }
    queryText += ' ORDER BY medicine_name';

    const result = await db.query(queryText, params);
    let resultRows = result.rows || [];

    if (expiring_soon === 'true') {
      const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      resultRows = resultRows.filter(m => m.expiry_date && m.expiry_date <= thirtyDays);
    }

    return res.json({ inventory: resultRows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getMedicineById = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = getUserOrganizationId(req);

    let queryText = 'SELECT * FROM pharmacy_inventory WHERE id = $1';
    const params = [req.params.id];
    if (organizationId) {
      params.push(organizationId);
      queryText += ' AND organization_id = $2';
    }
    queryText += ' LIMIT 1';

    const result = await db.query(queryText, params);
    const data = result.rows[0];
    if (!data) return res.status(404).json({ error: 'Medicine not found' });
    return res.json({ medicine: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getMedicineByBarcode = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = getUserOrganizationId(req);

    let queryText = 'SELECT * FROM pharmacy_inventory WHERE barcode = $1 AND is_active = true';
    const params = [req.params.barcode];
    if (organizationId) {
      params.push(organizationId);
      queryText += ' AND organization_id = $2';
    }
    queryText += ' LIMIT 1';

    const result = await db.query(queryText, params);
    const data = result.rows[0];
    if (!data) return res.json({ found: false, medicine: null });
    return res.json({ found: true, medicine: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const addMedicine = async (req, res) => {
  try {
    const db = req.db;
    const { medicine_name, category, unit, current_stock, reorder_level, unit_price, batch_number, expiry_date, manufacturer, barcode } = req.body;
    if (!medicine_name) return res.status(400).json({ error: 'medicine_name is required' });

    const organizationId = getUserOrganizationId(req);
    const insertQuery = `
      INSERT INTO pharmacy_inventory (
        medicine_name, category, unit, current_stock, reorder_level,
        unit_price, batch_number, expiry_date, manufacturer, barcode,
        organization_id, is_active, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    const params = [
      medicine_name,
      category || null,
      unit || 'tablet',
      current_stock || 0,
      reorder_level || 10,
      unit_price || 0,
      batch_number || null,
      expiry_date || null,
      manufacturer || null,
      barcode || null,
      organizationId || null,
      true,
      req.user.id,
      new Date().toISOString()
    ];

    const result = await db.query(insertQuery, params);
    const data = result.rows[0];

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'ADD_MEDICINE', module: 'Pharmacy', entity_type: 'pharmacy_inventory', entity_id: data.id });
    return res.status(201).json({ message: 'Medicine added', medicine: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateMedicine = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = getUserOrganizationId(req);
    
    const allowedKeys = ['medicine_name', 'category', 'unit', 'current_stock', 'reorder_level', 'unit_price', 'batch_number', 'expiry_date', 'manufacturer', 'barcode', 'is_active'];
    const fields = ['updated_by = $1', 'updated_at = $2'];
    const params = [req.user.id, new Date().toISOString()];

    allowedKeys.forEach(k => {
      if (req.body[k] !== undefined) {
        params.push(req.body[k]);
        fields.push(`${k} = $${params.length}`);
      }
    });

    params.push(req.params.id);
    let queryText = `UPDATE pharmacy_inventory SET ${fields.join(', ')} WHERE id = $${params.length}`;
    if (organizationId) {
      params.push(organizationId);
      queryText += ` AND organization_id = $${params.length}`;
    }
    queryText += ' RETURNING *';

    const result = await db.query(queryText, params);
    const data = result.rows[0];
    if (!data) return res.status(404).json({ error: 'Medicine not found' });

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'UPDATE_MEDICINE', module: 'Pharmacy', entity_type: 'pharmacy_inventory', entity_id: req.params.id });
    return res.json({ message: 'Medicine updated', medicine: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const addStock = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = getUserOrganizationId(req);
    const { id } = req.params;
    const { quantity, batch_number, expiry_date, unit_price, notes } = req.body;
    if (!quantity || quantity <= 0) return res.status(400).json({ error: 'quantity must be positive' });

    let medQuery = 'SELECT current_stock FROM pharmacy_inventory WHERE id = $1';
    const medParams = [id];
    if (organizationId) {
      medParams.push(organizationId);
      medQuery += ' AND organization_id = $2';
    }
    medQuery += ' LIMIT 1';

    const medResult = await db.query(medQuery, medParams);
    const med = medResult.rows[0];
    if (!med) return res.status(404).json({ error: 'Medicine not found' });

    const newStock = (med.current_stock || 0) + parseInt(quantity);
    const fields = ['current_stock = $1', 'updated_by = $2', 'updated_at = $3'];
    const params = [newStock, req.user.id, new Date().toISOString()];

    if (batch_number) {
      params.push(batch_number);
      fields.push(`batch_number = $${params.length}`);
    }
    if (expiry_date) {
      params.push(expiry_date);
      fields.push(`expiry_date = $${params.length}`);
    }
    if (unit_price) {
      params.push(unit_price);
      fields.push(`unit_price = $${params.length}`);
    }

    params.push(id);
    let stockQuery = `UPDATE pharmacy_inventory SET ${fields.join(', ')} WHERE id = $${params.length}`;
    if (organizationId) {
      params.push(organizationId);
      stockQuery += ` AND organization_id = $${params.length}`;
    }
    stockQuery += ' RETURNING *';

    const result = await db.query(stockQuery, params);
    const data = result.rows[0];

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'ADD_STOCK', module: 'Pharmacy', entity_type: 'pharmacy_inventory', entity_id: id, new_data: { quantity_added: quantity, notes } });
    return res.json({ message: `Stock updated. New stock: ${newStock}`, medicine: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Pharmacy Invoices ─────────────────────────────────────────────────────────
const getPharmacyInvoices = async (req, res) => {
  try {
    const db = req.db;
    const { patient_id, date, status } = req.query;
    const today = date || new Date().toISOString().split('T')[0];
    const organizationId = getUserOrganizationId(req);

    let queryText = 'SELECT * FROM pharmacy_invoices';
    const params = [];
    const conditions = [];

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
    if (!patient_id) {
      params.push(`${today}T00:00:00`, `${today}T23:59:59`);
      conditions.push(`created_at >= $${params.length - 1} AND created_at <= $${params.length}`);
    }

    if (conditions.length) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }
    queryText += ' ORDER BY created_at DESC';

    const result = await db.query(queryText, params);
    const invoices = result.rows || [];

    if (invoices.length) {
      const patientIds = [...new Set(invoices.map(i => i.patient_id).filter(Boolean))];
      const invoiceIds = invoices.map(i => i.id);

      const [patientsResult, itemsResult] = await Promise.all([
        patientIds.length ? db.query('SELECT id, first_name, last_name, patient_uid, phone FROM patients WHERE id = ANY($1)', [patientIds]) : { rows: [] },
        db.query('SELECT * FROM pharmacy_invoice_items WHERE pharmacy_invoice_id = ANY($1)', [invoiceIds])
      ]);

      const patientMap = {};
      (patientsResult.rows || []).forEach(p => { patientMap[p.id] = p; });

      const itemsMap = {};
      (itemsResult.rows || []).forEach(item => {
        if (!itemsMap[item.pharmacy_invoice_id]) itemsMap[item.pharmacy_invoice_id] = [];
        itemsMap[item.pharmacy_invoice_id].push(item);
      });

      invoices.forEach(inv => {
        inv.patients = patientMap[inv.patient_id] || null;
        inv.pharmacy_invoice_items = itemsMap[inv.id] || [];
      });
    }

    return res.json({ invoices });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createPharmacyInvoice = async (req, res) => {
  try {
    const db = req.db;
    const { patient_id, prescription_id, consultation_id, items, discount, notes } = req.body;
    if (!patient_id || !items?.length) return res.status(400).json({ error: 'patient_id and items required' });

    // Validate stock for each item in a batch query
    const medicineIds = items.map(item => item.medicine_id);
    const medResult = await db.query(
      'SELECT id, current_stock, medicine_name FROM pharmacy_inventory WHERE id = ANY($1)',
      [medicineIds]
    );
    const medMap = {};
    (medResult.rows || []).forEach(m => { medMap[m.id] = m; });

    for (const item of items) {
      const med = medMap[item.medicine_id];
      if (!med) return res.status(400).json({ error: `Medicine ID ${item.medicine_id} not found` });
      if (med.current_stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${med.medicine_name}. Available: ${med.current_stock}` });
      }
    }

    const subtotal = items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);
    const discountAmt = discount || 0;
    const total = subtotal - discountAmt;

    const organizationId = getUserOrganizationId(req);
    const insertInvoiceQuery = `
      INSERT INTO pharmacy_invoices (
        patient_id, prescription_id, consultation_id, subtotal, discount,
        total_amount, status, notes, organization_id, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const invoiceParams = [
      patient_id,
      prescription_id || null,
      consultation_id || null,
      subtotal,
      discountAmt,
      total,
      'pending',
      notes || null,
      organizationId || null,
      req.user.id,
      new Date().toISOString()
    ];

    const invResult = await db.query(insertInvoiceQuery, invoiceParams);
    const inv = invResult.rows[0];

    // Build dynamic placeholders and parameters for multi-row INSERT
    const valuePlaceholders = [];
    const itemParams = [];
    items.forEach((item, index) => {
      const offset = index * 7;
      valuePlaceholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`);
      itemParams.push(
        inv.id,
        item.medicine_id,
        item.medicine_name,
        item.quantity,
        item.unit_price,
        item.unit_price * item.quantity,
        item.is_partial || false
      );
    });

    const insertItemsQuery = `
      INSERT INTO pharmacy_invoice_items (
        pharmacy_invoice_id, medicine_id, medicine_name, quantity, unit_price, total_price, is_partial
      ) VALUES ${valuePlaceholders.join(', ')}
      RETURNING *
    `;
    const itemsResult = await db.query(insertItemsQuery, itemParams);
    const itemData = itemsResult.rows || [];

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'CREATE_PHARMACY_INVOICE', module: 'Pharmacy', entity_type: 'pharmacy_invoice', entity_id: inv.id });
    return res.status(201).json({ message: 'Invoice created', invoice: { ...inv, items: itemData } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const dispensePharmacyInvoice = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = getUserOrganizationId(req);
    const { id } = req.params;
    const { payment_mode, amount_paid } = req.body;

    let invoiceQuery = 'SELECT * FROM pharmacy_invoices WHERE id = $1';
    const invParams = [id];
    if (organizationId) {
      invParams.push(organizationId);
      invoiceQuery += ' AND organization_id = $2';
    }
    invoiceQuery += ' LIMIT 1';

    const invResult = await db.query(invoiceQuery, invParams);
    const inv = invResult.rows[0];
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (inv.status === 'dispensed') return res.status(400).json({ error: 'Already dispensed' });

    // Fetch items
    const itemsResult = await db.query('SELECT * FROM pharmacy_invoice_items WHERE pharmacy_invoice_id = $1', [id]);
    const items = itemsResult.rows || [];

    // Reduce stock in batch
    if (items.length) {
      const medIds = items.map(item => item.medicine_id);
      const medsResult = await db.query('SELECT id, current_stock FROM pharmacy_inventory WHERE id = ANY($1)', [medIds]);
      const medStockMap = {};
      (medsResult.rows || []).forEach(m => { medStockMap[m.id] = m.current_stock; });

      for (const item of items) {
        const currentStock = medStockMap[item.medicine_id] || 0;
        const newStock = Math.max(0, currentStock - item.quantity);
        await db.query(
          'UPDATE pharmacy_inventory SET current_stock = $1, updated_by = $2 WHERE id = $3',
          [newStock, req.user.id, item.medicine_id]
        );
      }
    }

    const updateInvoiceQuery = `
      UPDATE pharmacy_invoices
      SET status = $1, payment_mode = $2, amount_paid = $3, dispensed_by = $4, dispensed_at = $5
      WHERE id = $6
      RETURNING *
    `;
    const updateParams = [
      'dispensed',
      payment_mode || null,
      amount_paid !== undefined ? amount_paid : inv.total_amount,
      req.user.id,
      new Date().toISOString(),
      id
    ];

    const result = await db.query(updateInvoiceQuery, updateParams);
    const data = result.rows[0];

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'DISPENSE_PHARMACY', module: 'Pharmacy', entity_type: 'pharmacy_invoice', entity_id: id });
    return res.json({ message: 'Medicines dispensed', invoice: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getStockAlerts = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = getUserOrganizationId(req);
    let queryText = 'SELECT * FROM pharmacy_inventory WHERE is_active = true';
    const params = [];
    if (organizationId) {
      params.push(organizationId);
      queryText += ' AND organization_id = $1';
    }

    const result = await db.query(queryText, params);
    const data = result.rows || [];

    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const low_stock = data.filter(m => m.current_stock <= m.reorder_level);
    const expiring = data.filter(m => m.expiry_date && m.expiry_date <= thirtyDays);
    const expired = data.filter(m => m.expiry_date && m.expiry_date < new Date().toISOString().split('T')[0]);

    return res.json({ low_stock, expiring_soon: expiring, expired });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Patient: own pharmacy invoices ───────────────────────────────────────────
const getMyInvoices = async (req, res) => {
  try {
    const db = req.db;
    let patResult = await db.query('SELECT id FROM patients WHERE user_id = $1 LIMIT 1', [req.user.id]);
    let patRec = patResult.rows[0];

    // Fallback: receptionist-created patients have user_id=null — match by email and link
    if (!patRec && req.user.email) {
      let emailResult = await db.query('SELECT id FROM patients WHERE email = $1 LIMIT 1', [req.user.email]);
      let byEmail = emailResult.rows[0];
      if (byEmail) {
        patRec = byEmail;
        await db.query('UPDATE patients SET user_id = $1 WHERE id = $2', [req.user.id, byEmail.id]);
      }
    }

    if (!patRec) return res.json({ invoices: [] });

    const invoicesResult = await db.query(
      'SELECT * FROM pharmacy_invoices WHERE patient_id = $1 ORDER BY created_at DESC',
      [patRec.id]
    );
    const invoices = invoicesResult.rows || [];

    if (invoices.length) {
      const invoiceIds = invoices.map(i => i.id);
      const itemsResult = await db.query('SELECT * FROM pharmacy_invoice_items WHERE pharmacy_invoice_id = ANY($1)', [invoiceIds]);
      const itemsMap = {};
      (itemsResult.rows || []).forEach(item => {
        if (!itemsMap[item.pharmacy_invoice_id]) itemsMap[item.pharmacy_invoice_id] = [];
        itemsMap[item.pharmacy_invoice_id].push(item);
      });

      invoices.forEach(inv => {
        inv.pharmacy_invoice_items = itemsMap[inv.id] || [];
      });
    }

    return res.json({ invoices });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Pending Prescriptions (for pharmacy to dispense) ─────────────────────
const getPendingPrescriptions = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = getUserOrganizationId(req);

    let queryText = 'SELECT * FROM prescriptions';
    const params = [];
    if (organizationId) {
      params.push(organizationId);
      queryText += ' WHERE organization_id = $1';
    }
    queryText += ' ORDER BY created_at DESC LIMIT 100';

    const result = await db.query(queryText, params);
    const rows = result.rows || [];

    if (!rows.length) return res.json({ prescriptions: [] });

    const prescIds = rows.map(p => p.id);
    const itemsResult = await db.query('SELECT * FROM prescription_items WHERE prescription_id = ANY($1)', [prescIds]);
    const itemsMap = {};
    (itemsResult.rows || []).forEach(item => {
      if (!itemsMap[item.prescription_id]) itemsMap[item.prescription_id] = [];
      itemsMap[item.prescription_id].push(item);
    });

    // Attach items to prescriptions
    rows.forEach(p => {
      p.prescription_items = itemsMap[p.id] || [];
    });

    // Find which prescription IDs are already dispensed via pharmacy
    let dispensedSet = new Set();
    const dispensedResult = await db.query(
      'SELECT prescription_id FROM pharmacy_invoices WHERE prescription_id = ANY($1) AND status = $2',
      [prescIds, 'dispensed']
    );
    (dispensedResult.rows || []).forEach(i => {
      if (i.prescription_id) dispensedSet.add(i.prescription_id);
    });

    const pending = rows.filter(p => !dispensedSet.has(p.id));

    // Attach patient info
    const patientIds = [...new Set(pending.map(p => p.patient_id).filter(Boolean))];
    const patientMap = {};
    if (patientIds.length) {
      const patientsResult = await db.query('SELECT id, first_name, last_name, patient_uid, phone FROM patients WHERE id = ANY($1)', [patientIds]);
      (patientsResult.rows || []).forEach(p => { patientMap[p.id] = p; });
    }

    // Attach doctor info
    const doctorIds = [...new Set(pending.map(p => p.doctor_id).filter(Boolean))];
    const doctorNameMap = {};
    if (doctorIds.length) {
      const doctorsResult = await db.query('SELECT id, user_id, specialization FROM doctors WHERE id = ANY($1)', [doctorIds]);
      const userIds = [...new Set((doctorsResult.rows || []).map(d => d.user_id).filter(Boolean))];
      const userMap = {};
      if (userIds.length) {
        const usersResult = await db.query('SELECT id, first_name, last_name FROM users WHERE id = ANY($1)', [userIds]);
        (usersResult.rows || []).forEach(u => { userMap[u.id] = u; });
      }
      (doctorsResult.rows || []).forEach(d => {
        const u = userMap[d.user_id];
        doctorNameMap[d.id] = u ? `Dr. ${u.first_name} ${u.last_name}`.trim() : 'Doctor';
      });
    }

    return res.json({
      prescriptions: pending.map(p => ({
        ...p,
        patients: patientMap[p.patient_id] || null,
        doctor_name: doctorNameMap[p.doctor_id] || 'Doctor',
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Bulk Import Medicines ─────────────────────────────────────────────────────
const bulkImportMedicines = async (req, res) => {
  try {
    const db = req.db;
    const { medicines } = req.body;
    if (!Array.isArray(medicines) || !medicines.length)
      return res.status(400).json({ error: 'medicines array required' });

    const organizationId = getUserOrganizationId(req);
    const rows = medicines
      .map(m => ({
        medicine_name:  (m.medicine_name || '').trim(),
        category:       (m.category || '').trim() || null,
        unit:           (m.unit || 'tablet').trim(),
        unit_price:     parseFloat(m.unit_price)    || 0,
        current_stock:  parseInt(m.current_stock)   || 0,
        reorder_level:  parseInt(m.reorder_level)   || 10,
        batch_number:   (m.batch_number || '').trim() || null,
        expiry_date:    (m.expiry_date || '').trim()  || null,
        manufacturer:   (m.manufacturer || '').trim() || null,
        barcode:        (m.barcode || '').trim() || null,
        organization_id: organizationId || null,
        is_active:      true,
        created_by:     req.user.id,
        created_at:     new Date().toISOString(),
      }))
      .filter(m => m.medicine_name);

    if (!rows.length) return res.status(400).json({ error: 'No valid rows found — medicine_name is required' });

    // Multi-row INSERT dynamically
    const valuePlaceholders = [];
    const params = [];
    rows.forEach((m, index) => {
      const offset = index * 14;
      valuePlaceholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14})`);
      params.push(
        m.medicine_name,
        m.category,
        m.unit,
        m.current_stock,
        m.reorder_level,
        m.unit_price,
        m.batch_number,
        m.expiry_date,
        m.manufacturer,
        m.barcode,
        m.organization_id,
        m.is_active,
        m.created_by,
        m.created_at
      );
    });

    const insertQuery = `
      INSERT INTO pharmacy_inventory (
        medicine_name, category, unit, current_stock, reorder_level,
        unit_price, batch_number, expiry_date, manufacturer, barcode,
        organization_id, is_active, created_by, created_at
      ) VALUES ${valuePlaceholders.join(', ')}
      RETURNING id, medicine_name
    `;

    const insertResult = await db.query(insertQuery, params);
    const data = insertResult.rows || [];

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'BULK_IMPORT_MEDICINES', module: 'Pharmacy', entity_type: 'pharmacy_inventory', new_data: { count: data.length } });
    return res.json({ message: `${data.length} medicine${data.length !== 1 ? 's' : ''} imported successfully`, count: data.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getInventory, getMedicineById, getMedicineByBarcode, addMedicine, updateMedicine, addStock, getPharmacyInvoices, createPharmacyInvoice, dispensePharmacyInvoice, getStockAlerts, getPendingPrescriptions, bulkImportMedicines, getMyInvoices };

