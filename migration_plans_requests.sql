-- =====================================================================
-- migration_plans_requests.sql
-- Editable subscription plans + feature upgrade requests.
-- Idempotent.
--   subscription_plans : super admin can edit each plan's portals/seats/features.
--   feature_requests   : org admin requests a feature/upgrade; super admin grants
--                        it manually (after payment).
-- =====================================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  key            text PRIMARY KEY,                 -- trial | basic | standard | premium | custom
  label          text NOT NULL,
  manual         boolean DEFAULT false,            -- custom plans allow manual access editing
  monthly_price  numeric DEFAULT 0,
  portal_access  jsonb DEFAULT '{}'::jsonb,
  seat_limits    jsonb DEFAULT '{}'::jsonb,
  feature_flags  jsonb DEFAULT '{}'::jsonb,
  sort_order     int DEFAULT 0,
  updated_by     uuid,
  updated_at     timestamptz DEFAULT now()
);

-- Org-admin requests to unlock a feature or upgrade a plan.
CREATE TABLE IF NOT EXISTS feature_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id bigint REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  request_type    text NOT NULL,                   -- 'feature' | 'plan'
  feature         text,                            -- ai_assistant | hrms | queue_voice  (when request_type='feature')
  target_plan     text,                            -- when request_type='plan'
  message         text,
  status          text DEFAULT 'pending',          -- pending | approved | rejected
  admin_note      text,
  handled_by      uuid,
  handled_at      timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_req_status ON feature_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_req_org    ON feature_requests(organization_id, created_at DESC);
