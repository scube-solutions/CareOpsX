
// Patient creates a "pay at reception" request
const createRequest = async (req, res) => {
  try {
    const supabase = req.db;
    const { patient_name, patient_phone, patient_user_id, doctor_id, doctor_name, specialty, appointment_date, appointment_time, consultation_fee } = req.body;
    if (!patient_name || !consultation_fee) return res.status(400).json({ error: 'patient_name and consultation_fee required' });

    const { data, error } = await supabase.from('appointment_payment_requests').insert([{
      patient_name,
      patient_phone:   patient_phone || null,
      patient_user_id: patient_user_id || req.user?.id || null,
      doctor_id:       doctor_id || null,
      doctor_name:     doctor_name || null,
      specialty:       specialty || null,
      appointment_date,
      appointment_time,
      consultation_fee: parseFloat(consultation_fee),
      status:          'pending',
      organization_id: req.user?.organization_id ?? null,
      created_at:      new Date().toISOString(),
    }]).select('id, status, created_at').single();

    if (error) throw error;
    return res.status(201).json({ request: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// Receptionist gets all pending requests
const getPendingRequests = async (req, res) => {
  try {
    const supabase = req.db;
    const organizationId = req.user?.organization_id ?? null;
    let q = supabase.from('appointment_payment_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (organizationId) q = q.eq('organization_id', organizationId);
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ requests: data || [] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// Receptionist marks payment received
const approveRequest = async (req, res) => {
  try {
    const supabase = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const { id } = req.params;
    const { payment_mode = 'cash' } = req.body || {};

    let updQ = supabase.from('appointment_payment_requests')
      .update({ status: 'approved', approved_by: req.user.id, approved_at: new Date().toISOString() })
      .eq('id', id);
    if (organizationId) updQ = updQ.eq('organization_id', organizationId);
    const { data, error } = await updQ.select('*').single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Payment request not found' });

    // Auto-create billing invoice so it appears in patient payment history
    try {
      // Resolve patient record
      let patient_id = null;
      if (data.patient_user_id) {
        const { data: pat } = await supabase.from('patients').select('id').eq('user_id', data.patient_user_id).maybeSingle();
        if (pat) patient_id = pat.id;
      }
      // Fallback: match by phone
      if (!patient_id && data.patient_phone) {
        const { data: pat } = await supabase.from('patients').select('id').eq('phone', data.patient_phone).maybeSingle();
        if (pat) patient_id = pat.id;
      }

      if (patient_id) {
        const invoiceNumber = `INV-${new Date().toISOString().slice(2,7).replace('-','')}-${Math.floor(Math.random()*90000+10000)}`;
        const amount = parseFloat(data.consultation_fee) || 0;

        const { data: inv } = await supabase.from('invoices').insert([{
          patient_id,
          doctor_id:        data.doctor_id || null,
          invoice_number:   invoiceNumber,
          invoice_type:     'consultation',
          consultation_fee: amount,
          total_amount:     amount,
          paid_amount:      amount,
          balance_amount:   0,
          status:           'paid',
          notes:            `Collected at reception — ${data.appointment_date || ''}`,
          organization_id:  organizationId,
          created_at:       new Date().toISOString(),
        }]).select('id').single();

        if (inv?.id) {
          await supabase.from('payments').insert([{
            invoice_id:   inv.id,
            amount,
            payment_mode,
            payment_date: new Date().toISOString(),
            collected_by: req.user.id,
            notes:        'Collected at reception desk',
            organization_id: organizationId,
            created_at:   new Date().toISOString(),
          }]);
        }
      }
    } catch (_) {}

    // Push notification to patient
    if (data.patient_user_id) {
      try {
        await supabase.from('notifications').insert([{
          user_id:    data.patient_user_id,
          title:      'Payment Confirmed',
          message:    `Your consultation fee of ₹${data.consultation_fee} has been received at reception. You can now confirm your appointment.`,
          type:       'payment',
          is_read:    false,
          created_at: new Date().toISOString(),
        }]);
      } catch (_) {}
    }

    return res.json({ message: 'Payment marked as received', request: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// Patient polls status of their request
const checkStatus = async (req, res) => {
  try {
    const supabase = req.db;
    const organizationId = req.user?.organization_id ?? null;
    let q = supabase.from('appointment_payment_requests')
      .select('id, status, approved_at')
      .eq('id', req.params.id);
    if (organizationId) q = q.eq('organization_id', organizationId);
    const { data, error } = await q.single();
    if (error || !data) return res.status(404).json({ error: 'Request not found' });
    return res.json({ status: data.status, approved_at: data.approved_at });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

module.exports = { createRequest, getPendingRequests, approveRequest, checkStatus };
