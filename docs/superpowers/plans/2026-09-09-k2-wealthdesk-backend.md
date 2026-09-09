# K2 WealthDesk Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new Fastify/Prisma/PostgreSQL backend implementing the K2 WealthDesk MVP API and role model.

**Architecture:** Fastify route modules call service functions backed by a repository interface. Prisma is the production repository for PostgreSQL, and tests use an in-memory repository through the same service layer.

**Tech Stack:** Node.js, TypeScript, Fastify, Prisma, PostgreSQL, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-09-k2-wealthdesk-backend-design.md`

## Global Constraints

- Base path is `/api/v1`.
- Tenant scope is derived from authenticated user context.
- All write APIs append an audit log.
- CRM sync and generated task dispatch require a confirmed CRM draft.
- Generated task dispatch uses an idempotency key.
- House views return only approved records for non-admin reads.

---

### Task 1: Contract Tests

**Files:**
- Create: `tests/api.test.ts`

**Interfaces:**
- Consumes: `buildApp({ repository, jwtSecret })`.
- Produces: API behavior assertions for MVP routes.

- [x] Write failing tests for login, `/me`, client visibility, tasks, CRM flow, audit export, governance, and house views.
- [x] Run `npm test` and verify the tests fail before implementation.

### Task 2: Domain and Repository

**Files:**
- Create: `src/domain.ts`
- Create: `src/repository.ts`
- Create: `src/in-memory-repository.ts`
- Create: `src/seed-data.ts`

**Interfaces:**
- Produces: typed entities, repository operations, and deterministic seed data.

- [x] Implement domain enums and data types matching the backend spec.
- [x] Implement in-memory repository used by tests and local non-DB fallback.

### Task 3: Fastify App and Auth

**Files:**
- Create: `src/app.ts`
- Create: `src/auth.ts`
- Create: `src/authz.ts`
- Create: `src/server.ts`

**Interfaces:**
- Produces: `buildApp` and authenticated route pre-handler.

- [x] Implement login, refresh, `/me`, and shared role/visibility helpers.
- [x] Add rate limits for auth and sensitive routes.

### Task 4: MVP Routes and Services

**Files:**
- Create: `src/routes.ts`
- Create: `src/services.ts`

**Interfaces:**
- Produces: `/api/v1` routes listed in the MVP API set.

- [x] Implement clients, portfolio, tasks, CRM drafts, audit logs/export, governance, users/team, and house views.
- [x] Ensure write paths append audit logs and enforce authorization.

### Task 5: Prisma PostgreSQL Backend

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`
- Create: `src/prisma-repository.ts`

**Interfaces:**
- Produces: production PostgreSQL repository and seed script.

- [x] Model all requested tables.
- [x] Map Prisma records to domain entities.

### Task 6: Verification and Docs

**Files:**
- Create: `README.md`

**Interfaces:**
- Produces: setup/run/test instructions and demo credentials.

- [x] Run tests and typecheck.
- [x] Document API usage and PostgreSQL setup.
