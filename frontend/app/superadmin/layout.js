'use client';

import { useState, useEffect } from 'react';
import { getUser } from '@/lib/auth';
import AppShell from '@/lib/AppShell';

const GROUPS = [{ label: 'Super Admin', items: [{ href: '/superadmin/organizations', label: 'Organizations' }] }];

export default function SuperAdminLayout({ children }) {
  // Always start null on server — populate only after hydration on client
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = getUser();
    const roles = Array.isArray(u?.roles) && u.roles.length ? u.roles : [u?.role_id];
    if (!u || !roles.includes(9)) {
      window.location.href = '/login';
      return;
    }
    setUser(u);
    setReady(true);
  }, []);

  // Don't render anything until client has confirmed auth
  // (avoids flash of layout before redirect)
  if (!ready) return null;

  return (
    <AppShell title="Super Admin" roleLabel="Platform Control" currentRole={9} groups={GROUPS} user={user}>
      {children}
    </AppShell>
  );
}
