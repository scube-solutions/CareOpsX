-- ============================================================
-- Schema Separation Migration
-- Moves control-plane tables into a dedicated `superadmin` schema.
--
--   superadmin schema  = YOUR data (orgs, audit log, super admin)
--   public schema      = HOSPITAL data (patients, appointments…)
--
-- Safe to re-run — uses IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- ============================================================

-- ── 1. Create the superadmin schema ──────────────────────────
CREATE SCHEMA IF NOT EXISTS superadmin;

-- ── 2. organizations table in superadmin schema ───────────────
CREATE TABLE IF NOT EXISTS superadmin.organizations (
  id                BIGSERIAL PRIMARY KEY,
  organization_name TEXT NOT NULL,
  organization_code TEXT UNIQUE,
  slug              TEXT UNIQUE,
  contact_name      TEXT,
  contact_email     TEXT,
  contact_phone     TEXT,
  status            TEXT DEFAULT 'active',
  billing_status    TEXT DEFAULT 'trial',
  payment_status    TEXT DEFAULT 'pending',
  portal_access     JSONB DEFAULT '{"admin":true,"doctor":true,"patient":true,"reception":true,"lab":true,"pharmacy":true,"analytics":true}',
  seat_limits       JSONB DEFAULT '{"admin":2,"doctor":3,"patient":-1,"receptionist":2,"lab":1,"pharmacist":1,"reporting":1}',
  notes             TEXT,
  contract_start    DATE,
  contract_end      DATE,
  last_payment_at   TIMESTAMPTZ,
  next_payment_due  TIMESTAMPTZ,
  paused_at         TIMESTAMPTZ,
  suspended_at      TIMESTAMPTZ,
  created_by        UUID,
  updated_by        UUID,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  tenant_db_url     TEXT,
  tenant_db_key     TEXT
);

-- Copy existing org data with explicit columns (no column-order issues)
INSERT INTO superadmin.organizations (
  id, organization_name, organization_code, slug,
  contact_name, contact_email, contact_phone,
  status, billing_status, payment_status,
  portal_access, seat_limits, notes,
  contract_start, contract_end,
  last_payment_at, next_payment_due,
  paused_at, suspended_at,
  created_by, updated_by, created_at, updated_at,
  tenant_db_url, tenant_db_key
)
SELECT
  id, organization_name, organization_code, slug,
  contact_name, contact_email, contact_phone,
  status, billing_status, payment_status,
  portal_access, seat_limits, notes,
  contract_start, contract_end,
  last_payment_at, next_payment_due,
  paused_at, suspended_at,
  created_by, updated_by, created_at, updated_at,
  tenant_db_url, tenant_db_key
FROM public.organizations
ON CONFLICT (id) DO NOTHING;

-- Keep the sequence in sync with public.organizations
SELECT setval(
  pg_get_serial_sequence('superadmin.organizations', 'id'),
  COALESCE((SELECT MAX(id) FROM superadmin.organizations), 1)
);

-- ── 3. Audit log in superadmin schema ────────────────────────
CREATE TABLE IF NOT EXISTS superadmin.audit_log (
  id              BIGSERIAL PRIMARY KEY,
  admin_user_id   UUID,
  action          TEXT NOT NULL,
  target_org_id   BIGINT,
  target_role_id  INT,
  details         JSONB,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Copy any existing audit rows
INSERT INTO superadmin.audit_log (
  admin_user_id, action, target_org_id, target_role_id,
  details, ip_address, created_at
)
SELECT
  admin_user_id, action, target_org_id, target_role_id,
  details, ip_address, created_at
FROM public.super_admin_audit_log
ON CONFLICT DO NOTHING;

-- ── 4. Super admin users view ────────────────────────────────
CREATE OR REPLACE VIEW superadmin.super_admin_users AS
  SELECT id, first_name, last_name, email, phone,
         is_active, created_at, updated_at
  FROM public.users
  WHERE role_id = 9;

-- ── 5. Password reset tokens table ───────────────────────────
-- Stores reset tokens when super admin triggers a reset for a hospital admin
CREATE TABLE IF NOT EXISTS superadmin.password_reset_tokens (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL,
  org_id       BIGINT REFERENCES superadmin.organizations(id),
  token        TEXT NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  requested_by UUID,        -- super admin who triggered this
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ── 6. Grant permissions ─────────────────────────────────────
GRANT USAGE ON SCHEMA superadmin TO service_role, anon, authenticated;
GRANT ALL   ON ALL TABLES    IN SCHEMA superadmin TO service_role;
GRANT SELECT ON ALL TABLES    IN SCHEMA superadmin TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA superadmin TO service_role;

-- ── 7. Verify ────────────────────────────────────────────────
SELECT
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname = 'superadmin'
ORDER BY tablename;
