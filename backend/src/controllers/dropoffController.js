const supabase = require('../utils/supabase');
const { auditLog } = require('../middlewares/audit');

// ── Get Watchlist ─────────────────────────────────────────────────────────────
const getWatchlist = async (req, res) => {
  try {
    const { risk_level, outcome, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase.from('drop_off_watchlist')
      .select('*, patients(first_name, last_name, patient_uid, phone, chronic_disease_tag)', { count: 'exact' })
      .order('risk_score', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (risk_level) query = query.eq('risk_level', risk_level);
    if (outcome) query = query.eq('outcome', outcome);
    else query = query.in('outcome', ['at_risk', 'still_at_risk']);

    const { data, error, count } = await query;
    if (error) throw error;
    return res.json({ watchlist: data, total: count });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get/Create Drop-off Rules ─────────────────────────────────────────────────
const getRules = async (req, res) => {
  try {
    const { data, error } = await supabase.from('drop_off_rules').select('*').eq('is_active', true).order('risk_level');
    if (error) throw error;
    return res.json({ rules: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createRule = async (req, res) => {
  try {
    const { data, error } = await supabase.from('drop_off_rules').insert([{ ...req.body, is_active: true, created_by: req.user.id, created_at: new Date().toISOString() }]).select('*').single();
    if (error) throw error;
    return res.status(201).json({ message: 'Rule created', rule: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateRule = async (req, res) => {
  try {
    const { data, error } = await supabase.from('drop_off_rules').update({ ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() }).eq('id', req.params.id).select('*').single();
    if (error) throw error;
    return res.json({ message: 'Rule updated', rule: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Record Recovery Action ────────────────────────────────────────────────────
const recordAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { action_type, notes, outcome } = req.body;

    const { data: entry } = await supabase.from('drop_off_watchlist').select('action_history').eq('id', id).single();
    if (!entry) return res.status(404).json({ error: 'Watchlist entry not found' });

    const history = entry.action_history || [];
    history.push({ action_type, notes, performed_by: req.user.id, performed_at: new Date().toISOString() });

    const updates = { action_history: history, last_action_at: new Date().toISOString(), last_action_by: req.user.id, updated_at: new Date().toISOString() };
    if (outcome) updates.outcome = outcome;

    const { data, error } = await supabase.from('drop_off_watchlist').update(updates).eq('id', id).select('*').single();
    if (error) throw error;

    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'DROPOFF_ACTION', module: 'DropOff', entity_type: 'drop_off_watchlist', entity_id: id, new_data: { action_type, outcome } });
    return res.json({ message: 'Action recorded', entry: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Outcome Summary ───────────────────────────────────────────────────────
const getOutcomeSummary = async (req, res) => {
  try {
    const { data, error } = await supabase.from('drop_off_watchlist').select('outcome, risk_level');
    if (error) throw error;

    const summary = (data || []).reduce((acc, d) => {
      acc[d.outcome] = (acc[d.outcome] || 0) + 1;
      return acc;
    }, {});
    const byRisk = (data || []).reduce((acc, d) => {
      acc[d.risk_level] = (acc[d.risk_level] || 0) + 1;
      return acc;
    }, {});

    return res.json({ total: data.length, by_outcome: summary, by_risk_level: byRisk, recovered: summary.recovered || 0, at_risk: (summary.at_risk || 0) + (summary.still_at_risk || 0), lost: summary.lost_to_follow_up || 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Manual: Add to Watchlist ──────────────────────────────────────────────────
const addToWatchlist = async (req, res) => {
  try {
    const { patient_id, risk_reason, risk_level, risk_score, trigger_type } = req.body;
    if (!patient_id) return res.status(400).json({ error: 'patient_id required' });

    const { data: existing } = await supabase.from('drop_off_watchlist').select('id').eq('patient_id', patient_id).in('outcome', ['at_risk', 'still_at_risk']).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Patient already on watchlist', id: existing.id });

    const { data, error } = await supabase.from('drop_off_watchlist').insert([{
      patient_id,
      risk_reason: risk_reason || null,
      risk_level: risk_level || 'medium',
      risk_score: risk_score || 50,
      trigger_type: trigger_type || 'manual',
      outcome: 'at_risk',
      action_history: [],
      created_by: req.user.id,
      created_at: new Date().toISOString()
    }]).select('*').single();

    if (error) throw error;
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, action: 'ADD_TO_WATCHLIST', module: 'DropOff', entity_type: 'drop_off_watchlist', entity_id: data.id });
    return res.status(201).json({ message: 'Patient added to watchlist', entry: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getWatchlist, getRules, createRule, updateRule, recordAction, getOutcomeSummary, addToWatchlist };
