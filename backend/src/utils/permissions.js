// ─────────────────────────────────────────────────────────────────────────────
// Granular RBAC — module × action permissions.
//
// DEFAULT_PERMISSIONS holds the baseline grid per role. The role_permissions
// table only stores OVERRIDES; getEffectivePermissions merges defaults with any
// per-org override rows. Admin (1) and Super Admin (9) bypass all checks.
// ─────────────────────────────────────────────────────────────────────────────
const db = require('./db');

const MODULES = ['reception', 'opd', 'ipd', 'laboratory', 'pharmacy', 'billing', 'hrms', 'reports'];
const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve'];

const FULL_ACCESS_ROLES = [1, 9]; // Hospital Admin, Super Admin

// HTTP method → action mapping for route-level enforcement.
const METHOD_TO_ACTION = { GET: 'view', POST: 'create', PUT: 'edit', PATCH: 'edit', DELETE: 'delete' };

// Compact builder: { module: [actions] } → full {can_*} object grid.
const grid = (spec) => {
  const out = {};
  for (const m of MODULES) {
    const allowed = spec[m] === 'all' ? ACTIONS : (spec[m] || []);
    out[m] = ACTIONS.reduce((acc, a) => ({ ...acc, [a]: allowed.includes(a) }), {});
  }
  return out;
};

// Baseline permissions per role_id. Mirrors current route-level access so adding
// enforcement does not change existing behaviour for the standard roles.
const DEFAULT_PERMISSIONS = {
  // 1 Admin & 9 Super Admin handled by FULL_ACCESS_ROLES (everything).
  2: grid({ // Doctor
    reception: ['view'], opd: ['view', 'create', 'edit', 'approve'], ipd: ['view', 'create', 'edit'],
    laboratory: ['view', 'create'], pharmacy: ['view'], reports: ['view'],
  }),
  5: grid({ // Receptionist
    reception: 'all', opd: ['view', 'create', 'edit'], ipd: ['view'], billing: ['view', 'create'],
  }),
  6: grid({ // Lab Technician / Lab Staff
    laboratory: 'all', reports: ['view'],
  }),
  7: grid({ // Pharmacist
    pharmacy: 'all', billing: ['view', 'create'], reports: ['view'],
  }),
  8: grid({ // Reporting (read-only across modules)
    reception: ['view'], opd: ['view'], ipd: ['view'], laboratory: ['view'],
    pharmacy: ['view'], billing: ['view'], hrms: ['view'], reports: ['view'],
  }),
  10: grid({ // Nurse
    opd: ['view', 'edit'], ipd: ['view', 'create', 'edit'], laboratory: ['view'], pharmacy: ['view'],
  }),
  11: grid({ // HR Manager
    hrms: 'all', reports: ['view'],
  }),
  12: grid({ // Billing Executive
    billing: 'all', reception: ['view'], opd: ['view'], reports: ['view'],
  }),
};

const emptyGrid = () => grid({});

// Merge a DB override row onto a base module grid.
const applyOverride = (base, row) => {
  base[row.module] = {
    view:    !!row.can_view,
    create:  !!row.can_create,
    edit:    !!row.can_edit,
    delete:  !!row.can_delete,
    approve: !!row.can_approve,
  };
  return base;
};

// Effective grid for ONE role: defaults merged with org override rows.
const getEffectivePermissions = async (organizationId, roleId) => {
  if (FULL_ACCESS_ROLES.includes(Number(roleId))) return grid(MODULES.reduce((a, m) => ({ ...a, [m]: 'all' }), {}));
  const base = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS[roleId] || emptyGrid()));
  if (!organizationId) return base;
  const result = await db.query(
    'SELECT module, can_view, can_create, can_edit, can_delete, can_approve FROM role_permissions WHERE organization_id = $1 AND role_id = $2',
    [organizationId, roleId]
  );
  (result.rows || []).forEach(row => applyOverride(base, row));
  return base;
};

// Union of effective grids across all of a user's roles.
const getEffectivePermissionsForRoles = async (organizationId, roleIds = []) => {
  const grids = await Promise.all(roleIds.map(r => getEffectivePermissions(organizationId, r)));
  const merged = emptyGrid();
  for (const g of grids) {
    for (const m of MODULES) {
      for (const a of ACTIONS) merged[m][a] = merged[m][a] || g[m][a];
    }
  }
  return merged;
};

const rolesOf = (user) =>
  (Array.isArray(user?.roles) && user.roles.length ? user.roles : [user?.role_id]).filter(Boolean);

// Middleware: require a specific module+action. If action omitted, derive from method.
const requirePermission = (module, action = null) => async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated.' });
    const roles = rolesOf(req.user);
    if (roles.some(r => FULL_ACCESS_ROLES.includes(Number(r)))) return next();
    const act = action || METHOD_TO_ACTION[req.method] || 'view';
    const perms = await getEffectivePermissionsForRoles(req.user.organization_id || null, roles);
    if (perms?.[module]?.[act]) return next();
    return res.status(403).json({ error: `Access denied: no '${act}' permission on ${module}.` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  MODULES, ACTIONS, FULL_ACCESS_ROLES, METHOD_TO_ACTION,
  DEFAULT_PERMISSIONS, getEffectivePermissions, getEffectivePermissionsForRoles,
  requirePermission, rolesOf,
};
