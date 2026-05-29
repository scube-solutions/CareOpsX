'use client';
import { useEffect } from 'react';
import { getUser } from '@/lib/auth';
import AppShell from '@/lib/AppShell';

const I = {
  Dashboard:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  NewPatient:   () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  Search:       () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Appointments: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Queue:        () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  Billing:      () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
};

const GROUPS = [{ label: 'Reception', items: [
  { href: '/receptionist/dashboard',    label: 'Dashboard',    Icon: I.Dashboard    },
  { href: '/receptionist/patients/new', label: 'New Patient',  Icon: I.NewPatient   },
  { href: '/receptionist/patients',     label: 'Search Patient',Icon: I.Search      },
  { href: '/receptionist/appointments', label: 'Appointments', Icon: I.Appointments },
  { href: '/receptionist/queue',        label: 'Queue',        Icon: I.Queue        },
  { href: '/receptionist/billing',      label: 'Billing',      Icon: I.Billing      },
] }];

export default function ReceptionistLayout({ children }) {
  const user = getUser();

  useEffect(() => {
    const roles = Array.isArray(user?.roles) && user.roles.length ? user.roles : [user?.role_id];
    if (!user || ![1, 5].some(r => roles.includes(r))) window.location.href = '/login';
  }, []);

  return (
    <AppShell title="Reception Workspace" roleLabel="Receptionist" currentRole={5} groups={GROUPS} user={user} >
      {children}
    </AppShell>
  );
}
