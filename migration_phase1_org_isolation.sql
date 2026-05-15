-- ============================================================
-- Phase 1: Add organization_id to all remaining clinical tables
-- Safe to re-run: uses IF NOT EXISTS
-- ============================================================

ALTER TABLE IF EXISTS consultations       ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS prescriptions       ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS lab_orders          ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS lab_reports         ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS queue_tokens        ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS pharmacy_inventory  ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS pharmacy_invoices   ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS payments            ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS patient_journey_log ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS follow_up_plans     ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);

-- Backfill existing rows to the default organization
UPDATE consultations       SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE prescriptions       SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE lab_orders          SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE lab_reports         SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE queue_tokens        SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE pharmacy_inventory  SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE pharmacy_invoices   SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE payments            SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE patient_journey_log SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE follow_up_plans     SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;

-- ============================================================
-- Phase 2: Super admin impersonation audit log table
-- ============================================================

CREATE TABLE IF NOT EXISTS super_admin_audit_log (
  id              BIGSERIAL PRIMARY KEY,
  admin_user_id   UUID REFERENCES users(id),
  action          TEXT NOT NULL,
  target_org_id   BIGINT REFERENCES organizations(id),
  target_role_id  INT,
  details         JSONB,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
