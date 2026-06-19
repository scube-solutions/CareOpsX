const { auditLog } = require('../middlewares/audit');
const { getUserOrganizationId, getOrganizationById, normalizeFeatureFlags } = require('../utils/organizationAccess');

// True when the org's plan includes voice announcements.
const queueVoiceEnabled = async (organizationId) => {
  if (!organizationId) return true;
  try {
    const org = await getOrganizationById(organizationId);
    return normalizeFeatureFlags(org?.feature_flags).queue_voice !== false;
  } catch { return true; }
};

// Attach patient + doctor names to queue token rows
const attachQueueRelated = async (rows, db) => {
  if (!rows.length) return rows;

  const patientIds = [...new Set(rows.map(r => r.patient_id).filter(Boolean))];
  const patientMap = {};
  if (patientIds.length) {
    const res = await db.query(
      `SELECT id, first_name, last_name, phone, patient_uid FROM patients WHERE id = ANY($1)`,
      [patientIds]
    );
    (res.rows || []).forEach(p => { patientMap[p.id] = p; });
  }

  const doctorIds = [...new Set(rows.map(r => r.doctor_id).filter(Boolean))];
  const doctorMap = {};
  if (doctorIds.length) {
    const docRes = await db.query(
      `SELECT id, user_id, room_number FROM doctors WHERE id = ANY($1)`,
      [doctorIds]
    );
    const doctors = docRes.rows || [];
    const userIds = [...new Set(doctors.map(d => d.user_id).filter(Boolean))];
    const userMap = {};
    if (userIds.length) {
      const userRes = await db.query(
        `SELECT id, first_name, last_name FROM users WHERE id = ANY($1)`,
        [userIds]
      );
      (userRes.rows || []).forEach(u => { userMap[u.id] = u; });
    }
    doctors.forEach(d => {
      doctorMap[d.id] = { room_number: d.room_number, users: userMap[d.user_id] || null };
    });
  }

  return rows.map(r => ({
    ...r,
    patients: patientMap[r.patient_id] || null,
    doctors:  doctorMap[r.doctor_id]  || null,
  }));
};

// Generate token number for today per doctor
const generateToken = async (doctor_id, db) => {
  const today = new Date().toISOString().split('T')[0];
  const res = await db.query(
    `SELECT COALESCE(MAX(token_number), 0) AS max_token FROM queue_tokens WHERE doctor_id = $1 AND token_date = $2`,
    [doctor_id, today]
  );
  return (res.rows[0]?.max_token || 0) + 1;
};

