const supabase = require('../utils/supabase');

// ── Get Audit Logs ────────────────────────────────────────────────────────────
const getAuditLogs = async (req, res) => {
  try {
    const { user_id, module, action, entity_type, entity_id, date_from, date_to, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase.from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (user_id) query = query.eq('user_id', user_id);
    if (module) query = query.eq('module', module);
    if (action) query = query.ilike('action', `%${action}%`);
    if (entity_type) query = query.eq('entity_type', entity_type);
    if (entity_id) query = query.eq('entity_id', entity_id);
    if (date_from) query = query.gte('created_at', `${date_from}T00:00:00`);
    if (date_to) query = query.lte('created_at', `${date_to}T23:59:59`);

    const { data, error, count } = await query;
    if (error) throw error;
    return res.json({ logs: data, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Audit Log By ID ───────────────────────────────────────────────────────
const getAuditLogById = async (req, res) => {
  try {
    const { data, error } = await supabase.from('audit_logs').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Audit log not found' });
    return res.json({ log: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Activity Summary ──────────────────────────────────────────────────────────
const getActivitySummary = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase.from('audit_logs')
      .select('action, module, role_name, created_at')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const byModule = (data || []).reduce((acc, l) => {
      acc[l.module] = (acc[l.module] || 0) + 1;
      return acc;
    }, {});
    const byRole = (data || []).reduce((acc, l) => {
      acc[l.role_name] = (acc[l.role_name] || 0) + 1;
      return acc;
    }, {});

    return res.json({ today_total: data.length, by_module: byModule, by_role: byRole, recent: data.slice(0, 20) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getAuditLogs, getAuditLogById, getActivitySummary };
