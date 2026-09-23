# CareOpsX — Hospital Management Platform

![CareOpsX Logo](careopsx_logo.png)

> **App (Frontend):** https://careopsx.co.in/
>
> **API (Backend):** https://api.careopsx.co.in/
>
> **GitHub Repo:** https://github.com/scube-solutions/CareOpsX

A full-stack, role-based hospital operations platform that brings together scheduling, patient handling, consultations, billing, lab, pharmacy, follow-up, and reporting into one connected application.

---

## Architecture

```
CareOpsX/
├── backend/          # Node.js + Express REST API  →  api.careopsx.co.in
└── frontend/         # Next.js (App Router)        →  careopsx.co.in
```

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express.js |
| Frontend | Next.js 15 (App Router), React |
| Database | PostgreSQL (self-hosted via Coolify) |
| Auth | JWT |
| Email | Nodemailer (SMTP) / SendGrid |
| SMS | Fast2SMS |
| Payments | Razorpay |
| Deployment | Coolify (Docker) |

---

## Roles

| Role | Description |
|------|-------------|
| Super Admin | Platform-level management across all orgs |
| Admin | Clinic/hospital admin |
| Doctor | Consultations, prescriptions, queue |
| Receptionist | Appointments, check-in, billing |
| Lab | Lab orders and reports |
| Pharmacy | Inventory and dispensing |
| Patient | Booking, history, reports |

---

## Key Features

- 📅 Appointment booking and slot management
- 🔢 Queue management with live lobby display
- 🩺 Consultations, prescriptions, lab orders
- 🧾 Billing, invoices, payments, refunds
- 🧪 Lab operations — orders, reports, delivery
- 💊 Pharmacy inventory, stock alerts, dispensing
- 📲 Notification system (email / SMS)
- 📊 Analytics dashboards (revenue, volume, performance)
- 📋 Audit logs
- 💳 Subscription plans with Razorpay integration

---

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL database
- SMTP credentials (Gmail App Password or Hostinger)

### Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=your_jwt_secret

# Email (choose one)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_16char_app_password
SMTP_FROM=your@gmail.com

# Optional
FAST2SMS_API_KEY=...
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
```

```bash
npm run dev       # starts on http://localhost:5000
```

Health check: http://localhost:5000/health

### Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id
```

```bash
npm run dev       # starts on http://localhost:3000
```

---

## Database Setup

Run the SQL in `COMPLETE_SCHEMA.sql` (PostgreSQL 18 compatible) against your database.

Migration files are also available individually:

| File | Purpose |
|------|---------|
| `COMPLETE_SCHEMA.sql` | Full unified schema |
| `migration_phase1_org_isolation.sql` | Org isolation |
| `migration_subscription_plans.sql` | Plans & features |
| `migration_queue_voice.sql` | Queue & voice |
| `migration_ai_assistant.sql` | AI assistant |
| `migration_session_additions.sql` | Sessions |

---

## Git Branches

| Branch | Description |
|--------|-------------|
| `main` | Production-ready code, deployed to Coolify |
| `registration` | Registration flow experiments |
| `backup-before-reword` | Backup snapshot |
| `feature/customization-and-enhancements` | Feature work |

---

## Deployment

Deployed via **Coolify** (self-hosted) with Docker.

- **Backend** → `api.careopsx.co.in`
- **Frontend** → `careopsx.co.in`

---

## Contact

- **Email:** info@careopsx.co.in
- **Phone:** +91 96666 69377
- **Address:** 18-399/6/C/1, Shadnagar, Hyderabad – 509216
- **Built by:** Scube Solutions

---

## Last Updated

June 2026 — Latest: activation-link email for clinic signup, Supabase fully removed, migrated to self-hosted PostgreSQL.
