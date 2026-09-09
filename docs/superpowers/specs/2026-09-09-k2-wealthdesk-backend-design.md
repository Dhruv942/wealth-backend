# K2 WealthDesk Backend Design

## Goal

Build a new production-shaped backend for K2 WealthDesk in `finalwealth` with PostgreSQL persistence, role-wise API access, Auto-CRM review flow, idempotent task dispatch, and append-only audit logging.

## Scope

The first build implements the lean MVP API set from the provided specification under `/api/v1`: auth, `/me`, users/team, clients, portfolios, tasks, call notes, CRM drafts, CRM sync mock adapter, audit logs/export, governance summaries, and approved house views. Audio upload/transcription, realtime SSE, and real external CRM/back-office integrations are represented in the schema-ready architecture but not exposed as working production integrations in this MVP.

## Architecture

The backend is a Fastify TypeScript API. Prisma owns the PostgreSQL schema and generated client. Route modules validate request payloads with Zod, call focused service functions, and return ISO timestamps without trusting tenant IDs from clients.

Authorization is centralized in `src/authz.ts`. Each service receives the authenticated user context and applies tenant and row visibility constraints: RM sees assigned clients and own tasks, Manager sees team records, Ops sees operational/compliance queues and linked clients, and Admin sees all tenant records.

Every write operation calls `appendAuditLog`. Audit logs are modeled as append-only from application code; correction events must be new audit rows.

## Data

Prisma models cover all tables requested in the spec: tenants, users, team memberships, clients, client notes/moments, allocations, holdings, opportunities, tasks, task histories, call notes, CRM drafts, liquidity signals, generated tasks, CRM sync records, client communication drafts, audit logs, suitability checks, house views, and house view versions.

Seed data creates one active tenant with Admin, Manager, RM, Ops users, several clients, portfolio rows, tasks, house views, and audit entries. Passwords are documented in `README.md`.

## Testing

API tests use Fastify injection against an in-memory repository implementation with the same service behavior as the Prisma-backed runtime. They verify auth, row-level role visibility, task status/assignment audits, CRM confirmation gating, idempotent dispatch, audit export, governance, and house-view reads.
