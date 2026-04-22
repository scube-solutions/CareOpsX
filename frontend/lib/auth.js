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
// 1=Admin, 2=Doctor, 3=Patient, 5=Receptionist, 6=LabStaff, 7=Pharmacist, 8=Reporting
export const ROLES = { ADMIN: 1, DOCTOR: 2, PATIENT: 3, RECEPTIONIST: 5, LAB: 6, PHARMACIST: 7, REPORTING: 8 };
export const ROLE_LABELS = { 1: 'Admin', 2: 'Doctor', 3: 'Patient', 5: 'Receptionist', 6: 'Lab Staff', 7: 'Pharmacist', 8: 'Reporting' };

export const isAdmin        = () => getUser()?.role_id === 1;
export const isDoctor       = () => getUser()?.role_id === 2;
export const isPatient      = () => getUser()?.role_id === 3;
export const isReceptionist = () => getUser()?.role_id === 5;
export const isLabStaff     = () => getUser()?.role_id === 6;
export const isPharmacist   = () => getUser()?.role_id === 7;
export const isReporting    = () => getUser()?.role_id === 8;

export const getDashboardRoute = (role_id) => {
  const routes = {
    1: '/admin/dashboard',
    2: '/doctor/dashboard',
    3: '/patient/dashboard',
    5: '/receptionist/dashboard',
    6: '/lab/dashboard',
    7: '/pharmacy/dashboard',
    8: '/admin/analytics',
  };
  return routes[role_id] || '/login';
};

export const clearAuth = () => localStorage.removeItem('token');

export const logout = () => {
  clearAuth();
  window.location.href = '/login';
};
