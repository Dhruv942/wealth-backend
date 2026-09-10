# K2 WealthDesk Backend

New Fastify + Prisma + PostgreSQL backend for the K2 WealthDesk RM platform.

## Setup

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

The API runs on `http://localhost:3000` by default.

If `.env` / `DATABASE_URL` is not present, the dev server uses the built-in in-memory demo dataset so frontend integration can continue without local PostgreSQL. To use PostgreSQL, create `.env`, start Postgres, then run `npm run db:migrate` and `npm run db:seed`.

## Gemini AI Features

Auto-CRM meeting synthesis and RM Co-Pilot advice use the real Gemini API. Set these variables before calling `POST /api/v1/call-notes/:callNoteId/synthesize` or `POST /api/v1/clients/:clientId/copilot-advice`:

```bash
GEMINI_API_KEY="your-google-ai-studio-key"
GEMINI_MODEL="gemini-2.5-flash"
```

If `GEMINI_API_KEY` is missing, AI endpoints return `503` instead of creating fake AI output.

## Demo Users

All seeded users use password `password`.

- `rahul@firm.com` - RM
- `manager@k2wealth.com` - MANAGER
- `ops@k2wealth.com` - OPS
- `admin@k2wealth.com` - ADMIN

## Core Endpoints

All authenticated endpoints use:

```http
Authorization: Bearer <accessToken>
```

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/me`
- `GET /api/v1/bootstrap`
- `GET /api/v1/users/team`
- `GET /api/v1/team-members`
- `POST /api/v1/users`
- `PATCH /api/v1/users/:userId/role`
- `GET /api/v1/clients`
- `GET /api/v1/clients/:clientId`
- `GET /api/v1/clients/:clientId/portfolio`
- `GET /api/v1/clients/:clientId/copilot-alerts`
- `POST /api/v1/clients/:clientId/copilot-advice`
- `PATCH /api/v1/clients/:clientId/assigned-rm`
- `GET /api/v1/tasks`
- `POST /api/v1/tasks`
- `PATCH /api/v1/tasks/:taskId/status`
- `PATCH /api/v1/tasks/:taskId/assign`
- `POST /api/v1/tasks/bulk`
- `POST /api/v1/call-notes`
- `POST /api/v1/call-notes/:callNoteId/synthesize`
- `PATCH /api/v1/crm-drafts/:draftId`
- `GET /api/v1/crm-drafts/:draftId`
- `POST /api/v1/crm-drafts/:draftId/confirm`
- `POST /api/v1/crm-drafts/:draftId/sync`
- `POST /api/v1/crm-drafts/:draftId/dispatch-tasks`
- `GET /api/v1/audit-logs`
- `GET /api/v1/audit-logs/export`
- `GET /api/v1/governance/branch-summary`
- `GET /api/v1/governance/capacity-matrix`
- `GET /api/v1/governance/risk-heatmap`
- `GET /api/v1/governance/call-quality`
- `GET /api/v1/house-views`
- `GET /api/v1/house-views/:id`

## Notes

- Tenant scope is always derived from the authenticated user.
- Write endpoints append audit records.
- CRM sync and generated task dispatch require a confirmed CRM draft.
- CRM sync remains a mock adapter until a live CRM provider is connected.
- Meeting synthesis calls Gemini and stores the generated CRM draft, liquidity signals, communication drafts, and generated task candidates.
- RM Co-Pilot advice calls Gemini against the current repository context: client dossier, portfolio allocations, holdings, opportunities, open tasks, and approved house views.
# wealth-backend
