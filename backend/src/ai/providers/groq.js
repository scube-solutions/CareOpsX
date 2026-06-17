const { BaseProvider } = require('./base');

// Groq — OpenAI-compatible chat completions API with function/tool calling.
// Because the wire format matches our internal format, this adapter is a near
// pass-through. Other providers (Gemini/Claude) will translate inside chat().
class GroqProvider extends BaseProvider {
  constructor() {
    super();
    this.apiKey = process.env.GROQ_API_KEY;
    this.model  = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    this.url    = 'https://api.groq.com/openai/v1/chat/completions';
  }

  async chat({ messages, tools, model, temperature = 0.2 }) {
    if (!this.apiKey) throw new Error('GROQ_API_KEY is not configured');

    const body = {
      model: model || this.model,
      messages,
      temperature,
      ...(tools && tools.length ? { tools, tool_choice: 'auto' } : {}),
    };

    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Groq API error ${res.status}: ${text.slice(0, 500)}`);
    }

    const data = await res.json();
    const msg  = data.choices?.[0]?.message || {};
    const toolCalls = (msg.tool_calls || []).map(tc => {
      let args = {};
      try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { args = {}; }
      return { id: tc.id, name: tc.function?.name, arguments: args };
    });

    return { content: msg.content || null, toolCalls, raw: msg, usage: data.usage || {} };
  }

  // Streaming variant. Calls onToken(text) for each content delta and returns the
  // final { content, toolCalls } once the stream ends. Tool-call deltas (which
  // carry no visible content) are accumulated by index and emitted at the end.
  async chatStream({ messages, tools, model, temperature = 0.2 }, onToken) {
    if (!this.apiKey) throw new Error('GROQ_API_KEY is not configured');
    const body = {
      model: model || this.model, messages, temperature, stream: true,
      ...(tools && tools.length ? { tools, tool_choice: 'auto' } : {}),
    };
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Groq API error ${res.status}: ${text.slice(0, 500)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '', content = '';
    const tcAcc = {}; // index → { id, name, argsStr }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (payload === '[DONE]') continue;
        let j; try { j = JSON.parse(payload); } catch { continue; }
        const delta = j.choices?.[0]?.delta || {};
        if (delta.content) { content += delta.content; if (onToken) onToken(delta.content); }
        for (const tc of (delta.tool_calls || [])) {
          const idx = tc.index ?? 0;
          if (!tcAcc[idx]) tcAcc[idx] = { id: tc.id, name: '', argsStr: '' };
          if (tc.id) tcAcc[idx].id = tc.id;
          if (tc.function?.name) tcAcc[idx].name = tc.function.name;
          if (tc.function?.arguments) tcAcc[idx].argsStr += tc.function.arguments;
        }
      }
    }

    const toolCalls = Object.values(tcAcc).map(a => {
      let args = {}; try { args = JSON.parse(a.argsStr || '{}'); } catch { args = {}; }
      return { id: a.id, name: a.name, arguments: args };
    });
    return { content: content || null, toolCalls };
  }
}

module.exports = { GroqProvider };
