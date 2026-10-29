# OtyaPoint — Release Gates and Verified Development Baseline

**Last checked:** 2026-10-29  
**Scope:** Documentation only. This checklist does not authorize deployment, remote migrations, DNS/secret changes, or payment operations.

## Verified development baseline

- Cloudflare D1 database `omnipoint-dev` exists.
- Read-only schema inspection found the expected nine core `omni_*` tables.
- D1 migration history records `0001_core.sql`, `0002_company_scope.sql`, and `0003_staff_profile.sql`.
- The repository's Wrangler config points to the development D1 database, development R2 buckets, a development KV namespace, the development jobs queue, and the `otya-auth` service binding.
- The configured `omnipoint-dev-api` Worker was not found in the live Worker inventory during the last check. This discrepancy must be resolved before preview deployment.
- No business rows were read during this verification. Schema presence is not proof of a complete, working application.

## Release gates — all must be evidenced

### 1. Resource and environment reconciliation

- [ ] Confirm account and environment ownership for every configured binding.
- [ ] Confirm live IDs for D1, R2, KV, queue, and service binding match this repository's intended development configuration.
- [ ] Confirm no production resource is referenced by the development configuration.
- [ ] Resolve why `omnipoint-dev-api` is absent from the live Worker inventory.
- [ ] Choose a private preview route protected by Cloudflare Access or an equivalent approved private path. Do not enable a public endpoint merely to get a preview URL.

### 2. Build and automated checks

- [ ] Install from the committed lockfile in CI.
- [ ] Run the Cloudflare Worker TypeScript check.
- [ ] Run schema/migration layout checks and local SQLite schema tests.
- [ ] Run unit and route-level tests.
- [ ] Verify the complete app build without exposing secrets in logs or artifacts.
- [ ] Add CI protection that prevents accidental production deploys from documentation or test branches.

### 3. Authentication and authorization

- [ ] Missing, malformed, expired, or invalid tokens fail closed.
- [ ] Auth service timeout/outage returns an unavailable response, not an authenticated fallback.
- [ ] A valid Otya identity without an active local OtyaPoint staff membership is denied.
- [ ] Every data query and mutation is scoped to the authenticated staff member's company.
- [ ] Cross-company IDs cannot read or mutate another company's products, sales, stock, ledger, agency records, or audit data.
- [ ] Role checks are tested for every manager-only operation.
- [ ] Audit records contain the actor, action, entity, company, and request identifier without leaking credentials or sensitive payment data.

### 4. Retail and accounting invariants

- [ ] Product creation validates inputs and enforces company-scoped SKU uniqueness.
- [ ] Stock adjustments reject zero, unsafe integer, negative resulting stock, and cross-company product IDs.
- [ ] Sales are atomic: sale, lines, stock movements, ledger entries, and audit records either all succeed or roll back.
- [ ] Duplicate idempotency keys cannot create duplicate sales or ledger postings.
- [ ] Concurrent sales cannot oversell stock.
- [ ] Voids/refunds use explicit compensating records; historical sales and ledger entries are not silently rewritten.
- [ ] Ledger balancing is tested with positive and negative scenarios.
- [ ] All monetary calculations use integer UGX amounts and validated safe integers.

### 5. Payments and external providers

- [ ] Agency transaction endpoint remains disabled until provider credentials, signatures, callbacks, reconciliation, idempotency, retry and reversal behavior are tested.
- [ ] No request is reported as successful merely because it was submitted to a provider.
- [ ] Provider sandbox tests are separate from live credentials and live customer funds.
- [ ] Live payments remain disabled until a separate explicit approval and partner certification.

### 6. Recovery and operations

- [ ] Export a backup from the isolated development database.
- [ ] Verify the backup object can be retrieved from the intended private R2 bucket.
- [ ] Restore into a separate isolated test database and compare schema, migration history, and synthetic fixture counts.
- [ ] Document recovery-point and recovery-time expectations, backup encryption/access, retention, and restore owner.
- [ ] Confirm logs exclude tokens, secret values, full payment credentials, and unnecessary personal data.
- [ ] Confirm alerting and dead-letter queue handling before enabling consumers.

### 7. Frontend and Cloudflare-only migration

- [ ] Inventory all active Supabase imports, auth/session calls, data queries, environment variables, and Prisma paths.
- [ ] Replace active data/auth paths with the OtyaPoint Cloudflare API and Otya Auth contract, preserving the existing UI.
- [ ] Add tests for every migrated route before removing the legacy client or packages.
- [ ] Remove Supabase and legacy Prisma runtime dependencies only after no active code path relies on them; do not delete external data.
- [ ] Confirm no Appwrite or Vercel runtime dependency is introduced.
- [ ] Verify all customer/staff screens show real API responses and explicit empty states rather than fabricated demo data.

## Deployment approval checklist

A deployment proposal must include:

1. Commit SHA and CI results.
2. Exact target Worker and binding names/IDs.
3. Migration plan and rollback/recovery evidence.
4. Preview URL and proof of access protection.
5. Auth, tenant isolation, sales atomicity/idempotency, and agency-disabled test results.
6. Explicit confirmation that DNS, secrets, production resources, and live payments will not change.

**Stop conditions:** any binding mismatch; unknown migration state; failed tests; inability to restore a backup; missing tenant isolation; public preview exposure; leaked secret; or unexpected production resource reference. Stop and investigate rather than deploying.

## Live Cloudflare inventory reconciliation — 2026-10-29

Read-only Cloudflare API check performed on 2026-10-29:

- The account's Worker script inventory returned exactly these scripts: `otya-auth`, `otya-core`, and `otya-next`.
- `omnipoint-dev-api` was not present in that inventory.
- The live `otya-core` settings bind `AUTH` to `otya-auth`, `DB` to D1 `otya-store-db` (ID `ab157fc6-2cbb-4d46-9789-2e4392e16aea`), and include the existing Otya queues/KV/R2 resources. This is production infrastructure and must not be repurposed for OtyaPoint development.
- The live `otya-auth` settings bind `AUTH_DB` to D1 `otya-auth-db` (ID `b05595f6-260a-4720-acca-4f8b13f5c43e`) and `AUTH_KV` to its existing namespace. Secret values were not read or returned.
- The repository's OtyaPoint Wrangler file describes a separate development Worker and resources, but their existence/bindings are not proven by this live Worker inventory.

### Decision

Do not deploy `omnipoint-dev-api` yet. First inspect the exact live IDs and bindings for the development D1, R2, KV, queue, and auth service target; verify the intended account/environment; then run a Worker dry-run and local tests. A preview endpoint must remain private (Cloudflare Access or an approved private service path), and must never point to `otya-store-db` or other production resources.

This inventory is a point-in-time observation, not proof of app readiness or a deployment authorization.
