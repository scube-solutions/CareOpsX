-- ============================================================
-- CareOpsX COMPLETE SCHEMA (PostgreSQL Bootstrap)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Base Tables (Historically provided by initial setup) ──

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
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS doctors (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  specialization TEXT,
  experience_years INTEGER,
  consultation_fee DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointments (
  id BIGSERIAL PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  doctor_id BIGINT NOT NULL REFERENCES doctors(id),
  appointment_date DATE NOT NULL,
  appointment_time TIME,
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  total_amount DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
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
  created_at TIMESTAMPTZ DEFAULT now()
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
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- ============================================================
-- CareOpsX — Complete Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- Run each section separately if needed.
-- ============================================================

-- ── 1. MODIFY EXISTING: users table ──────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS branch_id BIGINT,
  ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Role IDs: 1=Admin, 2=Doctor, 3=Patient, 5=Receptionist, 6=LabStaff, 7=Pharmacist, 8=Reporting
-- (role_id 4 was old Staff — replaced by 5/6/7/8)


-- ── 2. MODIFY EXISTING: patients table ───────────────────────────────────────
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS patient_uid TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS blood_group TEXT,
  ADD COLUMN IF NOT EXISTS alternate_phone TEXT,
  ADD COLUMN IF NOT EXISTS address_line_1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line_2 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS allergies TEXT,
  ADD COLUMN IF NOT EXISTS existing_conditions TEXT,
  ADD COLUMN IF NOT EXISTS chronic_disease_tag TEXT,
  ADD COLUMN IF NOT EXISTS branch_id BIGINT,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS merged_into BIGINT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;


-- ── 3. MODIFY EXISTING: doctors table ────────────────────────────────────────
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS qualification TEXT,
  ADD COLUMN IF NOT EXISTS department_id BIGINT,
  ADD COLUMN IF NOT EXISTS follow_up_fee DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS consultation_duration INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS break_time TEXT,
  ADD COLUMN IF NOT EXISTS room_number TEXT,
  ADD COLUMN IF NOT EXISTS branch_id BIGINT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;


-- ── 4. MODIFY EXISTING: appointments table ───────────────────────────────────
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS appointment_type TEXT DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS token_number INTEGER,
  ADD COLUMN IF NOT EXISTS queue_status TEXT DEFAULT 'booked',
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS called_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consultation_id UUID,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS branch_id BIGINT,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- queue_status values: booked, checked_in, waiting, called, in_consultation, completed, cancelled, no_show, missed


-- ── 5. MODIFY EXISTING: invoices table ───────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'consultation',
  ADD COLUMN IF NOT EXISTS consultation_id UUID,
  ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS refund_payment_mode TEXT,
  ADD COLUMN IF NOT EXISTS refunded_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS branch_id BIGINT,
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- invoice_type values: consultation, lab, pharmacy, procedure, other
-- status values: pending, paid, partial, failed, refunded


-- ── 6. MODIFY EXISTING: payments table ───────────────────────────────────────
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);


-- ============================================================
-- NEW TABLES
-- ============================================================

-- ── 7. hospital_profile ──────────────────────────────────────────────────────
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
  updated_at      TIMESTAMPTZ DEFAULT now()
);


-- ── 8. branches ──────────────────────────────────────────────────────────────
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
  updated_at      TIMESTAMPTZ DEFAULT now()
);


-- ── 9. departments ───────────────────────────────────────────────────────────
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
  updated_at               TIMESTAMPTZ DEFAULT now()
);

-- Seed default departments
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


-- ── 10. consultation_types ───────────────────────────────────────────────────
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
  updated_at    TIMESTAMPTZ DEFAULT now()
);

INSERT INTO consultation_types (type_name, type_code, default_fee) VALUES
  ('New Consultation',   'NEW',       300),
  ('Follow-up',          'FOLLOWUP',  150),
  ('Revisit',            'REVISIT',   200),
  ('Emergency',          'EMERGENCY', 500)
ON CONFLICT DO NOTHING;


