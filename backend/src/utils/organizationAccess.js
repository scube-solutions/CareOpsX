const supabase        = require('./supabase');
const adminDb         = supabase; // control-plane tables (defaults to public)

const SUPER_ADMIN_ROLE = 9;

const DEFAULT_PORTAL_ACCESS = {
  admin: true,
  doctor: true,
  patient: true,
  reception: true,
  lab: true,
  pharmacy: true,
  analytics: true,
};

const DEFAULT_SEAT_LIMITS = {
  admin: 2,
  doctor: 3,
  patient: -1,
  receptionist: 2,
  lab: 1,
  pharmacist: 1,
  reporting: 1,
};

const ROLE_TO_SEAT_KEY = {
  1: 'admin',
  2: 'doctor',
  3: 'patient',
  5: 'receptionist',
  6: 'lab',
  7: 'pharmacist',
  8: 'reporting',
};

const ROLE_TO_PORTAL_KEY = {
  1: 'admin',
  2: 'doctor',
  3: 'patient',
  5: 'reception',
  6: 'lab',
  7: 'pharmacy',
  8: 'analytics',
};

const normalizePortalAccess = (value) => ({ ...DEFAULT_PORTAL_ACCESS, ...(value || {}) });
const normalizeSeatLimits = (value) => ({ ...DEFAULT_SEAT_LIMITS, ...(value || {}) });

const getUserOrganizationId = (req) => req.user?.organization_id || req.user?.impersonated_organization_id || null;

const isSuperAdmin = (req) => {
  const roles = Array.isArray(req.user?.roles) && req.user.roles.length ? req.user.roles : [req.user?.role_id];
  return roles.includes(SUPER_ADMIN_ROLE) || req.user?.role_id === SUPER_ADMIN_ROLE || req.user?.original_role_id === SUPER_ADMIN_ROLE;
};

const getOrganizationById = async (organizationId) => {
  if (!organizationId) return null;
  const { data, error } = await adminDb.from('organizations').select('*').eq('id', organizationId).single();
  if (error) throw error;
  return data;
};

const getOrganizationContext = async (req) => {
  if (isSuperAdmin(req) && !getUserOrganizationId(req)) {
    return { isSuperAdmin: true, organization: null, organizationId: null, portalAccess: normalizePortalAccess(), seatLimits: normalizeSeatLimits() };
  }
  const organizationId = getUserOrganizationId(req);
  const organization = await getOrganizationById(organizationId);
  return {
    isSuperAdmin: isSuperAdmin(req),
    organization,
    organizationId,
    portalAccess: normalizePortalAccess(organization?.portal_access),
    seatLimits: normalizeSeatLimits(organization?.seat_limits),
  };
};

const ensureOrganizationOperational = (organization) => {
  if (!organization) return { ok: false, message: 'Organization not found' };
  if (organization.status === 'paused') return { ok: false, message: 'Service is paused. Please contact support or complete payment to reactivate access.' };
  if (organization.status === 'suspended') return { ok: false, message: 'Service is suspended. Please contact support to restore access.' };
  if (organization.status === 'inactive') return { ok: false, message: 'Organization is inactive.' };
  return { ok: true };
};

const ensurePortalEnabled = (portalAccess, roleId) => {
  const normalized = normalizePortalAccess(portalAccess);
  const portalKey = ROLE_TO_PORTAL_KEY[roleId];
  if (!portalKey) return { ok: true };
  if (normalized[portalKey] === false) {
    return { ok: false, message: `This portal is disabled for your organization (${portalKey}).` };
  }
  return { ok: true };
};

const ensureSeatAvailable = async ({ organizationId, seatLimits, roleId, excludeUserId = null }) => {
  const seatKey = ROLE_TO_SEAT_KEY[roleId];
  if (!seatKey) return { ok: true };
  const normalized = normalizeSeatLimits(seatLimits);
  const limit = Number(normalized[seatKey]);
  if (!Number.isFinite(limit) || limit < 0) return { ok: true };

  let query = supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('role_id', roleId)
    .eq('is_active', true);

  if (excludeUserId) query = query.neq('id', excludeUserId);

  const { count, error } = await query;
  if (error) throw error;
  if ((count || 0) >= limit) {
    return { ok: false, message: `Seat limit reached for ${seatKey}. Allowed: ${limit}.` };
  }
  return { ok: true };
};

const countUsersInSeat = async (organizationId, seatKey) => {
  const roleIds = Object.entries(ROLE_TO_SEAT_KEY)
    .filter(([, key]) => key === seatKey)
    .map(([roleId]) => Number(roleId));

  if (!roleIds.length) return 0;

  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .in('role_id', roleIds)
    .eq('is_active', true);
  if (error) throw error;
  return count || 0;
};

module.exports = {
  SUPER_ADMIN_ROLE,
  DEFAULT_PORTAL_ACCESS,
  DEFAULT_SEAT_LIMITS,
  ROLE_TO_SEAT_KEY,
  ROLE_TO_PORTAL_KEY,
  normalizePortalAccess,
  normalizeSeatLimits,
  getUserOrganizationId,
  isSuperAdmin,
  getOrganizationById,
  getOrganizationContext,
  ensureOrganizationOperational,
  ensurePortalEnabled,
  ensureSeatAvailable,
  countUsersInSeat,
};
