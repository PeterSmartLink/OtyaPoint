# Cloudflare resource inventory — read-only audit

Audit date: 2026-10-24 UTC. This snapshot was collected from the connected Cloudflare API. It is not a guarantee that every resource or binding is represented.

## OmniPoint resources observed

| Resource | Name | Identifier / notes | Current assessment |
| --- | --- | --- | --- |
| D1 | omnipoint-prod | 65868e64-ff39-4ed3-91de-59c237cd9cb0; EU jurisdiction | Contains nine `omni_*` core tables, indexes and stock triggers. The schema is **not** empty. Production columns lag behind the test schema, including missing company-scope columns on several operational tables. Do not deploy the current Worker until schema parity and migration history are reconciled. |
| D1 | omnipoint-migration-test | 43d274ce-d46e-462f-bcef-59b93caefc21; EU jurisdiction | Contains legacy tables (`Product`, `RetailSale`, `User`, etc.) plus the newer `omni_*` schema and extra staff-review triggers. This is not a clean single-schema test baseline; document and test the intended migration path. |
| R2 | omnipoint-private | private operational documents/receipts/exports target | Bucket exists; application access controls, signed/short-lived URLs, content validation and lifecycle are not verified. |
| R2 | omnipoint-backups | reserved backup target | Bucket exists; scheduled export, encryption, access control, retention, alerts and restore drills are not verified. |
| KV | omnipoint-cache | cc30449e4a93428c989a564cebf80417; EU jurisdiction | Namespace exists; use only for reconstructable/short-lived data. |
| Queue | omnipoint-jobs | bd18ce6e20e943779022ee845ec38380; EU jurisdiction | Queue exists with no producer/consumer attached in the inventory at audit time. Proposed Worker config declares a producer only. |
| Queue | omnipoint-jobs-dlq | cf8f143e40404863930ffa44662fcf1d; EU jurisdiction | Queue exists with no consumer attached in the inventory at audit time. Retry and dead-letter behavior remain unverified. |
| Worker | OmniPoint API | `wrangler.omnipoint.toml` proposes `omnipoint-api` | No dedicated OmniPoint Worker appeared in the account's Worker inventory at audit time. The config is proposed, not proof of a deployed service. |

## Existing Otya resources observed — do not repurpose

- Workers: `otya-auth`, `otya-core`, `otya-next`.
- D1: `otya-auth-db`, `otya-store-db`.
- R2: `otya-assets`, `otya-player-releases`.
- KV: `otya-auth-kv`, `otya-core-kv`.
- Queues: `otya-next-jobs`, `otya-next-jobs-dlq`, `otya-push`, `otya-push-dlq`, `otya-release-events`, `otya-release-events-dlq`.

The existing Otya resources serve separate workloads. They must not be renamed, deleted, or have bindings changed as part of OmniPoint setup.

## Key findings

1. The earlier claim that `omnipoint-prod` has zero tables is incorrect. Read-only SQL found the core `omni_*` tables and triggers in production.
2. The production D1 schema is behind the migration-test schema. Several tables in test have `company_id` columns missing from production; staff profile/review columns also differ. This is a release blocker because the API expects company-scoped records.
3. The test D1 contains legacy schema tables and the new schema side by side. Tests must specify which schema is authoritative and prove the migration sequence from a clean database.
4. No dedicated OmniPoint Worker appeared in the Worker inventory. Existing `otya-core` has production routes/bindings and must not be expanded for OmniPoint by default.
5. OmniPoint queues exist but are unattached. Producer/consumer configuration, retry limits, idempotency and DLQ handling need isolated integration tests.
6. R2 buckets exist, but private access controls, backup automation, retention and recovery are not verified. Do not expose receipts or exports publicly.
7. Cloudflare location hints and jurisdiction labels are not a blanket guarantee of end-to-end data residency. Review each service's location policy before making residency claims.
8. The legal owner is **Otya Hold Ltd** and the operating product/business name is **OmniPoint**. Do not use "OmniPoint UG Limited" as the owner unless formally confirmed.

## Required next checks

- Compare the exact deployed D1 schemas to reviewed migration files; create a forward-only migration for missing company/branch scoping and staff fields in a clean isolated test database first.
- Review every API query and write for company/branch scoping; verify tenant isolation with adversarial tests before any Worker deployment.
- Inspect the Supabase/PostgreSQL schema read-only and classify it as legacy/recovery data; do not dual-write or delete data.
- Verify the Otya Auth issuer, audience, signing-key rotation and revocation contract before integrating shared identity.
- Implement secure staff provisioning, role/approval boundaries, and owner recovery access without a public bootstrap-admin route.
- Add controlled backup exports with manifest/checksum, retention, alerting and an actual isolated restore test; D1 Time Travel alone is not an independent backup.
- Keep production deployment, custom domain, secret changes and provider execution disabled until security, transaction, concurrency, reconciliation and rollback tests pass.
