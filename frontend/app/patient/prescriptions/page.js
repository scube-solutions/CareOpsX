'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function PatientPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [selected, setSelected]           = useState(null);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    api('/consultations/my-prescriptions')
      .then(d => setPrescriptions(d.prescriptions || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={s.center}>Loading...</div>;

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={s.h1}>My Prescriptions</h1>
        <p style={s.sub}>{prescriptions.length} prescription{prescriptions.length !== 1 ? 's' : ''}</p>
      </div>

      {prescriptions.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💊</div>
          <p style={{ color: '#64748b' }}>No prescriptions yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
          {/* List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {prescriptions.map(p => {
              const docName = p.doctors?.users
                ? `Dr. ${p.doctors.users.first_name} ${p.doctors.users.last_name}`.trim()
                : '–';
              return (
                <div key={p.id} onClick={() => setSelected(selected?.id === p.id ? null : p)}
                  style={{ ...s.card, cursor: 'pointer', borderLeft: selected?.id === p.id ? '4px solid #00b4a0' : '4px solid transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f1f3d', fontSize: '.95rem' }}>{docName}</div>
                      {p.doctors?.specialization && <div style={{ fontSize: '.8rem', color: '#64748b' }}>{p.doctors.specialization}</div>}
                    </div>
                    <div style={{ fontSize: '.8rem', color: '#64748b' }}>{new Date(p.created_at).toLocaleDateString('en-IN')}</div>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(p.prescription_items || []).slice(0, 4).map((item, i) => (
                      <span key={i} style={{ background: '#f0fdfb', color: '#0f766e', border: '1px solid #ccfbf1', borderRadius: 6, padding: '2px 10px', fontSize: '.78rem', fontWeight: 600 }}>
                        {item.medicine_name}
                      </span>
                    ))}
                    {(p.prescription_items || []).length > 4 && (
                      <span style={{ background: '#f1f5f9', color: '#64748b', borderRadius: 6, padding: '2px 10px', fontSize: '.78rem' }}>
                        +{p.prescription_items.length - 4} more
                      </span>
                    )}
                  </div>
                  {p.notes && <div style={{ marginTop: 8, fontSize: '.8rem', color: '#475569' }}>Note: {p.notes}</div>}
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={s.h2}>Prescription Details</h2>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
              </div>
              <div style={{ marginBottom: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 8 }}>
                <div style={{ fontWeight: 600, color: '#0f1f3d' }}>
                  {selected.doctors?.users ? `Dr. ${selected.doctors.users.first_name} ${selected.doctors.users.last_name}` : '–'}
                </div>
                {selected.doctors?.specialization && <div style={{ fontSize: '.8rem', color: '#64748b' }}>{selected.doctors.specialization}</div>}
                <div style={{ fontSize: '.8rem', color: '#64748b', marginTop: 4 }}>{new Date(selected.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(selected.prescription_items || []).map((item, i) => (
                  <div key={i} style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, color: '#0f1f3d', marginBottom: 6 }}>{item.medicine_name}</div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {[['Dosage', item.dosage], ['Frequency', item.frequency], ['Duration', item.duration], ['Route', item.route]].filter(([, v]) => v).map(([l, v]) => (
                        <div key={l}>
                          <span style={{ fontSize: '.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>{l}: </span>
                          <span style={{ fontSize: '.8rem', fontWeight: 600, color: '#334155' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    {item.instructions && (
                      <div style={{ marginTop: 6, fontSize: '.8rem', color: '#475569', fontStyle: 'italic' }}>{item.instructions}</div>
                    )}
                  </div>
                ))}
              </div>

              {selected.notes && (
                <div style={{ marginTop: 14, padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: '.875rem', color: '#92400e' }}>
                  <strong>Doctor's Note:</strong> {selected.notes}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  page:   { padding: '2rem', maxWidth: 1100, margin: '0 auto' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#64748b' },
  h1:     { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  h2:     { fontSize: '1rem', fontWeight: 600, color: '#0f1f3d', margin: 0 },
  sub:    { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  card:   { background: '#fff', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
};
