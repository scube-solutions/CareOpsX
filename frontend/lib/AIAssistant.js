'use client';
import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';

// Floating AI Organizational Assistant — available across the authenticated app.
export default function AIAssistant() {
  const [open, setOpen]       = useState(false);
  const [msgs, setMsgs]       = useState([]); // { role, content }
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [convId, setConvId]   = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [histQ, setHistQ]     = useState('');
  const scrollRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [msgs, loading]);

  const loadHistory = async (q = '') => {
    try { const d = await api(`/ai/conversations${q ? `?q=${encodeURIComponent(q)}` : ''}`); setHistory(d.conversations || []); setShowHistory(true); }
    catch { setHistory([]); setShowHistory(true); }
  };

  const openConversation = async (id) => {
    try {
      const d = await api(`/ai/conversations/${id}/messages`);
      setMsgs((d.messages || []).map(m => ({ role: m.role, content: m.content })));
      setConvId(id); setShowHistory(false);
    } catch { /* ignore */ }
  };

  const exportChat = () => {
    if (!msgs.length) return;
    const text = msgs.map(m => `${m.role === 'user' ? 'You' : 'Assistant'}: ${m.content}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ai-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMsgs(m => [...m, { role: 'user', content: text }]);
    setLoading(true);
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const token = localStorage.getItem('token');
    let started = false;
    try {
      const res = await fetch(`${BASE_URL}/ai/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, conversation_id: convId }),
      });
      if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      const appendToken = (tok) => setMsgs(m => {
        const c = [...m]; const l = c[c.length - 1];
        if (l?.streaming) c[c.length - 1] = { ...l, content: (l.content || '') + tok };
        return c;
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split('\n\n');
        buf = events.pop();
        for (const ev of events) {
          const line = ev.split('\n').find(l => l.startsWith('data:'));
          if (!line) continue;
          let d; try { d = JSON.parse(line.slice(5).trim()); } catch { continue; }
          if (d.conversation_id) setConvId(d.conversation_id);
          if (d.token) {
            if (!started) { started = true; setLoading(false); setMsgs(m => [...m, { role: 'assistant', content: d.token, streaming: true }]); }
            else appendToken(d.token);
          }
          if (d.done) {
            setMsgs(m => { const c = [...m]; const l = c[c.length - 1]; if (l?.streaming) c[c.length - 1] = { ...l, streaming: false, report: d.report, content: l.content || d.answer }; return c; });
          }
          if (d.error) throw new Error(d.error);
        }
      }
      if (!started) setMsgs(m => [...m, { role: 'assistant', content: 'No response.', error: true }]);
    } catch (e) {
      setMsgs(m => [...m, { role: 'assistant', content: `⚠️ ${e.message}`, error: true }]);
    } finally {
      setLoading(false);
    }
  };

  const copy = (t) => { navigator.clipboard?.writeText(t); };
  const reset = () => { setMsgs([]); setConvId(null); };

  // Download a generated report in the chosen format.
  const downloadReport = async (rep, format) => {
    try {
      const d = await api('/ai/report', { method: 'POST', body: JSON.stringify({ report: rep.report, format, ...rep.params }) });
      const bin = atob(d.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: d.mime });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = d.filename; a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setMsgs(m => [...m, { role: 'assistant', content: `⚠️ ${e.message}`, error: true }]);
    }
  };

  const SUGGESTIONS = [
    'How many patients visited today?',
    'Total revenue this month',
    'Who is on leave today?',
    'Show low stock medicines',
  ];

  return (
    <>
      {/* Launcher */}
      <button onClick={() => setOpen(o => !o)} aria-label="AI Assistant"
        style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, width: 56, height: 56, borderRadius: '50%',
          border: 'none', cursor: 'pointer', color: '#fff', fontSize: 24, boxShadow: '0 8px 24px rgba(0,180,160,.4)',
          background: 'linear-gradient(135deg, #1e3f85 0%, #00b4a0 100%)' }}>
        {open ? '×' : '🤖'}
      </button>

      {open && (
        <div style={st.panel}>
          <div style={st.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🤖</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>AI Assistant</div>
                <div style={{ fontSize: 11, opacity: .8 }}>Ask about patients, revenue, staff, stock…</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => (showHistory ? setShowHistory(false) : loadHistory())} title="History" style={st.headBtn}>🕘</button>
              <button onClick={exportChat} title="Export chat" style={st.headBtn}>⤓</button>
              <button onClick={reset} title="New chat" style={st.headBtn}>＋</button>
            </div>
          </div>

          {showHistory ? (
            <div style={st.body}>
              <input value={histQ} onChange={e => { setHistQ(e.target.value); loadHistory(e.target.value); }}
                placeholder="Search conversations…" style={{ ...st.input, marginBottom: 10 }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', margin: '4px 4px 10px' }}>{histQ ? 'Search results' : 'Recent conversations'}</div>
              {history.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8', padding: 8 }}>{histQ ? 'No matches.' : 'No past conversations.'}</div>}
              {history.map(c => (
                <button key={c.id} onClick={() => openConversation(c.id)} style={st.suggestion}>
                  {c.title || 'Untitled'}
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{new Date(c.updated_at).toLocaleString()}</div>
                </button>
              ))}
            </div>
          ) : (
          <div ref={scrollRef} style={st.body}>
            {msgs.length === 0 && (
              <div style={{ padding: 8 }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Try asking:</div>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => setInput(s)} style={st.suggestion}>{s}</button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                <div style={{ ...st.bubble, ...(m.role === 'user' ? st.userBub : (m.error ? st.errBub : st.aiBub)) }}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                  {m.report && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      {(m.report.formats || ['csv', 'xlsx', 'pdf']).map(f => (
                        <button key={f} onClick={() => downloadReport(m.report, f)} style={st.dlBtn}>{f.toUpperCase()}</button>
                      ))}
                    </div>
                  )}
                  {m.role === 'assistant' && !m.error && (
                    <button onClick={() => copy(m.content)} style={st.copyBtn}>Copy</button>
                  )}
                </div>
              </div>
            ))}
            {loading && <div style={{ ...st.bubble, ...st.aiBub, color: '#64748b' }}>Thinking…</div>}
          </div>
          )}

          <div style={st.inputRow}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask a question…" style={st.input} />
            <button onClick={send} disabled={loading} style={st.sendBtn}>➤</button>
          </div>
        </div>
      )}
    </>
  );
}

