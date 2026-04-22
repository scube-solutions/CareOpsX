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
-- DONE — All tables and indexes created.
-- ============================================================
