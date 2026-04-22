# CareOpsX

Hospital management system for small clinics and hospitals. Manage patients, staff, appointments, billing, pharmacy, lab, and queues in one platform.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Backend | Node.js, Express 5 |
| Database | Supabase (PostgreSQL) |
| Auth | JWT |
| Notifications | SendGrid (email), Fast2SMS (SMS) |

---

## Features

- **Auth & Roles** — Admin, Doctor, Receptionist, Pharmacist, Lab Technician, Patient
- **Appointments** — Book, manage, and track appointments with queue management
- **Consultations** — Doctor consultation notes and prescriptions
- **Billing** — Invoice generation and payment request tracking
- **Pharmacy** — Inventory management, stock alerts, billing
- **Lab** — Order management and report tracking
- **Patient Portal** — Self-service booking, prescriptions, lab results, follow-ups
- **Analytics** — Admin analytics dashboard
- **Audit Logs** — Track all system actions
- **Automated Jobs** — Follow-up scanner, drop-off engine, stock alerts, appointment reminders

---

## Project Structure

```
CareOpsX/
├── backend/                  # Express API server
│   ├── src/
│   │   ├── controllers/      # Route handlers
│   │   ├── routes/           # API route definitions
│   │   ├── middlewares/      # Auth, role-check, audit
│   │   ├── jobs/             # Cron jobs (reminders, alerts)
│   │   ├── services/         # Business logic
│   │   ├── models/           # Data models
│   │   └── utils/            # Supabase client, notifications
│   ├── .env.example          # Environment variable template
│   └── package.json
├── frontend/                 # Next.js app
│   ├── app/
│   │   ├── admin/            # Admin dashboard pages
│   │   ├── doctor/           # Doctor portal pages
│   │   ├── patient/          # Patient portal pages
│   │   ├── receptionist/     # Receptionist portal pages
│   │   ├── pharmacy/         # Pharmacy portal pages
│   │   ├── lab/              # Lab portal pages
│   │   ├── lobby/            # Queue lobby display
│   │   └── login/            # Authentication
│   └── package.json
└── SUPABASE_SCHEMA.sql       # Database schema
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project

### 1. Database Setup

Run `SUPABASE_SCHEMA.sql` in your Supabase SQL editor to create all tables.

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Fill in .env with your credentials
npm run dev
```

Backend runs on `http://localhost:5000`.

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Description |
|----------|-------------|
| `PORT` | Backend server port (default: 5000) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon or service role key |
| `JWT_SECRET` | Secret key for JWT signing |
| `FAST2SMS_API_KEY` | Fast2SMS API key for SMS notifications |
| `SENDGRID_API_KEY` | SendGrid API key for email notifications |
| `SENDGRID_FROM_EMAIL` | Sender email address |

---

## API Endpoints

| Module | Base Path |
|--------|-----------|
| Auth | `/api/auth` |
| Patients | `/api/patients` |
| Appointments | `/api/appointments` |
| Doctors | `/api/doctors` |
| Consultations | `/api/consultations` |
| Billing | `/api/billing` |
| Pharmacy | `/api/pharmacy` |
| Lab | `/api/lab` |
| Queue | `/api/queue` |
| Notifications | `/api/notifications` |
| Analytics | `/api/analytics` |
| Audit | `/api/audit` |
| Admin | `/api/admin` |

---

## License

MIT
