# CareOpsX

CareOpsX is a full-stack hospital and clinic operations platform built to manage the patient journey from appointment booking through consultation, billing, lab work, pharmacy fulfillment, follow-ups, notifications, and reporting.

The project combines:

- A `Next.js` frontend for patients and internal staff
- An `Express.js` backend API for operational workflows
- A `Supabase/Postgres` database layer for clinical and administrative data
- Background jobs for reminders, follow-up scanning, drop-off tracking, and stock alerts

## What This Project Is For

CareOpsX is designed to help hospitals, clinics, and outpatient teams run day-to-day operations from one system instead of spreading work across separate tools.

It is intended to support:

- Patient self-service appointment booking
- Front-desk and receptionist workflows
- Doctor consultation and patient history access
- Billing and payment collection
- Lab order and report management
- Pharmacy inventory and dispensing
- Admin oversight, audit trails, notifications, and analytics

## What It Does

At a high level, CareOpsX provides:

- Public patient booking flows
- Role-based dashboards for `Admin`, `Doctor`, `Patient`, `Receptionist`, `Lab Staff`, `Pharmacist`, and `Reporting`
- Doctor setup, availability, and leave management
- Appointment scheduling, rescheduling, and lifecycle tracking
- Queue token generation and live lobby display
- Consultation notes, prescriptions, and lab orders
- Patient profile management and duplicate checking/merge support
- Invoice creation, payment recording, and refund support
- Lab test catalog, lab order tracking, report upload, correction, and delivery
- Pharmacy inventory, stock alerts, barcode lookup, billing, and dispensing
- Notification templates and manual/automated notifications
- Follow-up tracking and missed follow-up workflows
- Drop-off watchlists and rule-based monitoring
- Audit logs and operational analytics dashboards

## How It Helps

CareOpsX helps healthcare teams by:

- Reducing manual coordination between departments
- Improving visibility across booking, consultation, billing, lab, and pharmacy workflows
- Making patient movement through the hospital easier to track
- Supporting role-based access so each team sees the tools they need
- Reducing missed appointments with reminders and follow-up tracking
- Providing administrators with auditability and reporting

## How It Works

### Architecture

The repository is split into two main applications:

- `frontend/`: Next.js app router frontend
- `backend/`: Express API and background jobs

The frontend calls the backend over HTTP using `NEXT_PUBLIC_API_URL`. The backend connects to Supabase using the JavaScript client and uses JWT-based authentication for protected routes.

### Main Flow

Typical workflow through the system:

1. A patient registers or logs in.
2. The patient books an appointment or staff create/manage patients and bookings.
3. Reception/admin teams manage schedules, queue tokens, and billing.
4. Doctors access queues, consultation history, prescriptions, and lab ordering.
5. Lab and pharmacy teams process downstream orders.
6. Notifications, reminders, and follow-up tasks run through API flows and scheduled jobs.
7. Admin/reporting users monitor operations through analytics and audit logs.

### User Roles

Role IDs currently used in the project:

- `1`: Admin
- `2`: Doctor
- `3`: Patient
- `5`: Receptionist
- `6`: Lab Staff
- `7`: Pharmacist
- `8`: Reporting

## Project Structure

```text
care_opsx/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── jobs/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   ├── utils/
│   │   └── index.js
│   └── package.json
├── frontend/
│   ├── app/
│   ├── lib/
│   ├── public/
│   └── package.json
├── SUPABASE_SCHEMA.sql
└── README.md
```

## Frontend Overview

The frontend is a `Next.js` application that includes:

- Public landing page
- Login, register, forgot-password, and reset-password flows
- Patient pages for booking, dashboard, profile, lab, payments, prescriptions, and follow-ups
- Doctor pages for dashboard, patients, and consultations
- Receptionist pages for dashboard, patients, appointments, billing, and queue
- Lab pages for dashboard, orders, and reports
- Pharmacy pages for dashboard, alerts, inventory, and billing
- Admin pages for dashboard, setup, doctors, patients, appointments, billing, lab, pharmacy, notifications, drop-off, analytics, and audit
- Public lobby display page for queue visibility

## Backend Overview

The backend exposes modules for:

- `auth`
- `appointments`
- `doctors`
- `patients`
- `billing`
- `admin`
- `queue`
- `consultations`
- `lab`
- `pharmacy`
- `notifications`
- `followups`
- `analytics`
- `audit`
- `dropoff`
- `payment-requests`

Health endpoint:

- `GET /health`

### Background Jobs

These jobs are loaded when the backend starts:

- `reminders`
- `followupScanner`
- `dropoffEngine`
- `stockAlerts`

## Database

The project uses Supabase/Postgres. The schema bootstrap and extension script is provided in:

- [SUPABASE_SCHEMA.sql](/Users/abhinay/Documents/scube%20solutions/ScubeProjects/care_opsx/SUPABASE_SCHEMA.sql)

