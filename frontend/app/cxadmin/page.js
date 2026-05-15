'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperAdminRoot() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/cxadmin/organizations');
  }, [router]);
  return null;
}
