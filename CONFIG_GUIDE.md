# CareOpsX — Configuration & Maintenance Guide

A single reference for changing prices, GST, URLs, keys, plans, and other common edits.
Keep this file as your record. Last structure update: 2026-06.

---

## 1. Backend API URL (where the frontend talks to the server)

| Location | File | What to change |
|---|---|---|
| React app (all dashboards) | Vercel env var **or** `frontend/.env.local` | `NEXT_PUBLIC_API_URL=https://care-opsx.vercel.app` |
| Landing page (`home.html`) | `frontend/public/home.html` (~line 3455) | `const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://care-opsx.vercel.app';` |

> Production backend URL = **https://care-opsx.vercel.app**
> Local backend URL = **http://localhost:5000**
> Always test the URL with `/health` → should return `{"status":"ok","app":"CareOpsX API v2"}`
> No trailing slash on `NEXT_PUBLIC_API_URL` (a trailing `/` causes `//` and CORS errors).

---

## 2. Subscription Prices & GST

### 2a. Admin dashboard (Settings → Subscription)
File: `frontend/app/admin/setup/page.js` (inside `SubscriptionTab`)

```js
const GST_RATE  = 0.18;                              // 18% GST
const PLAN_BASE = { basic: 1499, professional: 2999 }; // base monthly price in ₹
```
- This is the **single source** — both the displayed price and the charged amount use it.
- Change the numbers → display + payment both update.

### 2b. Landing page (`home.html`) pricing cards
File: `frontend/public/home.html`

- **Displayed price** — edit the card text directly:
  - Basic card `.amount` → `₹1,499` (~line 2891)
  - Premium card `.amount` → `₹2,999` (~line 2918)
- **GST rate** (~line 3459):
  ```js
  const GST_RATE = 0.18; // 18% GST
  ```
- The charge is read **live** from the displayed `.amount` text, then GST is added — so just edit the card number.

> Final charge everywhere = base + 18% GST. Razorpay receives the GST-inclusive total in **paise** (₹ × 100).

---

## 3. Razorpay Keys (payments)

| Variable | Where | Notes |
|---|---|---|
| `RAZORPAY_KEY_ID` | `backend/.env` + Vercel backend | `rzp_live_xxx` (public-safe) |
| `RAZORPAY_KEY_SECRET` | `backend/.env` + Vercel backend | secret — **backend only** |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | `frontend/.env.local` + Vercel frontend | same value as `RAZORPAY_KEY_ID` |
| Landing page key (`home.html` ~line 3456) | `frontend/public/home.html` | `const RZ_KEY = ... 'rzp_live_xxx'` — replace `rzp_live_REPLACE_ME` |

Get keys: Razorpay Dashboard → Settings → API Keys → Generate Live Key.

---

## 4. Email / OTP delivery

Provider priority in `backend/src/utils/notify.js`: **SMTP → SendGrid → dry-run**.

### Option A — SMTP (Gmail, recommended)
Add to `backend/.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_16_char_app_password
SMTP_FROM=your_gmail@gmail.com
```
- `SMTP_PASS` must be a Google **App Password** (not the normal password).
- Get it: Google Account → Security → 2-Step Verification (on) → App passwords → "Mail".

### Option B — SendGrid
```
SENDGRID_API_KEY=SG.xxxxxxxx   # must start with "SG." (~69 chars)
SENDGRID_FROM_EMAIL=noreply@careopsx.co.in   # must be a verified sender
```

> If neither is set, OTP is logged to the backend console and (in non-production) returned in the API response as `dev_otp` so you can still test.

Code: `notify.js` → `sendEmail()` picks the provider; `sendOtpEmail()` sends the 6-digit code.
OTP validity: `const OTP_TTL_MS = 10 * 60 * 1000;` (10 min) in `backend/src/controllers/authController.js`.

---

## 5. Auto-logout (inactivity)

