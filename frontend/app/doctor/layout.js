'use client';
import { useEffect } from 'react';
import { getUser } from '@/lib/auth';
import AppShell from '@/lib/AppShell';

const GROUPS = [{ label: 'Doctor', items: [
  { href: '/doctor/dashboard', label: 'My Queue' },
  { href: '/doctor/consultations', label: 'Consultations' },
  { href: '/doctor/patients', label: 'Patient Search' },
] }];

export default function DoctorLayout({ children }) {
  const user = getUser();

  useEffect(() => {
    const roles = Array.isArray(user?.roles) && user.roles.length ? user.roles : [user?.role_id];
    if (!user || ![1, 2].some(r => roles.includes(r))) window.location.href = '/login';
  }, []);

  return (
    <AppShell title="Doctor Workspace" roleLabel="Doctor" currentRole={2} groups={GROUPS} user={user}>
      {children}
    </AppShell>
  );
}
