-- =====================================================================
-- migration_queue_voice.sql
-- Queue Management enhancement: automated patient calling + voice announcements.
-- Idempotent. Adds per-org voice/announcement settings and a call counter that
-- the lobby display uses to know when to (re-)announce a token.
-- =====================================================================

-- Announcement trigger: incremented every time a token is Called or Recalled.
-- The lobby display keys announcements on (token_id, call_count) so a new or
-- bumped value triggers a fresh voice announcement.
ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS call_count     int DEFAULT 0;
ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS last_called_at timestamptz;

-- Per-organization queue / voice-announcement configuration.
CREATE TABLE IF NOT EXISTS queue_settings (
  organization_id     bigint PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  voice_enabled       boolean DEFAULT true,
  voice_name          text,                       -- browser SpeechSynthesis voice name (device-dependent)
  voice_lang          text DEFAULT 'en-IN',
  voice_gender        text DEFAULT 'female',      -- 'male' | 'female' (hint; actual voice from voice_name)
  volume              numeric DEFAULT 1.0,        -- 0.0 – 1.0
  rate                numeric DEFAULT 1.0,        -- 0.5 – 1.5 speaking rate
  pitch               numeric DEFAULT 1.0,
  repeat_count        int DEFAULT 3,              -- total announcements per call
  repeat_interval_sec int DEFAULT 10,             -- seconds between repeats
  announce_template   text DEFAULT 'Attention please. Token number {token}, {name}, please proceed to {doctor}, consultation room {room}.',
  updated_by          uuid,
  updated_at          timestamptz DEFAULT now()
);
