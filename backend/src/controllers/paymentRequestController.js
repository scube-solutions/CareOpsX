
// Patient creates a "pay at reception" request
const createRequest = async (req, res) => {
  try {
    const db = req.db;
    const { patient_name, patient_phone, patient_user_id, doctor_id, doctor_name, specialty, appointment_date, appointment_time, consultation_fee } = req.body;
    if (!patient_name || !consultation_fee) return res.status(400).json({ error: 'patient_name and consultation_fee required' });

    const result = await db.query(
      `INSERT INTO appointment_payment_requests
         (patient_name, patient_phone, patient_user_id, doctor_id, doctor_name, specialty,
          appointment_date, appointment_time, consultation_fee, status, organization_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11)
       RETURNING id, status, created_at`,
      [
        patient_name, patient_phone || null, patient_user_id || req.user?.id || null,
        doctor_id || null, doctor_name || null, specialty || null,
        appointment_date, appointment_time, parseFloat(consultation_fee),
        req.user?.organization_id ?? null, new Date().toISOString()
      ]
    );

    return res.status(201).json({ request: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// Receptionist gets all pending requests
const getPendingRequests = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const params = ['pending'];
    let orgClause = '';
    if (organizationId) { params.push(organizationId); orgClause = ` AND organization_id = $${params.length}`; }
    const result = await db.query(
      `SELECT * FROM appointment_payment_requests WHERE status = $1${orgClause} ORDER BY created_at DESC`,
      params
    );
    return res.json({ requests: result.rows || [] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// Receptionist marks payment received
const approveRequest = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const { id } = req.params;
    const { payment_mode = 'cash' } = req.body || {};

    const updParams = [req.user.id, new Date().toISOString(), id];
    let orgClause = '';
    if (organizationId) { updParams.push(organizationId); orgClause = ` AND organization_id = $${updParams.length}`; }

    const updRes = await db.query(
      `UPDATE appointment_payment_requests
       SET status='approved', approved_by=$1, approved_at=$2
       WHERE id=$3${orgClause}
       RETURNING *`,
      updParams
    );
    if (!updRes.rows.length) return res.status(404).json({ error: 'Payment request not found' });
    const data = updRes.rows[0];

    // Auto-create billing invoice
    try {
      let patient_id = null;
      if (data.patient_user_id) {
        const patRes = await db.query(`SELECT id FROM patients WHERE user_id = $1 LIMIT 1`, [data.patient_user_id]);
        if (patRes.rows[0]) patient_id = patRes.rows[0].id;
      }
      if (!patient_id && data.patient_phone) {
        const patRes = await db.query(`SELECT id FROM patients WHERE phone = $1 LIMIT 1`, [data.patient_phone]);
        if (patRes.rows[0]) patient_id = patRes.rows[0].id;
      }

      if (patient_id) {
        const invoiceNumber = `INV-${new Date().toISOString().slice(2,7).replace('-','')}-${Math.floor(Math.random()*90000+10000)}`;
        const amount = parseFloat(data.consultation_fee) || 0;

        const invRes = await db.query(
          `INSERT INTO invoices
             (patient_id, doctor_id, invoice_number, invoice_type, consultation_fee, total_amount,
              paid_amount, balance_amount, status, notes, organization_id, created_at)
           VALUES ($1,$2,$3,'consultation',$4,$4,$4,0,'paid',$5,$6,$7)
           RETURNING id`,
          [patient_id, data.doctor_id || null, invoiceNumber, amount,
           `Collected at reception — ${data.appointment_date || ''}`, organizationId, new Date().toISOString()]
        );

        const invId = invRes.rows[0]?.id;
        if (invId) {
          await db.query(
            `INSERT INTO payments
               (invoice_id, amount, payment_mode, payment_date, collected_by, notes, organization_id, created_at)
             VALUES ($1,$2,$3,$4,$5,'Collected at reception desk',$6,$7)`,
            [invId, amount, payment_mode, new Date().toISOString(), req.user.id, organizationId, new Date().toISOString()]
          );
        }
      }
    } catch (_) {}

    // Push notification to patient
    if (data.patient_user_id) {
      try {
        await db.query(
          `INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
           VALUES ($1,'Payment Confirmed',$2,'payment',false,$3)`,
          [
            data.patient_user_id,
            `Your consultation fee of ₹${data.consultation_fee} has been received at reception. You can now confirm your appointment.`,
            new Date().toISOString()
          ]
        );
      } catch (_) {}
    }

    return res.json({ message: 'Payment marked as received', request: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// Patient polls status of their request
const checkStatus = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const params = [req.params.id];
    let orgClause = '';
    if (organizationId) { params.push(organizationId); orgClause = ` AND organization_id = $${params.length}`; }
    const result = await db.query(
      `SELECT id, status, approved_at FROM appointment_payment_requests WHERE id = $1${orgClause}`,
      params
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Request not found' });
    const data = result.rows[0];
    return res.json({ status: data.status, approved_at: data.approved_at });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

module.exports = { createRequest, getPendingRequests, approveRequest, checkStatus };
