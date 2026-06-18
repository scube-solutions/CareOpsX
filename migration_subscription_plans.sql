-- =====================================================================
-- migration_subscription_plans.sql
-- Subscription plan + feature flags on organizations.
-- Idempotent. A plan sets portal_access, seat_limits and feature_flags;
-- feature_flags gate capabilities that are NOT portal-gated:
--   ai_assistant, hrms, queue_voice
-- =====================================================================

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan          text DEFAULT 'trial';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS feature_flags jsonb DEFAULT
  '{"ai_assistant": true, "hrms": true, "queue_voice": true}'::jsonb;

-- Backfill existing rows to the trial bundle (full access) so nothing breaks.
UPDATE organizations SET plan = 'trial' WHERE plan IS NULL;
UPDATE organizations SET feature_flags = '{"ai_assistant": true, "hrms": true, "queue_voice": true}'::jsonb
  WHERE feature_flags IS NULL;