-- ── 11. doctor_leaves ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_leaves (
  id          BIGSERIAL PRIMARY KEY,
  doctor_id   BIGINT NOT NULL REFERENCES doctors(id),
  leave_date  DATE NOT NULL,
  leave_type  TEXT DEFAULT 'full_day',
  reason      TEXT,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);


-- ── 12. queue_tokens ─────────────────────────────────────────────────────────
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
  created_at       TIMESTAMPTZ DEFAULT now()
);
-- status values: waiting, called, in_consultation, completed, missed, skipped


-- ── 13. consultations ────────────────────────────────────────────────────────
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
  updated_at           TIMESTAMPTZ
);


-- ── 14. prescriptions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
  id               BIGSERIAL PRIMARY KEY,
  patient_id       UUID NOT NULL REFERENCES patients(id),
  consultation_id  UUID REFERENCES consultations(id),
  appointment_id   BIGINT REFERENCES appointments(id),
  doctor_id        BIGINT NOT NULL REFERENCES doctors(id),
  notes            TEXT,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);


-- ── 15. prescription_items ───────────────────────────────────────────────────
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


-- ── 16. lab_orders ───────────────────────────────────────────────────────────
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
  updated_at               TIMESTAMPTZ
);
-- status values: ordered, sample_collected, processing, ready, delivered, cancelled


-- ── 17. lab_reports ──────────────────────────────────────────────────────────
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
  created_at       TIMESTAMPTZ DEFAULT now()
);
-- status values: ready, delivered, corrected


-- ── 18. invoice_items ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_items (
  id          BIGSERIAL PRIMARY KEY,
  invoice_id  BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    INTEGER DEFAULT 1,
  unit_price  DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  item_type   TEXT DEFAULT 'service'
);


-- ── 19. pharmacy_inventory ───────────────────────────────────────────────────
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
  updated_at      TIMESTAMPTZ
);


-- ── 20. pharmacy_invoices ────────────────────────────────────────────────────
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
  created_at       TIMESTAMPTZ DEFAULT now()
);
-- status values: pending, dispensed, cancelled


-- ── 21. pharmacy_invoice_items ───────────────────────────────────────────────
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


-- ── 22. follow_up_plans ──────────────────────────────────────────────────────
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
  updated_at         TIMESTAMPTZ
);
-- status values: scheduled, completed, missed, cancelled, rescheduled


-- ── 23. notification_templates ───────────────────────────────────────────────
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
  UNIQUE(event_type, channel)
);
-- channel values: sms, email, whatsapp
-- event_type values: appointment_booked, appointment_reminder, patient_called,
--   payment_confirmation, lab_report_ready, follow_up_due, missed_follow_up, drop_off_recovery

-- Seed default SMS templates
INSERT INTO notification_templates (event_type, channel, subject, body) VALUES
  ('appointment_booked',   'sms', NULL, 'Dear {{patient_name}}, your appointment is confirmed for {{appointment_date}} at {{appointment_time}}. Booking ID: {{booking_id}}. - CareOpsX'),
  ('appointment_reminder', 'sms', NULL, 'Reminder: Your appointment at CareOpsX is tomorrow at {{appointment_time}}. Please arrive 10 mins early. - CareOpsX'),
  ('follow_up_due',        'sms', NULL, 'Dear {{patient_name}}, your follow-up visit is scheduled for {{follow_up_date}}. Please book your appointment. - CareOpsX'),
  ('missed_follow_up',     'sms', NULL, 'Dear {{patient_name}}, we noticed you missed your follow-up on {{follow_up_date}}. Please call us to reschedule. - CareOpsX'),
  ('lab_report_ready',     'sms', NULL, 'Dear {{patient_name}}, your lab report is ready. Please collect it from the lab counter. - CareOpsX'),
  ('payment_confirmation', 'sms', NULL, 'Payment of Rs {{amount}} received against Invoice {{invoice_number}}. Thank you. - CareOpsX')
ON CONFLICT DO NOTHING;


