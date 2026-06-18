'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// AI-generated executive overview card. Pulls /ai/summary (role-scoped, live).
export default function AISummaryCard() {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [hidden, setHidden] = useState(false);
  const load = async () => {
    setLoading(true); setError('');
    try { const d = await api('/ai/summary'); setSummary(d.summary || ''); }
    catch (e) { if (e.status === 403) { setHidden(true); } else setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (hidden) return null; // AI not in this org's plan

  return (
    <div style={{ background: 'linear-gradient(135deg, #0f1f3d 0%, #1e3f85 100%)', borderRadius: 14, padding: '18px 22px', marginBottom: 24, color: '#fff', boxShadow: '0 4px 16px rgba(15,31,61,.18)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
          <span style={{ fontSize: 18 }}>🤖</span> AI Daily Overview
        </div>
        <button onClick={load} disabled={loading} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>
      {error ? (
        <div style={{ fontSize: 13, color: '#fecaca' }}>{error}</div>
      ) : loading ? (
        <div style={{ fontSize: 13, opacity: .8 }}>Generating today's overview…</div>
      ) : (
        <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', opacity: .95 }}>{summary}</div>
      )}
    </div>
  );
}
