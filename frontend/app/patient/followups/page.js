'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const STATUS_STYLE = {
  scheduled: { bg: '#f0fdfb', text: '#0f766e', border: '#99f6e4', label: 'Scheduled' },
  completed: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0', label: 'Completed' },
  missed:    { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', label: 'Missed'    },
  cancelled: { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0', label: 'Cancelled' },
};

const daysUntil = (dateStr) => {
  const diff = new Date(dateStr) - new Date(new Date().toDateString());
  return Math.round(diff / (1000 * 60 * 60 * 24));
};

export default function PatientFollowUpsPage() {
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all'); // all | upcoming | past

  useEffect(() => {
    api('/followups/my-followups')
      .then(d => setFollowUps(d.follow_ups || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().split('T')[0];

  const filtered = followUps.filter(f => {
    if (filter === 'upcoming') return f.follow_up_date >= today && f.status === 'scheduled';
    if (filter === 'past')     return f.follow_up_date < today || f.status !== 'scheduled';
    return true;
  });

  const upcoming  = followUps.filter(f => f.follow_up_date >= today && f.status === 'scheduled');
  const missed    = followUps.filter(f => f.status === 'missed');
  const completed = followUps.filter(f => f.status === 'completed');

  if (loading) return <div style={s.center}>Loading...</div>;

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={s.h1}>My Follow-ups</h1>
        <p style={s.sub}>Follow-up visits scheduled by your doctor</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Upcoming',  value: upcoming.length,  color: '#0f766e', bg: '#f0fdfb', icon: '📅' },
          { label: 'Completed', value: completed.length, color: '#166534', bg: '#f0fdf4', icon: '✅' },
          { label: 'Missed',    value: missed.length,    color: '#b91c1c', bg: '#fef2f2', icon: '⚠️' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.color}20`, borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 28 }}>{c.icon}</span>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
              <div style={{ fontSize: '.8rem', color: '#64748b', marginTop: 4, fontWeight: 600 }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Next upcoming banner */}
      {upcoming.length > 0 && (() => {
        const next = upcoming[0];
        const days = daysUntil(next.follow_up_date);
        const docName = next.doctors?.users
          ? `Dr. ${next.doctors.users.first_name} ${next.doctors.users.last_name}`.trim()
          : null;
        return (
          <div style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', borderRadius: 14, padding: '20px 24px', marginBottom: 24, color: '#fff' }}>
            <div style={{ fontSize: 11, opacity: .75, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Next Follow-up</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              {new Date(next.follow_up_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div style={{ fontSize: 13, opacity: .85, marginBottom: days <= 3 ? 12 : 0 }}>
              {docName && `${docName}${next.doctors?.specialization ? ` — ${next.doctors.specialization}` : ''} • `}
              {days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : `In ${days} days`}
            </div>
            {days <= 3 && (
              <div style={{ background: 'rgba(255,255,255,.15)', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>
                🔔 Reminder: your follow-up is very soon. Please make sure to attend.
              </div>
            )}
            {next.notes && (
              <div style={{ marginTop: 10, fontSize: 13, opacity: .85, fontStyle: 'italic' }}>
                Note: {next.notes}
              </div>
            )}
          </div>
        );
      })()}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', width: 'fit-content' }}>
        {[
          { key: 'all',      label: `All (${followUps.length})` },
          { key: 'upcoming', label: `Upcoming (${upcoming.length})` },
          { key: 'past',     label: `Past` },
        ].map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            style={{ padding: '8px 18px', background: filter === t.key ? '#0f1f3d' : '#f8fafc', color: filter === t.key ? '#fff' : '#64748b', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '.82rem' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Follow-up list */}
      {filtered.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <p style={{ color: '#64748b' }}>No follow-ups in this category.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(f => {
            const st = STATUS_STYLE[f.status] || STATUS_STYLE.scheduled;
            const days = daysUntil(f.follow_up_date);
            const isPast = f.follow_up_date < today;
            const docName = f.doctors?.users
              ? `Dr. ${f.doctors.users.first_name} ${f.doctors.users.last_name}`.trim()
              : null;

            return (
              <div key={f.id} style={{ ...s.card, borderLeft: `4px solid ${st.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    {/* Date */}
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f1f3d', marginBottom: 4 }}>
                      {new Date(f.follow_up_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>

                    {/* Countdown / past label */}
                    <div style={{ fontSize: '.82rem', color: isPast ? '#94a3b8' : days <= 3 ? '#dc2626' : '#64748b', fontWeight: days <= 3 && !isPast ? 700 : 400, marginBottom: 6 }}>
                      {isPast && f.status === 'scheduled'
                        ? 'Overdue'
                        : days === 0 ? '⚡ Today!'
                        : days === 1 ? '⚡ Tomorrow'
                        : !isPast ? `In ${days} days`
                        : new Date(f.follow_up_date).toLocaleDateString('en-IN')}
                    </div>

                    {/* Doctor */}
                    {docName && (
                      <div style={{ fontSize: '.875rem', color: '#475569', marginBottom: 2 }}>
                        {docName}
                        {f.doctors?.specialization && <span style={{ color: '#94a3b8', marginLeft: 6 }}>— {f.doctors.specialization}</span>}
                      </div>
                    )}

                    {/* Notes */}
                    {f.notes && (
                      <div style={{ marginTop: 8, fontSize: '.84rem', color: '#475569', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px' }}>
                        📝 {f.notes}
                      </div>
                    )}

                    {/* Required tests */}
                    {f.required_tests && (
                      <div style={{ marginTop: 8, fontSize: '.82rem', color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 12px' }}>
                        🧪 Tests required: {f.required_tests}
                      </div>
                    )}
                  </div>

                  {/* Status badge */}
                  <span style={{ background: st.bg, color: st.text, border: `1px solid ${st.border}`, padding: '4px 14px', borderRadius: 20, fontSize: '.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {st.label}
                  </span>
                </div>

                {/* Reminder strip for very soon */}
                {f.status === 'scheduled' && !isPast && days <= 3 && (
                  <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, fontSize: '.82rem', color: '#92400e', fontWeight: 600 }}>
                    🔔 Reminder: {days === 0 ? 'This is today!' : days === 1 ? 'This is tomorrow!' : `Only ${days} days away!`} Please prepare and attend your follow-up.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const s = {
  page:   { padding: '2rem', maxWidth: 900, margin: '0 auto' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#64748b' },
  h1:     { fontSize: '1.5rem', fontWeight: 700, color: '#0f1f3d', margin: 0 },
  sub:    { fontSize: '.875rem', color: '#64748b', margin: '4px 0 0' },
  card:   { background: '#fff', borderRadius: 12, padding: '1.25rem 1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
};
