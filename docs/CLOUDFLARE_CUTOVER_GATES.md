# Cloudflare cutover gates

## Goal

Make Cloudflare the operational platform for OmniPoint while preserving existing source, business records, and access until the replacement path is verified. The legal identity is **Otya Hold Ltd T/A OmniPoint**.

This is an implementation checklist, not authorization to deploy, migrate data, change secrets/DNS, or enable live financial transactions.

## Current code observations

- `cloudflare-api/src/index.ts` contains a dedicated API scaffold with Otya Auth service-binding verification and local active-staff membership checks.
- `wrangler.omnipoint.test.toml` points at the isolated `omnipoint-migration-test` D1 database. Keep this as a test-only configuration.
- `wrangler.omnipoint.toml` exists and declares a dedicated `omnipoint-api` Worker bound to `omnipoint-prod`, private R2, cache, `omnipoint-jobs`, and the `otya-auth` service. Its existence is configuration only; it is not proof that the Worker has been deployed or verified.
- The web application still depends on `@supabase/ssr`, `@supabase/supabase-js`, Supabase auth middleware/server helpers, and a Supabase admin client used by staff management.
- Existing code and database schemas are not, by themselves, proof that the live dashboard is connected to production business records. Read-only inspection on 2026-10-27 found the dedicated Worker was not present in the listed deployed Workers, and the checked core OmniPoint production business tables had zero rows.

## Required sequence

### 1. Map existing runtime dependencies

- Inventory every Supabase import, server action, middleware check, route handler, Prisma access, environment variable, and staff invitation flow.
- Classify each use as identity/session, staff administration, business data, or legacy-only.
- Identify any existing data that must be retained. Do not delete old code or projects as part of this inventory.

### 2. Establish the Cloudflare API contract

- Otya Auth's documented contract includes `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, and `GET /auth/verify`. Use those existing identity endpoints rather than creating a second password store.
- The existing Otya Server browser-session proxy uses HttpOnly, Secure cookies scoped to `.petersmartlink.com`. Do not assume those cookies are available to an OmniPoint site hosted on an unrelated hostname. Choose and test a same-origin server-side proxy/session bridge before wiring the dashboard; do not expose refresh tokens to browser JavaScript.

- Define the frontend-facing API base URL and typed request/response contracts.
- Keep the browser limited to the API; it must not connect directly to D1 or receive privileged credentials.
- Use the existing Otya Auth verification service binding and local OmniPoint membership records. Never trust client-supplied roles.
- Specify session renewal/logout, CSRF protection where cookie sessions are used, CORS policy, rate limits, and error handling before replacing the current auth middleware.
- Ensure staff invitation, activation, role assignment, branch scope, and account recovery have a complete replacement before retiring their existing implementation.

### 3. Validate the data model and business invariants

- Reconcile migration order and schema against the actual D1 schema without applying migrations to production.
- Test company/branch scoping, unique SKU handling, stock adjustment atomicity, concurrent sales, idempotency replay, ledger balance, and audit event persistence.
- Confirm a failed or retried sale cannot double-decrement stock or double-post ledger entries.
- Keep retail cash operations separate from mobile-money agency transactions.
- Agency transactions remain disabled until an approved provider adapter, authenticated provider status verification, reconciliation, and explicit activation gate exist.

### 4. Test only against the isolated database

- Use `wrangler.omnipoint.test.toml` and synthetic fixtures only.
- Run schema tests, worker typecheck, authentication-denial tests, API integration tests, and frontend build/lint checks.
- Confirm health readiness checks required tables and fails closed when schema or auth is unavailable.
- Never treat legacy rows in the migration-test database as real business data.

### 5. Prepare production configuration without activating it

- Review the existing production Worker bindings by read-only inspection; verify the configured resource identifiers and binding names against Cloudflare.
- Do not add a custom domain, production secrets, deploy the Worker, or apply production migrations until the owner explicitly approves each relevant change.
- Do not use the shared `otya-core` database as a shortcut for OmniPoint operational records.

### 6. Cutover acceptance gates

A cutover proposal is ready for owner review only when all are true:

- Frontend login, logout, session expiry, staff invitations, role/branch permissions, and recovery work without Supabase runtime dependencies.
- Inventory, sales, stock, ledger, and audit flows pass automated isolated tests.
- No privileged secret is exposed to the browser, mobile app, or repository.
- Backup and restore/recovery are exercised and documented.
- Observability, request IDs, alerting, rollback plan, and release owner are identified.
- Payment-provider actions remain disabled unless separately approved and certified.
- A reviewable PR and test evidence are available.

## Prohibited during preparation

No production deploy, production D1 migration, live data copy/deletion, DNS changes, secret rotation/configuration, provider activation, live payment, outbound email, or billable resource provisioning without specific approval.
