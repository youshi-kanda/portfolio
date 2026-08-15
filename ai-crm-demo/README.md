# AI CRM Demo

**Portfolio Demo / Development Snapshot** — a scoped-down, publicly-safe extract of a private in-development AI CRM product. This repository is not a finished production service; it is a curated code sample that reproduces the AI-driven customer-management flow end-to-end on a local machine without any real customer data, external APIs, or production credentials.

---

## Overview

A prototype CRM for small brick-and-mortar businesses (beauty salons, body-care, gyms). The core loop is:

**Customers & Reservations → Insight (AI) → Campaign Proposal (AI) → Content Drafting (AI) → Human Approval → Monthly Report (AI)**

The AI layer is provider-abstracted: the default `AI_PROVIDER=mock` returns deterministic stub responses so the demo runs offline with no API key. Switching to `AI_PROVIDER=anthropic` (with a valid `ANTHROPIC_API_KEY`) routes the same call sites through the real Claude API.

---

## Key Features (Demo scope)

- **Authentication**: JWT (SimpleJWT) with rotating refresh tokens, token-version invalidation, login throttling, per-request `token_version` check.
- **Customer insight**: rule-based state calculator (`new_lead` / `first_reserved` / `repeater` / `pre_dormant` / `dormant` / ...) plus AI-generated dashboard suggestions.
- **Campaigns**: propose → draft → **AI-generated LINE / Email copy** → expression risk check → human approval → result recording.
- **AI services (5)** — all provider-abstracted:
  - `copy_generator` — draft marketing content
  - `expression_checker` — flag advertising-law risks in ad copy
  - `improvement_advisor` — suggest next-cycle improvements
  - `report_generator` — monthly report Markdown
  - `agency_diagnosis` — rule-based store health score, optionally AI-enhanced
- **Monthly reports** with AI-generated summary and Markdown body.
- **Audit logging** on selected state-changing operations — authentication (login / logout / throttled), store updates, customer create/update/delete/anonymise, consent changes, campaign content submit/approve/reject, campaign result recording, target-CSV export (including denied attempts), CSV upload & import, AI diagnosis, and monthly report generation. 23 call sites across 7 apps; **reservation and sale writes are not audited in this demo.**

---

## Technology Stack

| Layer | Stack |
|---|---|
| Backend | Django 5.0 · Django REST Framework · SimpleJWT · drf-spectacular · PostgreSQL (or SQLite for the demo) |
| Frontend | React 18 · TypeScript · Vite · React Router · TanStack Query · Axios |
| AI provider abstraction | `AI_PROVIDER` env var: `mock` (default) / `anthropic` |
| Tests | pytest · pytest-django (484 passed on SQLite in-memory) |

---

## Demo Flow

1. Log in as the demo owner (see **Demo Account** below).
2. You land on the **dashboard** for the seeded demo store, with monthly focus, KPI cards, and a mock AI diagnosis panel populated from the seed data.
3. Browse the **customer list** (50 synthetic customers) and open a customer detail page to see recent visits and per-customer insight.
4. Open **campaigns**, create or open a draft, and click *AI 文案を生成* to generate mock LINE/Email copy through the AI provider.
5. Approve the content and observe the approval status change and the audit log entry.
6. Open **reports** to view the auto-seeded mock monthly report.

---

## AI Architecture

Each AI service is a thin function that reads `settings.AI_PROVIDER` and dispatches:

```
AI_PROVIDER=mock       → deterministic _mock_result()
AI_PROVIDER=anthropic  → _call_anthropic()  (requires ANTHROPIC_API_KEY)
```

This lets the demo boot with no external calls, while the same code paths remain hot for a real deployment.

AI usage logging is uneven across the five services:

| Service | Dedicated log model | Model name persisted | Token usage persisted |
|---|---|---|---|
| `copy_generator` | `AIGenerationLog` | yes | yes (on the `anthropic` path) |
| `expression_checker` | `AIExpressionCheckLog` | yes | yes (on the `anthropic` path) |
| `improvement_advisor` | `AIImprovementLog` | yes | yes (on the `anthropic` path) |
| `agency_diagnosis` | `AgencyDiagnosisLog` | yes | no — the columns exist but are never populated |
| `report_generator` | none | via the audit-log snapshot only | no — the API-reported counts are read but discarded |

So three of the five services provide token-usage evidence today. Token-based spend controls would additionally require populating the `AgencyDiagnosisLog` token columns and adding usage persistence for `report_generator`.

### Mock vs Real AI

| | `mock` (default) | `anthropic` |
|---|---|---|
| API key | not required | `ANTHROPIC_API_KEY` required |
| Output | deterministic stub JSON | real Claude Sonnet 4.6 response parsed into typed dataclasses |
| Cost | 0 | Anthropic API pricing |
| Latency | ~ms | seconds |
| Suitable for | portfolio demo, unit tests, offline dev | staging / production |

