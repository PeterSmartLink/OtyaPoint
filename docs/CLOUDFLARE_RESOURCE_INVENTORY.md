# Cloudflare resource inventory

Audit date: 2026-10-30 UTC. This inventory separates canonical target resources from retained legacy resources. It is not proof that the application has been deployed or passed release gates.

## Canonical OtyaPoint resources created

| Resource | Name | Identifier / notes | Status |
| --- | --- | --- | --- |
| D1 | `otyapoint-db` | `65cc4aee-154a-474f-9ed4-aabea0924c98`; EU jurisdiction | Newly created; only Cloudflare internal `_cf_KV` table observed; business migrations still need to be applied and verified |
| R2 | `otyapoint-private` | WEUR location; standard storage; default jurisdiction | Newly created; no data copied yet; private access must be verified |
| R2 | `otyapoint-backups` | WEUR location; standard storage; default jurisdiction | Newly created; no verified backup stored yet |
| KV | `otyapoint-dev-cache` | `69ca8a463e60410d907749d4e863faf4`; EU jurisdiction | Namespace title renamed in place; namespace ID/data preserved |
| Queue | `otyapoint-dev-jobs` | `10b0b0c3f4234f9bbb8b8f94544224a3`; EU jurisdiction | Newly created; no producer/consumer configured |
| Queue | `otyapoint-dev-jobs-dlq` | `b5448f0de8064678b2cdac5005cdc98e`; EU jurisdiction | Newly created; no consumer configured |
| Worker config | `otyapoint-api` | Declared in `wrangler.toml` on the naming branch | Not deployed; `workers_dev = false`; no custom domain or public route configured |

The naming branch changes `wrangler.toml` to reference the canonical D1, R2, KV and queue names. The configuration change is proposed in a pull request and has not been deployed.

## Retained legacy OtyaPoint resources — preserve for migration and rollback

| Resource | Name | Identifier / notes | Action |
| --- | --- | --- | --- |
| D1 | `omnipoint-dev` | `2c4de5d4-6898-4768-9a60-091bca7779b5`; EU jurisdiction; direct read-only query found 10 application tables plus D1 metadata | Not empty. Contains OtyaPoint business schema; inspect row counts and export/verify backup before migrating. Do not delete. |
| R2 | `omnipoint-dev-private` | Standard storage; previous inventory reported empty, but live object listing has not been independently verified in this pass | Retain until object inventory and binding checks pass |
| R2 | `omnipoint-dev-backups` | Standard storage; no verified backup currently confirmed | Retain until the new backup/restore process is tested |
| Queue | `omnipoint-dev-jobs` | `e8e3721ce4934094b2cb3d8fb5cb2edb`; no producer/consumer observed | Retain until repository references and configuration checks pass |
| Queue | `omnipoint-dev-jobs-dlq` | `ef493d90b8d64801b5c95c2af31f0e31`; no producer/consumer observed | Retain until repository references and configuration checks pass |

No old resources were deleted and no business data has been copied. The legacy D1 has real schema even though Cloudflare's account-list metadata incorrectly/insufficiently reported zero tables. Treat the old database as containing valuable business data until table-by-table row counts and verified export checks prove otherwise. Do not write business records to both old and new databases.

## Shared Otya resources — preserve

- Workers: `otya-auth`, `otya-core`, `otya-next`.
- D1: `otya-auth-db`, `otya-store-db`.
- R2: `otya-assets`, `otya-player-releases`.
- KV: `otya-core-kv`, `otya-auth-kv`.
- Queues: `otya-next-jobs`, `otya-next-jobs-dlq`, `otya-push`, `otya-push-dlq`, `otya-release-events`, `otya-release-events-dlq`.

Read-only queries confirmed application tables in `otya-auth-db` (including users, linked identities, two-factor and security-event tables) and `otya-store-db` (including release, device, notification, audit, user preference and owner action tables). These are not empty databases; preserve them and their bindings. Do not rename, delete, or rebind these shared resources as part of OtyaPoint migration. The Otya Media release bucket and its R2 event queue need a separate dependency-aware migration.

## Resend

The domain `petersmartlink.com` is verified for sending and receiving. Keep the verified domain and current DNS intact. Resend remains the shared ecosystem email service. Existing published templates and the enabled delivery-events webhook should be preserved while callers are identified. A legacy Appwrite webhook is disabled; do not re-enable it or delete it without dependency review.

## Release gates

1. Export/backup the legacy `omnipoint-dev` D1 and independently verify that the backup restores.
2. Run schema validation and apply the D1 migrations to `otyapoint-db`; verify tables, constraints, indexes, and business invariants.
3. Compare the old and new schemas; migrate business data only through an explicit, repeatable migration with checksums, row counts, constraints and rollback.
4. Verify the new R2 buckets have no public domain or unintended access; test upload/download authorization and backup export/restore.
5. Validate Wrangler bindings, service binding to `otya-auth`, queue retry/dead-letter behavior, idempotency, transaction atomicity, and concurrency tests.
6. Run `npm run db:validate`, `npm run lint`, `npm run build`, `python3 migration/d1/test_schema.py`, and `python3 cloudflare-api/tests/test_core_schema.py` in CI.
7. Keep public routes and live payment-provider operations disabled until authentication, authorization, provider callback verification, reconciliation, backups, and compliance gates pass.
8. Keep old resources as rollback until cutover is verified. Delete only in a separate cleanup step after dependency scan, verified recovery, and explicit approval.
