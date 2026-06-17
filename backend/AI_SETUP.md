# AI Organizational Assistant — setup

Provider-agnostic AI assistant. v1 ships with **Groq** (default); the adapter layer
lets you switch to OpenAI / Gemini / Claude later by adding an adapter and changing
one env var — no orchestrator or tool changes.

## 1. Database
Run the migration in Supabase SQL editor:

```
migration_ai_assistant.sql   (creates ai_conversations, ai_messages)
```

AI interaction auditing reuses the existing `audit_logs` table (module = `AI`).

## 2. Environment variables (backend/.env)

```env
# Which provider to use. Supported now: groq
AI_PROVIDER=groq

# Groq (https://console.groq.com/keys)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

Restart the backend after adding these.

## 3. How it works
- `POST /ai/chat { message, conversation_id? }` → role-aware answer.
- The model is given **tools** (read-only, org-scoped queries). It picks the right
  tool from natural language, the server runs it, and the model summarizes.
- **RBAC**: every tool declares a `{ module, action }`; the user's effective
  permissions (from the permission matrix) are checked *before* the tool runs.
  The model never receives data the user is not allowed to see.
- Each turn is persisted (`ai_messages`) and audited (`audit_logs`, action `AI_QUERY`).

## 4. Tools available in v1
| Tool | Module/permission | Answers |
|------|-------------------|---------|
| get_hospital_overview | reports.view | patients today, appointments, revenue, lab orders |
| get_revenue_summary | billing.view | revenue by type for a period (supports comparisons) |
| get_appointments_summary | opd.view | appointment counts + status breakdown |
| get_doctor_performance | reports.view | per-doctor consultation counts (top/busiest) |
| get_hr_summary | hrms.view | active staff, on-leave today, dept headcount |
| get_attendance_summary | hrms.view | attendance status counts for a date |
| get_low_stock_medicines | pharmacy.view | medicines below reorder level |

**Comparisons** (e.g. "this month vs last month") work without extra code — the model
calls a tool twice with different date ranges and computes the difference.

**Endpoints**
- `POST /ai/chat { message, conversation_id? }` — main chat
- `GET /ai/summary` — live executive dashboard summary (role-scoped)
- `GET /ai/conversations`, `GET /ai/conversations/:id/messages`, `DELETE /ai/conversations/:id`

## 5. Adding a provider later
1. Create `src/ai/providers/<name>.js` extending `BaseProvider`, implement `chat()`
   (translate to/from the internal OpenAI-style message + tool format).
2. Register it in `src/ai/providers/index.js`.
3. Set `AI_PROVIDER=<name>` + that provider's key.

## 6. Adding a tool later
Add an entry to `TOOLS` in `src/ai/tools.js` with `{ module, action, description,
parameters, run }`. RBAC + schema exposure are automatic.
