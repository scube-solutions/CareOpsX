'use client';
import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

const STATUS_COLOR = {
  ordered:          { bg: '#fef3c7', text: '#92400e' },
  sample_collected: { bg: '#dbeafe', text: '#1e40af' },
  processing:       { bg: '#ede9fe', text: '#6d28d9' },
  ready:            { bg: '#dcfce7', text: '#166534' },
  delivered:        { bg: '#f1f5f9', text: '#334155' },
  cancelled:        { bg: '#fee2e2', text: '#b91c1c' },
};

export default function DoctorPatientSearchPage() {
  const [query, setQuery]           = useState('');
  const [patients, setPatients]     = useState([]);
  const [selected, setSelected]     = useState(null);
  const [history, setHistory]       = useState([]);
  const [labOrders, setLabOrders]   = useState([]);
  const [tab, setTab]               = useState('visits');   // 'visits' | 'lab'
  const [loading, setLoading]       = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [searched, setSearched]     = useState(false);
  const [expandedReport, setExpandedReport] = useState(null);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSelected(null);
    setHistory([]);
    setLabOrders([]);
    try {
      const data = await api(`/patients?search=${encodeURIComponent(query)}&limit=20`);
      setPatients(data.patients || []);
      setSearched(true);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [query]);

  const viewHistory = async (p) => {
    setSelected(p);
    setTab('visits');
    setHistLoading(true);
    try {
      const d = await api(`/consultations/patient-history/${p.id}`);
      setHistory(d.history || []);
      setLabOrders(d.lab_orders || []);
    } catch (e) { console.error(e); }
    finally { setHistLoading(false); }
  };

  const age = dob => dob ? Math.floor((Date.now() - new Date(dob)) / 31557600000) : null;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.h1}>Patient Search</h1>
          <p style={s.sub}>Search by name, phone, email or patient ID</p>
        </div>
      </div>

      <div style={s.searchBar}>
        <input
          style={s.searchInput}
          placeholder="Name, phone, email or PAT-ID..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          autoFocus
        />
        <button onClick={search} disabled={loading} style={s.btnSearch}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '380px 1fr' : '1fr', gap: 20 }}>
        {/* Results */}
        <div>
          {searched && patients.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              No patients found for <strong>"{query}"</strong>
            </div>
          )}

          {patients.length > 0 && (
            <div style={s.card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Patient ID', 'Name', 'Age / Gender', 'Phone', 'Action'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {patients.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', background: selected?.id === p.id ? '#f0f9ff' : 'transparent' }}>
                      <td style={s.td}><span style={s.uid}>{p.patient_uid || '–'}</span></td>
                      <td style={s.td}>
                        <div style={{ fontWeight: 600, color: '#0f1f3d' }}>{p.first_name} {p.last_name}</div>
                        {p.email && <div style={{ fontSize: 12, color: '#64748b' }}>{p.email}</div>}
                      </td>
                      <td style={s.td}>{age(p.date_of_birth) ? `${age(p.date_of_birth)} yrs` : '–'} {p.gender ? `/ ${p.gender}` : ''}</td>
                      <td style={s.td}>{p.phone}</td>
                      <td style={s.td}>
                        <button onClick={() => viewHistory(p)} style={s.btnView}>View History</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* History panel */}
        {selected && (
          <div style={s.card}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={s.h2}>{selected.first_name} {selected.last_name}</h2>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.2rem' }}>×</button>
            </div>

            {/* Patient meta */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, padding: '10px 12px', background: '#f8fafc', borderRadius: 8 }}>
              {[
                ['Patient ID', selected.patient_uid || '–'],
                ['Phone',      selected.phone || '–'],
                ['Blood',      selected.blood_group || '–'],
                ['Allergies',  selected.allergies || 'None'],
              ].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: '.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>{l}</div>
                  <div style={{ fontSize: '.875rem', fontWeight: 600, color: '#0f1f3d' }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              {[
                { key: 'visits', label: `Visits (${history.length})` },
                { key: 'lab',    label: `Lab Reports (${labOrders.length})` },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  style={{ flex: 1, padding: '9px', background: tab === t.key ? '#0f1f3d' : '#f8fafc', color: tab === t.key ? '#fff' : '#64748b', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '.8rem' }}>
                  {t.label}
                </button>
              ))}
            </div>

            {histLoading ? (
              <p style={{ color: '#64748b', fontSize: '.875rem', textAlign: 'center', padding: '1.5rem 0' }}>Loading...</p>
            ) : tab === 'visits' ? (
              /* ── Visit History ── */
              history.length === 0
                ? <p style={s.empty}>No previous consultations found.</p>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {history.map(h => (
                      <div key={h.id} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: '.875rem', color: '#0f1f3d' }}>{h.consultation_date}</span>
                          <span style={{ fontSize: '.72rem', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 10 }}>{h.consultation_status}</span>
                        </div>
                        {h.doctors && <div style={{ fontSize: '.78rem', color: '#00b4a0', marginBottom: 4 }}>Dr. {h.doctors.users?.first_name} {h.doctors.users?.last_name}</div>}
                        {h.chief_complaint && <div style={{ fontSize: '.8rem', color: '#475569' }}><strong>CC:</strong> {h.chief_complaint}</div>}
                        {h.symptoms        && <div style={{ fontSize: '.8rem', color: '#475569' }}><strong>Sx:</strong> {h.symptoms}</div>}
                        {h.diagnosis       && <div style={{ fontSize: '.8rem', color: '#475569' }}><strong>Dx:</strong> {h.diagnosis}</div>}
                        {h.advice          && <div style={{ fontSize: '.8rem', color: '#475569' }}><strong>Advice:</strong> {h.advice}</div>}
                        {h.follow_up_required && h.follow_up_date && (
                          <div style={{ fontSize: '.75rem', color: '#7c3aed', marginTop: 4 }}>Follow-up: {h.follow_up_date}</div>
                        )}
                        {/* Prescriptions in visit */}
                        {h.prescriptions?.length > 0 && (
                          <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {h.prescriptions.flatMap(p => p.prescription_items || []).slice(0, 4).map((item, i) => (
                              <span key={i} style={{ background: '#f0fdfb', color: '#0f766e', border: '1px solid #ccfbf1', borderRadius: 6, padding: '2px 8px', fontSize: '.72rem', fontWeight: 600 }}>
                                {item.medicine_name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
            ) : (
              /* ── Lab Reports ── */
              labOrders.length === 0
                ? <p style={s.empty}>No lab tests ordered for this patient.</p>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {labOrders.map(o => {
                      const c = STATUS_COLOR[o.status] || STATUS_COLOR.ordered;
                      const reports = o.lab_reports || [];
                      const isExpanded = expandedReport === o.id;
                      return (
                        <div key={o.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                          {/* Order row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', cursor: reports.length > 0 ? 'pointer' : 'default' }}
                            onClick={() => reports.length > 0 && setExpandedReport(isExpanded ? null : o.id)}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '.875rem', color: '#0f1f3d' }}>{o.test_name}</div>
                              <div style={{ fontSize: '.75rem', color: '#64748b' }}>{new Date(o.ordered_at).toLocaleDateString('en-IN')}{o.test_code && ` • ${o.test_code}`}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              {o.urgency === 'urgent' && (
                                <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '.7rem', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>URGENT</span>
                              )}
                              <span style={{ background: c.bg, color: c.text, fontSize: '.72rem', padding: '3px 10px', borderRadius: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                                {(o.status || '').replace(/_/g, ' ')}
                              </span>
                              {reports.length > 0 && (
                                <span style={{ fontSize: '.8rem', color: '#64748b' }}>{isExpanded ? '▲' : '▼'}</span>
                              )}
                            </div>
                          </div>

                          {/* Report(s) */}
                          {isExpanded && reports.map((r, i) => (
                            <div key={r.id} style={{ padding: '12px 14px', borderTop: '1px solid #e2e8f0', background: '#fff' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontSize: '.75rem', color: '#64748b' }}>
                                  Report {i + 1} — {new Date(r.uploaded_at || r.created_at).toLocaleDateString('en-IN')}
                                </span>
                                <span style={{ background: r.is_normal ? '#dcfce7' : '#fee2e2', color: r.is_normal ? '#166534' : '#b91c1c', padding: '2px 10px', borderRadius: 10, fontSize: '.72rem', fontWeight: 700 }}>
                                  {r.is_normal ? 'Normal' : 'Abnormal'}
                                </span>
                              </div>
                              {r.findings && (
                                <div style={{ marginBottom: 6 }}>
                                  <div style={{ fontSize: '.7rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: 2 }}>Findings</div>
                                  <div style={{ fontSize: '.84rem', color: '#334155', background: '#f8fafc', padding: '8px 10px', borderRadius: 6 }}>{r.findings}</div>
                                </div>
                              )}
                              {r.remarks && (
                                <div style={{ marginBottom: 6 }}>
                                  <div style={{ fontSize: '.7rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: 2 }}>Remarks</div>
                                  <div style={{ fontSize: '.84rem', color: '#334155', background: '#f8fafc', padding: '8px 10px', borderRadius: 6 }}>{r.remarks}</div>
                                </div>
                              )}
                              {r.report_url && (
                                <a href={r.report_url} target="_blank" rel="noopener noreferrer"
                                  style={{ display: 'inline-block', marginTop: 6, padding: '.4rem .9rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: '.78rem', fontWeight: 600, textDecoration: 'none' }}>
                                  Download Report ↓
                                </a>
                              )}
                            </div>
                          ))}
                          {reports.length === 0 && (
                            <div style={{ padding: '8px 14px', borderTop: '1px solid #f1f5f9', fontSize: '.8rem', color: '#94a3b8' }}>
                              Report pending
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  page:        { padding: '2rem', maxWidth: 1300, margin: '0 auto' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  h1:          { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2:          { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', margin: 0 },
  sub:         { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  searchBar:   { display: 'flex', gap: 10, marginBottom: 20 },
  searchInput: { flex: 1, padding: '.75rem 1rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: '.9rem', outline: 'none', background: '#fff' },
  btnSearch:   { padding: '.75rem 1.5rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.9rem' },
  btnView:     { padding: '.4rem .9rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem' },
  card:        { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  th:          { textAlign: 'left', padding: '10px 14px', fontSize: '.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0' },
  td:          { padding: '11px 14px', fontSize: '.875rem', color: '#334155' },
  uid:         { fontFamily: 'monospace', fontSize: 12, background: '#f0fdfb', color: '#0f766e', padding: '2px 7px', borderRadius: 4 },
  empty:       { color: '#94a3b8', fontSize: '.875rem', textAlign: 'center', padding: '1.5rem 0' },
};
