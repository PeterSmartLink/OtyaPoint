# Cloudflare resource inventory

Audit date: 2026-10-30 UTC. This inventory records the current read-only account observations and repository configuration. Resource existence, configured bindings, successful tests, and production readiness are distinct claims.

## Canonical OtyaPoint target resources

| Resource | Name | Identifier / notes | Current status |
| --- | --- | --- | --- |
| D1 | `otyapoint-db` | `65cc4aee-154a-474f-9ed4-aabea0924c98`; EU jurisdiction | Exists. Nine core business tables queried on 2026-10-30 returned zero rows; three migration records are documented. |
| R2 | `otyapoint-private` | WEUR location | Exists; live inventory showed 0 objects. Private access policy still needs end-to-end verification. |
| R2 | `otyapoint-backups` | WEUR location | Exists; live inventory showed 2 SQL snapshot objects described below. |
| KV | `otyapoint-dev-cache` | `69ca8a463e60410d907749d4e863faf4` | Exists; cache only, never financial source of truth. |
| Queue | `otyapoint-dev-jobs` | `10b0b0c3f4234f9bbb8b8f94544224a3` | Exists; do not attach a consumer until retry, idempotency, and dead-letter behavior are tested. |
| Queue | `otyapoint-dev-jobs-dlq` | `b5448f0de8064678b2cdac5005cdc98e` | Exists; preserve until queue design and dependency checks are complete. |
| Worker configuration | `otyapoint-api` | Declared in root `wrangler.toml` | Not found among the three deployed Workers in the account inventory. `workers_dev = false`; no custom route is configured. Treat as undeployed unless a later live check proves otherwise. |

The root `wrangler.toml` targets `otyapoint-db`, `otyapoint-private`, `otyapoint-backups`, `otyapoint-dev-cache`, and `otyapoint-dev-jobs`, and has a service binding to `otya-auth`. This file is configuration, not evidence that the Worker is deployed or serving requests.

## Recovery snapshots and isolated restore evidence

The live R2 inventory returned these objects in `otyapoint-backups`:

| Source D1 | Object key | Observed bytes | SHA-256 recorded in repository documentation |
| --- | --- | ---: | --- |
| `otyapoint-db` | `d1/otyapoint-db/2026-10-30-recovery.sql` | 11,241 | `21051eee120339be5eec44255a2944e596b34af299590cd9cf62f85b51bd564a` |
| `omnipoint-dev` | `d1/omnipoint-dev/2026-10-30-recovery.sql` | 11,175 | `b44fc62409ba6381229c3d3dfa227b0084545649bc79f07c7053a73a34bae93e` |

The repository's `cloudflare-api/README.md` documents that the snapshots were read back and restored to isolated EU D1 databases, reproducing 35 schema objects, three migration records, and the observed core-table row counts. The isolated targets are `otyapoint-restore-verify-20261030` and `omnipoint-restore-verify-20261030`.

This is documented restore evidence, not a claim that the production application has been migrated. During the current pass, object presence and byte sizes were independently observed; the SHA-256 hashes were not independently recomputed from downloaded object bytes. Keep source and verification databases until a separately reviewed retention decision. Never overwrite a source database to test recovery.

## D1 schema and row-count observations

The following nine tables were checked with read-only aggregate queries in each of the four databases below:

- `omni_agency_transactions`
- `omni_audit_events`
- `omni_ledger_entries`
- `omni_products`
- `omni_reconciliation_sessions`
- `omni_retail_sale_lines`
- `omni_retail_sales`
- `omni_staff_memberships`
- `omni_stock_movements`

| D1 database | Database ID | Result for the nine core business tables |
| --- | --- | --- |
| `otyapoint-db` | `65cc4aee-154a-474f-9ed4-aabea0924c98` | Zero rows in each table |
| `omnipoint-dev` | `2c4de5d4-6898-4768-9a60-091bca7779b5` | Zero rows in each table |
| `otyapoint-restore-verify-20261030` | `d162ce71-be13-43a3-bb0c-54858f9063df` | Zero rows in each table |
| `omnipoint-restore-verify-20261030` | `a62ff42f-149a-49e5-938e-8849061c5c51` | Zero rows in each table |

Both source databases have business schema and migration records. The source migration-history table definitions differ: `otyapoint-db` uses an integer `id` primary key plus `name`; `omnipoint-dev` uses `name` as its primary key. Do not treat the databases or their migration histories as interchangeable.

Zero rows in these D1 tables do **not** prove that the legacy PostgreSQL/Supabase source contains no records, or that no historical records exist in other services. The repository documents that the existing dashboard still depends on Supabase Auth and Prisma and that its Cloudflare migration is incomplete. Identify and preserve the actual legacy data source before cutover.

## Current Cloudflare account inventory

The Workers observed in the account are:

- `otya-auth`
- `otya-core`
- `otya-next`

Shared resources to preserve:

- D1: `otya-auth-db`, `otya-store-db`
- R2: `otya-assets`, `otya-player-releases`
- KV: `otya-core-kv`, `otya-auth-kv`
- Queues include `otya-next-jobs`, `otya-next-jobs-dlq`, `otya-push`, `otya-push-dlq`, `otya-release-events`, and `otya-release-events-dlq`.

The live R2 inventory returned 17 objects in `otya-assets`, 20 objects in `otya-player-releases`, 2 objects in `otyapoint-backups`, and 0 objects in `otyapoint-private`. Object presence alone does not prove artifact freshness, access controls, backup completeness, or application integration.

The legacy bucket names `omnipoint-dev-backups` and `omnipoint-dev-private` did not exist in the live bucket inventory. Use the current names `otyapoint-backups` and `otyapoint-private` in updated configuration and documentation. Do not delete or rename any resource to resolve stale documentation.

## Resend

The domain `petersmartlink.com` was previously confirmed verified for sending. Resend remains the shared ecosystem email provider. Preserve existing domain/DNS settings, templates, and delivery-event integration while callers and dependencies are reviewed. A disabled legacy integration must not be re-enabled or deleted without dependency review.

## Migration and release gates

1. Identify the actual existing dashboard database and authentication/session source; export and preserve it before cutover.
2. Reconcile the documented SQL hashes against downloaded object bytes and retain the isolated restore evidence.
3. Define one canonical D1 source and a reviewed, repeatable migration with row counts, checksums, constraints, rollback, and preserved migration history. Do not dual-write financial records.
4. Complete a trusted Otya Auth session contract and staff provisioning/authorization. A global identity alone must not grant access to shop data.
5. Connect the existing dashboard to the Cloudflare API through a server-side boundary. Test tenant/company scope, staff roles, audit, idempotency, atomic stock/ledger writes, and failure behavior.
6. Verify R2 private access, upload/download authorization, and recovery procedures.
7. Validate queue retry/dead-letter behavior and run the repository's schema, lint, build, and Worker tests in CI.
8. Keep public routes and live payment-provider execution disabled until authentication, provider callbacks, reconciliation, financial invariants, recovery, and compliance gates pass.
9. Preserve old resources for rollback. Do not delete databases, buckets, queues, or legacy identity dependencies without dependency review and explicit approval.

## Safety record

This inventory update is documentation-only. It does not authorize or perform production deployment, database writes or migrations, DNS or secret changes, payment-provider activation, or resource deletion.
