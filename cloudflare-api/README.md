# OmniPoint Cloudflare API

OmniPoint is the shop and financial-agency operations system of Otya Hold Ltd T/A OmniPoint. The target stack is Cloudflare Workers + D1 + R2 + KV + Queues, with GitHub as source control. AWS is optional only if a verified payment-provider requirement cannot be met with Cloudflare.

## One configuration

The repository has one Wrangler configuration: `wrangler.toml`. It targets the isolated `omnipoint-dev` D1 database and dedicated development resources. It disables public `workers.dev` access and defines no route or custom domain. No Worker is deployed by this configuration yet.

Run locally:

```sh
npx wrangler dev --config wrangler.toml
python3 cloudflare-api/tests/test_core_schema.py
```

The D1 development database has the core, company-scope and staff-profile migrations applied and migration history recorded. Core business tables have been verified empty. Local SQLite tests validate schema invariants, but do not prove Cloudflare D1 concurrency or production readiness.

## API surface

- `GET /health`: schema readiness only.
- `GET /api/me`: verified Otya identity mapped to active local staff membership.
- `GET /api/products`: authenticated inventory read.
- `POST /api/products`: manager-authorized product creation with audit record.
- `POST /api/stock-adjustments`: manager-authorized audited stock movement.
- `POST /api/sales`: cash-only retail sale with idempotency and ledger/audit records.
- `GET /api/summary` and `GET /api/ledger`: manager-authorized views.
- `POST /api/agency-transactions`: disabled; no provider call is made and no transaction is represented as successful.

## Security and release gates

Otya Auth remains the identity provider; OmniPoint stores its own local staff memberships and roles. A global Otya login does not itself grant OmniPoint access. Staff provisioning, owner recovery, token contract tests, API authorization tests, sale idempotency/concurrency/rollback tests, backup export retrieval and restore testing, and a private preview review remain incomplete.

No public endpoint, custom domain, live payment-provider operation, or production cutover is enabled. Do not add Supabase, Appwrite, Vercel, or a second business database to the new OmniPoint runtime. Legacy frontend dependencies are being retired only as the dashboard is migrated to this API, so the existing UI does not break prematurely.
