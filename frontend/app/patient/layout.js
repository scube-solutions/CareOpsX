'use client';
// Patient layout — no global auth redirect.
// Each protected page (/patient/dashboard, /patient/lab, etc.) handles its own auth.
// /patient (home) is intentionally public.
export default function PatientLayout({ children }) {
  return <>{children}</>;
}
