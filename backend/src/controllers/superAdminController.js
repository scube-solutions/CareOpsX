const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const supabase = require('../utils/supabase'); // always control-plane DB (public schema)
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
loadPlans(supabase).catch(() => {});

// Shorthand for the control plane tables (defaults to public)
const adminDb = supabase;

// Fire-and-forget audit log — never blocks a response, never throws
const writeAudit = (data) => {
  (async () => {
    try { await adminDb.from('super_admin_audit_log').insert([data]); } catch {}
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
    const { data: organizations, error } = await adminDb.from('organizations').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    const TRIAL_DAYS = 7;
    const dayMid = (d) => { const x = new Date(d); return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
    const todayMid = dayMid(new Date());

    const enriched = await Promise.all((organizations || []).map(async (org) => {
      const { count: activeUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .eq('is_active', true);

      // Trial countdown (only meaningful while billing_status === 'trial')
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
        active_users: activeUsers || 0,
        doctor_seats_used: await countUsersInSeat(org.id, 'doctor'),
        admin_seats_used: await countUsersInSeat(org.id, 'admin'),
        trial_days_left: trialDaysLeft,
        trial_expired: trialExpired,
      };
    }));

    const onTrial = enriched.filter((o) => o.trial_days_left !== null);

    return res.json({
      summary: {
        total_organizations: enriched.length,
        active: enriched.filter((org) => org.status === 'active').length,
        paused: enriched.filter((org) => org.status === 'paused').length,
        suspended: enriched.filter((org) => org.status === 'suspended').length,
        trial_expiring_soon: onTrial.filter((o) => o.trial_days_left > 0 && o.trial_days_left <= 2).length,
        trial_expired: onTrial.filter((o) => o.trial_expired).length,
        on_trial: onTrial.length,
      },
      organizations: enriched,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getOrganizationDetail = async (req, res) => {
  try {
    const { data: organization, error } = await adminDb.from('organizations').select('*').eq('id', req.params.id).single();
    if (error) throw error;

    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, role_id, roles, is_active, created_at')
      .eq('organization_id', req.params.id)
      .order('created_at', { ascending: false });

    const { data: branches } = await supabase
      .from('branches')
      .select('id, branch_name, city, is_active, created_at')
      .eq('organization_id', req.params.id)
      .order('created_at', { ascending: false });

    return res.json({
      organization: {
        ...organization,
        portal_access: normalizePortalAccess(organization.portal_access),
        seat_limits: normalizeSeatLimits(organization.seat_limits),
        feature_flags: normalizeFeatureFlags(organization.feature_flags),
      },
      users: users || [],
      branches: branches || [],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createOrganization = async (req, res) => {
  try {
    const {
      organization_name,
      organization_code,
      slug,
      contact_name,
      contact_email,
      contact_phone,
      seat_limits,
      portal_access,
      feature_flags,
      plan,
      billing_status,
      payment_status,
      notes,
      contract_start,
      contract_end,
      admin_user,
      // Tenant DB credentials (optional — leave null to share control-plane DB)
      tenant_db_url,
      tenant_db_key,
    } = req.body;

    if (!organization_name?.trim()) return res.status(400).json({ error: 'organization_name is required' });

    // Validate the admin email FIRST so we never create an orphan org if it clashes.
    const wantsAdmin = admin_user?.email && admin_user?.first_name && admin_user?.last_name;
    if (wantsAdmin) {
      const { data: existing } = await supabase.from('users').select('id').ilike('email', admin_user.email).maybeSingle();
      if (existing) return res.status(409).json({ error: 'Admin email already exists. Choose a different email.' });
    }

    // Apply subscription-plan defaults (selecting a plan sets access + features);
    // explicit values in the request still win.
    await loadPlans(adminDb);
    const planKey = (plan || 'trial').toLowerCase();
    const planDefaults = getPlanDefaults(planKey) || getPlanDefaults('trial');
    // Non-custom plans FORCE their bundle (no manual override). Only Enterprise
    // (custom) accepts hand-picked portals / seats / features.
    const manual = isManualPlan(planKey);
    const finalPortalAccess = normalizePortalAccess(manual ? (portal_access || planDefaults.portal_access) : planDefaults.portal_access);
    const finalSeatLimits   = normalizeSeatLimits(manual ? (seat_limits || planDefaults.seat_limits) : planDefaults.seat_limits);
    const finalFeatureFlags = normalizeFeatureFlags(manual ? (feature_flags || planDefaults.feature_flags) : planDefaults.feature_flags);

    // Auto-generate org code as ORG-1, ORG-2 … (next available serial)
    let finalCode = (organization_code || '').trim();
    if (!finalCode) {
      const { data: allOrgs } = await adminDb.from('organizations').select('organization_code');
      const usedNums = new Set(
        (allOrgs || [])
          .map(o => { const m = (o.organization_code || '').match(/^ORG-(\d+)$/i); return m ? parseInt(m[1]) : null; })
          .filter(Boolean)
      );
      let next = 1;
      while (usedNums.has(next)) next++;
      finalCode = `ORG-${next}`;
    }

    // Auto-generate slug from org name, ensure uniqueness by appending number if taken
    let baseSlug = buildSlug(slug || organization_name);
    let finalSlug = baseSlug;
    const { data: existingSlugs } = await adminDb.from('organizations').select('slug');
    const slugSet = new Set((existingSlugs || []).map(o => o.slug));
    if (slugSet.has(finalSlug)) {
      let n = 2;
      while (slugSet.has(`${baseSlug}-${n}`)) n++;
      finalSlug = `${baseSlug}-${n}`;
    }

    const { data: organization, error } = await adminDb
      .from('organizations')
      .insert([{
        organization_name: organization_name.trim(),
        organization_code: finalCode,
        slug: finalSlug,
        contact_name: contact_name || null,
        contact_email: contact_email || null,
        contact_phone: contact_phone || null,
        plan: planKey,
        seat_limits: finalSeatLimits,
        portal_access: finalPortalAccess,
        feature_flags: finalFeatureFlags,
        billing_status: billing_status || 'trial',
        payment_status: payment_status || 'pending',
        notes: notes || null,
        contract_start: contract_start || null,
        contract_end: contract_end || null,
        tenant_db_url: tenant_db_url || null,
        tenant_db_key: tenant_db_key || null,
        created_by: req.user.id,
      }])
      .select('*')
      .single();
    if (error) throw error;

    let createdAdmin = null;
    if (wantsAdmin) {
      // Invitation-based onboarding: no plaintext password. The admin sets their
      // own password via the activation link. If a password IS supplied, honour it.
      const usePassword = !!admin_user.password;
      const password_hash = await bcrypt.hash(usePassword ? admin_user.password : crypto.randomBytes(24).toString('hex'), 10);
      const inviteToken  = usePassword ? null : crypto.randomBytes(32).toString('hex');
      const inviteExpiry = usePassword ? null : new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      const { data: user, error: userError } = await supabase
        .from('users')
        .insert([{
          first_name: admin_user.first_name,
          last_name: admin_user.last_name,
          email: admin_user.email,
          phone: admin_user.phone || null,
          password_hash,
          role_id: 1,
          roles: [1],
          organization_id: organization.id,
          is_active: usePassword,
          email_verified: usePassword,
          account_status: usePassword ? 'active' : 'pending_activation',
          invite_status: usePassword ? 'active' : 'invited',
          invite_token: inviteToken,
          invite_token_expiry: inviteExpiry,
          created_by: req.user.id,
        }])
        .select('id, first_name, last_name, email, role_id, organization_id, invite_status')
        .single();
      if (userError) throw userError;
      createdAdmin = user;

      if (usePassword) {
        // Legacy path: send credentials.
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
        // Preferred path: send an activation invite (admin sets own password).
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
    // Whitelist — never let the client set id/created_by/status/etc. via mass-assignment.
    const payload = { updated_by: req.user.id, updated_at: new Date().toISOString() };
    UPDATABLE_ORG_FIELDS.forEach(k => { if (req.body[k] !== undefined) payload[k] = req.body[k]; });

    // Plan governs access. Non-custom plans FORCE their bundle (manual values
    // ignored). Enterprise (custom) keeps whatever the super admin sends.
    if (payload.plan !== undefined) {
      await loadPlans(adminDb);
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

    const { data, error } = await adminDb.from('organizations').update(payload).eq('id', req.params.id).select('*').single();
    if (error) throw error;
    // If DB credentials changed, flush the cached client so next request re-resolves
    if (payload.tenant_db_url !== undefined || payload.tenant_db_key !== undefined) {
      invalidateOrgCache(Number(req.params.id));
    }
    return res.json({ organization: data });
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

    const payload = {
      status,
      updated_by: req.user.id,
      updated_at: new Date().toISOString(),
    };
    if (status === 'paused') payload.paused_at = new Date().toISOString();
    if (status === 'suspended') payload.suspended_at = new Date().toISOString();

    const { data, error } = await adminDb.from('organizations').update(payload).eq('id', req.params.id).select('*').single();
    if (error) throw error;
    return res.json({ organization: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const impersonateOrganization = async (req, res) => {
  try {
    const { target_role_id = 1 } = req.body || {};
    const { data: organization, error } = await adminDb.from('organizations').select('*').eq('id', req.params.id).single();
    if (error) throw error;

    const token = jwt.sign(
      {
        id: req.user.id,
        email: req.user.email,
        role_id: target_role_id,
        roles: [target_role_id, SUPER_ADMIN_ROLE],
        original_role_id: SUPER_ADMIN_ROLE,
        organization_id: organization.id,
        organization_name: organization.organization_name,
        is_impersonating: true,
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    // Audit log: record every impersonation session (fire-and-forget)
    writeAudit({
      admin_user_id:  req.user.id,
      action:         'IMPERSONATE_ORG',
      target_org_id:  organization.id,
      target_role_id,
      details: {
        organization_name: organization.organization_name,
        admin_email:       req.user.email,
      },
      ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
      created_at: new Date().toISOString(),
    });

    return res.json({
      token,
      user: {
        id: req.user.id,
        email: req.user.email,
        role_id: target_role_id,
        roles: [target_role_id, SUPER_ADMIN_ROLE],
        original_role_id: SUPER_ADMIN_ROLE,
        organization_id: organization.id,
        organization_name: organization.organization_name,
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
    const { data: allOrgs } = await adminDb.from('organizations').select('organization_code');
    const usedNums = new Set(
      (allOrgs || [])
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
    if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const password_hash = await bcrypt.hash(new_password, 10);
    const { error } = await supabase
      .from('users')
      .update({ password_hash, updated_at: new Date().toISOString(), failed_login_attempts: 0, locked_until: null, force_password_change: true })
      .eq('id', user_id)
      .eq('organization_id', req.params.id);

    if (error) throw error;

    writeAudit({
      admin_user_id: req.user.id,
      action: 'RESET_USER_PASSWORD',
      target_org_id: Number(req.params.id),
      details: { user_id },
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
    const { error } = await supabase
      .from('users')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .eq('organization_id', req.params.id);
    if (error) throw error;
    return res.json({ message: 'User deactivated' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Delete (suspend + archive) an organization ────────────────────────────────
const deleteOrganization = async (req, res) => {
  try {
    const orgId = Number(req.params.id);
    // Mark org as inactive in control plane
    await adminDb.from('organizations')
      .update({ status: 'inactive', updated_by: req.user.id, updated_at: new Date().toISOString() })
      .eq('id', orgId);
    // Deactivate all users in this org
    await supabase.from('users').update({ is_active: false }).eq('organization_id', orgId);
    // Audit log
    writeAudit({
      admin_user_id: req.user.id,
      action: 'DELETE_ORG',
      target_org_id: orgId,
      ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
      created_at: new Date().toISOString(),
    });
    return res.json({ message: 'Organization archived. Data retained for 30 days.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── List subscription plans (for the create/edit UI) ─────────────────────────
const getPlans = async (req, res) => {
  try {
    await loadPlans(adminDb);
    return res.json({ plans: listPlans() });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Edit a plan's structure (portals / seats / features / price) ──────────────
const updatePlan = async (req, res) => {
  try {
    const { key } = req.params;
    await loadPlans(adminDb); // ensure the row exists (seeds defaults if missing)
    const allowed = ['label', 'monthly_price', 'portal_access', 'seat_limits', 'feature_flags', 'sort_order'];
    const payload = { updated_by: req.user.id, updated_at: new Date().toISOString() };
    allowed.forEach(k => { if (req.body[k] !== undefined) payload[k] = req.body[k]; });
    const { data, error } = await adminDb.from('subscription_plans').update(payload).eq('key', key).select('*').single();
    if (error) throw error;
    await loadPlans(adminDb); // refresh cache so new structure applies immediately
    writeAudit({ admin_user_id: req.user.id, action: 'UPDATE_PLAN', details: { key }, created_at: new Date().toISOString() });
    return res.json({ message: 'Plan updated', plan: data });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── Feature upgrade requests (super admin queue) ──────────────────────────────
const getFeatureRequests = async (req, res) => {
  try {
    const { status } = req.query;
    let q = adminDb.from('feature_requests').select('*').order('created_at', { ascending: false }).limit(200);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    // Attach org names.
    const orgIds = [...new Set((data || []).map(r => r.organization_id).filter(Boolean))];
    const nameMap = {};
    if (orgIds.length) {
      const { data: orgs } = await adminDb.from('organizations').select('id, organization_name, plan').in('id', orgIds);
      (orgs || []).forEach(o => { nameMap[o.id] = o; });
    }
    return res.json({ requests: (data || []).map(r => ({ ...r, organization: nameMap[r.organization_id] || null })) });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// Approve → grant the feature / upgrade the plan. Reject → just close it.
const handleFeatureRequest = async (req, res) => {
  try {
    const { action, admin_note } = req.body; // 'approve' | 'reject'
    const { data: reqRow } = await adminDb.from('feature_requests').select('*').eq('id', req.params.id).maybeSingle();
    if (!reqRow) return res.status(404).json({ error: 'Request not found' });
    if (reqRow.status !== 'pending') return res.status(409).json({ error: 'Request already handled' });

    if (action === 'approve') {
      const { data: org } = await adminDb.from('organizations').select('feature_flags, plan').eq('id', reqRow.organization_id).single();
      if (reqRow.request_type === 'feature' && reqRow.feature) {
        const flags = normalizeFeatureFlags(org?.feature_flags);
        flags[reqRow.feature] = true; // grant just this capability on top of the plan
        await adminDb.from('organizations').update({ feature_flags: flags, updated_by: req.user.id, updated_at: new Date().toISOString() }).eq('id', reqRow.organization_id);
      } else if (reqRow.request_type === 'plan' && reqRow.target_plan) {
        await loadPlans(adminDb);
        const d = getPlanDefaults(reqRow.target_plan);
        const patch = { plan: reqRow.target_plan, updated_by: req.user.id, updated_at: new Date().toISOString() };
        if (d && !isManualPlan(reqRow.target_plan)) { patch.portal_access = d.portal_access; patch.seat_limits = d.seat_limits; patch.feature_flags = d.feature_flags; }
        await adminDb.from('organizations').update(patch).eq('id', reqRow.organization_id);
      }
    } else if (action !== 'reject') {
      return res.status(400).json({ error: 'action must be approve or reject' });
    }

    await adminDb.from('feature_requests').update({
      status: action === 'approve' ? 'approved' : 'rejected',
      admin_note: admin_note || null, handled_by: req.user.id, handled_at: new Date().toISOString(),
    }).eq('id', req.params.id);
    writeAudit({ admin_user_id: req.user.id, action: `FEATURE_REQ_${action.toUpperCase()}`, target_org_id: reqRow.organization_id, details: { request_id: req.params.id }, created_at: new Date().toISOString() });
    return res.json({ message: action === 'approve' ? 'Request approved and access granted' : 'Request rejected' });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

// ── (Re)send an activation invite to an org user ──────────────────────────────
const inviteOrgUser = async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });
    const { data: user } = await supabase.from('users')
      .select('id, first_name, last_name, email, invite_status, organization_id')
      .eq('id', user_id).eq('organization_id', req.params.id).maybeSingle();
    if (!user) return res.status(404).json({ error: 'User not found in this organization' });
    if (user.invite_status === 'active') return res.status(409).json({ error: 'This account is already activated' });

    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await supabase.from('users').update({ invite_token: token, invite_token_expiry: expiry, invite_status: 'invited', account_status: 'pending_activation' }).eq('id', user.id);

    const { data: org } = await adminDb.from('organizations').select('organization_name').eq('id', req.params.id).maybeSingle();
    const url = `${FRONTEND_URL}/activate?token=${token}`;
    const sent = await sendInvitationEmail(user.email, `${user.first_name} ${user.last_name}`.trim(), url, org?.organization_name, 'Hospital Admin');
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
