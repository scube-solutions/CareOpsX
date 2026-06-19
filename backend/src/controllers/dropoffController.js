const { auditLog } = require('../middlewares/audit');

// ── Get Watchlist ─────────────────────────────────────────────────────────────
const getWatchlist = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const { risk_level, outcome, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const params = [];
    const where = [];
    if (organizationId) { params.push(organizationId); where.push(`dw.organization_id = $${params.length}`); }
    if (risk_level)     { params.push(risk_level);     where.push(`dw.risk_level = $${params.length}`); }
    if (outcome) {
      params.push(outcome); where.push(`dw.outcome = $${params.length}`);
    } else {
      where.push(`dw.outcome IN ('at_risk','still_at_risk')`);
    }

    const countRes = await db.query(
      `SELECT COUNT(*) FROM drop_off_watchlist dw${where.length ? ' WHERE ' + where.join(' AND ') : ''}`,
      params
    );

    params.push(parseInt(limit));
    params.push(offset);
    const result = await db.query(
      `SELECT dw.*,
              p.first_name, p.last_name, p.patient_uid, p.phone, p.chronic_disease_tag
       FROM drop_off_watchlist dw
       LEFT JOIN patients p ON p.id = dw.patient_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY dw.risk_score DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const watchlist = result.rows.map(row => ({
      ...row,
      patients: row.first_name ? {
        first_name: row.first_name, last_name: row.last_name,
        patient_uid: row.patient_uid, phone: row.phone, chronic_disease_tag: row.chronic_disease_tag
      } : null
    }));

    return res.json({ watchlist, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get/Create Drop-off Rules ─────────────────────────────────────────────────
const getRules = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const params = [true];
    const where = [`is_active = $1`];
    if (organizationId) { params.push(organizationId); where.push(`organization_id = $${params.length}`); }
    const result = await db.query(
      `SELECT * FROM drop_off_rules WHERE ${where.join(' AND ')} ORDER BY risk_level`,
      params
    );
    return res.json({ rules: result.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createRule = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const body = req.body;
    const allKeys = [...Object.keys(body), 'organization_id', 'is_active', 'created_by', 'created_at'];
    const allVals = [...Object.values(body), organizationId, true, req.user.id, new Date().toISOString()];
    const cols = allKeys.join(', ');
    const placeholders = allKeys.map((_, i) => `$${i + 1}`).join(', ');
    const result = await db.query(
      `INSERT INTO drop_off_rules (${cols}) VALUES (${placeholders}) RETURNING *`,
      allVals
    );
    return res.status(201).json({ message: 'Rule created', rule: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateRule = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const body = { ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() };
    const keys = Object.keys(body);
    const values = Object.values(body);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(req.params.id);
    let sql = `UPDATE drop_off_rules SET ${setClauses} WHERE id = $${values.length}`;
    if (organizationId) { values.push(organizationId); sql += ` AND organization_id = $${values.length}`; }
    sql += ' RETURNING *';
    const result = await db.query(sql, values);
    if (!result.rows.length) return res.status(404).json({ error: 'Rule not found' });
    return res.json({ message: 'Rule updated', rule: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Record Recovery Action ────────────────────────────────────────────────────
const recordAction = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const { id } = req.params;
    const { action_type, notes, outcome } = req.body;

    const entryParams = [id];
    let orgClause = '';
    if (organizationId) { entryParams.push(organizationId); orgClause = ` AND organization_id = $${entryParams.length}`; }
    const entryRes = await db.query(
      `SELECT action_history FROM drop_off_watchlist WHERE id = $1${orgClause}`,
      entryParams
    );
    const entry = entryRes.rows[0];
    if (!entry) return res.status(404).json({ error: 'Watchlist entry not found' });

    const history = Array.isArray(entry.action_history) ? entry.action_history : [];
    history.push({ action_type, notes, performed_by: req.user.id, performed_at: new Date().toISOString() });

    const updParams = [JSON.stringify(history), new Date().toISOString(), req.user.id, new Date().toISOString(), id];
    let updSet = `action_history=$1, last_action_at=$2, last_action_by=$3, updated_at=$4`;
    let updWhere = `WHERE id=$5`;
    if (outcome) { updParams.splice(4, 0, outcome); updSet += `, outcome=$5`; updParams[updParams.length - 1] = id; }

    // Rebuild cleanly
    const updVals = [JSON.stringify(history), new Date().toISOString(), req.user.id, new Date().toISOString()];
    const extraSets = [];
    if (outcome) { updVals.push(outcome); extraSets.push(`outcome = $${updVals.length}`); }
    updVals.push(id);
    const idIdx = updVals.length;

    const result = await db.query(
      `UPDATE drop_off_watchlist
       SET action_history=$1, last_action_at=$2, last_action_by=$3, updated_at=$4${extraSets.length ? ', ' + extraSets.join(', ') : ''}
       WHERE id=$${idIdx}
       RETURNING *`,
      updVals
    );

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'DROPOFF_ACTION', module: 'DropOff', entity_type: 'drop_off_watchlist', entity_id: id, new_data: { action_type, outcome } });
    return res.json({ message: 'Action recorded', entry: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Outcome Summary ───────────────────────────────────────────────────────
const getOutcomeSummary = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const params = [];
    let orgClause = '';
    if (organizationId) { params.push(organizationId); orgClause = ` WHERE organization_id = $1`; }

    const result = await db.query(
      `SELECT outcome, risk_level FROM drop_off_watchlist${orgClause}`,
      params
    );
    const data = result.rows || [];

    const summary = data.reduce((acc, d) => { acc[d.outcome] = (acc[d.outcome] || 0) + 1; return acc; }, {});
    const byRisk  = data.reduce((acc, d) => { acc[d.risk_level] = (acc[d.risk_level] || 0) + 1; return acc; }, {});

    return res.json({ total: data.length, by_outcome: summary, by_risk_level: byRisk, recovered: summary.recovered || 0, at_risk: (summary.at_risk || 0) + (summary.still_at_risk || 0), lost: summary.lost_to_follow_up || 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Manual: Add to Watchlist ──────────────────────────────────────────────────
const addToWatchlist = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const { patient_id, risk_reason, risk_level, risk_score, trigger_type } = req.body;
    if (!patient_id) return res.status(400).json({ error: 'patient_id required' });

    const existParams = [patient_id];
    let orgExist = '';
    if (organizationId) { existParams.push(organizationId); orgExist = ` AND organization_id = $${existParams.length}`; }
    const existRes = await db.query(
      `SELECT id FROM drop_off_watchlist WHERE patient_id = $1 AND outcome IN ('at_risk','still_at_risk')${orgExist} LIMIT 1`,
      existParams
    );
    if (existRes.rows.length) return res.status(409).json({ error: 'Patient already on watchlist', id: existRes.rows[0].id });

    const insertRes = await db.query(
      `INSERT INTO drop_off_watchlist
         (patient_id, risk_reason, risk_level, risk_score, trigger_type, outcome,
          action_history, organization_id, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,'at_risk','[]'::jsonb,$6,$7,$8)
       RETURNING *`,
      [
        patient_id, risk_reason || null, risk_level || 'medium', risk_score || 50,
        trigger_type || 'manual', organizationId, req.user.id, new Date().toISOString()
      ]
    );
    const data = insertRes.rows[0];

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null, action: 'ADD_TO_WATCHLIST', module: 'DropOff', entity_type: 'drop_off_watchlist', entity_id: data.id });
    return res.status(201).json({ message: 'Patient added to watchlist', entry: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getWatchlist, getRules, createRule, updateRule, recordAction, getOutcomeSummary, addToWatchlist };