This schema includes extensions to existing tables and adds operational tables such as:

- `hospital_profile`
- `branches`
- `departments`
- `consultation_types`
- `doctor_leaves`
- `queue_tokens`
- `consultations`
- plus related billing, follow-up, lab, pharmacy, and audit-supporting structures

## Tech Stack

- Frontend: `Next.js 16`, `React 19`
- Backend: `Node.js`, `Express 5`
- Database: `Supabase`, `PostgreSQL`
- Auth: `JWT`
- Validation: `Joi`
- Scheduling/background jobs: `node-cron`

## Prerequisites

Before running the project locally, make sure you have:

- `Node.js` installed
- `npm` installed
- A Supabase project/database
- Required environment variables configured for frontend and backend

## Environment Variables

### Backend

Create a file at `backend/.env` with values similar to:

```env
PORT=5000
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your_jwt_secret

SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

FAST2SMS_API_KEY=your_fast2sms_key
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=noreply@careopsx.co.in
```

Notes:

- `FAST2SMS_API_KEY` is used for SMS notifications.
- `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` are used for email delivery.
- If notification keys are missing, parts of the notification utility fall back to dry-run logging instead of sending.

### Frontend

Create a file at `frontend/.env.local` with:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## How To Run The Project

### 1. Install dependencies

Backend:

```bash
cd backend
npm install
```

Frontend:

```bash
cd frontend
npm install
```

### 2. Set up the database

Run the SQL in `SUPABASE_SCHEMA.sql` against your Supabase database.

### 3. Start the backend

```bash
cd backend
npm run dev
```

The backend runs on:

- `http://localhost:5000`

Health check:

- `http://localhost:5000/health`

### 4. Start the frontend

In a separate terminal:

```bash
cd frontend
npm run dev
```

The frontend runs on:

- `http://localhost:3000`

## Available Scripts

### Backend scripts

```bash
npm run dev
npm start
```

### Frontend scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Core Modules Explained

### Appointments and Scheduling

- Patients can browse and book appointments
- Admin/staff can manage doctor availability
- Appointment slots are generated from doctor availability
- Appointment status changes are tracked through the lifecycle

### Queue Management

- Queue tokens can be generated for patients
- Live queue endpoints support doctor queue operations
- A lobby display page is available for public viewing

### Consultations

- Doctors can create and update consultations
- Prescriptions and lab orders are generated from consultations
- Patient history is accessible during care delivery

### Billing and Payments

- Invoices can be created for consultations and other services
- Payments can be recorded and refunds processed
- Separate flows exist for patient invoices and reception/payment views

### Lab Operations

- Lab tests can be managed from admin setup
- Orders move through operational statuses
- Reports can be uploaded, corrected, and delivered

### Pharmacy Operations

- Pharmacy inventory can be created, updated, and imported in bulk
- Stock alerts highlight low inventory
- Prescriptions feed into pharmacy billing and dispensing flows

### Notifications and Follow-Ups

- Notification templates can be managed by admins
- Manual and automated notification flows are supported
- Follow-up tracking helps manage post-consultation continuity

### Analytics and Audit

- Analytics endpoints cover dashboards, revenue, patient volume, doctor performance, lab, pharmacy, and follow-up summaries
- Audit logs support visibility into administrative and clinical operations

## API Notes

The backend uses JWT-protected routes for most operational features. Public-facing flows currently include:

- Authentication endpoints such as registration and login
- Public appointment slot lookup
- Public or semi-public payment-request status checks
- Public lobby queue display

## Current Repo Notes

- There is no root-level combined startup script yet; frontend and backend are started separately.
- `frontend/README.md` still contains the default Next.js starter content.
- The project includes `test.sh`, which appears to be a legacy API test script and may not match every current route or response shape.
- `frontend/public/home.html` is a standalone static landing page with its own auth modal. It uses a dynamic API base URL to support both local development and production:

  ```js
  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://care-opsx-api.vercel.app';
  ```

  All fetch calls in that file use `API_BASE` as the prefix. If the production API domain changes, update this value in `home.html`.

## Recommended Development Flow

1. Start Supabase and configure the schema.
2. Run the backend first.
3. Run the frontend second.
4. Verify `/health` on the backend.
5. Open the frontend and test login/booking flows.

## Future README Enhancements

As the project evolves, this README can later be extended with:

- Screenshots of each role dashboard
- Deployment instructions
- Seed/demo account details
- API endpoint reference tables
- Architecture diagrams
- Test coverage and QA instructions

## Summary

CareOpsX is a role-based healthcare operations platform focused on making hospital workflows more connected, trackable, and efficient. It brings together scheduling, patient handling, consultations, billing, lab, pharmacy, follow-up, and reporting into one application stack.
