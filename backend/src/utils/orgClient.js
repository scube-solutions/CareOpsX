/**
 * orgClient.js — Dynamic per-tenant Supabase client factory
 *
 * How it works:
 *  - The control-plane DB (careops-app Supabase project) stores each
 *    organization's tenant_db_url and tenant_db_key.
 *  - When a hospital user makes a request, getDb(req) reads their
 *    organization_id from the JWT, fetches their DB credentials (cached
 *    in memory), and returns a Supabase client pointed at THEIR database.
 *  - If an org has no separate DB configured (tenant_db_url is null),
 *    the shared control-plane DB is used as fallback (demo org / default).
 *  - Super admin without an org context always gets the control-plane DB.
 */

const { createClient } = require('@supabase/supabase-js');
const controlPlaneDb   = require('./supabase'); // the main careops-app connection

// In-memory cache: orgId → SupabaseClient
// Cleared on server restart — credentials re-fetched on next request.
const clientCache = new Map();

/**
 * Returns the Supabase client for the organization in the request's JWT.
 * Falls back to the control-plane DB if no separate DB is configured.
 *
 * Usage inside any controller:
 *   const supabase = await getDb(req);
 */
const getDb = async (req) => {
  const organizationId = req.user?.organization_id ?? null;

  // No org context (unauthenticated, or super-admin without org) → control plane
  if (!organizationId) return controlPlaneDb;

  // Already cached for this org
  if (clientCache.has(organizationId)) return clientCache.get(organizationId);

  const { data: org, error } = await controlPlaneDb
    .from('organizations')
    .select('tenant_db_url, tenant_db_key')
    .eq('id', organizationId)
    .single();

  if (error || !org?.tenant_db_url || !org?.tenant_db_key) {
    // No separate DB configured → use shared/control-plane DB (demo org or legacy)
    clientCache.set(organizationId, controlPlaneDb);
    return controlPlaneDb;
  }

  // Build and cache a dedicated client for this org's database
  const tenantClient = createClient(org.tenant_db_url, org.tenant_db_key, {
    auth: { persistSession: false },
  });
  clientCache.set(organizationId, tenantClient);
  return tenantClient;
};

/**
 * Invalidate the cached client for an org (call this after updating credentials).
 */
const invalidateOrgCache = (organizationId) => {
  clientCache.delete(organizationId);
};

module.exports = { getDb, invalidateOrgCache, controlPlaneDb };