-- ── 24. notification_logs ────────────────────────────────────────────────────
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
  created_at       TIMESTAMPTZ DEFAULT now()
);
-- status values: pending, sent, delivered, failed, retried


-- ── 25. audit_logs ───────────────────────────────────────────────────────────
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
  created_at   TIMESTAMPTZ DEFAULT now()
);
-- Add index for fast search
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);


-- ── 26. drop_off_rules ───────────────────────────────────────────────────────
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
  updated_at   TIMESTAMPTZ
);

-- Seed default rules
INSERT INTO drop_off_rules (rule_name, trigger, days, risk_score, risk_level, description) VALUES
  ('Lab Not Collected',        'lab_not_collected',     5,  30, 'medium',   'Lab test not collected within 5 days of ordering'),
  ('No Return After Report',   'no_return_after_report',7,  40, 'high',     'Patient did not return within 7 days after report was ready'),
  ('Chronic Missed Follow-up', 'chronic_missed_followup',NULL,60,'high',   'Chronic disease patient missed a follow-up appointment'),
  ('Repeated No-Show',         'repeated_no_show',      NULL,50,'high',    'Patient had 2 or more no-show appointments'),
  ('Multiple Missed Follow-ups','missed_followup_critical',NULL,80,'critical','Patient missed 2 or more follow-ups')
ON CONFLICT DO NOTHING;


-- ── 27. drop_off_watchlist ───────────────────────────────────────────────────
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
  updated_at       TIMESTAMPTZ
);
-- outcome values: at_risk, still_at_risk, recovered, lost_to_follow_up
-- risk_level values: low, medium, high, critical


-- ── 28. patient_journey_log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_journey_log (
  id              BIGSERIAL PRIMARY KEY,
  patient_id      UUID NOT NULL REFERENCES patients(id),
  appointment_id  BIGINT REFERENCES appointments(id),
  location        TEXT NOT NULL,
  notes           TEXT,
  logged_by       UUID REFERENCES users(id),
  logged_at       TIMESTAMPTZ DEFAULT now()
);
-- location values: lobby, consultation_room, lab, pharmacy, billing, exit


-- ── specializations ───────────────────────────────────────────────────────────
-- Admin-managed list of specializations available in this org
CREATE TABLE IF NOT EXISTS specializations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── doctor_blocked_slots ──────────────────────────────────────────────────────
-- Doctor can block specific time slots on specific dates (overrides recurring schedule)
CREATE TABLE IF NOT EXISTS doctor_blocked_slots (
  id           BIGSERIAL PRIMARY KEY,
  doctor_id    UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  blocked_time TIME NOT NULL,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(doctor_id, blocked_date, blocked_time)
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_patients_phone      ON patients(phone);
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

-- ============================================================
-- SUPER ADMIN / MULTI-ORG FOUNDATION
-- ============================================================
-- Role IDs now include: 9=SuperAdmin

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
  created_by        UUID REFERENCES users(id),
  updated_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE hospital_profile ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE consultation_types ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE doctor_leaves ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE specializations ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS lab_test_catalog ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);

INSERT INTO organizations (organization_name, organization_code, slug, status, billing_status, payment_status)
SELECT 'Default Organization', 'DEFAULT_ORG', 'default-organization', 'active', 'active', 'paid'
WHERE NOT EXISTS (SELECT 1 FROM organizations);

UPDATE users            SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL AND role_id <> 9;
UPDATE hospital_profile SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE branches         SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE departments      SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE consultation_types SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE doctor_leaves    SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE specializations  SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE doctors          SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE patients         SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE appointments     SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;
UPDATE invoices         SET organization_id = (SELECT id FROM organizations ORDER BY id LIMIT 1) WHERE organization_id IS NULL;

-- ============================================================
-- PHASE 1: Add organization_id to all remaining clinical tables
-- ============================================================
ALTER TABLE IF EXISTS consultations         ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS prescriptions         ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS lab_orders            ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS lab_reports           ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS queue_tokens          ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS pharmacy_inventory    ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS pharmacy_invoices     ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS payments              ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS patient_journey_log   ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE IF EXISTS follow_up_plans       ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);

