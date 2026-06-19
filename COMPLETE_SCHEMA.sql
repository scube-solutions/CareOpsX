-- ============================================================
-- CareOpsX — Bare-Metal PostgreSQL 18 Compatible Schema
-- Flattened and Optimized
-- Supabase-specific dependencies removed.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";;

CREATE SCHEMA IF NOT EXISTS superadmin;;

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
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ,
  organization_id BIGINT REFERENCES organizations(id),
  otp_code      text,
  otp_expiry    timestamptz,
  otp_purpose   text,
  failed_login_attempts int DEFAULT 0,
  locked_until          timestamptz,
  last_login_at         timestamptz,
  two_factor_enabled boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
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
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ,
  organization_id BIGINT REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS doctors (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
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
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ,
  organization_id BIGINT REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS appointments (
  id BIGSERIAL PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  doctor_id BIGINT NOT NULL REFERENCES doctors(id),
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
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ,
  organization_id BIGINT REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
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
  refunded_by UUID REFERENCES users(id),
  refunded_at TIMESTAMPTZ,
  branch_id BIGINT,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ,
  organization_id BIGINT REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  amount DECIMAL(10,2) NOT NULL,
  payment_mode TEXT NOT NULL,
  payment_date TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'completed',
  transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  organization_id BIGINT REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS lab_test_catalog (
  id BIGSERIAL PRIMARY KEY,
  test_name TEXT NOT NULL,
  test_code TEXT,
  category TEXT,
  fee DECIMAL(10,2) DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT REFERENCES organizations(id)
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
  created_by      UUID REFERENCES users(id),
  updated_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT REFERENCES organizations(id)
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
  created_by      UUID REFERENCES users(id),
  updated_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT REFERENCES organizations(id)
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
  branch_id                BIGINT REFERENCES branches(id),
  created_by               UUID REFERENCES users(id),
  updated_by               UUID REFERENCES users(id),
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS consultation_types (
  id            BIGSERIAL PRIMARY KEY,
  type_name     TEXT NOT NULL,
  type_code     TEXT NOT NULL UNIQUE,
  default_fee   DECIMAL(10,2),
  description   TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_by    UUID REFERENCES users(id),
  updated_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS doctor_leaves (
  id          BIGSERIAL PRIMARY KEY,
  doctor_id   BIGINT NOT NULL REFERENCES doctors(id),
  leave_date  DATE NOT NULL,
  leave_type  TEXT DEFAULT 'full_day',
  reason      TEXT,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS queue_tokens (
  id               BIGSERIAL PRIMARY KEY,
  appointment_id   BIGINT REFERENCES appointments(id),
  patient_id       UUID NOT NULL REFERENCES patients(id),
  doctor_id        BIGINT NOT NULL REFERENCES doctors(id),
  branch_id        BIGINT REFERENCES branches(id),
  token_number     INTEGER NOT NULL,
  token_date       DATE NOT NULL,
  status           TEXT DEFAULT 'waiting',
  priority         TEXT DEFAULT 'normal',
  checked_in_at    TIMESTAMPTZ,
  called_at        TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_by       UUID REFERENCES users(id),
  updated_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT REFERENCES organizations(id),
  call_count     int DEFAULT 0,
  last_called_at timestamptz
);

CREATE TABLE IF NOT EXISTS consultations (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id           UUID NOT NULL REFERENCES patients(id),
  appointment_id       BIGINT REFERENCES appointments(id),
  doctor_id            BIGINT NOT NULL REFERENCES doctors(id),
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
  created_by           UUID REFERENCES users(id),
  updated_by           UUID REFERENCES users(id),
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ,
  organization_id BIGINT REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id               BIGSERIAL PRIMARY KEY,
  patient_id       UUID NOT NULL REFERENCES patients(id),
  consultation_id  UUID REFERENCES consultations(id),
  appointment_id   BIGINT REFERENCES appointments(id),
  doctor_id        BIGINT NOT NULL REFERENCES doctors(id),
  notes            TEXT,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id               BIGSERIAL PRIMARY KEY,
  prescription_id  BIGINT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medicine_name    TEXT NOT NULL,
  dosage           TEXT,
  frequency        TEXT,
  duration         TEXT,
  route            TEXT,
  instructions     TEXT
);

CREATE TABLE IF NOT EXISTS lab_orders (
  id                       BIGSERIAL PRIMARY KEY,
  patient_id               UUID NOT NULL REFERENCES patients(id),
  consultation_id          UUID REFERENCES consultations(id),
  appointment_id           BIGINT REFERENCES appointments(id),
  doctor_id                BIGINT NOT NULL REFERENCES doctors(id),
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
  created_by               UUID REFERENCES users(id),
  updated_by               UUID REFERENCES users(id),
  updated_at               TIMESTAMPTZ,
  organization_id BIGINT REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS lab_reports (
  id               BIGSERIAL PRIMARY KEY,
  lab_order_id     BIGINT NOT NULL REFERENCES lab_orders(id),
  patient_id       UUID NOT NULL REFERENCES patients(id),
  doctor_id        BIGINT REFERENCES doctors(id),
  consultation_id  UUID REFERENCES consultations(id),
  report_data      JSONB,
  report_url       TEXT,
  findings         TEXT,
  remarks          TEXT,
  is_normal        BOOLEAN,
  status           TEXT DEFAULT 'ready',
  uploaded_by      UUID REFERENCES users(id),
  uploaded_at      TIMESTAMPTZ DEFAULT now(),
  corrected_by     UUID REFERENCES users(id),
  corrected_at     TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  delivered_by     UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id          BIGSERIAL PRIMARY KEY,
  invoice_id  BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
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
  created_by      UUID REFERENCES users(id),
  updated_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ,
  organization_id BIGINT REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS pharmacy_invoices (
  id               BIGSERIAL PRIMARY KEY,
  patient_id       UUID NOT NULL REFERENCES patients(id),
  prescription_id  BIGINT REFERENCES prescriptions(id),
  consultation_id  UUID REFERENCES consultations(id),
  subtotal         DECIMAL(10,2) DEFAULT 0,
  discount         DECIMAL(10,2) DEFAULT 0,
  total_amount     DECIMAL(10,2) DEFAULT 0,
  amount_paid      DECIMAL(10,2) DEFAULT 0,
  payment_mode     TEXT,
  status           TEXT DEFAULT 'pending',
  notes            TEXT,
  dispensed_by     UUID REFERENCES users(id),
  dispensed_at     TIMESTAMPTZ,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS pharmacy_invoice_items (
  id                   BIGSERIAL PRIMARY KEY,
  pharmacy_invoice_id  BIGINT NOT NULL REFERENCES pharmacy_invoices(id) ON DELETE CASCADE,
  medicine_id          BIGINT NOT NULL REFERENCES pharmacy_inventory(id),
  medicine_name        TEXT NOT NULL,
  quantity             INTEGER NOT NULL,
  unit_price           DECIMAL(10,2) NOT NULL,
  total_price          DECIMAL(10,2) NOT NULL,
  is_partial           BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS follow_up_plans (
  id                 BIGSERIAL PRIMARY KEY,
  patient_id         UUID NOT NULL REFERENCES patients(id),
  doctor_id          BIGINT REFERENCES doctors(id),
  consultation_id    UUID REFERENCES consultations(id),
  follow_up_date     DATE NOT NULL,
  required_tests     TEXT,
  medication_refill  BOOLEAN DEFAULT false,
  notes              TEXT,
  disease_tag        TEXT,
  status             TEXT DEFAULT 'scheduled',
  reminder_sent      BOOLEAN DEFAULT false,
  created_by         UUID REFERENCES users(id),
  updated_by         UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ,
  organization_id BIGINT REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS notification_templates (
  id          BIGSERIAL PRIMARY KEY,
  event_type  TEXT NOT NULL,
  channel     TEXT NOT NULL,
  subject     TEXT,
  body        TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_by  UUID REFERENCES users(id),
  updated_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ,
  UNIQUE(event_type, channel),
  organization_id bigint REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id               BIGSERIAL PRIMARY KEY,
  patient_id       UUID REFERENCES patients(id),
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
  sent_by          UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  organization_id bigint REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES users(id),
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
  organization_id bigint REFERENCES organizations(id)
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
  created_by   UUID REFERENCES users(id),
  updated_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ,
  organization_id bigint REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS drop_off_watchlist (
  id               BIGSERIAL PRIMARY KEY,
  patient_id       UUID NOT NULL REFERENCES patients(id),
  risk_score       INTEGER DEFAULT 0,
  risk_level       TEXT DEFAULT 'medium',
  risk_reason      TEXT,
  trigger_type     TEXT,
  outcome          TEXT DEFAULT 'at_risk',
  action_history   JSONB DEFAULT '[]',
  last_action_at   TIMESTAMPTZ,
  last_action_by   UUID REFERENCES users(id),
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ,
  organization_id bigint REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS patient_journey_log (
  id              BIGSERIAL PRIMARY KEY,
  patient_id      UUID NOT NULL REFERENCES patients(id),
  appointment_id  BIGINT REFERENCES appointments(id),
  location        TEXT NOT NULL,
  notes           TEXT,
  logged_by       UUID REFERENCES users(id),
  logged_at       TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS specializations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  organization_id BIGINT REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS doctor_blocked_slots (
  id           BIGSERIAL PRIMARY KEY,
  doctor_id    UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  blocked_time TIME NOT NULL,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(doctor_id, blocked_date, blocked_time)
);

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
  portal_access     JSONB DEFAULT '{"admin": true,
  "doctor": true,
  "patient": true,
  "reception": true,
  "lab": true,
  "pharmacy": true,
  "analytics": true}',
  seat_limits       JSONB DEFAULT '{"admin": 2,
  "receptionist": 2,
  "pharmacist": 1,
  "reporting": 1}',
  notes             TEXT,
  contract_start    DATE,
  contract_end      DATE,
  last_payment_at   TIMESTAMPTZ,
  next_payment_due  TIMESTAMPTZ,
  paused_at         TIMESTAMPTZ,
  suspended_at      TIMESTAMPTZ,
  created_by        UUID REFERENCES users(id),
  updated_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  plan          text DEFAULT 'trial',
  feature_flags jsonb DEFAULT
  '{"ai_assistant": true
);

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
  role            text NOT NULL,
  content         text,
  tools_used      jsonb,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_plans (
  key            text PRIMARY KEY,
  label          text NOT NULL,
  manual         boolean DEFAULT false,
  monthly_price  numeric DEFAULT 0,
  portal_access  jsonb DEFAULT '{}'::jsonb,
  seat_limits    jsonb DEFAULT '{}'::jsonb,
  feature_flags  jsonb DEFAULT '{}'::jsonb,
  sort_order     int DEFAULT 0,
  updated_by     uuid,
  updated_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id bigint REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  request_type    text NOT NULL,
  feature         text,
  target_plan     text,
  message         text,
  status          text DEFAULT 'pending',
  admin_note      text,
  handled_by      uuid,
  handled_at      timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS queue_settings (
  organization_id     bigint PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  voice_enabled       boolean DEFAULT true,
  voice_name          text,
  voice_lang          text DEFAULT 'en-IN',
  voice_gender        text DEFAULT 'female',
  volume              numeric DEFAULT 1.0,
  rate                numeric DEFAULT 1.0,
  pitch               numeric DEFAULT 1.0,
  repeat_count        int DEFAULT 3,
  repeat_interval_sec int DEFAULT 10,
  announce_template   text DEFAULT 'Attention please. Token number {token},
  {name},
  please proceed to {doctor},
  consultation room {room}.',
  updated_by          uuid,
  updated_at          timestamptz DEFAULT now()
);

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
  portal_access     JSONB DEFAULT '{"admin":true,
  "doctor":true,
  "patient":true,
  "reception":true,
  "lab":true,
  "pharmacy":true,
  "analytics":true}',
  seat_limits       JSONB DEFAULT '{"admin":2,
  "doctor":3,
  "patient":-1,
  "receptionist":2,
  "lab":1,
  "pharmacist":1,
  "reporting":1}',
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
  org_id       BIGINT REFERENCES superadmin.organizations(id),
  token        TEXT NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  requested_by UUID,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_profiles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   bigint REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES users(id) ON DELETE CASCADE,
  employee_id       text,
  department        text,
  designation       text,
  employment_type   text CHECK (employment_type IN ('Full-Time','Part-Time','Contract','Intern')),
  date_of_joining   date,
  blood_group       text,
  emergency_contact text,
  address           text,
  is_active         boolean DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id),
  full_name         text,
  email             text,
  mobile            text,
  role_id           int,
  employment_status text DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS attendance_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   bigint REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES users(id) ON DELETE CASCADE,
  date              date NOT NULL,
  status            text CHECK (status IN ('present','absent','half_day','late','on_leave','holiday')),
  check_in          time,
  check_out         time,
  notes             text,
  marked_by         uuid REFERENCES users(id),
  created_at        timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS shifts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   bigint REFERENCES organizations(id) ON DELETE CASCADE,
  shift_name        text NOT NULL,
  start_time        time,
  end_time          time,
  break_minutes     int DEFAULT 30,
  days_of_week      text[],
  color             text DEFAULT '#00b4a0',
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_leave_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   bigint REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES users(id) ON DELETE CASCADE,
  leave_type        text,
  from_date         date,
  to_date           date,
  reason            text,
  status            text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  remarks           text,
  reviewed_by       uuid REFERENCES users(id),
  reviewed_at       timestamptz,
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salary_structures (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   bigint REFERENCES organizations(id) ON DELETE CASCADE,
  grade             text,
  role_id           int,
  basic_salary      numeric DEFAULT 0,
  hra               numeric DEFAULT 0,
  allowances        numeric DEFAULT 0,
  deductions        numeric DEFAULT 0,
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   bigint REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES users(id) ON DELETE CASCADE,
  pay_month         text NOT NULL,
  basic_salary      numeric DEFAULT 0,
  hra               numeric DEFAULT 0,
  allowances        numeric DEFAULT 0,
  deductions        numeric DEFAULT 0,
  gross_salary      numeric DEFAULT 0,
  net_salary        numeric DEFAULT 0,
  status            text DEFAULT 'generated',
  generated_by      uuid REFERENCES users(id),
  created_at        timestamptz DEFAULT now(),
  UNIQUE(user_id, pay_month)
);

CREATE TABLE IF NOT EXISTS hospital_rooms (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   bigint REFERENCES organizations(id) ON DELETE CASCADE,
  room_name         text NOT NULL,
  room_type         text,
  total_beds        int DEFAULT 1,
  available_beds    int DEFAULT 1,
  is_active         boolean DEFAULT true,
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointment_payment_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   bigint REFERENCES organizations(id) ON DELETE CASCADE,
  patient_name      text,
  patient_phone     text,
  patient_user_id   uuid REFERENCES users(id),
  doctor_id         uuid,
  doctor_name       text,
  specialty         text,
  appointment_date  date,
  appointment_time  text,
  consultation_fee  numeric,
  status            text DEFAULT 'pending',
  approved_by       uuid REFERENCES users(id),
  approved_at       timestamptz,
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id bigint REFERENCES organizations(id) ON DELETE CASCADE,
  role_id         int  NOT NULL,
  module          text NOT NULL,
  can_view        boolean DEFAULT false,
  can_create      boolean DEFAULT false,
  can_edit        boolean DEFAULT false,
  can_delete      boolean DEFAULT false,
  can_approve     boolean DEFAULT false,
  updated_by      uuid,
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(organization_id, role_id, module)
);

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
ON CONFLICT DO NOTHING;;

INSERT INTO consultation_types (type_name, type_code, default_fee) VALUES
  ('New Consultation',   'NEW',       300),
  ('Follow-up',          'FOLLOWUP',  150),
  ('Revisit',            'REVISIT',   200),
  ('Emergency',          'EMERGENCY', 500)
ON CONFLICT DO NOTHING;;

INSERT INTO notification_templates (event_type, channel, subject, body) VALUES
  ('appointment_booked',   'sms', NULL, 'Dear {{patient_name}}, your appointment is confirmed for {{appointment_date}} at {{appointment_time}}. Booking ID: {{booking_id}}. - CareOpsX'),
  ('appointment_reminder', 'sms', NULL, 'Reminder: Your appointment at CareOpsX is tomorrow at {{appointment_time}}. Please arrive 10 mins early. - CareOpsX'),
  ('follow_up_due',        'sms', NULL, 'Dear {{patient_name}}, your follow-up visit is scheduled for {{follow_up_date}}. Please book your appointment. - CareOpsX'),
  ('missed_follow_up',     'sms', NULL, 'Dear {{patient_name}}, we noticed you missed your follow-up on {{follow_up_date}}. Please call us to reschedule. - CareOpsX'),
  ('lab_report_ready',     'sms', NULL, 'Dear {{patient_name}}, your lab report is ready. Please collect it from the lab counter. - CareOpsX'),
  ('payment_confirmation', 'sms', NULL, 'Payment of Rs {{amount}} received against Invoice {{invoice_number}}. Thank you. - CareOpsX')
ON CONFLICT DO NOTHING;;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);;

CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);;

INSERT INTO drop_off_rules (rule_name, trigger, days, risk_score, risk_level, description) VALUES
  ('Lab Not Collected',        'lab_not_collected',     5,  30, 'medium',   'Lab test not collected within 5 days of ordering'),
  ('No Return After Report',   'no_return_after_report',7,  40, 'high',     'Patient did not return within 7 days after report was ready'),
  ('Chronic Missed Follow-up', 'chronic_missed_followup',NULL,60,'high',   'Chronic disease patient missed a follow-up appointment'),
  ('Repeated No-Show',         'repeated_no_show',      NULL,50,'high',    'Patient had 2 or more no-show appointments'),
  ('Multiple Missed Follow-ups','missed_followup_critical',NULL,80,'critical','Patient missed 2 or more follow-ups')
ON CONFLICT DO NOTHING;;

CREATE INDEX IF NOT EXISTS idx_patients_phone      ON patients(phone);;

CREATE INDEX IF NOT EXISTS idx_patients_uid        ON patients(patient_uid);;

CREATE INDEX IF NOT EXISTS idx_patients_archived   ON patients(is_archived);;

CREATE INDEX IF NOT EXISTS idx_appointments_date   ON appointments(appointment_date);;

CREATE INDEX IF NOT EXISTS idx_appointments_pid    ON appointments(patient_id);;

CREATE INDEX IF NOT EXISTS idx_queue_tokens_date   ON queue_tokens(token_date, doctor_id);;

CREATE INDEX IF NOT EXISTS idx_consultations_pid   ON consultations(patient_id);;

CREATE INDEX IF NOT EXISTS idx_lab_orders_status   ON lab_orders(status);;

CREATE INDEX IF NOT EXISTS idx_lab_orders_pid      ON lab_orders(patient_id);;

CREATE INDEX IF NOT EXISTS idx_followups_date      ON follow_up_plans(follow_up_date, status);;

CREATE INDEX IF NOT EXISTS idx_dropoff_outcome     ON drop_off_watchlist(outcome, risk_level);;

CREATE INDEX IF NOT EXISTS idx_notifications_pid   ON notification_logs(patient_id);;

CREATE INDEX IF NOT EXISTS idx_pharmacy_inv        ON pharmacy_inventory(medicine_name);;

INSERT INTO organizations (organization_name, organization_code, slug, status, billing_status, payment_status)
SELECT 'Default Organization', 'DEFAULT_ORG', 'default-organization', 'active', 'active', 'paid'
WHERE NOT EXISTS (SELECT 1 FROM organizations);;

UPDATE users            SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL AND role_id <> 9;;

UPDATE hospital_profile SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE branches         SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE departments      SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE consultation_types SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE doctor_leaves    SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE specializations  SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE doctors          SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE patients         SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE appointments     SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE invoices         SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE consultations       SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE prescriptions       SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE lab_orders          SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE lab_reports         SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE queue_tokens        SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE pharmacy_inventory  SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE pharmacy_invoices   SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE payments            SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE patient_journey_log SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE follow_up_plans     SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

CREATE INDEX IF NOT EXISTS idx_ai_conv_org_user ON ai_conversations(organization_id, user_id, updated_at DESC);;

CREATE INDEX IF NOT EXISTS idx_ai_msg_conv      ON ai_messages(conversation_id, created_at);;

INSERT INTO organizations (organization_name, organization_code, slug, status, billing_status, payment_status)
SELECT 'Default Organization', 'DEFAULT_ORG', 'default-organization', 'active', 'active', 'paid'
WHERE NOT EXISTS (SELECT 1 FROM organizations);;

UPDATE users             SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL AND role_id <> 9;;

UPDATE hospital_profile  SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE branches          SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE departments       SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE consultation_types SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE doctor_leaves     SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE specializations   SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE doctors           SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE patients          SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE appointments      SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE invoices          SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE consultations     SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE prescriptions     SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE lab_orders        SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE lab_reports       SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE queue_tokens      SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE pharmacy_inventory SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE pharmacy_invoices SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE payments          SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE patient_journey_log SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE follow_up_plans   SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE consultations       SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE prescriptions       SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE lab_orders          SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE lab_reports         SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE queue_tokens        SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE pharmacy_inventory  SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE pharmacy_invoices   SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE payments            SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE patient_journey_log SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

UPDATE follow_up_plans     SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;;

CREATE INDEX IF NOT EXISTS idx_feature_req_status ON feature_requests(status, created_at DESC);;

CREATE INDEX IF NOT EXISTS idx_feature_req_org    ON feature_requests(organization_id, created_at DESC);;

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
ON CONFLICT (id) DO NOTHING;;

SELECT setval(
  pg_get_serial_sequence('superadmin.organizations', 'id'),
  COALESCE((SELECT MAX(id) FROM superadmin.organizations), 1)
);;

INSERT INTO superadmin.audit_log (
  admin_user_id, action, target_org_id, target_role_id,
  details, ip_address, created_at
)
SELECT
  admin_user_id, action, target_org_id, target_role_id,
  details, ip_address, created_at
FROM public.super_admin_audit_log
ON CONFLICT DO NOTHING;;

CREATE OR REPLACE VIEW superadmin.super_admin_users AS
  SELECT id, first_name, last_name, email, phone,
         is_active, created_at, updated_at
  FROM public.users
  WHERE role_id = 9;;

SELECT
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname = 'superadmin'
ORDER BY tablename;;

CREATE INDEX IF NOT EXISTS idx_attendance_org_date  ON attendance_logs(organization_id, date);;

CREATE INDEX IF NOT EXISTS idx_leave_org_status     ON hr_leave_requests(organization_id, status);;

CREATE INDEX IF NOT EXISTS idx_payroll_org_month    ON payroll_records(organization_id, pay_month);;

UPDATE users                     SET organization_id = 1 WHERE organization_id IS NULL AND role_id <> 9;;

UPDATE doctors                   SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE patients                  SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE appointments              SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE consultations             SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE prescriptions             SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE lab_orders                SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE lab_reports               SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE lab_test_catalog          SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE pharmacy_inventory        SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE pharmacy_invoices         SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE invoices                  SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE payments                  SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE queue_tokens              SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE follow_up_plans           SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE branches                  SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE departments               SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE consultation_types        SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE doctor_leaves             SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE specializations           SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE hospital_profile          SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE drop_off_rules            SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE drop_off_watchlist        SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE notification_templates    SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE notification_logs         SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE audit_logs                SET organization_id = 1 WHERE organization_id IS NULL;;

UPDATE appointment_payment_requests SET organization_id = 1 WHERE organization_id IS NULL;;

ALTER TABLE staff_profiles ALTER COLUMN user_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_org_email
  ON staff_profiles(organization_id, lower(email)) WHERE email IS NOT NULL;;

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_org_employee_id
  ON staff_profiles(organization_id, employee_id) WHERE employee_id IS NOT NULL;;

UPDATE users SET account_status = 'active'   WHERE account_status IS NULL AND is_active IS NOT false;;

UPDATE users SET account_status = 'inactive' WHERE account_status IS NULL AND is_active IS false;;

UPDATE users SET account_status = 'active'   WHERE invite_status = 'active';;

UPDATE users SET account_status = 'pending_activation' WHERE invite_status = 'invited';;

UPDATE users SET account_status = 'pending_invitation' WHERE invite_status = 'pending';;

CREATE INDEX IF NOT EXISTS idx_role_perms_org_role ON role_permissions(organization_id, role_id);;

ALTER TABLE organizations "hrms": true;

ALTER TABLE organizations "queue_voice": true}'::jsonb;

UPDATE organizations SET plan = 'trial' WHERE plan IS NULL;;

UPDATE organizations SET feature_flags = '{"ai_assistant": true, "hrms": true, "queue_voice": true}'::jsonb
  WHERE feature_flags IS NULL;;

