# OmniPoint implementation roadmap — Cloudflare-first

**Decision date:** 2026-10-24  
**Status:** staged delivery plan; production release remains gated.

This roadmap supersedes older steps that describe Supabase as OmniPoint's primary database or authentication system. Cloudflare is the primary runtime/data platform. Otya Server / Otya Auth is the shared identity and integration foundation. Supabase may be considered only as a separately validated backup/recovery destination; it is not an active primary writer.

## Architecture target

- **Web app:** staff UI and management screens; no privileged database credentials.
- **Dedicated OmniPoint API Worker:** the only service permitted to write OmniPoint operational records.
- **Identity:** Otya Auth verifies the bearer token; OmniPoint then maps its verified stable identity subject to an active local staff membership and server-owned role/company/branch permissions.
- **Primary database:** dedicated Cloudflare D1 `omnipoint-prod`.
- **Private files and exports:** dedicated private R2 namespace; never public by default.
- **Background work:** dedicated Queue with retry, idempotency and dead-letter handling.
- **Cache:** dedicated KV namespace for non-authoritative cache only. Do not store authoritative balances or permissions only in KV.
- **Recovery:** independent backup copy plus integrity and restore tests. A backup is not a recovery plan until restore and failback have been demonstrated.
- **Shared ecosystem:** Otya Server owns shared identity/API contracts and the central product registry; OmniPoint owns its business data and financial controls.

## Phase 0 — Inventory and release safety

- [x] Create a dedicated OmniPoint D1 database and source configuration for the isolated API Worker.
- [x] Add a source-level safeguard disabling the default public `workers.dev` endpoint in the review branch.
- [x] Record production/test schema discrepancies and key release blockers in the audit PR.
- [x] Define the OmniPoint/Otya ownership contract and prevent direct cross-product database access.
- [ ] Verify deployed Worker, service binding, routes and domains against the source configuration. A config file alone is not proof of deployment.
- [ ] Consolidate overlapping open implementation PRs after comparing their diffs; do not stack unrelated or conflicting schema migrations.

## Phase 1 — Reconcile and secure the data model

- [ ] Reconcile the exact production schema with checked-in migrations and migration-test schema. Do not infer migration history from table counts; production currently has no confirmed `d1_migrations` ledger in the inspected schema.
- [ ] Review each SQL migration and its rollback/recovery implications before any remote apply.
- [ ] Enforce company and branch scope on every business table, relationship, unique key and query. Staff membership scope alone is insufficient.
- [ ] Ensure every staff actor maps to a verified Otya identity subject and an active local membership. Client-supplied actor IDs or roles are never trusted.
- [ ] Enforce atomic, balanced journal posting for retail and agency ledgers separately.
- [ ] Add transaction idempotency, unique source references, safe reversal rules and append-only audit events.
- [ ] Test concurrent stock changes, duplicate requests, transaction rollback and branch/company isolation against an isolated test database.
- [ ] Preserve monetary values in integer minor units with explicit UGX handling and documented rounding.

## Phase 2 — Secure API and staff access

- [ ] Complete the Otya Auth token verification contract, including issuer/audience, expiry and stable subject handling.
- [ ] Implement server-side permission checks for every protected route and mutation.
- [ ] Ensure the dedicated Worker is the only writer of OmniPoint D1 business records; the web app must not access D1 directly.
- [ ] Add request IDs, bounded request sizes, rate limits, structured redacted logs and safe error responses.
- [ ] Validate required columns at startup/health checks so an old schema never reports ready.
- [ ] Use explicit API contracts and versioned minimal events; events are notifications, not a second financial ledger.

## Phase 3 — Retail and inventory operations

- [ ] Product creation/editing with validated SKU, price, cost, reorder threshold and active status.
- [ ] Stock receipts, adjustments, sales, returns and transfers as audited stock movements.
- [ ] Checkout posts sale, lines, stock movements, ledger journal and audit record atomically.
- [ ] Prevent negative stock unless an explicitly reviewed business rule allows it.
- [ ] Receipt numbering, printable receipts, day close and stock reconciliation.
- [ ] Low-stock and high-value alerts, searchable history and permission-scoped exports.

## Phase 4 — Mobile-money agency operations

- [ ] Keep agency cash/float, provider references, commissions and ledger separate from retail revenue and stock.
- [ ] Use provider-approved integrations only; start in sandbox or simulation mode.
- [ ] Treat timeouts as `UNKNOWN` until an authenticated status inquiry resolves the outcome.
- [ ] Never infer success from a submitted request, browser response, timeout or queue message.
- [ ] Enforce idempotency, duplicate-reference protection, reversals and daily provider/cash reconciliation.
- [ ] Confirm current MTN/Airtel/provider contracts and regulatory boundaries before enabling live money movement.

## Phase 5 — Operations, backups and recovery

- [ ] Configure dedicated R2 storage with private access, least privilege and lifecycle/retention policy.
- [ ] Produce scheduled encrypted database backups with integrity manifests and restricted access.
- [ ] Restore a backup into an isolated environment and verify row/schema invariants; record evidence and restore time.
- [ ] Define measurable recovery-point and recovery-time objectives.
- [ ] Test a recovery drill: fence the old writer, restore/validate, switch traffic only after checks, then safely fail back.
- [ ] Monitor Worker health, D1 errors, queue depth, dead-letter messages, failed jobs and reconciliation exceptions.
- [ ] Add incident and rollback runbooks. Do not automate destructive restores or migrations.

## Phase 6 — Uganda business and partner readiness

- [ ] Review EFRIS invoice metadata and actual integration obligations with a qualified local adviser/provider; schema fields alone do not establish compliance.
- [ ] Confirm privacy notice, retention, access/export, account deletion and incident-response requirements.
- [ ] Confirm provider permissions, settlement rules, agent agreements and permitted use of payment APIs.
- [ ] Verify receipt, tax, cash, stock and agency reconciliation workflows with realistic test scenarios.
- [ ] Keep secrets in Cloudflare/GitHub secret stores, never in Git, client bundles, logs or screenshots.

## Supabase policy

- Supabase is **not** OmniPoint's primary database or source of truth.
- Do not use Supabase Auth for new OmniPoint sign-in flows; integrate with Otya Auth after the token contract and staff-membership mapping are tested.
- Existing Supabase code, migrations and dependencies are legacy implementation to be removed only through a reviewed migration plan—not by deleting dependencies before replacement flows are tested.
- Any future Supabase recovery target must have an explicit schema/backup format, restore procedure, access policy and failback plan. Never treat it as an automatically synchronized D1 replica.

## Production release gate

Production remains **not approved** until all of the following are verified:

1. Migration lineage and target identity are known and reviewed.
2. Backup integrity and a successful restore are evidenced.
3. Otya Auth verification and company/branch authorization tests pass.
4. Atomic balanced journals, idempotency, reversals and reconciliation tests pass.
5. Provider outcomes are authenticated and recoverable.
6. Security/dependency scans, typecheck, lint, isolated tests and production build pass.
7. Deployed bindings/routes are verified; live smoke tests are read-only and safe.
8. A specific component, commit, environment and rollback plan receive explicit approval.

A green CI run or healthy endpoint is necessary, but never sufficient, to declare OmniPoint production-ready.
