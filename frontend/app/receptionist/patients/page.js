'use client';
import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

export default function SearchPatientPage() {
  const [query, setQuery]       = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await api(`/patients?search=${encodeURIComponent(query)}&limit=20`);
      setPatients(data.patients || []);
      setSearched(true);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [query]);

  const onKey = e => { if (e.key === 'Enter') search(); };

  const age = dob => dob ? Math.floor((Date.now() - new Date(dob)) / 31557600000) : null;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.h1}>Search Patient</h1>
          <p style={s.sub}>Search by name, phone, email or patient ID</p>
        </div>
        <a href="/receptionist/patients/new" style={s.btnPri}>+ Register New Patient</a>
      </div>

      <div style={s.searchBar}>
        <input
          style={s.searchInput}
          placeholder="Name, phone, email or PAT-ID..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKey}
          autoFocus
        />
        <button onClick={search} disabled={loading} style={s.btnSearch}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {searched && patients.length === 0 && (
        <div style={s.empty}>
          <p>No patients found for <strong>"{query}"</strong></p>
          <a href="/receptionist/patients/new" style={s.btnPri}>Register New Patient</a>
        </div>
      )}

      {patients.length > 0 && (
        <div style={s.card}>
          <table style={s.table}>
            <thead>
              <tr style={s.thr}>
                {['Patient ID', 'Name', 'Age / Gender', 'Phone', 'Blood', 'Actions'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patients.map(p => (
                <tr key={p.id} style={s.tr}>
                  <td style={s.td}><span style={s.uid}>{p.patient_uid || '–'}</span></td>
                  <td style={s.td}>
                    <div style={{ fontWeight: 600, color: '#0f1f3d' }}>{p.first_name} {p.last_name}</div>
                    {p.email && <div style={{ fontSize: 12, color: '#64748b' }}>{p.email}</div>}
                  </td>
                  <td style={s.td}>{age(p.date_of_birth) ? `${age(p.date_of_birth)} yrs` : '–'} {p.gender ? `/ ${p.gender}` : ''}</td>
                  <td style={s.td} style={{ fontFamily: 'monospace', fontSize: 13 }}>{p.phone}</td>
                  <td style={s.td}>{p.blood_group || '–'}</td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <a href={`/receptionist/appointments?patient_id=${p.id}&patient_name=${encodeURIComponent(p.first_name + ' ' + p.last_name)}`} style={s.btnBook}>
                        Book Appt
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const s = {
  page:        { padding: '2rem', maxWidth: 1100, margin: '0 auto' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  h1:          { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  sub:         { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  searchBar:   { display: 'flex', gap: 10, marginBottom: 20 },
  searchInput: { flex: 1, padding: '.75rem 1rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: '.9rem', outline: 'none', background: '#fff' },
  btnSearch:   { padding: '.75rem 1.5rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.9rem' },
  btnPri:      { padding: '.65rem 1.25rem', background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '.875rem', textDecoration: 'none' },
  btnBook:     { padding: '.4rem .9rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '.8rem', textDecoration: 'none' },
  card:        { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' },
  table:       { width: '100%', borderCollapse: 'collapse' },
  thr:         { background: '#f8fafc' },
  th:          { textAlign: 'left', padding: '10px 14px', fontSize: '.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0' },
  tr:          { borderBottom: '1px solid #f1f5f9' },
  td:          { padding: '11px 14px', fontSize: '.875rem', color: '#334155' },
  uid:         { fontFamily: 'monospace', fontSize: 12, background: '#f0fdfb', color: '#0f766e', padding: '2px 7px', borderRadius: 4 },
  empty:       { textAlign: 'center', padding: '3rem 1rem', color: '#64748b' },
};
