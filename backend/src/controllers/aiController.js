const { runChat, runChatStream, runDashboardSummary } = require('../ai/service');
const { buildReport } = require('../ai/reports');
const { exportReport } = require('../ai/exporters');
const { auditLog } = require('../middlewares/audit');
const { getOrganizationContext } = require('../utils/organizationAccess');

// POST /ai/chat  { message, conversation_id? }
const chat = async (req, res) => {
  try {
    const db = req.db;
    const { message, conversation_id } = req.body;
    if (!message || !String(message).trim()) return res.status(400).json({ error: 'message is required' });
    const { organizationId, organization } = await getOrganizationContext(req);

    // Resolve / create the conversation.
    let convId = conversation_id;
    if (convId) {
      const existingRes = await db.query(
        'SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2 LIMIT 1',
        [convId, req.user.id]
      );
      if (!existingRes.rows.length) convId = null;
    }
    if (!convId) {
      const title = String(message).trim().slice(0, 60);
      const convRes = await db.query(
        'INSERT INTO ai_conversations (organization_id, user_id, title) VALUES ($1, $2, $3) RETURNING id',
        [organizationId, req.user.id, title]
      );
      convId = convRes.rows[0].id;
    }

    // Load recent history (last 10 messages) for context.
    const historyRes = await db.query(
      'SELECT role, content FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 10',
      [convId]
    );
    const history = historyRes.rows || [];

    const { answer, toolsUsed, report } = await runChat({
      db, user: req.user, orgId: organizationId, orgName: organization?.organization_name,
      message, priorMessages: history,
    });

    // Persist the turn.
    await db.query(
      `INSERT INTO ai_messages (conversation_id, organization_id, role, content, tools_used) 
       VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)`,
      [
        convId, organizationId, 'user', message, null,
        convId, organizationId, 'assistant', answer, toolsUsed || null
      ]
    );
    await db.query('UPDATE ai_conversations SET updated_at = $1 WHERE id = $2', [new Date().toISOString(), convId]);

    // Audit (spec: capture user/role/query/response/module/time).
    await auditLog({
      user_id: req.user.id, role_id: req.user.role_id, organization_id: organizationId,
      action: 'AI_QUERY', module: 'AI', entity_type: 'ai_conversation', entity_id: convId,
      description: `Q: ${String(message).slice(0, 200)} | tools: ${(toolsUsed || []).join(',') || 'none'}`,
    });

    return res.json({ conversation_id: convId, answer, tools_used: toolsUsed, report });
  } catch (err) {
    console.error('AI chat error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// POST /ai/chat/stream — same as /ai/chat but streams the answer via SSE.
const chatStream = async (req, res) => {
  try {
    const db = req.db;
    const { message, conversation_id } = req.body;
    if (!message || !String(message).trim()) return res.status(400).json({ error: 'message is required' });
    const { organizationId, organization } = await getOrganizationContext(req);

    let convId = conversation_id;
    if (convId) {
      const existingRes = await db.query(
        'SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2 LIMIT 1',
        [convId, req.user.id]
      );
      if (!existingRes.rows.length) convId = null;
    }
    if (!convId) {
      const title = String(message).trim().slice(0, 60);
      const convRes = await db.query(
        'INSERT INTO ai_conversations (organization_id, user_id, title) VALUES ($1, $2, $3) RETURNING id',
        [organizationId, req.user.id, title]
      );
      convId = convRes.rows[0].id;
    }

    const historyRes = await db.query(
      'SELECT role, content FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 10',
      [convId]
    );
    const history = historyRes.rows || [];

    // Open SSE stream.
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ conversation_id: convId })}\n\n`);

    const onToken = (t) => res.write(`data: ${JSON.stringify({ token: t })}\n\n`);
    const { answer, toolsUsed, report } = await runChatStream({
      db, user: req.user, orgId: organizationId, orgName: organization?.organization_name,
      message, priorMessages: history,
    }, onToken);

    await db.query(
      `INSERT INTO ai_messages (conversation_id, organization_id, role, content, tools_used) 
       VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)`,
      [
        convId, organizationId, 'user', message, null,
        convId, organizationId, 'assistant', answer, toolsUsed || null
      ]
    );
    await db.query('UPDATE ai_conversations SET updated_at = $1 WHERE id = $2', [new Date().toISOString(), convId]);
    await auditLog({
      user_id: req.user.id, role_id: req.user.role_id, organization_id: organizationId,
      action: 'AI_QUERY', module: 'AI', entity_type: 'ai_conversation', entity_id: convId,
      description: `Q: ${String(message).slice(0, 200)} | tools: ${(toolsUsed || []).join(',') || 'none'}`,
    });

    res.write(`data: ${JSON.stringify({ done: true, conversation_id: convId, report, answer })}\n\n`);
    res.end();
  } catch (err) {
    console.error('AI chatStream error:', err.message);
    if (!res.headersSent) return res.status(500).json({ error: err.message });
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
};

// GET /ai/summary — executive dashboard summary (live, role-scoped)
const dashboardSummary = async (req, res) => {
  try {
    const { organizationId, organization } = await getOrganizationContext(req);
    const { summary, data } = await runDashboardSummary({
      db: req.db, user: req.user, orgId: organizationId, orgName: organization?.organization_name,
    });
    return res.json({ summary, data });
  } catch (err) {
    console.error('AI summary error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// POST /ai/report  { report, format, date_from?, date_to? } → file download
const generateReport = async (req, res) => {
  try {
    const { report, format = 'pdf', date_from, date_to } = req.body;
    if (!report) return res.status(400).json({ error: 'report is required' });
    const { organizationId } = await getOrganizationContext(req);
    const built = await buildReport(report, { db: req.db, user: req.user, orgId: organizationId }, { date_from, date_to });
    if (built.access_denied) return res.status(403).json({ error: built.message });
    if (built.error) return res.status(400).json({ error: built.error });

    const { buffer, mime, filename } = await exportReport(built, format);
    await auditLog({
      user_id: req.user.id, role_id: req.user.role_id, organization_id: organizationId,
      action: 'AI_REPORT', module: 'AI', entity_type: 'report', entity_id: report,
      description: `Generated ${report} (${format})`,
    });
    return res.json({ filename, mime, base64: buffer.toString('base64') });
  } catch (err) {
    console.error('AI report error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// GET /ai/conversations?q= — list (and optionally search) current user's conversations.
// Searches both conversation titles and message content.
const listConversations = async (req, res) => {
  try {
    const db = req.db;
    const q = (req.query.q || '').trim();
    let queryText = `
      SELECT DISTINCT c.id, c.title, c.created_at, c.updated_at
      FROM ai_conversations c
      LEFT JOIN ai_messages m ON m.conversation_id = c.id
      WHERE c.user_id = $1
    `;
    const params = [req.user.id];
    if (q) {
      params.push(`%${q}%`);
      queryText += ` AND (c.title ILIKE $2 OR m.content ILIKE $2)`;
    }
    queryText += ' ORDER BY c.updated_at DESC LIMIT 50';

    const result = await db.query(queryText, params);
    return res.json({ conversations: result.rows || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /ai/conversations/:id/messages
const getMessages = async (req, res) => {
  try {
    const db = req.db;
    const convRes = await db.query(
      'SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2 LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!convRes.rows.length) return res.status(404).json({ error: 'Conversation not found' });

    const messagesRes = await db.query(
      'SELECT role, content, tools_used, created_at FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    return res.json({ messages: messagesRes.rows || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// DELETE /ai/conversations/:id
const deleteConversation = async (req, res) => {
  try {
    const db = req.db;
    const deleteRes = await db.query(
      'DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    return res.json({ message: 'Conversation deleted' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { chat, chatStream, dashboardSummary, generateReport, listConversations, getMessages, deleteConversation };
