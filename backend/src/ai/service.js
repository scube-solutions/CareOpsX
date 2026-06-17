// ─────────────────────────────────────────────────────────────────────────────
// AI orchestrator — runs the model ↔ tool loop, provider-agnostically.
//
// Flow: build system prompt with user/role/org context → call provider with the
// tool schemas → if the model requests tools, execute them (RBAC-enforced) and
// feed results back → repeat until the model returns a final text answer.
// ─────────────────────────────────────────────────────────────────────────────
const { getProvider } = require('./providers');
const { toolSchemas, executeTool } = require('./tools');
const { ROLE_LABELS } = require('../utils/organizationAccess');

const MAX_TOOL_ITERATIONS = 5;

const buildSystemPrompt = ({ user, orgName }) => {
  const roles = (Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role_id])
    .map(r => ROLE_LABELS[r] || `Role ${r}`).join(', ');
  return [
    'You are the AI Organizational Assistant for a Hospital Management System (HMS) and HRMS.',
    `The signed-in user is "${user.email}" with role(s): ${roles}.`,
    orgName ? `Their organization is "${orgName}".` : '',
    `Today's date is ${new Date().toISOString().split('T')[0]}.`,
    '',
    'RULES:',
    '- Answer ONLY using data returned by the provided tools. Never invent numbers, names, or statistics.',
    '- If a tool returns access_denied, tell the user they are not authorized for that information. Do not attempt other tools to work around it.',
    '- If you have no tool to answer a question, say so plainly.',
    '- Give concise, business-style summaries and insights, not raw data dumps. Format currency in INR (₹).',
    '- When useful, highlight the most important figure first, then supporting detail.',
    '- Keep answers short and readable. Use simple sentences or short bullet lists.',
  ].filter(Boolean).join('\n');
};

// Run one user turn. priorMessages = prior [{role, content}] from history.
// Returns { answer, toolsUsed[] }.
const runChat = async ({ db, user, orgId, orgName, message, priorMessages = [] }) => {
  const provider = getProvider();
  const tools = toolSchemas();

  const messages = [
    { role: 'system', content: buildSystemPrompt({ user, orgName }) },
    ...priorMessages.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  const toolsUsed = [];
  let report = null; // set when generate_report runs → surfaced for download buttons

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const { content, toolCalls, raw } = await provider.chat({ messages, tools });

    if (!toolCalls || toolCalls.length === 0) {
      return { answer: content || 'I could not generate a response.', toolsUsed, report };
    }

    // Echo the assistant tool-call message back into the thread, then resolve each.
    messages.push(raw || { role: 'assistant', content: content || null, tool_calls: toolCalls.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.arguments) } })) });

    for (const call of toolCalls) {
      toolsUsed.push(call.name);
      const result = await executeTool(call.name, call.arguments, { db, user, orgId });
      if (call.name === 'generate_report' && result.report_ready) {
        report = { report: result.report, label: result.label, params: result.params, formats: result.formats };
      }
      messages.push({ role: 'tool', tool_call_id: call.id, name: call.name, content: JSON.stringify(result) });
    }
  }

  // Safety net: ran out of iterations — ask for a final answer with what we have.
  const { content } = await provider.chat({ messages, tools: [] });
  return { answer: content || 'I gathered the data but could not summarize it. Please try rephrasing.', toolsUsed, report };
};

// Streaming variant of runChat. Streams the final answer token-by-token via
// onToken(). Tool-resolution turns produce no visible tokens (the model emits
// only tool_calls), so the user sees "Thinking…" until the final answer streams.
const runChatStream = async ({ db, user, orgId, orgName, message, priorMessages = [] }, onToken) => {
  const provider = getProvider();
  if (typeof provider.chatStream !== 'function') {
    // Fallback: provider has no streaming — run non-stream and emit once.
    const r = await runChat({ db, user, orgId, orgName, message, priorMessages });
    if (onToken && r.answer) onToken(r.answer);
    return r;
  }
  const tools = toolSchemas();
  const messages = [
    { role: 'system', content: buildSystemPrompt({ user, orgName }) },
    ...priorMessages.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];
  const toolsUsed = [];
  let report = null;

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const { content, toolCalls } = await provider.chatStream({ messages, tools }, onToken);
    if (!toolCalls || toolCalls.length === 0) {
      return { answer: content || 'I could not generate a response.', toolsUsed, report };
    }
    messages.push({ role: 'assistant', content: content || null, tool_calls: toolCalls.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.arguments) } })) });
    for (const call of toolCalls) {
      toolsUsed.push(call.name);
      const result = await executeTool(call.name, call.arguments, { db, user, orgId });
      if (call.name === 'generate_report' && result.report_ready) {
        report = { report: result.report, label: result.label, params: result.params, formats: result.formats };
      }
      messages.push({ role: 'tool', tool_call_id: call.id, name: call.name, content: JSON.stringify(result) });
    }
  }
  // Safety net: final streamed answer with tools disabled.
  const { content } = await provider.chatStream({ messages, tools: [] }, onToken);
  return { answer: content || 'I gathered the data but could not summarize it.', toolsUsed, report };
};

// Executive dashboard summary — gathers key metrics (RBAC-filtered) and asks the
// model for a short, plain-language overview. Tools the user can't access are
// silently skipped, so the summary only reflects permitted data.
const runDashboardSummary = async ({ db, user, orgId, orgName }) => {
  const provider = getProvider();
  const ctx = { db, user, orgId };
  const wanted = ['get_hospital_overview', 'get_appointments_summary', 'get_hr_summary', 'get_low_stock_medicines'];

  const gathered = {};
  for (const name of wanted) {
    const r = await executeTool(name, {}, ctx);
    if (!r?.access_denied && !r?.error) gathered[name] = r;
  }
  if (Object.keys(gathered).length === 0) {
    return { summary: 'No dashboard data is available for your role.', data: {} };
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt({ user, orgName }) + '\n\nProduce a concise executive daily overview as short bullet lines (metric: value). No preamble.' },
    { role: 'user', content: `Here is today's data. Write the executive overview:\n${JSON.stringify(gathered)}` },
  ];
  const { content } = await provider.chat({ messages, tools: [] });
  return { summary: content || 'Summary unavailable.', data: gathered };
};

module.exports = { runChat, runChatStream, runDashboardSummary };