---

## Demo Account

```
Email:    demo@example.com
Password: DemoPass123!
```

This account is created by `python manage.py seed_demo`. The credentials are intentionally publicly-visible portfolio credentials — do not reuse this password anywhere else.

---

## Local Setup

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 16+ (or use the SQLite fallback described below)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate         # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env               # optional: edit DB credentials

# Option A: PostgreSQL (recommended for a realistic feel)
export DJANGO_SETTINGS_MODULE=config.settings.demo
createdb ai_crm_demo
createuser ai_crm_demo
psql -c "ALTER USER ai_crm_demo WITH PASSWORD 'ai_crm_demo';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE ai_crm_demo TO ai_crm_demo;"

# Option B: SQLite (zero DB setup — good for a quick look)
export DJANGO_SETTINGS_MODULE=config.settings.demo
export DB_ENGINE=sqlite

python manage.py migrate
python manage.py seed_demo         # creates the demo user, stores, and 100+ synthetic rows
python manage.py runserver 127.0.0.1:8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env               # optional
npm run dev -- --host 127.0.0.1
```

Then open <http://127.0.0.1:5173/> and sign in with the demo account.

### API Docs

- Swagger UI: <http://localhost:8000/api/schema/swagger-ui/>
- Redoc:       <http://localhost:8000/api/schema/redoc/>

### Reseed / reset the demo data

```bash
DJANGO_SETTINGS_MODULE=config.settings.demo DB_ENGINE=sqlite \
  python manage.py seed_demo --reset
```

---

## Security / Privacy

- No real customer data is included in this repository. All seeded records use `example.com` emails, `090-0000-XXXX` phone numbers, and generic Japanese placeholders (`デモ顧客001`, `デモ・ビューティサロン中目黒`, ...).
- No production credentials, VPS IPs, deployment scripts, or LINE Business API secrets are included.
- The demo owner password is deliberately public.
- Application logs avoid explicitly logging raw request bodies or PII field values. AuditLog snapshots mainly record changed fields and state transitions; campaign rejection reasons are retained as entered.
- JWT access tokens use `token_version` invalidation so a rotated refresh token cannot resurrect access after logout.

If you plan to fork this and put it behind a real domain, at minimum rotate `DJANGO_SECRET_KEY`, delete the demo owner, and set `DEMO_MODE=false`.

---

## Differences from the Original Product Scope

The private in-development product this snapshot is derived from also contains:

- LINE Messaging API integration (webhook receiver, broadcast/multicast/step delivery, rich-menus, scenario flows, delivery insights).
- Multi-tenant agency management (`/agencies` UI, agency-scoped store dashboards).
- Celery + Redis for scheduled LINE tasks and background delivery pipelines.
- Production infrastructure: HTTPS termination, HSTS, secure cookies, CDN, VPS operations runbooks.
- Real-customer CSV ingestion policies (raw-data masking, retention purge command).

**None of that is present in this repository.** The Portfolio Demo intentionally excludes external messaging, real deployment infrastructure, and any code path that would require a production credential. Everything in this repo is the AI-CRM core loop, in a shape that can be evaluated on a laptop in under 10 minutes.

---

## Repository Layout

```
backend/
  apps/
    accounts/       # JWT auth, User, roles
    stores/         # Store, StoreSettings, Menu, Collaborator + seed_demo command
    customers/      # Customer, CustomerProfile, CustomerConsent
    reservations/   # Reservation
    sales/          # Sale
    insights/       # CustomerInsight, DashboardView, state calculator
    campaigns/      # Campaign, CampaignContent, approval flow
    ai_core/        # 5 provider-abstracted AI services + logs
    reports/        # Report (monthly + others)
    imports/        # CSV import processors
    audit/          # AuditLog, IncidentReport, write_audit_log
  config/
    settings/{base,local,demo,test}.py
    urls.py
frontend/
  src/
    app/            # Router, Layout, Sidebar, TopHeader
    features/
      auth/         # LoginPage (with demo credentials banner)
      dashboard/    # Dashboard, KpiCard, MonthlyFocusCard
      customers/    # List & detail pages
      campaigns/    # List, detail, AI content generation
      reports/      # Monthly reports
    lib/apiClient.ts
docs/
  API_CONTRACT.md
  business/  design/  policy/  specs/    # product design & spec documents (public-safe)
sample_data/                              # small synthetic CSVs
```

---

## License / Attribution

This is a portfolio artifact. The code is shared to demonstrate implementation quality and product thinking; if you want to reuse a specific piece, open an issue first.
