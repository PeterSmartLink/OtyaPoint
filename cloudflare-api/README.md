# OmniPoint Cloudflare API

This is a dedicated OmniPoint Worker API path. It uses a namespaced D1 schema and does not share business tables with the Otya Auth, Core, Next or Player services.

## Configurations

- `wrangler.toml`: legacy migration-test scaffold; do not treat as production configuration.
- `wrangler.omnipoint.test.toml`: isolated API configuration using the migration-test D1 database only.
- `wrangler.omnipoint.toml`: dedicated production binding definition for omnipoint-prod, private R2, cache and the jobs queue. It has no custom domain and must not be deployed until the release gates pass.

The core schema and additive company-scope migration were applied to the isolated migration-test database for validation. Its migration baseline is recorded there. Neither migration has been applied to the production database by this branch.

## API surface

- `GET /health`: schema readiness only; does not reveal table names or business data.
- `GET /api/products`: authenticated inventory read.
- `POST /api/products`: manager-authorized product creation, with audit record.
- `POST /api/stock-adjustments`: manager-authorized audited movement; D1 triggers enforce quantity invariants.
- `POST /api/sales`: cash-only retail sale. Requires an idempotency-key header. Every read and write is scoped to the authenticated staff member's `company_id`; the sale, lines, stock movements, balanced retail ledger entries and audit record are submitted in one D1 batch; database triggers reject insufficient stock and cross-company product use.
- `GET /api/summary` and `GET /api/ledger`: manager-authorized views.
- `POST /api/agency-transactions`: deliberately disabled with HTTP 501. No provider call is made and no transaction is represented as successful.

## Authentication boundary

Business routes pass the caller's Otya access token to the existing `otya-auth` Worker using a Cloudflare service binding and accept the identity only when `/auth/verify` returns a verified user ID. OmniPoint then looks up an active local staff membership and role in its own D1 database. A global Otya login does not itself grant OmniPoint access, and browser-supplied roles are never trusted.

The production Wrangler config contains the service binding but has not been deployed by this branch. The dashboard is not yet wired to pass the current Otya access token to this API, and staff onboarding/provisioning is not complete. No public bootstrap-admin route exists. Do not enable business routes until token verification, staff onboarding, owner recovery and authorization tests are reviewed.

## Validation

Run:

```sh
python3 cloudflare-api/tests/test_core_schema.py
npx wrangler dev --config wrangler.omnipoint.test.toml
```

The local SQLite tests verify the schema and stock triggers, but do not simulate Cloudflare D1 concurrency, the Worker runtime, or provider settlement. Do not connect the dashboard or production traffic until the API contract, auth bridge, idempotency, concurrency, rollback, backup and restore tests pass.
