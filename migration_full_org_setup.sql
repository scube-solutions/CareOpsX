-- ============================================================
-- STEP 1: Create organizations table (control plane)
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
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
  portal_access     JSONB DEFAULT '{"admin": true, "doctor": true, "patient": true, "reception": true, "lab": true, "pharmacy": true, "analytics": true}',
  seat_limits       JSONB DEFAULT '{"admin": 2, "doctor": 3, "patient": -1, "receptionist": 2, "lab": 1, "pharmacist": 1, "reporting": 1}',
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
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STEP 2: Add organization_id to all existing tables
-- ============================================================
ALTER TABLE IF EXISTS users              ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS hospital_profile   ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS branches           ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS departments        ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS consultation_types ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS doctor_leaves      ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS specializations    ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS lab_test_catalog   ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS doctors            ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS patients           ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS appointments       ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS invoices           ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS consultations      ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS prescriptions      ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS lab_orders         ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS lab_reports        ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS queue_tokens       ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS pharmacy_inventory ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS pharmacy_invoices  ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS payments           ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS patient_journey_log ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS follow_up_plans    ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);

-- ============================================================
-- STEP 3: Seed default organization (your existing hospital data)
-- ============================================================
INSERT INTO organizations (organization_name, organization_code, slug, status, billing_status, payment_status)
SELECT 'Default Organization', 'DEFAULT_ORG', 'default-organization', 'active', 'active', 'paid'
WHERE NOT EXISTS (SELECT 1 FROM organizations);

-- ============================================================
-- STEP 4: Backfill all existing rows to the default org
-- ============================================================
UPDATE users             SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL AND role_id <> 9;
UPDATE hospital_profile  SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE branches          SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE departments       SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE consultation_types SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE doctor_leaves     SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE specializations   SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE doctors           SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE patients          SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE appointments      SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE invoices          SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE consultations     SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE prescriptions     SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE lab_orders        SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE lab_reports       SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE queue_tokens      SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE pharmacy_inventory SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE pharmacy_invoices SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE payments          SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE patient_journey_log SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE follow_up_plans   SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;

-- ============================================================
-- STEP 5: Super admin audit log table (Phase 2)
-- ============================================================
CREATE TABLE IF NOT EXISTS super_admin_audit_log (
  id              BIGSERIAL PRIMARY KEY,
  admin_user_id   UUID,
  action          TEXT NOT NULL,
  target_org_id   BIGINT REFERENCES organizations(id),
  target_role_id  INT,
  details         JSONB,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
