'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { T } from '../layout';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const STAT_ACCENT = ['#00b4a0', '#6366f1', '#a855f7', '#f59e0b'];

export default function AdminDashboardPage() {
  const [todayAppts, setTodayAppts]       = useState([]);
  const [weekAppts, setWeekAppts]         = useState([]);
  const [patients, setPatients]           = useState([]);
  const [doctors, setDoctors]             = useState([]);
  const [revenueToday, setRevenueToday]   = useState(0);
  const [yesterdayCount, setYesterdayCount] = useState(0);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const today     = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 864e5).toISOString().split('T')[0];

        // compute week start (Monday)
        const now       = new Date();
        const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - dayOfWeek);
        const weekStartStr = weekStart.toISOString().split('T')[0];

        const results = await Promise.allSettled([
          api(`/appointments?date=${today}`),
          api(`/appointments?date=${yesterday}`),
          api(`/appointments?from=${weekStartStr}&to=${today}`),
          api('/patients'),
          api('/doctors'),
          api(`/billing/invoices?date=${today}`),
        ]);

        const todayRes    = results[0].status === 'fulfilled' ? results[0].value : null;
        const yestRes     = results[1].status === 'fulfilled' ? results[1].value : null;
        const weekRes     = results[2].status === 'fulfilled' ? results[2].value : null;
        const patientsRes = results[3].status === 'fulfilled' ? results[3].value : null;
        const doctorsRes  = results[4].status === 'fulfilled' ? results[4].value : null;
        const billingRes  = results[5].status === 'fulfilled' ? results[5].value : null;

        setTodayAppts(todayRes?.data || todayRes?.appointments || []);
        setYesterdayCount((yestRes?.data || yestRes?.appointments || []).length);
        setWeekAppts(weekRes?.data || weekRes?.appointments || []);
        setPatients(patientsRes?.patients || []);
        setDoctors((doctorsRes?.doctors || []).filter(d => d.is_active !== false));
        const invoices = billingRes?.invoices || [];
        const rev = invoices.reduce((s, inv) => s + Number(inv.total_amount || 0), 0);
        setRevenueToday(rev);
      } catch (err) {
        console.error(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const todayDelta = todayAppts.length - yesterdayCount;

  const stats = [
    {
      label: "TODAY'S APPTS",
      value: todayAppts.length,
      sub: `${todayDelta >= 0 ? '↑' : '↓'} ${Math.abs(todayDelta)} vs yesterday`,
      subColor: todayDelta >= 0 ? '#22c55e' : '#ef4444',
      accent: STAT_ACCENT[0],
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={STAT_ACCENT[0]} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
    },
    {
      label: 'TOTAL PATIENTS',
      value: patients.length,
      sub: '↑ All time',
      subColor: '#22c55e',
      accent: STAT_ACCENT[1],
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={STAT_ACCENT[1]} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      label: 'ACTIVE DOCTORS',
      value: doctors.length,
      sub: 'On roster',
      subColor: '#a855f7',
      accent: STAT_ACCENT[2],
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={STAT_ACCENT[2]} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
          <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
          <circle cx="20" cy="10" r="2"/>
        </svg>
      ),
    },
    {
      label: 'REVENUE TODAY',
      value: `₹${revenueToday.toLocaleString('en-IN')}`,
      sub: 'Billed today',
      subColor: '#f59e0b',
      accent: STAT_ACCENT[3],
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={STAT_ACCENT[3]} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
    },
  ];

  const statusColor = (s) => {
    if (s === 'confirmed') return { bg: '#dcfce7', color: '#16a34a' };
    if (s === 'completed') return { bg: '#dbeafe', color: '#1d4ed8' };
    if (s === 'cancelled') return { bg: '#fee2e2', color: '#dc2626' };
    return { bg: '#fef9c3', color: '#b45309' };
  };

  return (
    <div style={{ padding: 28, fontFamily: T.body, background: T.bg, minHeight: '100vh' }}>
      {/* Header greeting */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontFamily: T.display, fontSize: 26, color: T.navy, fontWeight: 700 }}>
          {greeting()}, Admin 👋
        </h1>
        <p style={{ margin: '4px 0 0', color: T.muted, fontSize: 14 }}>Hospital overview for today</p>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 16, marginBottom: 24 }}>
        {stats.map((s) => (
          <div key={s.label} style={{
            background: T.card, borderRadius: 14, padding: '18px 20px',
            boxShadow: '0 1px 4px rgba(0,0,0,.06)',
            borderTop: `3px solid ${s.accent}`,
            display: 'flex', gap: 14, alignItems: 'flex-start',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
              background: `${s.accent}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: T.muted, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontFamily: T.display, fontSize: 28, fontWeight: 700, color: T.navy, lineHeight: 1.15, marginTop: 4 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: s.subColor, marginTop: 4 }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Middle row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Appointments This Week */}
        <div style={{ background: T.card, borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontFamily: T.display, fontWeight: 700, color: T.navy, fontSize: 15 }}>Appointments This Week</span>
          </div>
          <div style={{ padding: '12px 0' }}>
            {loading ? (
              <div style={{ padding: '24px 20px', color: T.muted, fontSize: 13 }}>Loading…</div>
            ) : weekAppts.length === 0 ? (
              <div style={{ padding: '32px 20px', color: T.muted, fontSize: 13, textAlign: 'center' }}>No appointments this week.</div>
            ) : (
              weekAppts.slice(0, 6).map((a) => {
                const docName = `${a.doctors?.users?.first_name || ''} ${a.doctors?.users?.last_name || ''}`.trim() || 'Doctor';
                const sc = statusColor(a.status);
                return (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 20px', borderBottom: `1px solid ${T.border}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {a.patients?.name || '—'}
                      </div>
                      <div style={{ fontSize: 12, color: T.muted }}>Dr. {docName}</div>
                    </div>
                    <div style={{ fontSize: 12, color: T.muted, flexShrink: 0 }}>
                      {a.appointment_date || ''} {a.appointment_time?.slice(0, 5) || ''}
                    </div>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 600, flexShrink: 0 }}>
                      {a.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ background: T.card, borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontFamily: T.display, fontWeight: 700, color: T.navy, fontSize: 15 }}>Quick Actions</span>
          </div>
          <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              {
                label: '+ Add Doctor', href: '/admin/doctors', primary: true,
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>,
              },
              {
                label: '📅 View Appts', href: '/admin/appointments', primary: false,
                icon: null,
              },
              {
                label: '👥 Patients', href: '/admin/patients', primary: false,
                icon: null,
              },
              {
                label: '🧾 Billing', href: '/admin/billing', primary: false,
                icon: null,
              },
            ].map((btn) => (
              <a key={btn.href} href={btn.href} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '14px 10px', borderRadius: 10, textDecoration: 'none',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                background: btn.primary ? T.teal : 'transparent',
                color: btn.primary ? '#fff' : T.navy,
                border: btn.primary ? 'none' : `1.5px solid ${T.border}`,
                transition: 'opacity .15s',
              }}>
                {btn.icon && btn.label.startsWith('+') ? btn.icon : null}
                {btn.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Today's Appointments table */}
      <div style={{ background: T.card, borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: T.display, fontWeight: 700, color: T.navy, fontSize: 15 }}>Today's Appointments</span>
          <a href="/admin/appointments" style={{ fontSize: 13, color: T.muted, textDecoration: 'none', fontWeight: 500 }}>View All</a>
        </div>
        {loading ? (
          <div style={{ padding: '24px 20px', color: T.muted, fontSize: 13 }}>Loading…</div>
        ) : todayAppts.length === 0 ? (
          <div style={{ padding: '32px 20px', color: T.muted, fontSize: 13, textAlign: 'center' }}>No appointments today.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['PATIENT', 'DOCTOR', 'SPECIALTY', 'TIME', 'STATUS'].map((h) => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '10px 18px',
                      fontSize: 11, fontWeight: 700, color: T.muted,
                      letterSpacing: '.06em', borderBottom: `1px solid ${T.border}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todayAppts.map((a) => {
                  const docName = `${a.doctors?.users?.first_name || ''} ${a.doctors?.users?.last_name || ''}`.trim() || 'Doctor';
                  const sc = statusColor(a.status);
                  return (
                    <tr key={a.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '12px 18px', fontSize: 13, color: T.text, fontWeight: 500 }}>{a.patients?.name || '—'}</td>
                      <td style={{ padding: '12px 18px', fontSize: 13, color: T.text }}>Dr. {docName}</td>
                      <td style={{ padding: '12px 18px', fontSize: 13, color: T.muted }}>{a.doctors?.specialization || '—'}</td>
                      <td style={{ padding: '12px 18px', fontSize: 13, color: T.text }}>{a.appointment_time?.slice(0, 5) || '—'}</td>
                      <td style={{ padding: '12px 18px' }}>
                        <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 600 }}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
