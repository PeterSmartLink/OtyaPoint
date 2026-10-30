# OtyaPoint Cloudflare API

OtyaPoint is the shop and financial-agency operations system of Otya Hold Ltd T/A OmniPoint. The intended runtime is Cloudflare Workers + D1 + R2 + KV + Queues, with GitHub for source control and Resend for shared transactional email where required.

## Current configuration and status

The root `wrangler.toml` is the canonical OtyaPoint API configuration. It names the Worker `otyapoint-api`, points D1 binding `DB` at `otyapoint-db`, and declares dedicated R2, KV, queue-producer, and Otya Auth service bindings. It disables public `workers.dev` access and defines no custom domain or route.

**Configuration is not deployment.** The Worker is not confirmed deployed. Do not attach a public route or enable payment-provider calls until the build, authorization, transaction-integrity, backup/restore, and private-preview gates below pass.

The three checked-in migrations are:
- `cloudflare-api/migrations/0001_core.sql`
- `cloudflare-api/migrations/0002_company_scope.sql`
- `cloudflare-api/migrations/0003_staff_profile.sql`

A direct Cloudflare D1 schema inspection confirmed the expected business tables and four stock/sale triggers in `otyapoint-db`. The legacy `omnipoint-dev` database has a very similar schema; do not assume either database can be deleted until row-level comparison, a durable backup, and a restore test are complete. An earlier export-download attempt failed, so a verified backup is not yet available. Legacy resources must not be described as retired until their existence, references, and data have been checked.

## Local development

```sh
npx wrangler dev --config wrangler.toml
python3 cloudflare-api/tests/test_core_schema.py
python3 migration/d1/test_schema.py
npm run check:worker
```

Local SQLite tests validate schema invariants; they do not prove Cloudflare D1 concurrency, deployed authentication behavior, or production readiness.

## API surface

- `GET /health`: schema readiness only.
- `GET /api/me`: verified Otya identity mapped to active local staff membership.
- `GET /api/products`: authenticated inventory read.
- `POST /api/products`: manager-authorized product creation with audit record.
- `POST /api/stock-adjustments`: manager-authorized audited stock movement.
- `POST /api/sales`: cash-only retail sale with idempotency and ledger/audit records.
- `GET /api/summary` and `GET /api/ledger`: manager-authorized views.
- `POST /api/agency-transactions`: disabled; no provider call is made and no transaction is represented as successful.

## Identity and access

Otya Auth is the identity provider. OtyaPoint separately authorizes local staff memberships and roles; a global Otya login alone must never grant shop access. Owner/admin provisioning, recovery, token-contract tests, API authorization tests, sale idempotency/concurrency/rollback tests, and an end-to-end private preview remain release gates.

## Cloudflare-first migration

The repository still contains legacy dashboard dependencies and integration files for Prisma and Supabase. They are not the intended OtyaPoint backend. Do not remove them blindly: first identify every runtime import and UI dependency, migrate the dashboard to the Cloudflare API, test the build, and retain historical migrations until preservation requirements are met. Do not add Supabase, Appwrite, or Vercel to the new runtime unless explicitly approved.

## Money movement and production

Agency-provider transactions remain disabled. No public endpoint, custom domain, live payment-provider operation, or production cutover is enabled by this configuration. Before activation, verify signed provider callbacks, replay protection, idempotency, timeout/retry/reversal handling, reconciliation, balanced ledger invariants, durable backup/restore, alert delivery, and applicable Uganda compliance requirements.
