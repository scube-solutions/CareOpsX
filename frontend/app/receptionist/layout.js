'use client';
import { useEffect } from 'react';
import { getUser } from '@/lib/auth';
import AppShell from '@/lib/AppShell';

const GROUPS = [{ label: 'Reception', items: [
  { href: '/receptionist/dashboard', label: 'Dashboard' },
  { href: '/receptionist/patients/new', label: 'New Patient' },
  { href: '/receptionist/patients', label: 'Search Patient' },
  { href: '/receptionist/appointments', label: 'Appointments' },
  { href: '/receptionist/queue', label: 'Queue' },
  { href: '/receptionist/billing', label: 'Billing' },
] }];

export default function ReceptionistLayout({ children }) {
  const user = getUser();

  useEffect(() => {
    const roles = Array.isArray(user?.roles) && user.roles.length ? user.roles : [user?.role_id];
    if (!user || ![1, 5].some(r => roles.includes(r))) window.location.href = '/login';
  }, []);

  return (
    <AppShell title="Reception Workspace" roleLabel="Receptionist" currentRole={5} groups={GROUPS} user={user}>
      {children}
    </AppShell>
  );
}
