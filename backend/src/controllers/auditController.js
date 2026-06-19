
// ── Get Audit Logs ────────────────────────────────────────────────────────────
const getAuditLogs = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const { user_id, module, action, entity_type, entity_id, date_from, date_to, page = 1, limit = 50 } = req.query;
    const parsedLimit = parseInt(limit) || 50;
    const offset = (parseInt(page) - 1) * parsedLimit;

    let queryText = 'SELECT * FROM audit_logs';
    let countQueryText = 'SELECT COUNT(*)::int FROM audit_logs';
    const conditions = [];
    const params = [];

    if (organizationId) {
      params.push(organizationId);
      conditions.push(`organization_id = $${params.length}`);
    }
    if (user_id) {
      params.push(user_id);
      conditions.push(`user_id = $${params.length}`);
    }
    if (module) {
      params.push(module);
      conditions.push(`module = $${params.length}`);
    }
    if (action) {
      params.push(`%${action}%`);
      conditions.push(`action ILIKE $${params.length}`);
    }
    if (entity_type) {
      params.push(entity_type);
      conditions.push(`entity_type = $${params.length}`);
    }
    if (entity_id) {
      params.push(entity_id);
      conditions.push(`entity_id = $${params.length}`);
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

    // Get total count
    const countResult = await db.query(countQueryText, params);
    const total = countResult.rows[0].count;

    // Add order and pagination
    queryText += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parsedLimit, offset);

    const result = await db.query(queryText, params);
    return res.json({ logs: result.rows, total, page: parseInt(page), limit: parsedLimit });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Audit Log By ID ───────────────────────────────────────────────────────
const getAuditLogById = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    let queryText = 'SELECT * FROM audit_logs WHERE id = $1';
    const params = [req.params.id];
    if (organizationId) {
      params.push(organizationId);
      queryText += ' AND organization_id = $2';
    }
    queryText += ' LIMIT 1';
    const result = await db.query(queryText, params);
    const log = result.rows[0];
    if (!log) return res.status(404).json({ error: 'Audit log not found' });
    return res.json({ log });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Activity Summary ──────────────────────────────────────────────────────────
const getActivitySummary = async (req, res) => {
  try {
    const db = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const today = new Date().toISOString().split('T')[0];

    let queryText = 'SELECT action, module, role_name, created_at FROM audit_logs WHERE created_at >= $1';
    const params = [`${today}T00:00:00`];
    if (organizationId) {
      params.push(organizationId);
      queryText += ' AND organization_id = $2';
    }
    queryText += ' ORDER BY created_at DESC LIMIT 100';

    const result = await db.query(queryText, params);
    const data = result.rows;

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
