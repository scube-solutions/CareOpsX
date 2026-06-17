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
      const { data: existing } = await db.from('ai_conversations').select('id').eq('id', convId).eq('user_id', req.user.id).maybeSingle();
      if (!existing) convId = null;
    }
    if (!convId) {
      const title = String(message).trim().slice(0, 60);
      const { data: conv, error } = await db.from('ai_conversations')
        .insert([{ organization_id: organizationId, user_id: req.user.id, title }])
        .select('id').single();
      if (error) throw error;
      convId = conv.id;
    }

    // Load recent history (last 10 messages) for context.
    const { data: history } = await db.from('ai_messages')
      .select('role, content').eq('conversation_id', convId).order('created_at', { ascending: true }).limit(10);

    const { answer, toolsUsed, report } = await runChat({
      db, user: req.user, orgId: organizationId, orgName: organization?.organization_name,
      message, priorMessages: history || [],
    });

    // Persist the turn.
    await db.from('ai_messages').insert([
      { conversation_id: convId, organization_id: organizationId, role: 'user', content: message },
      { conversation_id: convId, organization_id: organizationId, role: 'assistant', content: answer, tools_used: toolsUsed },
    ]);
    await db.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId);

    // Audit (spec: capture user/role/query/response/module/time).
    await auditLog({
      user_id: req.user.id, role_id: req.user.role_id, organization_id: organizationId,
      action: 'AI_QUERY', module: 'AI', entity_type: 'ai_conversation', entity_id: convId,
      description: `Q: ${String(message).slice(0, 200)} | tools: ${toolsUsed.join(',') || 'none'}`,
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
      const { data: existing } = await db.from('ai_conversations').select('id').eq('id', convId).eq('user_id', req.user.id).maybeSingle();
      if (!existing) convId = null;
    }
    if (!convId) {
      const { data: conv } = await db.from('ai_conversations')
        .insert([{ organization_id: organizationId, user_id: req.user.id, title: String(message).trim().slice(0, 60) }])
        .select('id').single();
      convId = conv.id;
    }
    const { data: history } = await db.from('ai_messages')
      .select('role, content').eq('conversation_id', convId).order('created_at', { ascending: true }).limit(10);

    // Open SSE stream.
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ conversation_id: convId })}\n\n`);

    const onToken = (t) => res.write(`data: ${JSON.stringify({ token: t })}\n\n`);
    const { answer, toolsUsed, report } = await runChatStream({
      db, user: req.user, orgId: organizationId, orgName: organization?.organization_name,
      message, priorMessages: history || [],
    }, onToken);

    await db.from('ai_messages').insert([
      { conversation_id: convId, organization_id: organizationId, role: 'user', content: message },
      { conversation_id: convId, organization_id: organizationId, role: 'assistant', content: answer, tools_used: toolsUsed },
    ]);
    await db.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId);
    await auditLog({
      user_id: req.user.id, role_id: req.user.role_id, organization_id: organizationId,
      action: 'AI_QUERY', module: 'AI', entity_type: 'ai_conversation', entity_id: convId,
      description: `Q: ${String(message).slice(0, 200)} | tools: ${toolsUsed.join(',') || 'none'}`,
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
// Returns the file as base64 so the browser can save it regardless of the auth
// header (downloads via <a> can't carry Authorization). RBAC enforced in buildReport.
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
    let matchIds = null;
    if (q) {
      // Conversation ids whose messages contain the search term.
      const { data: msgHits } = await db.from('ai_messages')
        .select('conversation_id').ilike('content', `%${q}%`).limit(500);
      matchIds = [...new Set((msgHits || []).map(m => m.conversation_id))];
    }
    let query = db.from('ai_conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', req.user.id).order('updated_at', { ascending: false }).limit(50);
    if (q) {
      const idList = (matchIds && matchIds.length) ? `,id.in.(${matchIds.join(',')})` : '';
      query = query.or(`title.ilike.%${q}%${idList}`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return res.json({ conversations: data || [] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// GET /ai/conversations/:id/messages
const getMessages = async (req, res) => {
  try {
    const db = req.db;
    const { data: conv } = await db.from('ai_conversations').select('id').eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const { data, error } = await db.from('ai_messages')
      .select('role, content, tools_used, created_at').eq('conversation_id', req.params.id).order('created_at', { ascending: true });
    if (error) throw error;
    return res.json({ messages: data || [] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// DELETE /ai/conversations/:id
const deleteConversation = async (req, res) => {
  try {
    const db = req.db;
    const { error } = await db.from('ai_conversations').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) throw error;
    return res.json({ message: 'Conversation deleted' });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

module.exports = { chat, chatStream, dashboardSummary, generateReport, listConversations, getMessages, deleteConversation };
