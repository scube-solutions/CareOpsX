-- =====================================================================
-- migration_ai_assistant.sql
-- AI Organizational Assistant — conversation persistence.
-- Idempotent (safe to re-run). AI interaction auditing reuses audit_logs
-- (module = 'AI'); these tables store the chat history + messages.
-- =====================================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id bigint REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  title           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES ai_conversations(id) ON DELETE CASCADE,
  organization_id bigint REFERENCES organizations(id) ON DELETE CASCADE,
  role            text NOT NULL,          -- 'user' | 'assistant'
  content         text,
  tools_used      jsonb,                  -- names of tools the assistant invoked
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_org_user ON ai_conversations(organization_id, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_msg_conv      ON ai_messages(conversation_id, created_at);