-- Backfill existing rows to default organization
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

-- PHASE 2: Audit log for super admin actions
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

-- ============================================================
-- DONE — All tables and indexes created.
-- ============================================================
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
-- =====================================================================
-- migration_session_additions.sql
-- Consolidated schema additions that were applied directly in Supabase
-- but were missing from the repo's .sql files. Idempotent (safe to re-run).
--
-- Covers:
--   1. Email OTP / verification columns on users
--   2. HRMS tables (staff, attendance, shifts, leave, salary, payroll)
--   3. organization_id columns on tables that lacked them
--   4. Tables referenced by code but not defined in repo
--      (hospital_rooms, appointment_payment_requests)
--   5. Foreign-key ON DELETE behaviour (user refs -> SET NULL,
--      doctor/appointment refs -> CASCADE) so deletes don't get blocked
--   6. Backfill of legacy rows to organization_id = 1
--
-- NOTE: foundational tables (users, patients, doctors, appointments,
-- invoices, payments, lab_results, lab_test_catalog, doctor_availability,
-- follow_ups, notifications) are assumed to already exist in the database
-- (they are referenced by SUPABASE_SCHEMA.sql via ALTER, not CREATE).
-- =====================================================================


-- ─── 1. Email OTP / verification on users ────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code      text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expiry    timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_purpose   text;


-- ─── 2. HRMS tables ──────────────────────────────────────────────────
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
  UNIQUE(organization_id, user_id)
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
  pay_month         text NOT NULL,        -- format YYYY-MM
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

CREATE INDEX IF NOT EXISTS idx_attendance_org_date  ON attendance_logs(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_leave_org_status     ON hr_leave_requests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_payroll_org_month    ON payroll_records(organization_id, pay_month);


-- ─── 3. Hospital rooms (referenced by admin room management) ──────────
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


-- ─── 4. Appointment payment requests (pay-at-reception flow) ──────────
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


-- ─── 5. organization_id on tables that lacked it ─────────────────────
ALTER TABLE drop_off_rules               ADD COLUMN IF NOT EXISTS organization_id bigint REFERENCES organizations(id);
ALTER TABLE drop_off_watchlist           ADD COLUMN IF NOT EXISTS organization_id bigint REFERENCES organizations(id);
ALTER TABLE notification_templates       ADD COLUMN IF NOT EXISTS organization_id bigint REFERENCES organizations(id);
ALTER TABLE notification_logs            ADD COLUMN IF NOT EXISTS organization_id bigint REFERENCES organizations(id);
ALTER TABLE audit_logs                   ADD COLUMN IF NOT EXISTS organization_id bigint REFERENCES organizations(id);
ALTER TABLE appointment_payment_requests ADD COLUMN IF NOT EXISTS organization_id bigint REFERENCES organizations(id);


-- ─── 6. FK ON DELETE behaviour ───────────────────────────────────────
-- Any FK that references public.users(id) -> ON DELETE SET NULL
-- (lets an admin delete a user without orphan-FK errors; clinical rows are kept).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname, rel.relname AS child_table, att.attname AS child_col
    FROM pg_constraint con
    JOIN pg_class rel    ON rel.oid  = con.conrelid
    JOIN pg_namespace ns  ON ns.oid  = rel.relnamespace
    JOIN pg_class fref   ON fref.oid = con.confrelid
    JOIN pg_namespace fns ON fns.oid = fref.relnamespace
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f' AND fref.relname = 'users'
      AND fns.nspname = 'public' AND ns.nspname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', r.child_table, r.child_col);
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.child_table, r.conname);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.users(id) ON DELETE SET NULL', r.child_table, r.conname, r.child_col);
  END LOOP;
END $$;

