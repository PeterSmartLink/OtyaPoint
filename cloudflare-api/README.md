# OmniPoint Cloudflare API

This is a dedicated OmniPoint Worker API path. It uses a namespaced D1 schema and does not share business tables with the Otya Auth, Core, Next or Player services.

## Configurations

- `wrangler.toml`: legacy migration-test scaffold; do not treat as production configuration.
- `wrangler.omnipoint.test.toml`: isolated API configuration using the migration-test D1 database only.
- `wrangler.omnipoint.toml`: dedicated production binding definition for omnipoint-prod, private R2, cache and the jobs queue. It has no custom domain and must not be deployed until the release gates pass.

The new core schema was applied to the isolated migration-test database for validation. It has not been applied to the production database by this branch.

## API surface

- `GET /health`: schema readiness only; does not reveal table names or business data.
- `GET /api/products`: authenticated inventory read.
- `POST /api/products`: manager-authorized product creation, with audit record.
- `POST /api/stock-adjustments`: manager-authorized audited movement; D1 triggers enforce quantity invariants.
- `POST /api/sales`: cash-only retail sale. Requires an idempotency-key header. The sale, lines, stock movements, balanced retail ledger entries and audit record are submitted in one D1 batch; database triggers reject insufficient stock.
- `GET /api/summary` and `GET /api/ledger`: manager-authorized views.
- `POST /api/agency-transactions`: deliberately disabled with HTTP 501. No provider call is made and no transaction is represented as successful.

## Authentication boundary

Business routes require a short-lived HMAC-SHA256 JWT with issuer `omnipoint` and audience `omnipoint-api`. The signature secret must be stored as a Worker secret and in a trusted server-side issuer only. The API loads the active staff membership and role from the OmniPoint database; the role supplied by a browser or token does not grant access.

The token issuer/bridge from verified Otya Auth identity to an OmniPoint-scoped token is not complete. No public bootstrap-admin route exists. Do not configure a secret or enable business routes until the issuer, expiry, revocation, staff onboarding and owner recovery process are reviewed.

## Validation

Run:

```sh
python3 cloudflare-api/tests/test_core_schema.py
npx wrangler dev --config wrangler.omnipoint.test.toml
```

The local SQLite tests verify the schema and stock triggers, but do not simulate Cloudflare D1 concurrency, the Worker runtime, or provider settlement. Do not connect the dashboard or production traffic until the API contract, auth bridge, idempotency, concurrency, rollback, backup and restore tests pass.