File: `frontend/lib/AppShell.js`
```js
const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes → change here
```
- Warning banner appears 2 minutes before logout.
- On logout → `/login?reason=inactivity` (shows a notice).

---

## 6. Roles & Dashboards

File: `frontend/lib/auth.js`
```js
ROLES        = { ADMIN:1, DOCTOR:2, PATIENT:3, RECEPTIONIST:5, LAB:6, PHARMACIST:7, REPORTING:8, SUPER_ADMIN:9 }
getDashboardRoute(role_id) // maps role → landing page after login
```
Sidebars per role: `frontend/app/<role>/layout.js` (e.g. `admin/layout.js`, `doctor/layout.js`).
Add/remove a menu item → edit the `NAV_GROUPS` / `GROUPS` array in that layout (each item: `{ href, label, Icon }`).

---

## 7. HRMS module

- Frontend (single tabbed page): `frontend/app/admin/hr/page.js` (Staff, Attendance, Leave, Payroll, Shifts)
- Backend routes: `backend/src/routes/hr.js`
- Backend logic: `backend/src/controllers/hrController.js`
- DB tables: `staff_profiles`, `attendance_logs`, `shifts`, `hr_leave_requests`, `salary_structures`, `payroll_records`
- Sidebar entry: `admin/layout.js` → HR group → `{ href:'/admin/hr', label:'HRMS' }`

---

## 8. Landing page content (`home.html`)

File: `frontend/public/home.html`
- Logo image: `<img src="careopsx_logo.png">` (file lives in `frontend/public/`)
- Nav links, hero text, features, pricing, Book Demo button (`/book-demo`), contact info — all plain HTML in this file.
- Phone/email/address: search for `+91 96666 69377`, `info@careopsx.co.in`, address block in the contact section.

Book Demo page (separate): `frontend/app/book-demo/page.js`.

---

## 9. CORS (which sites can call the backend)

File: `backend/src/index.js` (top, `app.use(cors({...}))`)
```js
const allowed = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3001', 'http://localhost:3002',
  'https://careopsx.co.in', 'https://www.careopsx.co.in',
];
// also allows any *.vercel.app
```
Add a new domain here if the frontend moves.

---

## 10. Environment variables — full list

### backend/.env
```
PORT=5000
FRONTEND_URL=https://careopsx.co.in
JWT_SECRET=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
FAST2SMS_API_KEY=...
# email (pick one)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=...
# payments
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
```

### frontend/.env.local
```
NEXT_PUBLIC_API_URL=https://care-opsx.vercel.app
NEXT_PUBLIC_RAZORPAY_KEY_ID=...
```

> `.env` files are git-ignored — never commit them. Set the same vars in Vercel → Settings → Environment Variables, then redeploy.

---

## 11. Deploy checklist

1. Commit + push to `main` (GitHub auto-deploys both Vercel projects).
2. Frontend Vercel project: set `NEXT_PUBLIC_*` vars → Redeploy.
3. Backend Vercel project: set all secret vars (Supabase, JWT, Razorpay, SMTP/SendGrid) → Redeploy.
4. Run any new SQL migrations in Supabase (HRMS tables, OTP columns, FK `ON DELETE` changes).
5. Test: `https://care-opsx.vercel.app/health`, login, register+OTP, a payment.

---

## 12. Common SQL migrations run so far

```sql
-- OTP / email verification columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expiry timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_purpose text;

-- Allow deleting users (null out references instead of blocking) — public schema only
-- (see full DO block in chat history / migrations)

-- Allow deleting doctors (cascade appointments + dependents) — public schema only
-- (see full DO block in chat history / migrations)
```

HRMS tables (`staff_profiles`, `attendance_logs`, `shifts`, `hr_leave_requests`, `salary_structures`, `payroll_records`) — full CREATE statements are in chat history; `organization_id` is `bigint` (matches `organizations.id`), `user_id` is `uuid`.
