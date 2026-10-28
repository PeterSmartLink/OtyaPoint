# Cloudflare resource inventory

Audit date: 2026-10-28 UTC. This inventory reflects the latest account-level checks available to this project.

## OmniPoint development resources retained

| Resource | Name | Identifier / notes | Status |
| --- | --- | --- | --- |
| D1 | `omnipoint-dev` | `2c4de5d4-6898-4768-9a60-091bca7779b5`; EU jurisdiction | Fresh schema applied; core business tables verified empty |
| R2 | `omnipoint-dev-private` | Standard storage; no public domain configured | Empty development file bucket |
| R2 | `omnipoint-dev-backups` | Standard storage; no public domain configured | Empty; no verified backup currently stored |
| KV | `omnipoint-dev-cache` | `69ca8a463e60410d907749d4e863faf4`; EU jurisdiction | Development cache only |
| Queue | `omnipoint-dev-jobs` | `e8e3721ce4934094b2cb3d8fb5cb2edb`; EU jurisdiction | No consumer configured |
| Queue | `omnipoint-dev-jobs-dlq` | `ef493d90b8d64801b5c95c2af31f0e31`; EU jurisdiction | No consumer configured |
| Worker | `omnipoint-dev-api` | Declared in root `wrangler.toml` | Not deployed; public workers.dev endpoint disabled |

## Removed legacy OmniPoint resources

The following unused OmniPoint-only resources were deleted after confirming they were not bound to deployed Otya Workers, old R2 buckets were empty, old KV had no keys, and old queues had no producers or consumers:

- D1 `omnipoint-prod` (`65868e64-ff39-4ed3-91de-59c237cd9cb0`).
- D1 `omnipoint-migration-test` (`43d274ce-d46e-462f-bcef-59b93caefc21`).
- R2 `omnipoint-private` and `omnipoint-backups` (both empty).
- KV `omnipoint-cache` (`cc30449e4a93428c989a564cebf80417`; no keys).
- Queues `omnipoint-jobs` and `omnipoint-jobs-dlq` (no producers/consumers).

The user confirmed these were not public production systems and their legacy business records were not real production data. The new development database is now the sole OmniPoint D1 resource. No verified backup is stored yet, so do not enter important or real business data until the independent backup/restore gate passes.

## Existing Otya resources — untouched

- Workers: `otya-auth`, `otya-core`, `otya-next`.
- D1: `otya-auth-db`, `otya-store-db`.
- R2: `otya-assets`, `otya-player-releases`.
- KV: `otya-core-kv`, `otya-auth-kv`.
- Queues: `otya-next-jobs`, `otya-next-jobs-dlq`, `otya-push`, `otya-push-dlq`, `otya-release-events`, `otya-release-events-dlq`.

Do not delete, rename or rebind Otya resources as part of OmniPoint work. They serve separate workloads.

## Remaining checks

- Retrieve an independent D1 export, checksum it, and restore into an isolated database.
- Verify Otya Auth's token contract and local staff authorization.
- Complete API transaction, idempotency, concurrency and rollback tests.
- Keep public routes, custom domains and live payment-provider operations disabled until release gates pass.
