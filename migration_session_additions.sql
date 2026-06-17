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
