# Cloudflare-first primary data architecture

Status: Proposed implementation decision for the `feat/cloudflare-d1-primary-database` branch  
Date: 2026-10-23

## Decision

Cloudflare D1 is the intended primary application database for OmniPoint. Supabase must not be used as the application database or source of truth. Until a separate identity migration is reviewed and approved, Supabase Auth may remain only as a temporary authentication provider; application profiles, organization memberships, permissions, inventory, sales, agency records, payment attempts, ledger entries, reconciliation records, and audit events belong in D1. No Supabase database reads or writes should remain in the final architecture.

Cloudflare Workers will own the privileged API and all database access through D1 bindings. The web app and Android app will call the same versioned API. Neither client may hold database credentials or bypass authorization.

## Cloudflare service responsibilities

- **D1:** relational application records and transactional business data.
- **Workers:** authenticated API, input validation, authorization, rate limiting, provider adapters, and database transactions.
- **Queues / Workflows:** retryable provider callbacks, reconciliation, notifications, and long-running jobs where appropriate. These jobs must be idempotent.
- **R2:** private file/object storage, if needed; store object references and metadata in D1, not file bytes.
- **KV:** non-authoritative cache/configuration only. Never use KV as the ledger or source of truth.
- **Cloudflare security controls:** protect public endpoints, limit abuse, and keep credentials in managed secrets. Secrets must never be committed or logged.
- **Vercel:** may continue hosting the existing Next.js web UI during migration; this does not make Vercel or Supabase the data source. The browser calls the Worker API.

## Safety invariants

1. Do not point the existing application at the isolated migration-test D1 database as if it were production.
2. Do not delete, rename, or overwrite existing Supabase or Cloudflare resources. No production data migration, DNS change, secret change, Worker deployment, or production cutover without explicit approval.
3. Keep retail commerce, agency cash/float, group funds, and payment-provider settlement as distinct accounting domains.
4. Money must be represented as integer minor units or rigorously validated fixed-precision decimal strings; never use binary floating-point for financial calculations.
5. Use immutable ledger postings, explicit reversal entries, unique idempotency keys, provider references, and auditable state transitions.
6. A payment is successful only after a trusted provider confirmation is verified. Timeouts and callbacks must not create duplicate postings.
7. Enforce tenant/org boundaries and permissions in the Worker on every request. Client-side visibility is not authorization.
8. Use D1 transactions/batches only where the operations are proven atomic for the intended statements. Add concurrency tests and design conditional updates/unique constraints to prevent overselling and duplicate ledger postings.
9. Do not store raw identity-document images or national-ID numbers in ordinary profile rows. Collect only what the feature and legal requirements need.
10. No real payment initiation or regulated financial service goes live until partner approval, compliance review, sandbox tests, reconciliation, and operational monitoring are complete.

## Migration sequence

### Phase 0 — Inventory and baseline (read-only)
- Inventory every Prisma/database call, Server Action, API route, auth path, migration, and Cloudflare Worker route.
- Inventory existing D1 migration-test bindings and prove they are isolated.
- Record current CI/test status and baseline build/type/lint results without printing secrets.
- Compare Prisma schema, all Postgres migrations, D1 schema/migrations, and current route contracts.

### Phase 1 — D1 schema and compatibility
- Establish one canonical D1 schema and ordered forward-only migrations.
- Align all domain enums, profile fields, indexes, constraints, tenant IDs, idempotency keys, and audit fields.
- Add schema smoke tests and fixtures. Never edit previously applied migrations in place.
- Keep all tests local or against the isolated test database.

### Phase 2 — Worker API and identity bridge
- Define versioned request/response/error contracts shared by web and Android.
- Verify identity tokens on the Worker; map identity to a D1 profile and organization membership.
- Enforce role, status, organization, and operation-level permission checks server-side.
- Add rate limiting, request IDs, safe logs, and negative authorization tests.
- Do not trust email-only identity mapping without verified issuer/audience/subject checks and a documented account-linking rule.

### Phase 3 — Read-only domain migration
- Move product/catalog and dashboard reads to the Worker/D1 API.
- Compare results against fixtures and, only with separate approval, a controlled non-production comparison dataset.
- Keep writes and payment operations disabled until acceptance tests pass.

### Phase 4 — Business writes
- Implement inventory movements, sales, expenses, receipts, and organization boundaries using tested D1 transactions.
- Add concurrency, rollback, duplicate-request, and permission tests.
- Use append-only audit and ledger records; never silently edit a posted financial entry.

### Phase 5 — Payment-partner adapter
- Define a provider-neutral contract and fake/sandbox adapter before Quickteller credentials are introduced.
- Validate callback authenticity, signature/timestamp/replay protection, idempotency, pending/failed/reversed states, timeouts, and daily reconciliation.
- Keep live payment execution disabled until commercial access and regulatory responsibilities are verified.

### Phase 6 — Controlled cutover (separate approval required)
- Create a backup/export plan, data mapping, reconciliation report, rollback plan, maintenance window, and measurable acceptance criteria.
- Obtain explicit approval before any production migration, secret/DNS changes, Worker deployment, or routing switch.
- Keep old resources intact until post-cutover reconciliation and rollback window are complete.

## Completion gates

- CI: lint, typecheck, unit tests, D1 migration tests, Worker contract tests, and production build pass.
- Security: unauthorized, inactive, unverified, cross-organization, replay, and duplicate-request tests fail closed.
- Financial: transaction atomicity, uniqueness, balanced ledger, reversals, reconciliation, and decimal handling tests pass.
- Operations: documented backups/recovery, monitoring, alerts, data retention, incident response, and rollback.
- Integration: web and Android use the same API contracts; provider sandbox only until approved.
- Cutover: no production switch without explicit approval.

## Current status

This document records the target and acceptance gates. It does not claim the migration is complete. Existing app code still needs a full call-site-by-call-site conversion from Prisma/PostgreSQL to the Cloudflare Worker/D1 API, and each phase must be tested before the next one begins.
