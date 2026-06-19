-- ============================================================
-- CareOpsX — PostgreSQL 18 Compatible Schema (CORRECTED)
-- ============================================================
-- Import order is guaranteed safe:
--   1. Extensions & schemas
--   2. ALL tables created first (no inline foreign keys)
--   3. ALL foreign keys added via ALTER TABLE ... ADD CONSTRAINT
--   4. Indexes
--   5. Seed / reference data
--
-- Notes:
--   * No Supabase-specific syntax (no auth.*, no RLS, no policies).
--   * The users <-> organizations dependency is a cycle, so every
--     FK is deferred to section 3 instead of being declared inline.
--   * Invalid JSON fragments and malformed ALTER statements removed.
--   * Validated against PostgreSQL 18 on an empty database (psql -f).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS superadmin;

-- ============================================================
-- 1. TABLES  (no foreign keys here — added in section 3)
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
  portal_access     JSONB DEFAULT '{"admin":true,"doctor":true,"patient":true,"reception":true,"lab":true,"pharmacy":true,"analytics":true}'::jsonb,
  seat_limits       JSONB DEFAULT '{"admin":2,"receptionist":2,"pharmacist":1,"reporting":1}'::jsonb,
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
  plan              TEXT DEFAULT 'trial',
  feature_flags     JSONB DEFAULT '{"ai_assistant":true,"hrms":true,"queue_voice":true}'::jsonb
);

CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  password_hash TEXT,
  role_id INTEGER,
  roles INTEGER[],
  email_verified BOOLEAN DEFAULT false,
  account_status TEXT DEFAULT 'active',
  invite_status TEXT DEFAULT 'active',
  invite_token TEXT,
  invite_token_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  branch_id BIGINT,
  force_password_change BOOLEAN DEFAULT false,
  last_login TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  updated_at TIMESTAMPTZ,
  organization_id BIGINT,
  otp_code      TEXT,
  otp_expiry    TIMESTAMPTZ,
  otp_purpose   TEXT,
  failed_login_attempts INT DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  last_login_at         TIMESTAMPTZ,
  two_factor_enabled BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  patient_uid TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  date_of_birth DATE,
  gender TEXT,
  blood_group TEXT,
  alternate_phone TEXT,
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  emergency_contact_name TEXT,
  emergency_contact_relationship TEXT,
  emergency_contact_phone TEXT,
  allergies TEXT,
  existing_conditions TEXT,
  chronic_disease_tag TEXT,
  branch_id BIGINT,
  is_archived BOOLEAN DEFAULT false,
  merged_into BIGINT,
  created_by UUID,
  updated_by UUID,
  updated_at TIMESTAMPTZ,
  organization_id BIGINT
);

CREATE TABLE IF NOT EXISTS doctors (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  specialization TEXT,
  experience_years INTEGER,
  consultation_fee DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  qualification TEXT,
  department_id BIGINT,
  follow_up_fee DECIMAL(10,2),
  consultation_duration INTEGER DEFAULT 15,
  break_time TEXT,
  room_number TEXT,
  branch_id BIGINT,
  created_by UUID,
  updated_by UUID,
  updated_at TIMESTAMPTZ,
  organization_id BIGINT
);

CREATE TABLE IF NOT EXISTS appointments (
  id BIGSERIAL PRIMARY KEY,
  patient_id UUID NOT NULL,
  doctor_id BIGINT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME,
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  appointment_type TEXT DEFAULT 'new',
  token_number INTEGER,
  queue_status TEXT DEFAULT 'booked',
  checked_in_at TIMESTAMPTZ,
  called_at TIMESTAMPTZ,
  consultation_id UUID,
  priority TEXT DEFAULT 'normal',
  branch_id BIGINT,
  updated_by UUID,
  updated_at TIMESTAMPTZ,
  organization_id BIGINT
);

CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  patient_id UUID NOT NULL,
  total_amount DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  invoice_type TEXT DEFAULT 'consultation',
  consultation_id UUID,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  balance_amount DECIMAL(10,2),
  refund_amount DECIMAL(10,2),
  refund_reason TEXT,
  refund_payment_mode TEXT,
  refunded_by UUID,
  refunded_at TIMESTAMPTZ,
  branch_id BIGINT,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  created_by UUID,
  updated_by UUID,
  updated_at TIMESTAMPTZ,
  organization_id BIGINT
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL,
  patient_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_mode TEXT NOT NULL,
  payment_date TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'completed',
  transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  created_by UUID,
  organization_id BIGINT
);

CREATE TABLE IF NOT EXISTS lab_test_catalog (
  id BIGSERIAL PRIMARY KEY,
  test_name TEXT NOT NULL,
  test_code TEXT,
  category TEXT,
  fee DECIMAL(10,2) DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT
);

CREATE TABLE IF NOT EXISTS hospital_profile (
  id              BIGSERIAL PRIMARY KEY,
  hospital_name   TEXT NOT NULL,
  address         TEXT,
  phone           TEXT,
  email           TEXT,
  working_days    TEXT,
  working_hours   TEXT,
  timezone        TEXT DEFAULT 'Asia/Kolkata',
  currency        TEXT DEFAULT 'INR',
  logo_url        TEXT,
  settings        JSONB,
  created_by      UUID,
  updated_by      UUID,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT
);

CREATE TABLE IF NOT EXISTS branches (
  id              BIGSERIAL PRIMARY KEY,
  branch_name     TEXT NOT NULL,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  phone           TEXT,
  email           TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_by      UUID,
  updated_by      UUID,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT
);

