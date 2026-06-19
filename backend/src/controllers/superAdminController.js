const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../utils/db');   // pg pool – used for control-plane queries
const { invalidateOrgCache } = require('../utils/orgClient');
const { notifyOrgOnboarded, sendInvitationEmail } = require('../utils/notify');
const {
  SUPER_ADMIN_ROLE,
  normalizePortalAccess,
  normalizeSeatLimits,
  normalizeFeatureFlags,
  countUsersInSeat,
} = require('../utils/organizationAccess');
const { getPlanDefaults, listPlans, PLAN_KEYS, isManualPlan, loadPlans } = require('../utils/plans');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://careopsx.com';

// Warm the editable-plan cache from the DB at boot (falls back to defaults).
loadPlans(db).catch(() => {});

// Fire-and-forget audit log — never blocks a response, never throws
const writeAudit = (data) => {
  (async () => {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const cols = keys.join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      await db.query(`INSERT INTO super_admin_audit_log (${cols}) VALUES (${placeholders})`, values);
    } catch {}
  })();
};

const buildSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const getOrganizations = async (req, res) => {
  try {
    const orgRes = await db.query(`SELECT * FROM organizations ORDER BY created_at DESC`);
    const organizations = orgRes.rows || [];

    const TRIAL_DAYS = 7;
    const dayMid = (d) => { const x = new Date(d); return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
    const todayMid = dayMid(new Date());

    const enriched = await Promise.all(organizations.map(async (org) => {
      const userCountRes = await db.query(
        `SELECT COUNT(*) FROM users WHERE organization_id = $1 AND is_active = true`,
        [org.id]
      );

      let trialDaysLeft = null, trialExpired = false;
      if (org.created_at && (org.billing_status === 'trial' || !org.billing_status)) {
        const elapsed = Math.floor((todayMid - dayMid(org.created_at)) / 86400000);
        trialDaysLeft = TRIAL_DAYS - elapsed;
        trialExpired = trialDaysLeft <= 0;
      }

      return {
        ...org,
        portal_access: normalizePortalAccess(org.portal_access),
        seat_limits: normalizeSeatLimits(org.seat_limits),
        active_users: parseInt(userCountRes.rows[0].count) || 0,
        doctor_seats_used: await countUsersInSeat(org.id, 'doctor'),
        admin_seats_used:  await countUsersInSeat(org.id, 'admin'),
        trial_days_left: trialDaysLeft,
        trial_expired:   trialExpired,
      };
    }));

    const onTrial = enriched.filter((o) => o.trial_days_left !== null);

    return res.json({
      summary: {
        total_organizations:   enriched.length,
        active:                enriched.filter(o => o.status === 'active').length,
        paused:                enriched.filter(o => o.status === 'paused').length,
        suspended:             enriched.filter(o => o.status === 'suspended').length,
        trial_expiring_soon:   onTrial.filter(o => o.trial_days_left > 0 && o.trial_days_left <= 2).length,
        trial_expired:         onTrial.filter(o => o.trial_expired).length,
        on_trial:              onTrial.length,
      },
      organizations: enriched,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getOrganizationDetail = async (req, res) => {
  try {
    const orgRes = await db.query(`SELECT * FROM organizations WHERE id = $1`, [req.params.id]);
    if (!orgRes.rows.length) return res.status(404).json({ error: 'Organization not found' });
    const organization = orgRes.rows[0];

    const [usersRes, branchesRes] = await Promise.all([
      db.query(
        `SELECT id, first_name, last_name, email, role_id, roles, is_active, created_at
         FROM users WHERE organization_id = $1 ORDER BY created_at DESC`,
        [req.params.id]
      ),
      db.query(
        `SELECT id, branch_name, city, is_active, created_at
         FROM branches WHERE organization_id = $1 ORDER BY created_at DESC`,
        [req.params.id]
      ),
    ]);

    return res.json({
      organization: {
        ...organization,
        portal_access: normalizePortalAccess(organization.portal_access),
        seat_limits: normalizeSeatLimits(organization.seat_limits),
        feature_flags: normalizeFeatureFlags(organization.feature_flags),
      },
      users: usersRes.rows || [],
      branches: branchesRes.rows || [],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createOrganization = async (req, res) => {
  try {
    const {
      organization_name, organization_code, slug, contact_name, contact_email, contact_phone,
      seat_limits, portal_access, feature_flags, plan, billing_status, payment_status,
      notes, contract_start, contract_end, admin_user,
      tenant_db_url, tenant_db_key,
    } = req.body;

    if (!organization_name?.trim()) return res.status(400).json({ error: 'organization_name is required' });

    const wantsAdmin = admin_user?.email && admin_user?.first_name && admin_user?.last_name;
    if (wantsAdmin) {
      const dupRes = await db.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [admin_user.email]);
      if (dupRes.rows.length) return res.status(409).json({ error: 'Admin email already exists. Choose a different email.' });
    }

    await loadPlans(db);
    const planKey = (plan || 'trial').toLowerCase();
    const planDefaults = getPlanDefaults(planKey) || getPlanDefaults('trial');
    const manual = isManualPlan(planKey);
    const finalPortalAccess = normalizePortalAccess(manual ? (portal_access || planDefaults.portal_access) : planDefaults.portal_access);
    const finalSeatLimits   = normalizeSeatLimits(manual ? (seat_limits || planDefaults.seat_limits) : planDefaults.seat_limits);
    const finalFeatureFlags = normalizeFeatureFlags(manual ? (feature_flags || planDefaults.feature_flags) : planDefaults.feature_flags);

    // Auto-generate org code
    let finalCode = (organization_code || '').trim();
    if (!finalCode) {
      const codesRes = await db.query(`SELECT organization_code FROM organizations`);
      const usedNums = new Set(
        (codesRes.rows || [])
          .map(o => { const m = (o.organization_code || '').match(/^ORG-(\d+)$/i); return m ? parseInt(m[1]) : null; })
          .filter(Boolean)
      );
      let next = 1;
      while (usedNums.has(next)) next++;
      finalCode = `ORG-${next}`;
    }

    // Auto-generate slug
    let baseSlug = buildSlug(slug || organization_name);
    let finalSlug = baseSlug;
    const slugRes = await db.query(`SELECT slug FROM organizations`);
    const slugSet = new Set((slugRes.rows || []).map(o => o.slug));
    if (slugSet.has(finalSlug)) {
      let n = 2;
      while (slugSet.has(`${baseSlug}-${n}`)) n++;
      finalSlug = `${baseSlug}-${n}`;
    }

    const orgInsertRes = await db.query(
      `INSERT INTO organizations
         (organization_name, organization_code, slug, contact_name, contact_email, contact_phone,
          plan, seat_limits, portal_access, feature_flags, billing_status, payment_status,
          notes, contract_start, contract_end, tenant_db_url, tenant_db_key, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        organization_name.trim(), finalCode, finalSlug,
        contact_name || null, contact_email || null, contact_phone || null,
        planKey, finalSeatLimits, finalPortalAccess, finalFeatureFlags,
        billing_status || 'trial', payment_status || 'pending',
        notes || null, contract_start || null, contract_end || null,
        tenant_db_url || null, tenant_db_key || null, req.user.id
      ]
    );
    const organization = orgInsertRes.rows[0];

    let createdAdmin = null;
    if (wantsAdmin) {
      const usePassword  = !!admin_user.password;
      const password_hash = await bcrypt.hash(usePassword ? admin_user.password : crypto.randomBytes(24).toString('hex'), 10);
      const inviteToken   = usePassword ? null : crypto.randomBytes(32).toString('hex');
      const inviteExpiry  = usePassword ? null : new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      const userInsertRes = await db.query(
        `INSERT INTO users
           (first_name, last_name, email, phone, password_hash, role_id, roles,
            organization_id, is_active, email_verified, account_status, invite_status,
            invite_token, invite_token_expiry, created_by)
         VALUES ($1,$2,$3,$4,$5,1,ARRAY[1],$6,$7,$7,$8,$9,$10,$11,$12)
         RETURNING id, first_name, last_name, email, role_id, organization_id, invite_status`,
        [
          admin_user.first_name, admin_user.last_name, admin_user.email,
          admin_user.phone || null, password_hash,
          organization.id,
          usePassword, usePassword,
          usePassword ? 'active' : 'pending_activation',
          usePassword ? 'active' : 'invited',
          inviteToken, inviteExpiry, req.user.id
        ]
      );
      createdAdmin = userInsertRes.rows[0];

      if (usePassword) {
        const enabledPortals = Object.entries(finalPortalAccess).filter(([, v]) => v === true).map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));
        notifyOrgOnboarded({
          adminEmail: createdAdmin.email,
          adminName:  `${admin_user.first_name} ${admin_user.last_name}`.trim(),
          orgName:    organization.organization_name,
          orgCode:    organization.organization_code,
          loginUrl:   `${FRONTEND_URL}/login`,
          portals:    enabledPortals,
          password:   admin_user.password,
        }).catch(() => {});
      } else {
        const url = `${FRONTEND_URL}/activate?token=${inviteToken}`;
        sendInvitationEmail(createdAdmin.email, `${admin_user.first_name} ${admin_user.last_name}`.trim(), url, organization.organization_name, 'Hospital Admin').catch(() => {});
      }
    }

    return res.status(201).json({ organization, admin_user: createdAdmin });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const UPDATABLE_ORG_FIELDS = [
  'organization_name', 'contact_name', 'contact_email', 'contact_phone',
  'portal_access', 'seat_limits', 'feature_flags', 'plan', 'billing_status',
  'payment_status', 'notes', 'contract_start', 'contract_end',
  'tenant_db_url', 'tenant_db_key', 'trial_ends_at',
];

const updateOrganization = async (req, res) => {
  try {
    const payload = { updated_by: req.user.id, updated_at: new Date().toISOString() };
    UPDATABLE_ORG_FIELDS.forEach(k => { if (req.body[k] !== undefined) payload[k] = req.body[k]; });

    if (payload.plan !== undefined) {
      await loadPlans(db);
      const d = getPlanDefaults(payload.plan);
      if (d && !isManualPlan(payload.plan)) {
        payload.portal_access = d.portal_access;
        payload.seat_limits   = d.seat_limits;
        payload.feature_flags = d.feature_flags;
      }
    }
    if (payload.portal_access) payload.portal_access = normalizePortalAccess(payload.portal_access);
    if (payload.seat_limits)   payload.seat_limits   = normalizeSeatLimits(payload.seat_limits);
    if (payload.feature_flags) payload.feature_flags = normalizeFeatureFlags(payload.feature_flags);

    const keys = Object.keys(payload);
    const values = Object.values(payload);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(req.params.id);
    const idParam = values.length;

    const result = await db.query(
      `UPDATE organizations SET ${setClauses} WHERE id = $${idParam} RETURNING *`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Organization not found' });

    if (payload.tenant_db_url !== undefined || payload.tenant_db_key !== undefined) {
      invalidateOrgCache(Number(req.params.id));
    }
    return res.json({ organization: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateOrganizationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'paused', 'suspended', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updates = { status, updated_by: req.user.id, updated_at: new Date().toISOString() };
    if (status === 'paused')    updates.paused_at    = new Date().toISOString();
    if (status === 'suspended') updates.suspended_at = new Date().toISOString();

    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(req.params.id);

    const result = await db.query(
      `UPDATE organizations SET ${setClauses} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Organization not found' });
    return res.json({ organization: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const impersonateOrganization = async (req, res) => {
  try {
    const { target_role_id = 1 } = req.body || {};
    const orgRes = await db.query(`SELECT * FROM organizations WHERE id = $1`, [req.params.id]);
    if (!orgRes.rows.length) return res.status(404).json({ error: 'Organization not found' });
    const organization = orgRes.rows[0];

    const token = jwt.sign(
      {
        id: req.user.id, email: req.user.email,
        role_id: target_role_id, roles: [target_role_id, SUPER_ADMIN_ROLE],
        original_role_id: SUPER_ADMIN_ROLE,
        organization_id: organization.id, organization_name: organization.organization_name,
        is_impersonating: true,
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    writeAudit({
      admin_user_id: req.user.id, action: 'IMPERSONATE_ORG',
      target_org_id: organization.id, target_role_id,
      details: { organization_name: organization.organization_name, admin_email: req.user.email },
      ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
      created_at: new Date().toISOString(),
    });

    return res.json({
      token,
      user: {
        id: req.user.id, email: req.user.email,
        role_id: target_role_id, roles: [target_role_id, SUPER_ADMIN_ROLE],
        original_role_id: SUPER_ADMIN_ROLE,
        organization_id: organization.id, organization_name: organization.organization_name,
        is_impersonating: true,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get next available ORG-N code ────────────────────────────────────────────
const getNextOrgCode = async (req, res) => {
  try {
    const codesRes = await db.query(`SELECT organization_code FROM organizations`);
    const usedNums = new Set(
      (codesRes.rows || [])
        .map(o => { const m = (o.organization_code || '').match(/^ORG-(\d+)$/i); return m ? parseInt(m[1]) : null; })
        .filter(Boolean)
    );
    let next = 1;
    while (usedNums.has(next)) next++;
    return res.json({ org_code: `ORG-${next}`, slug: `org-${next}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Reset a user's password (super admin only) ────────────────────────────────
const resetUserPassword = async (req, res) => {
  try {
    const { user_id, new_password } = req.body;
    if (!user_id || !new_password) return res.status(400).json({ error: 'user_id and new_password required' });
    if (new_password.length < 8)  return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const password_hash = await bcrypt.hash(new_password, 10);
    await db.query(
      `UPDATE users SET password_hash=$1, updated_at=$2, failed_login_attempts=0, locked_until=NULL, force_password_change=true
       WHERE id=$3 AND organization_id=$4`,
      [password_hash, new Date().toISOString(), user_id, req.params.id]
    );

    writeAudit({
      admin_user_id: req.user.id, action: 'RESET_USER_PASSWORD',
      target_org_id: Number(req.params.id), details: { user_id },
      ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
      created_at: new Date().toISOString(),
    });

    return res.json({ message: 'Password reset successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Delete a user from an org ─────────────────────────────────────────────────
const deleteOrgUser = async (req, res) => {
  try {
    const { userId } = req.params;
    await db.query(
      `UPDATE users SET is_active=false, updated_at=$1 WHERE id=$2 AND organization_id=$3`,
      [new Date().toISOString(), userId, req.params.id]
    );
    return res.json({ message: 'User deactivated' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Delete (suspend + archive) an organization ────────────────────────────────
const deleteOrganization = async (req, res) => {
  try {
    const orgId = Number(req.params.id);
    await db.query(
      `UPDATE organizations SET status='inactive', updated_by=$1, updated_at=$2 WHERE id=$3`,
      [req.user.id, new Date().toISOString(), orgId]
    );
    await db.query(`UPDATE users SET is_active=false WHERE organization_id=$1`, [orgId]);
    writeAudit({
      admin_user_id: req.user.id, action: 'DELETE_ORG', target_org_id: orgId,
      ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
      created_at: new Date().toISOString(),
    });
    return res.json({ message: 'Organization archived. Data retained for 30 days.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── List subscription plans ───────────────────────────────────────────────────
const getPlans = async (req, res) => {
  try {
    await loadPlans(db);
    return res.json({ plans: listPlans() });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Edit a plan's structure ───────────────────────────────────────────────────
const updatePlan = async (req, res) => {
  try {
    const { key } = req.params;
    await loadPlans(db);
    const allowed = ['label', 'monthly_price', 'portal_access', 'seat_limits', 'feature_flags', 'sort_order'];
    const payload = { updated_by: req.user.id, updated_at: new Date().toISOString() };
    allowed.forEach(k => { if (req.body[k] !== undefined) payload[k] = req.body[k]; });

    const keys = Object.keys(payload);
    const values = Object.values(payload);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(key);

    const result = await db.query(
      `UPDATE subscription_plans SET ${setClauses} WHERE key = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Plan not found' });
    await loadPlans(db);
    writeAudit({ admin_user_id: req.user.id, action: 'UPDATE_PLAN', details: { key }, created_at: new Date().toISOString() });
    return res.json({ message: 'Plan updated', plan: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Feature upgrade requests ──────────────────────────────────────────────────
const getFeatureRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let whereClause = '';
    if (status) { params.push(status); whereClause = ` WHERE status = $1`; }

    const result = await db.query(
      `SELECT * FROM feature_requests${whereClause} ORDER BY created_at DESC LIMIT 200`,
      params
    );
    const data = result.rows || [];

    const orgIds = [...new Set(data.map(r => r.organization_id).filter(Boolean))];
    const nameMap = {};
    if (orgIds.length) {
      const orgsRes = await db.query(`SELECT id, organization_name, plan FROM organizations WHERE id = ANY($1)`, [orgIds]);
      (orgsRes.rows || []).forEach(o => { nameMap[o.id] = o; });
    }
    return res.json({ requests: data.map(r => ({ ...r, organization: nameMap[r.organization_id] || null })) });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

const handleFeatureRequest = async (req, res) => {
  try {
    const { action, admin_note } = req.body;
    const reqRes = await db.query(`SELECT * FROM feature_requests WHERE id = $1`, [req.params.id]);
    const reqRow = reqRes.rows[0];
    if (!reqRow)                    return res.status(404).json({ error: 'Request not found' });
    if (reqRow.status !== 'pending') return res.status(409).json({ error: 'Request already handled' });

    if (action === 'approve') {
      const orgRes = await db.query(`SELECT feature_flags, plan FROM organizations WHERE id = $1`, [reqRow.organization_id]);
      const org = orgRes.rows[0];
      if (reqRow.request_type === 'feature' && reqRow.feature) {
        const flags = normalizeFeatureFlags(org?.feature_flags);
        flags[reqRow.feature] = true;
        await db.query(
          `UPDATE organizations SET feature_flags=$1, updated_by=$2, updated_at=$3 WHERE id=$4`,
          [flags, req.user.id, new Date().toISOString(), reqRow.organization_id]
        );
      } else if (reqRow.request_type === 'plan' && reqRow.target_plan) {
        await loadPlans(db);
        const d = getPlanDefaults(reqRow.target_plan);
        const patch = { plan: reqRow.target_plan, updated_by: req.user.id, updated_at: new Date().toISOString() };
        if (d && !isManualPlan(reqRow.target_plan)) {
          patch.portal_access  = d.portal_access;
          patch.seat_limits    = d.seat_limits;
          patch.feature_flags  = d.feature_flags;
        }
        const patchKeys = Object.keys(patch);
        const patchVals = Object.values(patch);
        const patchSet  = patchKeys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        patchVals.push(reqRow.organization_id);
        await db.query(`UPDATE organizations SET ${patchSet} WHERE id = $${patchVals.length}`, patchVals);
      }
    } else if (action !== 'reject') {
      return res.status(400).json({ error: 'action must be approve or reject' });
    }

    await db.query(
      `UPDATE feature_requests SET status=$1, admin_note=$2, handled_by=$3, handled_at=$4 WHERE id=$5`,
      [action === 'approve' ? 'approved' : 'rejected', admin_note || null, req.user.id, new Date().toISOString(), req.params.id]
    );
    writeAudit({ admin_user_id: req.user.id, action: `FEATURE_REQ_${action.toUpperCase()}`, target_org_id: reqRow.organization_id, details: { request_id: req.params.id }, created_at: new Date().toISOString() });
    return res.json({ message: action === 'approve' ? 'Request approved and access granted' : 'Request rejected' });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── (Re)send an activation invite to an org user ──────────────────────────────
const inviteOrgUser = async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const userRes = await db.query(
      `SELECT id, first_name, last_name, email, invite_status, organization_id FROM users WHERE id=$1 AND organization_id=$2`,
      [user_id, req.params.id]
    );
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found in this organization' });
    if (user.invite_status === 'active') return res.status(409).json({ error: 'This account is already activated' });

    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await db.query(
      `UPDATE users SET invite_token=$1, invite_token_expiry=$2, invite_status='invited', account_status='pending_activation' WHERE id=$3`,
      [token, expiry, user.id]
    );

    const orgRes = await db.query(`SELECT organization_name FROM organizations WHERE id=$1`, [req.params.id]);
    const url  = `${FRONTEND_URL}/activate?token=${token}`;
    const sent = await sendInvitationEmail(user.email, `${user.first_name} ${user.last_name}`.trim(), url, orgRes.rows[0]?.organization_name, 'Hospital Admin');
    writeAudit({ admin_user_id: req.user.id, action: 'INVITE_ORG_USER', target_org_id: Number(req.params.id), details: { user_id }, created_at: new Date().toISOString() });
    return res.json({ message: sent ? 'Invitation sent' : 'Invitation created — email unavailable, share the link manually.', ...(!sent && process.env.NODE_ENV !== 'production' ? { activate_url: url } : {}) });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

module.exports = {
  getNextOrgCode,
  getPlans,
  updatePlan,
  getFeatureRequests,
  handleFeatureRequest,
  getOrganizations,
  getOrganizationDetail,
  createOrganization,
  updateOrganization,
  updateOrganizationStatus,
  impersonateOrganization,
  resetUserPassword,
  inviteOrgUser,
  deleteOrganization,
  deleteOrgUser,
};
