const supabase = require('../utils/supabase');
const { auditLog } = require('../middlewares/audit');

// ── Inventory ─────────────────────────────────────────────────────────────────
const getInventory = async (req, res) => {
  try {
    const { search, low_stock, expiring_soon } = req.query;
    let query = supabase.from('pharmacy_inventory').select('*').eq('is_active', true).order('medicine_name');
    if (search) query = query.ilike('medicine_name', `%${search}%`);
    if (low_stock === 'true') query = query.lte('current_stock', supabase.raw('reorder_level'));

    const { data, error } = await query;
    if (error) throw error;

    let result = data || [];
    if (expiring_soon === 'true') {
      const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      result = result.filter(m => m.expiry_date && m.expiry_date <= thirtyDays);
    }
    if (low_stock === 'true') {
      result = result.filter(m => m.current_stock <= m.reorder_level);
    }

    return res.json({ inventory: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getMedicineById = async (req, res) => {
  try {
    const { data, error } = await supabase.from('pharmacy_inventory').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Medicine not found' });
    return res.json({ medicine: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const addMedicine = async (req, res) => {
  try {
    const { medicine_name, category, unit, current_stock, reorder_level, unit_price, batch_number, expiry_date, manufacturer } = req.body;
    if (!medicine_name) return res.status(400).json({ error: 'medicine_name is required' });

    const { data, error } = await supabase.from('pharmacy_inventory').insert([{
      medicine_name, category: category || null, unit: unit || 'tablet',
      current_stock: current_stock || 0, reorder_level: reorder_level || 10,
      unit_price: unit_price || 0, batch_number: batch_number || null,
      expiry_date: expiry_date || null, manufacturer: manufacturer || null,
      is_active: true, created_by: req.user.id, created_at: new Date().toISOString()
    }]).select('*').single();

    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'ADD_MEDICINE', module: 'Pharmacy', entity_type: 'pharmacy_inventory', entity_id: data.id });
    return res.status(201).json({ message: 'Medicine added', medicine: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateMedicine = async (req, res) => {
  try {
    const { data, error } = await supabase.from('pharmacy_inventory').update({ ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() }).eq('id', req.params.id).select('*').single();
    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'UPDATE_MEDICINE', module: 'Pharmacy', entity_type: 'pharmacy_inventory', entity_id: req.params.id });
    return res.json({ message: 'Medicine updated', medicine: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const addStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, batch_number, expiry_date, unit_price, notes } = req.body;
    if (!quantity || quantity <= 0) return res.status(400).json({ error: 'quantity must be positive' });

    const { data: med } = await supabase.from('pharmacy_inventory').select('current_stock').eq('id', id).single();
    if (!med) return res.status(404).json({ error: 'Medicine not found' });

    const newStock = (med.current_stock || 0) + parseInt(quantity);
    const updates = { current_stock: newStock, updated_by: req.user.id, updated_at: new Date().toISOString() };
    if (batch_number) updates.batch_number = batch_number;
    if (expiry_date) updates.expiry_date = expiry_date;
    if (unit_price) updates.unit_price = unit_price;

    const { data, error } = await supabase.from('pharmacy_inventory').update(updates).eq('id', id).select('*').single();
    if (error) throw error;

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'ADD_STOCK', module: 'Pharmacy', entity_type: 'pharmacy_inventory', entity_id: id, new_data: { quantity_added: quantity, notes } });
    return res.json({ message: `Stock updated. New stock: ${newStock}`, medicine: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Pharmacy Invoices ─────────────────────────────────────────────────────────
const getPharmacyInvoices = async (req, res) => {
  try {
    const { patient_id, date, status } = req.query;
    const today = date || new Date().toISOString().split('T')[0];

    let query = supabase.from('pharmacy_invoices')
      .select('*, patients(first_name, last_name, patient_uid, phone), pharmacy_invoice_items(*)')
      .order('created_at', { ascending: false });

    if (patient_id) query = query.eq('patient_id', patient_id);
    if (status) query = query.eq('status', status);
    if (!patient_id) query = query.gte('created_at', `${today}T00:00:00`).lte('created_at', `${today}T23:59:59`);

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ invoices: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createPharmacyInvoice = async (req, res) => {
  try {
    const { patient_id, prescription_id, consultation_id, items, discount, notes, payment_mode } = req.body;
    if (!patient_id || !items?.length) return res.status(400).json({ error: 'patient_id and items required' });

    // Validate stock for each item
    for (const item of items) {
      const { data: med } = await supabase.from('pharmacy_inventory').select('current_stock, medicine_name').eq('id', item.medicine_id).single();
      if (!med) return res.status(400).json({ error: `Medicine ID ${item.medicine_id} not found` });
      if (med.current_stock < item.quantity) return res.status(400).json({ error: `Insufficient stock for ${med.medicine_name}. Available: ${med.current_stock}` });
    }

    const subtotal = items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);
    const discountAmt = discount || 0;
    const total = subtotal - discountAmt;

    const { data: inv, error: invError } = await supabase.from('pharmacy_invoices').insert([{
      patient_id,
      prescription_id: prescription_id || null,
      consultation_id: consultation_id || null,
      subtotal,
      discount: discountAmt,
      total_amount: total,
      status: 'pending',
      notes: notes || null,
      created_by: req.user.id,
      created_at: new Date().toISOString()
    }]).select('*').single();

    if (invError) throw invError;

    const itemRows = items.map(i => ({
      pharmacy_invoice_id: inv.id,
      medicine_id: i.medicine_id,
      medicine_name: i.medicine_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      total_price: i.unit_price * i.quantity,
      is_partial: i.is_partial || false
    }));

    const { data: itemData, error: itemErr } = await supabase.from('pharmacy_invoice_items').insert(itemRows).select('*');
    if (itemErr) throw itemErr;

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'CREATE_PHARMACY_INVOICE', module: 'Pharmacy', entity_type: 'pharmacy_invoice', entity_id: inv.id });
    return res.status(201).json({ message: 'Invoice created', invoice: { ...inv, items: itemData } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const dispensePharmacyInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_mode, amount_paid } = req.body;

    const { data: inv } = await supabase.from('pharmacy_invoices').select('*, pharmacy_invoice_items(*)').eq('id', id).single();
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (inv.status === 'dispensed') return res.status(400).json({ error: 'Already dispensed' });

    // Reduce stock
    for (const item of inv.pharmacy_invoice_items) {
      const { data: med } = await supabase.from('pharmacy_inventory').select('current_stock').eq('id', item.medicine_id).single();
      const newStock = Math.max(0, (med?.current_stock || 0) - item.quantity);
      await supabase.from('pharmacy_inventory').update({ current_stock: newStock, updated_by: req.user.id }).eq('id', item.medicine_id);
    }

    const { data, error } = await supabase.from('pharmacy_invoices').update({
      status: 'dispensed',
      payment_mode: payment_mode || null,
      amount_paid: amount_paid || inv.total_amount,
      dispensed_by: req.user.id,
      dispensed_at: new Date().toISOString()
    }).eq('id', id).select('*').single();

    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'DISPENSE_PHARMACY', module: 'Pharmacy', entity_type: 'pharmacy_invoice', entity_id: id });
    return res.json({ message: 'Medicines dispensed', invoice: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getStockAlerts = async (req, res) => {
  try {
    const { data, error } = await supabase.from('pharmacy_inventory').select('*').eq('is_active', true);
    if (error) throw error;

    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const low_stock = (data || []).filter(m => m.current_stock <= m.reorder_level);
    const expiring = (data || []).filter(m => m.expiry_date && m.expiry_date <= thirtyDays);
    const expired = (data || []).filter(m => m.expiry_date && m.expiry_date < new Date().toISOString().split('T')[0]);

    return res.json({ low_stock, expiring_soon: expiring, expired });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getInventory, getMedicineById, addMedicine, updateMedicine, addStock, getPharmacyInvoices, createPharmacyInvoice, dispensePharmacyInvoice, getStockAlerts };