// ── Generate Token (check-in) ─────────────────────────────────────────────────
const generateQueueToken = async (req, res) => {
  try {
    const db = req.db;
    const { appointment_id, patient_id, doctor_id, branch_id, priority } = req.body;
    if (!patient_id || !doctor_id) return res.status(400).json({ error: 'patient_id and doctor_id required' });
    const organizationId = getUserOrganizationId(req);

    const token_number = await generateToken(doctor_id, db);
    const today = new Date().toISOString().split('T')[0];

    const insertRes = await db.query(
      `INSERT INTO queue_tokens
         (appointment_id, patient_id, doctor_id, branch_id, token_number, token_date, status,
          priority, organization_id, checked_in_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'waiting',$7,$8,$9,$10)
       RETURNING *`,
      [
        appointment_id || null, patient_id, doctor_id, branch_id || null,
        token_number, today, priority || 'normal',
        organizationId || null, new Date().toISOString(), req.user.id
      ]
    );
    const data = insertRes.rows[0];

    // Update appointment status to checked_in if appointment_id provided
    if (appointment_id) {
      await db.query(
        `UPDATE appointments SET queue_status='checked_in', token_number=$1, checked_in_at=$2 WHERE id=$3`,
        [token_number, new Date().toISOString(), appointment_id]
      );
    }

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'GENERATE_TOKEN', module: 'Queue', entity_type: 'queue_token', entity_id: data.id });
    return res.status(201).json({ message: 'Token generated', token: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Live Queue for a Doctor ───────────────────────────────────────────────
const getLiveQueue = async (req, res) => {
  try {
    const db = req.db;
    const { doctor_id } = req.params;
    const today = new Date().toISOString().split('T')[0];
    const organizationId = getUserOrganizationId(req);

    const params = [doctor_id, today];
    let orgClause = '';
    if (organizationId) { params.push(organizationId); orgClause = ` AND organization_id = $${params.length}`; }

    const queueRes = await db.query(
      `SELECT * FROM queue_tokens
       WHERE doctor_id = $1 AND token_date = $2
         AND status IN ('waiting','called','in_consultation')
         ${orgClause}
       ORDER BY
         CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
         token_number ASC`,
      params
    );

    const queue = await attachQueueRelated(queueRes.rows || [], db);
    return res.json({ queue, total: queue.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Lobby Display (all doctors, current day) ──────────────────────────────────
const getLobbyDisplay = async (req, res) => {
  try {
    const db = req.db;
    const { branch_id, doctor_id } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const organizationId = getUserOrganizationId(req);

    const params = [today];
    const whereClauses = [`token_date = $1`, `status IN ('called','in_consultation','waiting')`];
    if (organizationId) { params.push(organizationId); whereClauses.push(`organization_id = $${params.length}`); }
    if (branch_id)      { params.push(branch_id);      whereClauses.push(`branch_id = $${params.length}`); }
    if (doctor_id)      { params.push(doctor_id);      whereClauses.push(`doctor_id = $${params.length}`); }

    const tokenRes = await db.query(
      `SELECT * FROM queue_tokens WHERE ${whereClauses.join(' AND ')} ORDER BY token_number ASC`,
      params
    );

    const rows = await attachQueueRelated(tokenRes.rows || [], db);
    const called  = rows.filter(t => t.status === 'called' || t.status === 'in_consultation');
    const waiting = rows.filter(t => t.status === 'waiting');

    // Voice/announcement settings
    const settingsOrg = organizationId || (req.query.org_id ? Number(req.query.org_id) : null);
    let settings = { ...DEFAULT_QUEUE_SETTINGS };
    if (settingsOrg) {
      const sRes = await db.query(
        `SELECT * FROM queue_settings WHERE organization_id = $1 LIMIT 1`,
        [settingsOrg]
      );
      if (sRes.rows[0]) settings = { ...settings, ...sRes.rows[0] };
    }
    if (!(await queueVoiceEnabled(settingsOrg))) settings.voice_enabled = false;

    return res.json({ called, waiting, total_waiting: waiting.length, settings });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Doctor: Call Next Patient ─────────────────────────────────────────────────
const callNext = async (req, res) => {
  try {
    const db = req.db;
    const { doctor_id } = req.params;
    const today = new Date().toISOString().split('T')[0];
    const organizationId = getUserOrganizationId(req);

    const orgParam = organizationId ? ` AND organization_id = $3` : '';
    const baseParams = [doctor_id, today];
    if (organizationId) baseParams.push(organizationId);

    // Mark current in_consultation as completed
    await db.query(
      `UPDATE queue_tokens SET status='completed', completed_at=$1
       WHERE doctor_id=$2 AND token_date=$3 AND status='in_consultation'${organizationId ? ` AND organization_id=$4` : ''}`,
      [new Date().toISOString(), doctor_id, today, ...(organizationId ? [organizationId] : [])]
    );

    // Mark current called as in_consultation
    await db.query(
      `UPDATE queue_tokens SET status='in_consultation'
       WHERE doctor_id=$1 AND token_date=$2 AND status='called'${organizationId ? ` AND organization_id=$3` : ''}`,
      [doctor_id, today, ...(organizationId ? [organizationId] : [])]
    );

    // Get next waiting
    const nextRes = await db.query(
      `SELECT * FROM queue_tokens
       WHERE doctor_id=$1 AND token_date=$2 AND status='waiting'${organizationId ? ` AND organization_id=$3` : ''}
       ORDER BY
         CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
         token_number ASC
       LIMIT 1`,
      [doctor_id, today, ...(organizationId ? [organizationId] : [])]
    );
    if (!nextRes.rows.length) return res.json({ message: 'No more patients waiting', next_token: null });

    const next = nextRes.rows[0];
    const now = new Date().toISOString();

    const updRes = await db.query(
      `UPDATE queue_tokens
       SET status='called', called_at=$1, last_called_at=$1, call_count=$2
       WHERE id=$3
       RETURNING *`,
      [now, (next.call_count || 0) + 1, next.id]
    );
    const [data] = await attachQueueRelated(updRes.rows, db);

    if (next.appointment_id) {
      await db.query(
        `UPDATE appointments SET queue_status='called', called_at=$1 WHERE id=$2`,
        [now, next.appointment_id]
      );
    }

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'CALL_NEXT', module: 'Queue', entity_type: 'queue_token', entity_id: next.id });
    return res.json({ message: 'Next patient called', token: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Doctor: Call a SPECIFIC patient (by token id) ─────────────────────────────
const callPatient = async (req, res) => {
  try {
    const db = req.db;
    const { id } = req.params;
    const organizationId = getUserOrganizationId(req);
    const tokenRes = await db.query(`SELECT * FROM queue_tokens WHERE id = $1`, [id]);
    const token = tokenRes.rows[0];
    if (!token) return res.status(404).json({ error: 'Token not found' });
    const now = new Date().toISOString();
    const updRes = await db.query(
      `UPDATE queue_tokens
       SET status='called', called_at=$1, last_called_at=$1, call_count=$2
       WHERE id=$3
       RETURNING *`,
      [now, (token.call_count || 0) + 1, id]
    );
    const [data] = await attachQueueRelated(updRes.rows, db);
    if (token.appointment_id) {
      await db.query(
        `UPDATE appointments SET queue_status='called', called_at=$1 WHERE id=$2`,
        [now, token.appointment_id]
      );
    }
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: organizationId || null, action: 'CALL_PATIENT', module: 'Queue', entity_type: 'queue_token', entity_id: id });
    return res.json({ message: 'Patient called', token: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Doctor: Recall (re-announce) — queue position unchanged ───────────────────
const recallPatient = async (req, res) => {
  try {
    const db = req.db;
    const { id } = req.params;
    const organizationId = getUserOrganizationId(req);
    const tokenRes = await db.query(`SELECT * FROM queue_tokens WHERE id = $1`, [id]);
    const token = tokenRes.rows[0];
    if (!token) return res.status(404).json({ error: 'Token not found' });
    const now = new Date().toISOString();
    const updRes = await db.query(
      `UPDATE queue_tokens SET last_called_at=$1, call_count=$2 WHERE id=$3 RETURNING *`,
      [now, (token.call_count || 0) + 1, id]
    );
    const [data] = await attachQueueRelated(updRes.rows, db);
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: organizationId || null, action: 'RECALL_PATIENT', module: 'Queue', entity_type: 'queue_token', entity_id: id });
    return res.json({ message: 'Patient recalled', token: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Queue / Voice Settings ────────────────────────────────────────────────────
const DEFAULT_QUEUE_SETTINGS = {
  voice_enabled: true, voice_name: null, voice_lang: 'en-IN', voice_gender: 'female',
  volume: 1.0, rate: 1.0, pitch: 1.0, repeat_count: 3, repeat_interval_sec: 10,
  announce_template: 'Attention please. Token number {token}, {name}, please proceed to {doctor}, consultation room {room}.',
};

const getQueueSettings = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = getUserOrganizationId(req) || (req.query.org_id ? Number(req.query.org_id) : null);
    if (!organizationId) return res.json({ settings: DEFAULT_QUEUE_SETTINGS });
    const sRes = await db.query(
      `SELECT * FROM queue_settings WHERE organization_id = $1 LIMIT 1`,
      [organizationId]
    );
    return res.json({ settings: { ...DEFAULT_QUEUE_SETTINGS, ...(sRes.rows[0] || {}) } });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const updateQueueSettings = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = getUserOrganizationId(req);
    if (!organizationId) return res.status(400).json({ error: 'Organization context required' });
    if (!(await queueVoiceEnabled(organizationId))) return res.status(403).json({ error: 'Voice announcements are not included in your organization\'s plan.' });

    const allowed = ['voice_enabled', 'voice_name', 'voice_lang', 'voice_gender', 'volume', 'rate', 'pitch', 'repeat_count', 'repeat_interval_sec', 'announce_template'];
    const fields = { organization_id: organizationId, updated_by: req.user.id, updated_at: new Date().toISOString() };
    allowed.forEach(k => { if (req.body[k] !== undefined) fields[k] = req.body[k]; });

    const keys = Object.keys(fields);
    const values = Object.values(fields);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const insertCols = keys.join(', ');
    const insertPlaceholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const conflictUpdates = keys.filter(k => k !== 'organization_id').map((k, i) => `${k} = EXCLUDED.${k}`).join(', ');

    const upsertRes = await db.query(
      `INSERT INTO queue_settings (${insertCols}) VALUES (${insertPlaceholders})
       ON CONFLICT (organization_id) DO UPDATE SET ${conflictUpdates}
       RETURNING *`,
      values
    );
    const data = upsertRes.rows[0];
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: organizationId, action: 'UPDATE_QUEUE_SETTINGS', module: 'Queue', entity_type: 'queue_settings', entity_id: String(organizationId) });
    return res.json({ message: 'Queue settings saved', settings: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Update Token Status ───────────────────────────────────────────────────────
const updateTokenStatus = async (req, res) => {
  try {
    const db = req.db;
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['waiting', 'called', 'in_consultation', 'completed', 'missed', 'skipped'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const params = [status, new Date().toISOString(), id];
    let extraSet = '';
    if (status === 'called')    { params.splice(2, 0, new Date().toISOString()); extraSet = `, called_at = $3`; params[params.length - 1] = id; }
    if (status === 'completed') { params.splice(2, 0, new Date().toISOString()); extraSet = `, completed_at = $3`; params[params.length - 1] = id; }

    // Rebuild cleanly
    const updParams = [status, new Date().toISOString()];
    const extraSets = [];
    if (status === 'called')    { updParams.push(new Date().toISOString()); extraSets.push(`called_at = $${updParams.length}`); }
    if (status === 'completed') { updParams.push(new Date().toISOString()); extraSets.push(`completed_at = $${updParams.length}`); }
    updParams.push(id);
    const idParam = updParams.length;

    const updRes = await db.query(
      `UPDATE queue_tokens
       SET status = $1, updated_at = $2${extraSets.length ? ', ' + extraSets.join(', ') : ''}
       WHERE id = $${idParam}
       RETURNING *`,
      updParams
    );
    if (!updRes.rows.length) return res.status(404).json({ error: 'Token not found' });
    const data = updRes.rows[0];

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'UPDATE_TOKEN_STATUS', module: 'Queue', entity_type: 'queue_token', entity_id: id, new_data: { status } });
    return res.json({ message: 'Token status updated', token: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Log Patient Journey Step ──────────────────────────────────────────────────
const logPatientJourney = async (req, res) => {
  try {
    const db = req.db;
    const { patient_id, appointment_id, location, notes } = req.body;
    if (!patient_id || !location) return res.status(400).json({ error: 'patient_id and location required' });
    const organizationId = getUserOrganizationId(req);

    const insertRes = await db.query(
      `INSERT INTO patient_journey_log
         (patient_id, appointment_id, location, notes, organization_id, logged_by, logged_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [patient_id, appointment_id || null, location, notes || null, organizationId || null, req.user.id, new Date().toISOString()]
    );

    return res.status(201).json({ message: 'Journey logged', log: insertRes.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Patient Journey ───────────────────────────────────────────────────────
const getPatientJourney = async (req, res) => {
  try {
    const db = req.db;
    const { patient_id, appointment_id } = req.query;
    const organizationId = getUserOrganizationId(req);

    const params = [];
    const where = [];
    if (organizationId)  { params.push(organizationId);  where.push(`organization_id = $${params.length}`); }
    if (patient_id)      { params.push(patient_id);      where.push(`patient_id = $${params.length}`); }
    if (appointment_id)  { params.push(appointment_id);  where.push(`appointment_id = $${params.length}`); }

    const journeyRes = await db.query(
      `SELECT * FROM patient_journey_log${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY logged_at ASC`,
      params
    );
    return res.json({ journey: journeyRes.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { generateQueueToken, getLiveQueue, getLobbyDisplay, callNext, callPatient, recallPatient, getQueueSettings, updateQueueSettings, updateTokenStatus, logPatientJourney, getPatientJourney };
