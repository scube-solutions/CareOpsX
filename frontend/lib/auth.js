export const getUser = () => {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
};

// Role IDs
// 1=Admin, 2=Doctor, 3=Patient, 5=Receptionist, 6=LabStaff, 7=Pharmacist, 8=Reporting, 9=SuperAdmin
export const ROLES = { ADMIN: 1, DOCTOR: 2, PATIENT: 3, RECEPTIONIST: 5, LAB: 6, PHARMACIST: 7, REPORTING: 8, SUPER_ADMIN: 9, NURSE: 10, HR_MANAGER: 11, BILLING: 12 };
export const ROLE_LABELS = { 1: 'Admin', 2: 'Doctor', 3: 'Patient', 5: 'Receptionist', 6: 'Lab Staff', 7: 'Pharmacist', 8: 'Reporting', 9: 'Super Admin', 10: 'Nurse', 11: 'HR Manager', 12: 'Billing Executive' };

export const isAdmin        = () => getUser()?.role_id === 1;
export const isDoctor       = () => getUser()?.role_id === 2;
export const isPatient      = () => getUser()?.role_id === 3;
export const isReceptionist = () => getUser()?.role_id === 5;
export const isLabStaff     = () => getUser()?.role_id === 6;
export const isPharmacist   = () => getUser()?.role_id === 7;
export const isReporting    = () => getUser()?.role_id === 8;
export const isSuperAdmin   = () => getUser()?.role_id === 9 || getUser()?.original_role_id === 9;

export const getDashboardRoute = (role_id) => {
  const routes = {
    1: '/admin/dashboard',
    2: '/doctor/dashboard',
    3: '/patient/dashboard',
    5: '/receptionist/dashboard',
    6: '/lab/dashboard',
    7: '/pharmacy/dashboard',
    8: '/admin/analytics',
    9: '/cxadmin/organizations',
    10: '/doctor/dashboard',
    11: '/admin/hr',
    12: '/admin/billing',
  };
  return routes[role_id] || '/login';
};

export const clearAuth = () => localStorage.removeItem('token');

export const logout = async () => {
  // Record logout history server-side (best-effort), then clear local session.
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      await fetch(`${BASE_URL}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    }
  } catch { /* ignore network errors on logout */ }
  clearAuth();
  localStorage.removeItem('user');
  window.location.href = '/login';
};
