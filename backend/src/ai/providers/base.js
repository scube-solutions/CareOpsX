// ─────────────────────────────────────────────────────────────────────────────
// Provider adapter contract.
//
// Every LLM provider (Groq, OpenAI, Gemini, Claude…) implements this interface so
// the orchestrator never depends on a specific vendor. Swap providers by changing
// the AI_PROVIDER env var — no orchestrator/tool changes.
//
// The INTERNAL message/tool format is OpenAI-compatible (Groq is natively so):
//   messages: [{ role: 'system'|'user'|'assistant'|'tool', content, tool_calls?, tool_call_id?, name? }]
//   tools:    [{ type: 'function', function: { name, description, parameters(JSONSchema) } }]
//
// chat() MUST return:
//   { content: string|null, toolCalls: [{ id, name, arguments(obj) }], usage: {…} }
//
// Adapters for non-OpenAI-shaped providers (Gemini, Claude) translate to/from this
// internal format inside their own chat() implementation.
// ─────────────────────────────────────────────────────────────────────────────

class BaseProvider {
  // eslint-disable-next-line no-unused-vars
  async chat({ messages, tools, model, temperature }) {
    throw new Error('Provider.chat() not implemented');
  }
}

module.exports = { BaseProvider };
