# Cloudflare resource inventory

Audit date: 2026-10-28 UTC. This reflects resources inspected through the Cloudflare API. It is not a guarantee that every account setting has been audited.

## New OmniPoint development resources

| Resource | Name | Identifier / notes | Status |
| --- | --- | --- | --- |
| D1 | `omnipoint-dev` | `2c4de5d4-6898-4768-9a60-091bca7779b5`; EU jurisdiction | Fresh schema applied; core business tables verified empty |
| R2 | `omnipoint-dev-private` | Standard storage; no public domain configured | Empty development file bucket |
| R2 | `omnipoint-dev-backups` | Standard storage; no public domain configured | Reserved for verified backup artifacts; no verified backup currently stored |
| KV | `omnipoint-dev-cache` | `69ca8a463e60410d907749d4e863faf4`; EU jurisdiction | Development cache only |
| Queue | `omnipoint-dev-jobs` | `e8e3721ce4934094b2cb3d8fb5cb2edb`; EU jurisdiction | No consumer configured |
| Queue | `omnipoint-dev-jobs-dlq` | `ef493d90b8d64801b5c95c2af31f0e31`; EU jurisdiction | No consumer configured |
| Worker | `omnipoint-dev-api` | Declared in root `wrangler.toml` | Not deployed; public workers.dev endpoint disabled |

## Legacy OmniPoint resources pending retirement

| Resource | Name | Identifier / notes | Status |
| --- | --- | --- | --- |
| D1 | `omnipoint-prod` | `65868e64-ff39-4ed3-91de-59c237cd9cb0`; EU jurisdiction | Not bound to any deployed Worker; nine core business tables had zero rows; do not use for new work |
| D1 | `omnipoint-migration-test` | `43d274ce-d46e-462f-bcef-59b93caefc21`; EU jurisdiction | Legacy test database; not bound to any deployed Worker |
| R2 | `omnipoint-private` | Legacy operational files bucket | Previously verified empty; not bound to a deployed OmniPoint Worker |
| R2 | `omnipoint-backups` | Legacy backup target | Previously verified empty; no verified backup stored |
| KV | `omnipoint-cache` | `cc30449e4a93428c989a564cebf80417` | Not bound to existing Otya Workers |
| Queue | `omnipoint-jobs` / `omnipoint-jobs-dlq` | No producers or consumers attached | Not used by a deployed Worker |

These legacy OmniPoint resources are scheduled for removal after the single Wrangler configuration cleanup is merged and final checks confirm no remaining bindings, objects, keys, consumers, or routes. The user has confirmed that the project is not public and its legacy business records are not real production data.

## Existing Otya resources — keep separate

- Workers: `otya-auth`, `otya-core`, `otya-next`.
- D1: `otya-auth-db`, `otya-store-db`.
- R2: `otya-assets`, `otya-player-releases`.
- Otya queues include `otya-next-jobs`, `otya-push`, and `otya-release-events` with their dead-letter queues.

Do not delete, rename, or rebind Otya resources as part of OmniPoint cleanup. The existing Workers have their own databases, queues, secrets and production duties.

## Remaining checks

- Verify backup export retrieval, checksum, and isolated restore; the current R2 backup bucket does not yet contain a verified backup.
- Verify Otya Auth's token contract and local staff authorization.
- Complete API transaction, idempotency, concurrency and rollback tests.
- Keep public routes, custom domains, and live payment-provider operations disabled until release gates pass.