CREATE TABLE IF NOT EXISTS departments (
  id                       BIGSERIAL PRIMARY KEY,
  department_name          TEXT NOT NULL UNIQUE,
  department_code          TEXT NOT NULL UNIQUE,
  description              TEXT,
  department_type          TEXT,
  default_consultation_fee DECIMAL(10,2),
  booking_enabled          BOOLEAN DEFAULT true,
  is_active                BOOLEAN DEFAULT true,
  branch_id                BIGINT,
  created_by               UUID,
  updated_by               UUID,
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now(),
  organization_id          BIGINT
);

CREATE TABLE IF NOT EXISTS consultation_types (
  id            BIGSERIAL PRIMARY KEY,
  type_name     TEXT NOT NULL,
  type_code     TEXT NOT NULL UNIQUE,
  default_fee   DECIMAL(10,2),
  description   TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_by    UUID,
  updated_by    UUID,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT
);

CREATE TABLE IF NOT EXISTS doctor_leaves (
  id          BIGSERIAL PRIMARY KEY,
  doctor_id   BIGINT NOT NULL,
  leave_date  DATE NOT NULL,
  leave_type  TEXT DEFAULT 'full_day',
  reason      TEXT,
  created_by  UUID,
  created_at  TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT
);

CREATE TABLE IF NOT EXISTS queue_tokens (
  id               BIGSERIAL PRIMARY KEY,
  appointment_id   BIGINT,
  patient_id       UUID NOT NULL,
  doctor_id        BIGINT NOT NULL,
  branch_id        BIGINT,
  token_number     INTEGER NOT NULL,
  token_date       DATE NOT NULL,
  status           TEXT DEFAULT 'waiting',
  priority         TEXT DEFAULT 'normal',
  checked_in_at    TIMESTAMPTZ,
  called_at        TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_by       UUID,
  updated_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  organization_id  BIGINT,
  call_count       INT DEFAULT 0,
  last_called_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS consultations (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id           UUID NOT NULL,
  appointment_id       BIGINT,
  doctor_id            BIGINT NOT NULL,
  consultation_date    DATE NOT NULL,
  chief_complaint      TEXT,
  symptoms             TEXT,
  history              TEXT,
  diagnosis            TEXT,
  notes                TEXT,
  advice               TEXT,
  follow_up_required   BOOLEAN DEFAULT false,
  follow_up_date       DATE,
  follow_up_notes      TEXT,
  consultation_status  TEXT DEFAULT 'completed',
  created_by           UUID,
  updated_by           UUID,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ,
  organization_id      BIGINT
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id               BIGSERIAL PRIMARY KEY,
  patient_id       UUID NOT NULL,
  consultation_id  UUID,
  appointment_id   BIGINT,
  doctor_id        BIGINT NOT NULL,
  notes            TEXT,
  created_by       UUID,
  created_at       TIMESTAMPTZ DEFAULT now(),
  organization_id  BIGINT
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id               BIGSERIAL PRIMARY KEY,
  prescription_id  BIGINT NOT NULL,
  medicine_name    TEXT NOT NULL,
  dosage           TEXT,
  frequency        TEXT,
  duration         TEXT,
  route            TEXT,
  instructions     TEXT
);

CREATE TABLE IF NOT EXISTS lab_orders (
  id                       BIGSERIAL PRIMARY KEY,
  patient_id               UUID NOT NULL,
  consultation_id          UUID,
  appointment_id           BIGINT,
  doctor_id                BIGINT NOT NULL,
  test_name                TEXT NOT NULL,
  test_code                TEXT,
  urgency                  TEXT DEFAULT 'normal',
  notes                    TEXT,
  status                   TEXT DEFAULT 'ordered',
  sample_collection_notes  TEXT,
  sample_collected_at      TIMESTAMPTZ,
  ready_at                 TIMESTAMPTZ,
  delivered_at             TIMESTAMPTZ,
  ordered_at               TIMESTAMPTZ DEFAULT now(),
  created_by               UUID,
  updated_by               UUID,
  updated_at               TIMESTAMPTZ,
  organization_id          BIGINT
);

CREATE TABLE IF NOT EXISTS lab_reports (
  id               BIGSERIAL PRIMARY KEY,
  lab_order_id     BIGINT NOT NULL,
  patient_id       UUID NOT NULL,
  doctor_id        BIGINT,
  consultation_id  UUID,
  report_data      JSONB,
  report_url       TEXT,
  findings         TEXT,
  remarks          TEXT,
  is_normal        BOOLEAN,
  status           TEXT DEFAULT 'ready',
  uploaded_by      UUID,
  uploaded_at      TIMESTAMPTZ DEFAULT now(),
  corrected_by     UUID,
  corrected_at     TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  delivered_by     UUID,
  created_at       TIMESTAMPTZ DEFAULT now(),
  organization_id  BIGINT
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id          BIGSERIAL PRIMARY KEY,
  invoice_id  BIGINT NOT NULL,
  description TEXT NOT NULL,
  quantity    INTEGER DEFAULT 1,
  unit_price  DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  item_type   TEXT DEFAULT 'service'
);

CREATE TABLE IF NOT EXISTS pharmacy_inventory (
  id              BIGSERIAL PRIMARY KEY,
  medicine_name   TEXT NOT NULL,
  category        TEXT,
  unit            TEXT DEFAULT 'tablet',
  current_stock   INTEGER DEFAULT 0,
  reorder_level   INTEGER DEFAULT 10,
  unit_price      DECIMAL(10,2) DEFAULT 0,
  batch_number    TEXT,
  expiry_date     DATE,
  manufacturer    TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_by      UUID,
  updated_by      UUID,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ,
  organization_id BIGINT
);

CREATE TABLE IF NOT EXISTS pharmacy_invoices (
  id               BIGSERIAL PRIMARY KEY,
  patient_id       UUID NOT NULL,
  prescription_id  BIGINT,
  consultation_id  UUID,
  subtotal         DECIMAL(10,2) DEFAULT 0,
  discount         DECIMAL(10,2) DEFAULT 0,
  total_amount     DECIMAL(10,2) DEFAULT 0,
  amount_paid      DECIMAL(10,2) DEFAULT 0,
  payment_mode     TEXT,
  status           TEXT DEFAULT 'pending',
  notes            TEXT,
  dispensed_by     UUID,
  dispensed_at     TIMESTAMPTZ,
  created_by       UUID,
  created_at       TIMESTAMPTZ DEFAULT now(),
  organization_id  BIGINT
);

CREATE TABLE IF NOT EXISTS pharmacy_invoice_items (
  id                   BIGSERIAL PRIMARY KEY,
  pharmacy_invoice_id  BIGINT NOT NULL,
  medicine_id          BIGINT NOT NULL,
  medicine_name        TEXT NOT NULL,
  quantity             INTEGER NOT NULL,
  unit_price           DECIMAL(10,2) NOT NULL,
  total_price          DECIMAL(10,2) NOT NULL,
  is_partial           BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS follow_up_plans (
  id                 BIGSERIAL PRIMARY KEY,
  patient_id         UUID NOT NULL,
  doctor_id          BIGINT,
  consultation_id    UUID,
  follow_up_date     DATE NOT NULL,
  required_tests     TEXT,
  medication_refill  BOOLEAN DEFAULT false,
  notes              TEXT,
  disease_tag        TEXT,
  status             TEXT DEFAULT 'scheduled',
  reminder_sent      BOOLEAN DEFAULT false,
  created_by         UUID,
  updated_by         UUID,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ,
  organization_id    BIGINT
);

CREATE TABLE IF NOT EXISTS notification_templates (
  id          BIGSERIAL PRIMARY KEY,
  event_type  TEXT NOT NULL,
  channel     TEXT NOT NULL,
  subject     TEXT,
  body        TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_by  UUID,
  updated_by  UUID,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ,
  organization_id BIGINT,
  UNIQUE(event_type, channel)
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id               BIGSERIAL PRIMARY KEY,
  patient_id       UUID,
  channel          TEXT NOT NULL,
  event_type       TEXT,
  subject          TEXT,
  message          TEXT NOT NULL,
  recipient_phone  TEXT,
  recipient_email  TEXT,
  status           TEXT DEFAULT 'pending',
  sent_at          TIMESTAMPTZ,
  retry_count      INTEGER DEFAULT 0,
  last_retry_at    TIMESTAMPTZ,
  sent_by          UUID,
  created_at       TIMESTAMPTZ DEFAULT now(),
  organization_id  BIGINT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID,
  role_id      INTEGER,
  role_name    TEXT,
  action       TEXT NOT NULL,
  module       TEXT,
  entity_type  TEXT,
  entity_id    TEXT,
  old_data     JSONB,
  new_data     JSONB,
  ip_address   TEXT,
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT
);

CREATE TABLE IF NOT EXISTS drop_off_rules (
  id           BIGSERIAL PRIMARY KEY,
  rule_name    TEXT NOT NULL,
  trigger      TEXT NOT NULL,
  days         INTEGER,
  count        INTEGER,
  risk_score   INTEGER NOT NULL,
  risk_level   TEXT NOT NULL,
  description  TEXT,
  is_active    BOOLEAN DEFAULT true,
  created_by   UUID,
  updated_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ,
  organization_id BIGINT
);

CREATE TABLE IF NOT EXISTS drop_off_watchlist (
  id               BIGSERIAL PRIMARY KEY,
  patient_id       UUID NOT NULL,
  risk_score       INTEGER DEFAULT 0,
  risk_level       TEXT DEFAULT 'medium',
  risk_reason      TEXT,
  trigger_type     TEXT,
  outcome          TEXT DEFAULT 'at_risk',
  action_history   JSONB DEFAULT '[]'::jsonb,
  last_action_at   TIMESTAMPTZ,
  last_action_by   UUID,
  created_by       UUID,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ,
  organization_id  BIGINT
);

CREATE TABLE IF NOT EXISTS patient_journey_log (
  id              BIGSERIAL PRIMARY KEY,
  patient_id      UUID NOT NULL,
  appointment_id  BIGINT,
  location        TEXT NOT NULL,
  notes           TEXT,
  logged_by       UUID,
  logged_at       TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT
);

CREATE TABLE IF NOT EXISTS specializations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT
);

CREATE TABLE IF NOT EXISTS doctor_blocked_slots (
  id           BIGSERIAL PRIMARY KEY,
  doctor_id    BIGINT NOT NULL,
  blocked_date DATE NOT NULL,
  blocked_time TIME NOT NULL,
  created_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(doctor_id, blocked_date, blocked_time)
);

CREATE TABLE IF NOT EXISTS super_admin_audit_log (
  id              BIGSERIAL PRIMARY KEY,
  admin_user_id   UUID,
  action          TEXT NOT NULL,
  target_org_id   BIGINT,
  target_role_id  INT,
  details         JSONB,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id BIGINT,
  user_id         UUID,
  title           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID,
  organization_id BIGINT,
  role            TEXT NOT NULL,
  content         TEXT,
  tools_used      JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_plans (
  key            TEXT PRIMARY KEY,
  label          TEXT NOT NULL,
  manual         BOOLEAN DEFAULT false,
  monthly_price  NUMERIC DEFAULT 0,
  portal_access  JSONB DEFAULT '{}'::jsonb,
  seat_limits    JSONB DEFAULT '{}'::jsonb,
  feature_flags  JSONB DEFAULT '{}'::jsonb,
  sort_order     INT DEFAULT 0,
  updated_by     UUID,
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id BIGINT,
  requested_by    UUID,
  request_type    TEXT NOT NULL,
  feature         TEXT,
  target_plan     TEXT,
  message         TEXT,
  status          TEXT DEFAULT 'pending',
  admin_note      TEXT,
  handled_by      UUID,
  handled_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS queue_settings (
  organization_id     BIGINT PRIMARY KEY,
  voice_enabled       BOOLEAN DEFAULT true,
  voice_name          TEXT,
  voice_lang          TEXT DEFAULT 'en-IN',
  voice_gender        TEXT DEFAULT 'female',
  volume              NUMERIC DEFAULT 1.0,
  rate                NUMERIC DEFAULT 1.0,
  pitch               NUMERIC DEFAULT 1.0,
  repeat_count        INT DEFAULT 3,
  repeat_interval_sec INT DEFAULT 10,
  announce_template   TEXT DEFAULT 'Attention please. Token number {token}, {name}, please proceed to {doctor}, consultation room {room}.',
  updated_by          UUID,
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   BIGINT,
  user_id           UUID,
  employee_id       TEXT,
  department        TEXT,
  designation       TEXT,
  employment_type   TEXT CHECK (employment_type IN ('Full-Time','Part-Time','Contract','Intern')),
  date_of_joining   DATE,
  blood_group       TEXT,
  emergency_contact TEXT,
  address           TEXT,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  full_name         TEXT,
  email             TEXT,
  mobile            TEXT,
  role_id           INT,
  employment_status TEXT DEFAULT 'Active',
  UNIQUE(organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS attendance_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   BIGINT,
  user_id           UUID,
  date              DATE NOT NULL,
  status            TEXT CHECK (status IN ('present','absent','half_day','late','on_leave','holiday')),
  check_in          TIME,
  check_out         TIME,
  notes             TEXT,
  marked_by         UUID,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS shifts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   BIGINT,
  shift_name        TEXT NOT NULL,
  start_time        TIME,
  end_time          TIME,
  break_minutes     INT DEFAULT 30,
  days_of_week      TEXT[],
  color             TEXT DEFAULT '#00b4a0',
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_leave_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   BIGINT,
  user_id           UUID,
  leave_type        TEXT,
  from_date         DATE,
  to_date           DATE,
  reason            TEXT,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  remarks           TEXT,
  reviewed_by       UUID,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salary_structures (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   BIGINT,
  grade             TEXT,
  role_id           INT,
  basic_salary      NUMERIC DEFAULT 0,
  hra               NUMERIC DEFAULT 0,
  allowances        NUMERIC DEFAULT 0,
  deductions        NUMERIC DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   BIGINT,
  user_id           UUID,
  pay_month         TEXT NOT NULL,
  basic_salary      NUMERIC DEFAULT 0,
  hra               NUMERIC DEFAULT 0,
  allowances        NUMERIC DEFAULT 0,
  deductions        NUMERIC DEFAULT 0,
  gross_salary      NUMERIC DEFAULT 0,
  net_salary        NUMERIC DEFAULT 0,
  status            TEXT DEFAULT 'generated',
  generated_by      UUID,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, pay_month)
);

CREATE TABLE IF NOT EXISTS hospital_rooms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   BIGINT,
  room_name         TEXT NOT NULL,
  room_type         TEXT,
  total_beds        INT DEFAULT 1,
  available_beds    INT DEFAULT 1,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointment_payment_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   BIGINT,
  patient_name      TEXT,
  patient_phone     TEXT,
  patient_user_id   UUID,
  doctor_id         UUID,
  doctor_name       TEXT,
  specialty         TEXT,
  appointment_date  DATE,
  appointment_time  TEXT,
  consultation_fee  NUMERIC,
  status            TEXT DEFAULT 'pending',
  approved_by       UUID,
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id BIGINT,
  role_id         INT  NOT NULL,
  module          TEXT NOT NULL,
  can_view        BOOLEAN DEFAULT false,
  can_create      BOOLEAN DEFAULT false,
  can_edit        BOOLEAN DEFAULT false,
  can_delete      BOOLEAN DEFAULT false,
  can_approve     BOOLEAN DEFAULT false,
  updated_by      UUID,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, role_id, module)
);

-- ---- superadmin schema tables ----

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
  portal_access     JSONB DEFAULT '{"admin":true,"doctor":true,"patient":true,"reception":true,"lab":true,"pharmacy":true,"analytics":true}'::jsonb,
  seat_limits       JSONB DEFAULT '{"admin":2,"doctor":3,"patient":-1,"receptionist":2,"lab":1,"pharmacist":1,"reporting":1}'::jsonb,
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

CREATE TABLE IF NOT EXISTS superadmin.password_reset_tokens (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL,
  org_id       BIGINT,
  token        TEXT NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  requested_by UUID,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. FOREIGN KEYS  (added after all tables exist)
-- ============================================================

-- users
ALTER TABLE users ADD CONSTRAINT fk_users_created_by      FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE users ADD CONSTRAINT fk_users_updated_by      FOREIGN KEY (updated_by)      REFERENCES users(id);
ALTER TABLE users ADD CONSTRAINT fk_users_organization    FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- organizations
ALTER TABLE organizations ADD CONSTRAINT fk_org_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE organizations ADD CONSTRAINT fk_org_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);

-- patients
ALTER TABLE patients ADD CONSTRAINT fk_patients_user         FOREIGN KEY (user_id)         REFERENCES users(id);
ALTER TABLE patients ADD CONSTRAINT fk_patients_created_by   FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE patients ADD CONSTRAINT fk_patients_updated_by   FOREIGN KEY (updated_by)      REFERENCES users(id);
ALTER TABLE patients ADD CONSTRAINT fk_patients_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- doctors
ALTER TABLE doctors ADD CONSTRAINT fk_doctors_user         FOREIGN KEY (user_id)         REFERENCES users(id);
ALTER TABLE doctors ADD CONSTRAINT fk_doctors_created_by   FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE doctors ADD CONSTRAINT fk_doctors_updated_by   FOREIGN KEY (updated_by)      REFERENCES users(id);
ALTER TABLE doctors ADD CONSTRAINT fk_doctors_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- appointments
ALTER TABLE appointments ADD CONSTRAINT fk_appt_patient      FOREIGN KEY (patient_id)      REFERENCES patients(id);
ALTER TABLE appointments ADD CONSTRAINT fk_appt_doctor       FOREIGN KEY (doctor_id)       REFERENCES doctors(id);
ALTER TABLE appointments ADD CONSTRAINT fk_appt_updated_by   FOREIGN KEY (updated_by)      REFERENCES users(id);
ALTER TABLE appointments ADD CONSTRAINT fk_appt_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- invoices
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_patient      FOREIGN KEY (patient_id)      REFERENCES patients(id);
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_refunded_by  FOREIGN KEY (refunded_by)     REFERENCES users(id);
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_created_by   FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_updated_by   FOREIGN KEY (updated_by)      REFERENCES users(id);
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- payments
ALTER TABLE payments ADD CONSTRAINT fk_payments_invoice      FOREIGN KEY (invoice_id)      REFERENCES invoices(id);
ALTER TABLE payments ADD CONSTRAINT fk_payments_patient      FOREIGN KEY (patient_id)      REFERENCES patients(id);
ALTER TABLE payments ADD CONSTRAINT fk_payments_created_by   FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE payments ADD CONSTRAINT fk_payments_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- lab_test_catalog
ALTER TABLE lab_test_catalog ADD CONSTRAINT fk_ltc_created_by   FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE lab_test_catalog ADD CONSTRAINT fk_ltc_updated_by   FOREIGN KEY (updated_by)      REFERENCES users(id);
ALTER TABLE lab_test_catalog ADD CONSTRAINT fk_ltc_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- hospital_profile
ALTER TABLE hospital_profile ADD CONSTRAINT fk_hp_created_by   FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE hospital_profile ADD CONSTRAINT fk_hp_updated_by   FOREIGN KEY (updated_by)      REFERENCES users(id);
ALTER TABLE hospital_profile ADD CONSTRAINT fk_hp_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- branches
ALTER TABLE branches ADD CONSTRAINT fk_branches_created_by   FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE branches ADD CONSTRAINT fk_branches_updated_by   FOREIGN KEY (updated_by)      REFERENCES users(id);
ALTER TABLE branches ADD CONSTRAINT fk_branches_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- departments
ALTER TABLE departments ADD CONSTRAINT fk_dept_branch       FOREIGN KEY (branch_id)       REFERENCES branches(id);
ALTER TABLE departments ADD CONSTRAINT fk_dept_created_by   FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE departments ADD CONSTRAINT fk_dept_updated_by   FOREIGN KEY (updated_by)      REFERENCES users(id);
ALTER TABLE departments ADD CONSTRAINT fk_dept_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- consultation_types
ALTER TABLE consultation_types ADD CONSTRAINT fk_ct_created_by   FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE consultation_types ADD CONSTRAINT fk_ct_updated_by   FOREIGN KEY (updated_by)      REFERENCES users(id);
ALTER TABLE consultation_types ADD CONSTRAINT fk_ct_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- doctor_leaves
ALTER TABLE doctor_leaves ADD CONSTRAINT fk_dl_doctor       FOREIGN KEY (doctor_id)       REFERENCES doctors(id);
ALTER TABLE doctor_leaves ADD CONSTRAINT fk_dl_created_by   FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE doctor_leaves ADD CONSTRAINT fk_dl_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- queue_tokens
ALTER TABLE queue_tokens ADD CONSTRAINT fk_qt_appointment  FOREIGN KEY (appointment_id)  REFERENCES appointments(id);
ALTER TABLE queue_tokens ADD CONSTRAINT fk_qt_patient      FOREIGN KEY (patient_id)      REFERENCES patients(id);
ALTER TABLE queue_tokens ADD CONSTRAINT fk_qt_doctor       FOREIGN KEY (doctor_id)       REFERENCES doctors(id);
ALTER TABLE queue_tokens ADD CONSTRAINT fk_qt_branch       FOREIGN KEY (branch_id)       REFERENCES branches(id);
ALTER TABLE queue_tokens ADD CONSTRAINT fk_qt_created_by   FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE queue_tokens ADD CONSTRAINT fk_qt_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- consultations
ALTER TABLE consultations ADD CONSTRAINT fk_cons_patient      FOREIGN KEY (patient_id)      REFERENCES patients(id);
ALTER TABLE consultations ADD CONSTRAINT fk_cons_appointment  FOREIGN KEY (appointment_id)  REFERENCES appointments(id);
ALTER TABLE consultations ADD CONSTRAINT fk_cons_doctor       FOREIGN KEY (doctor_id)       REFERENCES doctors(id);
ALTER TABLE consultations ADD CONSTRAINT fk_cons_created_by   FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE consultations ADD CONSTRAINT fk_cons_updated_by   FOREIGN KEY (updated_by)      REFERENCES users(id);
ALTER TABLE consultations ADD CONSTRAINT fk_cons_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- prescriptions
ALTER TABLE prescriptions ADD CONSTRAINT fk_rx_patient      FOREIGN KEY (patient_id)      REFERENCES patients(id);
ALTER TABLE prescriptions ADD CONSTRAINT fk_rx_consultation FOREIGN KEY (consultation_id) REFERENCES consultations(id);
ALTER TABLE prescriptions ADD CONSTRAINT fk_rx_appointment  FOREIGN KEY (appointment_id)  REFERENCES appointments(id);
ALTER TABLE prescriptions ADD CONSTRAINT fk_rx_doctor       FOREIGN KEY (doctor_id)       REFERENCES doctors(id);
ALTER TABLE prescriptions ADD CONSTRAINT fk_rx_created_by   FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE prescriptions ADD CONSTRAINT fk_rx_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- prescription_items
ALTER TABLE prescription_items ADD CONSTRAINT fk_rxitem_prescription FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE;

-- lab_orders
ALTER TABLE lab_orders ADD CONSTRAINT fk_lo_patient      FOREIGN KEY (patient_id)      REFERENCES patients(id);
ALTER TABLE lab_orders ADD CONSTRAINT fk_lo_consultation FOREIGN KEY (consultation_id) REFERENCES consultations(id);
ALTER TABLE lab_orders ADD CONSTRAINT fk_lo_appointment  FOREIGN KEY (appointment_id)  REFERENCES appointments(id);
ALTER TABLE lab_orders ADD CONSTRAINT fk_lo_doctor       FOREIGN KEY (doctor_id)       REFERENCES doctors(id);
ALTER TABLE lab_orders ADD CONSTRAINT fk_lo_created_by   FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE lab_orders ADD CONSTRAINT fk_lo_updated_by   FOREIGN KEY (updated_by)      REFERENCES users(id);
ALTER TABLE lab_orders ADD CONSTRAINT fk_lo_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- lab_reports
ALTER TABLE lab_reports ADD CONSTRAINT fk_lr_lab_order    FOREIGN KEY (lab_order_id)    REFERENCES lab_orders(id);
ALTER TABLE lab_reports ADD CONSTRAINT fk_lr_patient      FOREIGN KEY (patient_id)      REFERENCES patients(id);
ALTER TABLE lab_reports ADD CONSTRAINT fk_lr_doctor       FOREIGN KEY (doctor_id)       REFERENCES doctors(id);
ALTER TABLE lab_reports ADD CONSTRAINT fk_lr_consultation FOREIGN KEY (consultation_id) REFERENCES consultations(id);
ALTER TABLE lab_reports ADD CONSTRAINT fk_lr_uploaded_by  FOREIGN KEY (uploaded_by)     REFERENCES users(id);
ALTER TABLE lab_reports ADD CONSTRAINT fk_lr_corrected_by FOREIGN KEY (corrected_by)    REFERENCES users(id);
ALTER TABLE lab_reports ADD CONSTRAINT fk_lr_delivered_by FOREIGN KEY (delivered_by)    REFERENCES users(id);
ALTER TABLE lab_reports ADD CONSTRAINT fk_lr_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- invoice_items
ALTER TABLE invoice_items ADD CONSTRAINT fk_invitem_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;

-- pharmacy_inventory
ALTER TABLE pharmacy_inventory ADD CONSTRAINT fk_pi_created_by   FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE pharmacy_inventory ADD CONSTRAINT fk_pi_updated_by   FOREIGN KEY (updated_by)      REFERENCES users(id);
ALTER TABLE pharmacy_inventory ADD CONSTRAINT fk_pi_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- pharmacy_invoices
ALTER TABLE pharmacy_invoices ADD CONSTRAINT fk_pinv_patient      FOREIGN KEY (patient_id)      REFERENCES patients(id);
ALTER TABLE pharmacy_invoices ADD CONSTRAINT fk_pinv_prescription FOREIGN KEY (prescription_id) REFERENCES prescriptions(id);
ALTER TABLE pharmacy_invoices ADD CONSTRAINT fk_pinv_consultation FOREIGN KEY (consultation_id) REFERENCES consultations(id);
ALTER TABLE pharmacy_invoices ADD CONSTRAINT fk_pinv_dispensed_by FOREIGN KEY (dispensed_by)    REFERENCES users(id);
ALTER TABLE pharmacy_invoices ADD CONSTRAINT fk_pinv_created_by   FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE pharmacy_invoices ADD CONSTRAINT fk_pinv_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- pharmacy_invoice_items
ALTER TABLE pharmacy_invoice_items ADD CONSTRAINT fk_piitem_invoice  FOREIGN KEY (pharmacy_invoice_id) REFERENCES pharmacy_invoices(id) ON DELETE CASCADE;
ALTER TABLE pharmacy_invoice_items ADD CONSTRAINT fk_piitem_medicine FOREIGN KEY (medicine_id)         REFERENCES pharmacy_inventory(id);

-- follow_up_plans
ALTER TABLE follow_up_plans ADD CONSTRAINT fk_fup_patient      FOREIGN KEY (patient_id)      REFERENCES patients(id);
ALTER TABLE follow_up_plans ADD CONSTRAINT fk_fup_doctor       FOREIGN KEY (doctor_id)       REFERENCES doctors(id);
ALTER TABLE follow_up_plans ADD CONSTRAINT fk_fup_consultation FOREIGN KEY (consultation_id) REFERENCES consultations(id);
ALTER TABLE follow_up_plans ADD CONSTRAINT fk_fup_created_by   FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE follow_up_plans ADD CONSTRAINT fk_fup_updated_by   FOREIGN KEY (updated_by)      REFERENCES users(id);
ALTER TABLE follow_up_plans ADD CONSTRAINT fk_fup_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- notification_templates
ALTER TABLE notification_templates ADD CONSTRAINT fk_nt_created_by   FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE notification_templates ADD CONSTRAINT fk_nt_updated_by   FOREIGN KEY (updated_by)      REFERENCES users(id);
ALTER TABLE notification_templates ADD CONSTRAINT fk_nt_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- notification_logs
ALTER TABLE notification_logs ADD CONSTRAINT fk_nl_patient      FOREIGN KEY (patient_id)      REFERENCES patients(id);
ALTER TABLE notification_logs ADD CONSTRAINT fk_nl_sent_by      FOREIGN KEY (sent_by)         REFERENCES users(id);
ALTER TABLE notification_logs ADD CONSTRAINT fk_nl_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- audit_logs
ALTER TABLE audit_logs ADD CONSTRAINT fk_al_user         FOREIGN KEY (user_id)         REFERENCES users(id);
ALTER TABLE audit_logs ADD CONSTRAINT fk_al_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- drop_off_rules
ALTER TABLE drop_off_rules ADD CONSTRAINT fk_dor_created_by   FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE drop_off_rules ADD CONSTRAINT fk_dor_updated_by   FOREIGN KEY (updated_by)      REFERENCES users(id);
ALTER TABLE drop_off_rules ADD CONSTRAINT fk_dor_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- drop_off_watchlist
ALTER TABLE drop_off_watchlist ADD CONSTRAINT fk_dow_patient        FOREIGN KEY (patient_id)      REFERENCES patients(id);
ALTER TABLE drop_off_watchlist ADD CONSTRAINT fk_dow_last_action_by FOREIGN KEY (last_action_by) REFERENCES users(id);
ALTER TABLE drop_off_watchlist ADD CONSTRAINT fk_dow_created_by     FOREIGN KEY (created_by)      REFERENCES users(id);
ALTER TABLE drop_off_watchlist ADD CONSTRAINT fk_dow_organization   FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- patient_journey_log
ALTER TABLE patient_journey_log ADD CONSTRAINT fk_pjl_patient      FOREIGN KEY (patient_id)      REFERENCES patients(id);
ALTER TABLE patient_journey_log ADD CONSTRAINT fk_pjl_appointment  FOREIGN KEY (appointment_id)  REFERENCES appointments(id);
ALTER TABLE patient_journey_log ADD CONSTRAINT fk_pjl_logged_by    FOREIGN KEY (logged_by)       REFERENCES users(id);
ALTER TABLE patient_journey_log ADD CONSTRAINT fk_pjl_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- specializations
ALTER TABLE specializations ADD CONSTRAINT fk_spec_organization FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- doctor_blocked_slots
ALTER TABLE doctor_blocked_slots ADD CONSTRAINT fk_dbs_doctor     FOREIGN KEY (doctor_id)  REFERENCES doctors(id) ON DELETE CASCADE;
ALTER TABLE doctor_blocked_slots ADD CONSTRAINT fk_dbs_created_by FOREIGN KEY (created_by) REFERENCES users(id);

-- super_admin_audit_log
ALTER TABLE super_admin_audit_log ADD CONSTRAINT fk_saal_admin_user FOREIGN KEY (admin_user_id) REFERENCES users(id);
ALTER TABLE super_admin_audit_log ADD CONSTRAINT fk_saal_target_org FOREIGN KEY (target_org_id) REFERENCES organizations(id);

-- ai_conversations
ALTER TABLE ai_conversations ADD CONSTRAINT fk_aic_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE ai_conversations ADD CONSTRAINT fk_aic_user         FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE;

-- ai_messages
ALTER TABLE ai_messages ADD CONSTRAINT fk_aim_conversation FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE;
ALTER TABLE ai_messages ADD CONSTRAINT fk_aim_organization FOREIGN KEY (organization_id) REFERENCES organizations(id)    ON DELETE CASCADE;

-- feature_requests
ALTER TABLE feature_requests ADD CONSTRAINT fk_fr_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE feature_requests ADD CONSTRAINT fk_fr_requested_by FOREIGN KEY (requested_by)    REFERENCES users(id)         ON DELETE SET NULL;

-- queue_settings
ALTER TABLE queue_settings ADD CONSTRAINT fk_qs_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- staff_profiles
ALTER TABLE staff_profiles ADD CONSTRAINT fk_sp_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE staff_profiles ADD CONSTRAINT fk_sp_user         FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE;

-- attendance_logs
ALTER TABLE attendance_logs ADD CONSTRAINT fk_att_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE attendance_logs ADD CONSTRAINT fk_att_user         FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE;
ALTER TABLE attendance_logs ADD CONSTRAINT fk_att_marked_by    FOREIGN KEY (marked_by)       REFERENCES users(id);

-- shifts
ALTER TABLE shifts ADD CONSTRAINT fk_shifts_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- hr_leave_requests
ALTER TABLE hr_leave_requests ADD CONSTRAINT fk_hlr_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE hr_leave_requests ADD CONSTRAINT fk_hlr_user         FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE;
ALTER TABLE hr_leave_requests ADD CONSTRAINT fk_hlr_reviewed_by  FOREIGN KEY (reviewed_by)     REFERENCES users(id);

-- salary_structures
ALTER TABLE salary_structures ADD CONSTRAINT fk_ss_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- payroll_records
ALTER TABLE payroll_records ADD CONSTRAINT fk_pr_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE payroll_records ADD CONSTRAINT fk_pr_user         FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE;
ALTER TABLE payroll_records ADD CONSTRAINT fk_pr_generated_by FOREIGN KEY (generated_by)    REFERENCES users(id);

-- hospital_rooms
ALTER TABLE hospital_rooms ADD CONSTRAINT fk_hr_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- appointment_payment_requests
ALTER TABLE appointment_payment_requests ADD CONSTRAINT fk_apr_organization   FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE appointment_payment_requests ADD CONSTRAINT fk_apr_patient_user   FOREIGN KEY (patient_user_id) REFERENCES users(id);
ALTER TABLE appointment_payment_requests ADD CONSTRAINT fk_apr_approved_by    FOREIGN KEY (approved_by)     REFERENCES users(id);

-- role_permissions
ALTER TABLE role_permissions ADD CONSTRAINT fk_rp_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- superadmin.password_reset_tokens
ALTER TABLE superadmin.password_reset_tokens ADD CONSTRAINT fk_prt_org FOREIGN KEY (org_id) REFERENCES superadmin.organizations(id);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module     ON audit_logs(module);

CREATE INDEX IF NOT EXISTS idx_patients_phone      ON patients(alternate_phone);
CREATE INDEX IF NOT EXISTS idx_patients_uid        ON patients(patient_uid);
CREATE INDEX IF NOT EXISTS idx_patients_archived   ON patients(is_archived);
CREATE INDEX IF NOT EXISTS idx_appointments_date   ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_pid    ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_queue_tokens_date   ON queue_tokens(token_date, doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultations_pid   ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_status   ON lab_orders(status);
CREATE INDEX IF NOT EXISTS idx_lab_orders_pid      ON lab_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_followups_date      ON follow_up_plans(follow_up_date, status);
CREATE INDEX IF NOT EXISTS idx_dropoff_outcome     ON drop_off_watchlist(outcome, risk_level);
CREATE INDEX IF NOT EXISTS idx_notifications_pid   ON notification_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inv        ON pharmacy_inventory(medicine_name);

CREATE INDEX IF NOT EXISTS idx_ai_conv_org_user ON ai_conversations(organization_id, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_msg_conv      ON ai_messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_feature_req_status ON feature_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_req_org    ON feature_requests(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_org_date ON attendance_logs(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_leave_org_status    ON hr_leave_requests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_payroll_org_month   ON payroll_records(organization_id, pay_month);
CREATE INDEX IF NOT EXISTS idx_role_perms_org_role ON role_permissions(organization_id, role_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_org_email
  ON staff_profiles(organization_id, lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_org_employee_id
  ON staff_profiles(organization_id, employee_id) WHERE employee_id IS NOT NULL;

-- ============================================================
-- 4. SEED / REFERENCE DATA
-- ============================================================

INSERT INTO organizations (organization_name, organization_code, slug, status, billing_status, payment_status)
SELECT 'Default Organization', 'DEFAULT_ORG', 'default-organization', 'active', 'active', 'paid'
WHERE NOT EXISTS (SELECT 1 FROM organizations);

INSERT INTO departments (department_name, department_code, department_type, is_active) VALUES
  ('General Medicine',  'GEN',  'OPD', true),
  ('Cardiology',        'CARD', 'OPD', true),
  ('Orthopedics',       'ORTH', 'OPD', true),
  ('Pediatrics',        'PED',  'OPD', true),
  ('Gynecology',        'GYN',  'OPD', true),
  ('Dermatology',       'DERM', 'OPD', true),
  ('ENT',               'ENT',  'OPD', true),
  ('Neurology',         'NEURO','OPD', true),
  ('Diabetology',       'DIAB', 'OPD', true),
  ('Ophthalmology',     'OPTH', 'OPD', true),
  ('Lab',               'LAB',  'Diagnostic', true),
  ('Pharmacy',          'PHAR', 'Pharmacy', true)
ON CONFLICT DO NOTHING;

INSERT INTO consultation_types (type_name, type_code, default_fee) VALUES
  ('New Consultation',   'NEW',       300),
  ('Follow-up',          'FOLLOWUP',  150),
  ('Revisit',            'REVISIT',   200),
  ('Emergency',          'EMERGENCY', 500)
ON CONFLICT DO NOTHING;

INSERT INTO notification_templates (event_type, channel, subject, body) VALUES
  ('appointment_booked',   'sms', NULL, 'Dear {{patient_name}}, your appointment is confirmed for {{appointment_date}} at {{appointment_time}}. Booking ID: {{booking_id}}. - CareOpsX'),
  ('appointment_reminder', 'sms', NULL, 'Reminder: Your appointment at CareOpsX is tomorrow at {{appointment_time}}. Please arrive 10 mins early. - CareOpsX'),
  ('follow_up_due',        'sms', NULL, 'Dear {{patient_name}}, your follow-up visit is scheduled for {{follow_up_date}}. Please book your appointment. - CareOpsX'),
  ('missed_follow_up',     'sms', NULL, 'Dear {{patient_name}}, we noticed you missed your follow-up on {{follow_up_date}}. Please call us to reschedule. - CareOpsX'),
  ('lab_report_ready',     'sms', NULL, 'Dear {{patient_name}}, your lab report is ready. Please collect it from the lab counter. - CareOpsX'),
  ('payment_confirmation', 'sms', NULL, 'Payment of Rs {{amount}} received against Invoice {{invoice_number}}. Thank you. - CareOpsX')
ON CONFLICT DO NOTHING;

INSERT INTO drop_off_rules (rule_name, trigger, days, risk_score, risk_level, description) VALUES
  ('Lab Not Collected',          'lab_not_collected',       5,    30, 'medium',   'Lab test not collected within 5 days of ordering'),
  ('No Return After Report',     'no_return_after_report',  7,    40, 'high',     'Patient did not return within 7 days after report was ready'),
  ('Chronic Missed Follow-up',   'chronic_missed_followup', NULL, 60, 'high',     'Chronic disease patient missed a follow-up appointment'),
  ('Repeated No-Show',           'repeated_no_show',        NULL, 50, 'high',     'Patient had 2 or more no-show appointments'),
  ('Multiple Missed Follow-ups', 'missed_followup_critical',NULL, 80, 'critical', 'Patient missed 2 or more follow-ups')
ON CONFLICT DO NOTHING;

-- ============================================================
-- End of schema
-- ============================================================
