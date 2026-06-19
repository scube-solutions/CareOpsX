// ─────────────────────────────────────────────────────────────────────────────
// Subscription plans — single source of truth for what each tier unlocks.
//
// Selecting a plan sets the org's portal_access (which sections/portals are
// reachable), seat_limits, and feature_flags (capabilities not gated by portals:
// AI assistant, HRMS, queue voice announcements). Super admin can still override
// individual values after applying a plan.
// ─────────────────────────────────────────────────────────────────────────────

const FEATURE_KEYS = ['ai_assistant', 'hrms', 'queue_voice'];

const PLANS = {
  trial: {
    label: 'Trial',
    portal_access: { admin: true, doctor: true, patient: true, reception: true, lab: true, pharmacy: true, analytics: true },
    seat_limits:   { admin: 1, doctor: 2, receptionist: 1, lab: 1, pharmacist: 1, reporting: 1, nurse: -1, hr_manager: 1, billing_executive: 1, patient: -1 },
    feature_flags: { ai_assistant: true, hrms: true, queue_voice: true },
  },
  basic: {
    label: 'Basic',
    portal_access: { admin: true, doctor: true, patient: true, reception: true, lab: false, pharmacy: false, analytics: false },
    seat_limits:   { admin: 1, doctor: 2, receptionist: 2, lab: 0, pharmacist: 0, reporting: 0, nurse: 2, hr_manager: 0, billing_executive: 1, patient: -1 },
    feature_flags: { ai_assistant: false, hrms: false, queue_voice: false },
  },
  standard: {
    label: 'Standard',
    portal_access: { admin: true, doctor: true, patient: true, reception: true, lab: true, pharmacy: true, analytics: false },
    seat_limits:   { admin: 2, doctor: 5, receptionist: 3, lab: 2, pharmacist: 2, reporting: 1, nurse: 5, hr_manager: 1, billing_executive: 2, patient: -1 },
    feature_flags: { ai_assistant: false, hrms: false, queue_voice: true },
  },
  premium: {
    label: 'Premium',
    portal_access: { admin: true, doctor: true, patient: true, reception: true, lab: true, pharmacy: true, analytics: true },
    seat_limits:   { admin: 5, doctor: -1, receptionist: -1, lab: -1, pharmacist: -1, reporting: 3, nurse: -1, hr_manager: 3, billing_executive: -1, patient: -1 },
    feature_flags: { ai_assistant: true, hrms: true, queue_voice: true },
  },
  // Enterprise / Custom — super admin sets portals, seats and features manually.
  // The values below are only a starting template; they are NOT forced.
  custom: {
    label: 'Enterprise (Custom)',
    manual: true,
    portal_access: { admin: true, doctor: true, patient: true, reception: true, lab: true, pharmacy: true, analytics: true },
    seat_limits:   { admin: 2, doctor: 3, receptionist: 2, lab: 1, pharmacist: 1, reporting: 1, nurse: -1, hr_manager: 1, billing_executive: 1, patient: -1 },
    feature_flags: { ai_assistant: true, hrms: true, queue_voice: true },
  },
};

// Whether a plan lets the super admin hand-pick access (only Enterprise/Custom).
const isManualPlan = (plan) => !!activePlans()[String(plan || '').toLowerCase()]?.manual;

const PLAN_KEYS = Object.keys(PLANS);

const DEFAULT_FEATURE_FLAGS = { ai_assistant: false, hrms: false, queue_voice: false };

const normalizeFeatureFlags = (value) => ({ ...DEFAULT_FEATURE_FLAGS, ...(value || {}) });

// ── DB-backed, editable plan registry ────────────────────────────────────────
// The hardcoded PLANS above are the defaults/fallback and the seed source. Super
// admin can edit plan structure (stored in subscription_plans); the cache mirrors
// the DB so getPlanDefaults stays synchronous for callers.
let cache = null; // { key: {label, manual, portal_access, seat_limits, feature_flags, monthly_price} }

const activePlans = () => cache || PLANS;

const defaultRow = (key, i) => ({
  key, label: PLANS[key].label, manual: !!PLANS[key].manual,
  portal_access: PLANS[key].portal_access, seat_limits: PLANS[key].seat_limits,
  feature_flags: PLANS[key].feature_flags, sort_order: i,
});

// Load all plans into cache. Any default plan missing from the DB is seeded
// (so it's editable and has a label). Cache always contains every default key —
// DB rows overlay the hardcoded defaults, so edits win but nothing vanishes.
const loadPlans = async (db) => {
  try {
    const res = await db.query('SELECT * FROM subscription_plans');
    const data = res.rows || [];
    const byKey = {}; data.forEach(r => { byKey[r.key] = r; });

    const missing = PLAN_KEYS.filter(k => !byKey[k]).map(k => defaultRow(k, PLAN_KEYS.indexOf(k)));
    if (missing.length) {
      for (const row of missing) {
        try {
          await db.query(
            `INSERT INTO subscription_plans (key, label, manual, portal_access, seat_limits, feature_flags, sort_order) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             ON CONFLICT (key) DO UPDATE SET 
               label = EXCLUDED.label, 
               manual = EXCLUDED.manual, 
               portal_access = EXCLUDED.portal_access, 
               seat_limits = EXCLUDED.seat_limits, 
               feature_flags = EXCLUDED.feature_flags, 
               sort_order = EXCLUDED.sort_order`,
            [
              row.key,
              row.label,
              row.manual,
              row.portal_access,
              row.seat_limits,
              row.feature_flags,
              row.sort_order
            ]
          );
        } catch (e) {
          console.error(`Error seeding plan ${row.key}:`, e.message);
        }
      }
    }

    cache = {};
    PLAN_KEYS.forEach((k, i) => { cache[k] = defaultRow(k, i); });
    [...data, ...missing].forEach(r => { cache[r.key] = { ...cache[r.key], ...r }; });
    return cache;
  } catch (err) {
    console.error("loadPlans error:", err.message);
    cache = null; // fall back to hardcoded
    return PLANS;
  }
};

// Returns the access bundle for a plan, or null if unknown.
const getPlanDefaults = (plan) => {
  const p = activePlans()[String(plan || '').toLowerCase()];
  if (!p) return null;
  return {
    portal_access: { ...p.portal_access },
    seat_limits:   { ...p.seat_limits },
    feature_flags: { ...p.feature_flags },
  };
};

// Public list for the super-admin UI.
const listPlans = () => Object.keys(activePlans()).map(key => ({ key, ...activePlans()[key] }));

module.exports = {
  PLANS, PLAN_KEYS, FEATURE_KEYS, DEFAULT_FEATURE_FLAGS,
  normalizeFeatureFlags, getPlanDefaults, listPlans, isManualPlan, loadPlans, activePlans,
};
