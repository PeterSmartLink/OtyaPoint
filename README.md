# OmniPoint

OmniPoint is the operating platform for the retail shop and fintech-agency services of **Otya Hold Ltd** in Uganda. Otya Hold Ltd is the legal business owner; OmniPoint is the operating business/product name. Do not describe OmniPoint UG Limited as the owner unless the company structure is formally changed and verified.

## Current implementation status

The repository contains a responsive Next.js dashboard, an existing PostgreSQL/Supabase-based app foundation, and a separate Cloudflare Worker/D1 service path. The Cloudflare API is not yet established as the only production writer and is not ready to execute mobile-money or bill-payment operations.

**Important: the Cloudflare resource inventory and deployed database schemas must be reconciled.** A read-only Cloudflare API audit on 2026-10-24 found that `omnipoint-prod` already contains the nine `omni_*` core tables, indexes and stock triggers, contrary to the previous inventory note that said it had zero tables. It also found that the production schema is behind the migration-test schema: several operational tables in production do not have the `company_id` column present in the test schema, and production staff memberships lack several profile/review fields. Do not deploy the current Worker or expose production routes until the migration history, expected schema and tenant-scope assumptions are reconciled and tested.

The dedicated Cloudflare D1 database, private R2 buckets, KV namespace and queues exist. The dedicated OmniPoint Worker has not been observed in the account's Worker inventory. No custom domain or verified provider integration is active for OmniPoint. Do not infer production readiness from the existence of resources, tables, a successful build, or a health endpoint.

**Do not treat a successful build or health endpoint as proof that OmniPoint is production-ready.** Secure staff provisioning, the Otya Auth contract, schema parity, POS transaction tests, backup/restore, reconciliation and operational approval remain release gates.

## Architecture direction

- **Cloudflare-first runtime and data:** a dedicated OmniPoint Worker, D1 for relational operational data, private R2 for protected documents/receipts/exports, KV only for reconstructable short-lived state, and Queues for retryable asynchronous work.
- **Shared Otya identity, separate authorization:** use the approved Otya Auth identity flow where appropriate, then map the verified identity to an active OmniPoint staff membership and locally assigned role.
- **Isolated business data:** OmniPoint products, stock, sales, agency operations, reconciliation and ledgers are not stored in Otya Auth/Core/Player databases.
- **Separate ledgers:** retail sales and cost of goods are distinct from agency cash, float, provider settlement and commissions.
- **Provider truth:** an agency transaction is not successful until a verified provider response/status confirms it. Provider execution remains disabled until partner contracts, credentials, callbacks, reconciliation and compliance controls are implemented.
- **Offline-friendly counter:** the staff interface should be touch-friendly and handle poor connectivity without pretending that an unconfirmed transaction succeeded.

See [the ecosystem contract](docs/ECOSYSTEM_CONTRACT.md), [the Cloudflare inventory](docs/CLOUDFLARE_RESOURCE_INVENTORY.md), and [the implementation gates](docs/OMNIPOINT_BUILD_GATES.md).

## Development

Requirements: Node.js 20.9+ and npm.

```sh
npm install
npm run dev
```

Open http://localhost:3000.

Existing application checks:

```sh
npm run db:validate
npm run lint
npm run build
python3 migration/d1/test_schema.py
python3 cloudflare-api/tests/test_core_schema.py
```

## Cloudflare API work

- `wrangler.toml` and the existing `cloudflare-api` scaffold remain the isolated migration-test setup for earlier experiments.
- `wrangler.omnipoint.test.toml` describes the dedicated test configuration for API/schema work.
- `wrangler.omnipoint.toml` describes proposed dedicated production Worker bindings. Do not deploy this configuration until all release gates pass.
- The production config has no custom domain. Do not bind OmniPoint records into the shared `otya-core` Worker by default.
- Business routes verify the caller's Otya access token through the existing Auth Worker service binding, then require an active local staff record. Browser role claims must never be trusted. No public bootstrap-admin route should exist.
- Cash POS posting is designed to use one D1 batch with stock guards, stock movements, balanced retail ledger entries and audit logging. Validate concurrency and failure rollback in CI and an isolated environment before production use.
- Agency transactions deliberately return a disabled response until verified provider adapters and status reconciliation are ready.

## Data migration and recovery

The older PostgreSQL/Supabase implementation must be treated as a legacy source/recovery copy during this transition, not as a second live writer. Do not dual-write financial records to PostgreSQL and D1. Do not delete existing Supabase projects or records as part of this feature branch.

Before cutover, export and verify the approved data set, compare row counts and business invariants, test an isolated restore, and choose one writable primary. Reconcile the production D1 schema against reviewed migrations first. Follow the [Cloudflare resource inventory](docs/CLOUDFLARE_RESOURCE_INVENTORY.md) and [build gates](docs/OMNIPOINT_BUILD_GATES.md).

## Business and security boundaries

- Legal owner: **Otya Hold Ltd**. Operating product/business name: **OmniPoint**.
- Public self-registration is not allowed for staff.
- Staff access must be provisioned through a secure owner/management process.
- Roles and branch permissions are read from server-side OmniPoint records, never trusted from browser payloads.
- Every business query and write must be scoped to the authenticated staff member's authorized company and branch.
- Do not store raw national ID numbers or identity-document images unless an approved, compliant requirement is established.
- Never commit credentials, database URLs, signing keys, provider secrets, or production data.
- No EFRIS, mobile-money, airtime or bill-payment integration should be represented as live until provider approval and end-to-end verification are complete.
