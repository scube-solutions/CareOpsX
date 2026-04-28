const supabase = require('../utils/supabase');

// Patient creates a "pay at reception" request
const createRequest = async (req, res) => {
  try {
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
      created_at:      new Date().toISOString(),
    }]).select('id, status, created_at').single();

    if (error) throw error;
    return res.status(201).json({ request: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// Receptionist gets all pending requests
const getPendingRequests = async (req, res) => {
  try {
    const { data, error } = await supabase.from('appointment_payment_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ requests: data || [] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// Receptionist marks payment received
const approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('appointment_payment_requests')
      .update({ status: 'approved', approved_by: req.user.id, approved_at: new Date().toISOString() })
      .eq('id', id).select('*').single();
    if (error) throw error;

    // Push notification to patient if patient_user_id exists
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
    const { data, error } = await supabase.from('appointment_payment_requests')
      .select('id, status, approved_at')
      .eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Request not found' });
    return res.json({ status: data.status, approved_at: data.approved_at });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

module.exports = { createRequest, getPendingRequests, approveRequest, checkStatus };