-- Any FK that references doctors(id) or appointments(id) -> ON DELETE CASCADE
-- (lets an admin delete a doctor; appointments + their dependents cascade).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname, rel.relname AS child_table, att.attname AS child_col, fref.relname AS parent_table
    FROM pg_constraint con
    JOIN pg_class rel    ON rel.oid  = con.conrelid
    JOIN pg_namespace ns  ON ns.oid  = rel.relnamespace
    JOIN pg_class fref   ON fref.oid = con.confrelid
    JOIN pg_namespace fns ON fns.oid = fref.relnamespace
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f' AND fns.nspname = 'public' AND ns.nspname = 'public'
      AND fref.relname IN ('doctors','appointments')
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.child_table, r.conname);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE CASCADE', r.child_table, r.conname, r.child_col, r.parent_table);
  END LOOP;
END $$;


-- ─── 7. Backfill legacy rows to org 1 (Default Organization) ─────────
UPDATE users                     SET organization_id = 1 WHERE organization_id IS NULL AND role_id <> 9;
UPDATE doctors                   SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE patients                  SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE appointments              SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE consultations             SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE prescriptions             SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE lab_orders                SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE lab_reports               SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE lab_test_catalog          SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE pharmacy_inventory        SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE pharmacy_invoices         SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE invoices                  SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE payments                  SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE queue_tokens              SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE follow_up_plans           SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE branches                  SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE departments               SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE consultation_types        SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE doctor_leaves             SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE specializations           SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE hospital_profile          SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE drop_off_rules            SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE drop_off_watchlist        SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE notification_templates    SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE notification_logs         SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE audit_logs                SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE appointment_payment_requests SET organization_id = 1 WHERE organization_id IS NULL;


-- ─── 8. HRMS → User Management sync (employee master + invitations) ───
-- HRMS is the master source of employee records. staff_profiles now stores
-- the employee's own identity fields so an employee can exist WITHOUT a login.
-- When "Create System Login" is enabled, a users row is created and linked.
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS full_name         text;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS email             text;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS mobile            text;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS role_id           int;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS employment_status text DEFAULT 'Active';

-- user_id is now optional (employee may have no system login yet).
ALTER TABLE staff_profiles ALTER COLUMN user_id DROP NOT NULL;

-- Prevent duplicate employees per org (only when the value is present).
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_org_email
  ON staff_profiles(organization_id, lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_org_employee_id
  ON staff_profiles(organization_id, employee_id) WHERE employee_id IS NOT NULL;

-- Invitation / account-activation columns on users.
-- invite_status: NULL (no invite), 'invited' (link sent), 'active' (activated).
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_token        text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_token_expiry timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_status       text;

-- NOTE: mobile uniqueness is enforced in application code (hrController), not via
-- a DB index — patient phone numbers may legitimately repeat (shared family lines),
-- so a global unique index on users(phone) would break existing data.


-- ─── 9. Auth hardening: status, lockout, 2FA ─────────────────────────
-- Unified account lifecycle status (supersedes the boolean is_active for
-- display; is_active is kept in sync for backward compatibility).
--   pending_invitation | pending_activation | active | inactive | suspended
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'active';

-- Failed-login throttling / lockout.
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts int DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until          timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at         timestamptz;

-- Optional two-factor authentication (email OTP challenge at login).
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;

-- Backfill account_status from existing flags (idempotent best-effort).
UPDATE users SET account_status = 'active'   WHERE account_status IS NULL AND is_active IS NOT false;
UPDATE users SET account_status = 'inactive' WHERE account_status IS NULL AND is_active IS false;
UPDATE users SET account_status = 'active'   WHERE invite_status = 'active';
UPDATE users SET account_status = 'pending_activation' WHERE invite_status = 'invited';
UPDATE users SET account_status = 'pending_invitation' WHERE invite_status = 'pending';


-- ─── 10. Granular RBAC permission overrides ──────────────────────────
-- Per-org, per-role, per-module action grid. Rows are OVERRIDES ONLY —
-- when no row exists the application falls back to code defaults
-- (utils/permissions.js DEFAULT_PERMISSIONS). Modules:
--   reception, opd, ipd, laboratory, pharmacy, billing, hrms, reports
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
CREATE INDEX IF NOT EXISTS idx_role_perms_org_role ON role_permissions(organization_id, role_id);
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