const st = {
  panel:   { position: 'fixed', bottom: 92, right: 24, zIndex: 1000, width: 'min(380px, calc(100vw - 32px))', height: 'min(560px, calc(100vh - 130px))', background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(15,31,61,.25)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Instrument Sans', sans-serif" },
  header:  { background: 'linear-gradient(135deg, #1e3f85 0%, #00b4a0 100%)', color: '#fff', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headBtn: { background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', fontSize: 16 },
  body:    { flex: 1, overflowY: 'auto', padding: 12, background: '#f8fafc' },
  bubble:  { maxWidth: '85%', padding: '9px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.5, position: 'relative' },
  userBub:   { background: '#00b4a0', color: '#fff', borderBottomRightRadius: 4 },
  aiBub:     { background: '#fff', color: '#0f1f3d', border: '1px solid #e2e8f0', borderBottomLeftRadius: 4 },
  errBub:    { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
  copyBtn: { marginTop: 6, fontSize: 10, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' },
  dlBtn:   { fontSize: 11, fontWeight: 700, color: '#fff', background: '#1e3f85', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' },
  suggestion: { display: 'block', width: '100%', textAlign: 'left', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', marginBottom: 6, fontSize: 12, color: '#1e3f85', cursor: 'pointer' },
  inputRow: { display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #e2e8f0', background: '#fff' },
  input:   { flex: 1, padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none' },
  sendBtn: { width: 40, background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14 },
};
