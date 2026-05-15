'use client';
import { useEffect } from 'react';
import { getUser } from '@/lib/auth';
import AppShell from '@/lib/AppShell';

const GROUPS = [{ label: 'Pharmacy', items: [
  { href: '/pharmacy/dashboard', label: 'Dashboard' },
  { href: '/pharmacy/billing', label: 'New Invoice' },
  { href: '/pharmacy/inventory', label: 'Inventory' },
  { href: '/pharmacy/alerts', label: 'Stock Alerts' },
] }];

export default function PharmacyLayout({ children }) {
  const user = getUser();

  useEffect(() => {
    const roles = Array.isArray(user?.roles) && user.roles.length ? user.roles : [user?.role_id];
    if (!user || ![1, 7].some(r => roles.includes(r))) window.location.href = '/login';
  }, []);

  return (
    <AppShell title="Pharmacy Workspace" roleLabel="Pharmacist" currentRole={7} groups={GROUPS} user={user}>
      {children}
    </AppShell>
  );
}
