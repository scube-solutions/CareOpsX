'use client';
import { useEffect } from 'react';
import { getUser } from '@/lib/auth';
import AppShell from '@/lib/AppShell';

const GROUPS = [{ label: 'Lab', items: [
  { href: '/lab/dashboard', label: 'Dashboard' },
  { href: '/lab/orders', label: 'Lab Orders' },
  { href: '/lab/reports', label: 'Reports' },
] }];

export default function LabLayout({ children }) {
  const user = getUser();

  useEffect(() => {
    const roles = Array.isArray(user?.roles) && user.roles.length ? user.roles : [user?.role_id];
    if (!user || ![1, 6].some(r => roles.includes(r))) window.location.href = '/login';
  }, []);

  return (
    <AppShell title="Lab Workspace" roleLabel="Lab Staff" currentRole={6} groups={GROUPS} user={user}>
      {children}
    </AppShell>
  );
}
