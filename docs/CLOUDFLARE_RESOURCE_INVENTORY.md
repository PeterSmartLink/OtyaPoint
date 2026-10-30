# Cloudflare resource inventory

Audit date: 2026-10-30 UTC. This inventory separates canonical target resources from retained legacy resources. It is not proof that the application has been deployed or passed release gates.

## Canonical OtyaPoint resources created

| Resource | Name | Identifier / notes | Status |
| --- | --- | --- | --- |
| D1 | `otyapoint-db` | `65cc4aee-154a-474f-9ed4-aabea0924c98`; EU jurisdiction | Newly created; zero tables; migrations still need to be applied and verified |
| R2 | `otyapoint-private` | WEUR location; standard storage; default jurisdiction | Newly created; no data copied yet; private access must be verified |
| R2 | `otyapoint-backups` | WEUR location; standard storage; default jurisdiction | Newly created; no verified backup stored yet |
| KV | `otyapoint-dev-cache` | `69ca8a463e60410d907749d4e863faf4`; EU jurisdiction | Namespace title renamed in place; namespace ID/data preserved |
| Queue | `otyapoint-dev-jobs` | `10b0b0c3f4234f9bbb8b8f94544224a3`; EU jurisdiction | Newly created; no producer/consumer configured |
| Queue | `otyapoint-dev-jobs-dlq` | `b5448f0de8064678b2cdac5005cdc98e`; EU jurisdiction | Newly created; no consumer configured |
| Worker config | `otyapoint-api` | Declared in `wrangler.toml` on the naming branch | Not deployed; `workers_dev = false`; no custom domain or public route configured |

The naming branch changes `wrangler.toml` to reference the canonical D1, R2, KV and queue names. The configuration change is proposed in a pull request and has not been deployed.

## Retained legacy OtyaPoint resources — rollback only

| Resource | Name | Identifier / notes | Action |
| --- | --- | --- | --- |
| D1 | `omnipoint-dev` | `2c4de5d4-6898-4768-9a60-091bca7779b5`; EU jurisdiction; account API reports zero tables | Retain until schema/data and rollback checks pass; do not delete during initial cutover |
| R2 | `omnipoint-dev-private` | Standard storage; previously reported empty | Retain until object inventory and binding checks pass |
| R2 | `omnipoint-dev-backups` | Standard storage; previously reported empty; no verified backup stored | Retain until the new backup/restore process is tested |
| Queue | `omnipoint-dev-jobs` | `e8e3721ce4934094b2cb3d8fb5cb2edb`; no producer/consumer observed | Retain until repository references and configuration checks pass |
| Queue | `omnipoint-dev-jobs-dlq` | `ef493d90b8d64801b5c95c2af31f0e31`; no producer/consumer observed | Retain until repository references and configuration checks pass |

No old resources were deleted. No data was copied because the current inventory and repository documentation indicate these development resources are empty; this must be reconfirmed before any future cleanup. Do not write business records to both old and new databases.

## Shared Otya resources — preserve

- Workers: `otya-auth`, `otya-core`, `otya-next`.
- D1: `otya-auth-db`, `otya-store-db`.
- R2: `otya-assets`, `otya-player-releases`.
- KV: `otya-core-kv`, `otya-auth-kv`.
- Queues: `otya-next-jobs`, `otya-next-jobs-dlq`, `otya-push`, `otya-push-dlq`, `otya-release-events`, `otya-release-events-dlq`.

Do not rename, delete, or rebind these shared resources as part of OtyaPoint migration. The Otya Media release bucket and its R2 event queue need a separate dependency-aware migration.

## Resend

The domain `petersmartlink.com` is verified in Resend for sending and receiving. Keep the verified domain and current DNS intact. Resend remains the shared ecosystem email service; standardize sender display names and role-based addresses only after checking existing inboxes, templates, webhooks, and DNS dependencies. Do not change tracking or sending behavior without a specific need.

## Release gates

1. Run schema validation and apply the D1 migrations to `otyapoint-db`; verify tables, constraints, indexes, and business invariants.
2. Verify the new R2 buckets have no public domain or unintended access; test upload/download authorization and backup export/restore.
3. Validate Wrangler bindings, service binding to `otya-auth`, queue retry/dead-letter behavior, idempotency, transaction atomicity, and concurrency tests.
4. Run `npm run db:validate`, `npm run lint`, `npm run build`, `python3 migration/d1/test_schema.py`, and `python3 cloudflare-api/tests/test_core_schema.py` in CI.
5. Keep public routes and live payment-provider operations disabled until authentication, authorization, provider callback verification, reconciliation, backups, and compliance gates pass.
6. Keep old resources as rollback until cutover is verified. Delete only in a separate cleanup step after dependency scan, verified recovery, and explicit approval.
