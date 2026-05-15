const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../utils/supabase'); // always control-plane DB (public schema)
const { invalidateOrgCache } = require('../utils/orgClient');
const { notifyOrgOnboarded } = require('../utils/notify');
const {
  SUPER_ADMIN_ROLE,
  normalizePortalAccess,
  normalizeSeatLimits,
  countUsersInSeat,
} = require('../utils/organizationAccess');

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

    const enriched = await Promise.all((organizations || []).map(async (org) => {
      const { count: activeUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .eq('is_active', true);

      return {
        ...org,
        portal_access: normalizePortalAccess(org.portal_access),
        seat_limits: normalizeSeatLimits(org.seat_limits),
        active_users: activeUsers || 0,
        doctor_seats_used: await countUsersInSeat(org.id, 'doctor'),
        admin_seats_used: await countUsersInSeat(org.id, 'admin'),
      };
    }));

    return res.json({
      summary: {
        total_organizations: enriched.length,
        active: enriched.filter((org) => org.status === 'active').length,
        paused: enriched.filter((org) => org.status === 'paused').length,
        suspended: enriched.filter((org) => org.status === 'suspended').length,
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
        seat_limits: normalizeSeatLimits(seat_limits),
        portal_access: normalizePortalAccess(portal_access),
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
    if (admin_user?.email && admin_user?.password && admin_user?.first_name && admin_user?.last_name) {
      const { data: existing } = await supabase.from('users').select('id').eq('email', admin_user.email).maybeSingle();
      if (existing) return res.status(409).json({ error: 'Admin email already exists. Organization was created but admin user was not.' });

      const password_hash = await bcrypt.hash(admin_user.password, 10);
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
          is_active: true,
          created_by: req.user.id,
        }])
        .select('id, first_name, last_name, email, role_id, organization_id')
        .single();
      if (userError) throw userError;
      createdAdmin = user;
    }

    // Send welcome email to the new admin (fire-and-forget — never fails the response)
    if (createdAdmin?.email) {
      const enabledPortals = Object.entries(normalizePortalAccess(portal_access))
        .filter(([, v]) => v === true)
        .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));

      notifyOrgOnboarded({
        adminEmail: createdAdmin.email,
        adminName:  `${admin_user.first_name} ${admin_user.last_name}`.trim(),
        orgName:    organization.organization_name,
        orgCode:    organization.organization_code,
        loginUrl:   `${process.env.FRONTEND_URL || 'https://careopsx.com'}/login`,
        portals:    enabledPortals,
        password:   admin_user.password,
      }).catch(() => {});
    }

    return res.status(201).json({ organization, admin_user: createdAdmin });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateOrganization = async (req, res) => {
  try {
    const payload = { ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() };
    if (payload.portal_access) payload.portal_access = normalizePortalAccess(payload.portal_access);
    if (payload.seat_limits)   payload.seat_limits   = normalizeSeatLimits(payload.seat_limits);
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
      .update({ password_hash, updated_at: new Date().toISOString() })
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

module.exports = {
  getNextOrgCode,
  getOrganizations,
  getOrganizationDetail,
  createOrganization,
  updateOrganization,
  updateOrganizationStatus,
  impersonateOrganization,
  resetUserPassword,
  deleteOrganization,
  deleteOrgUser,
};
