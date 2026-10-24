# OmniPoint

OmniPoint is a standalone retail and fintech agency operations platform for Uganda, operated by OmniPoint UG Limited under Otya Hold.

## Current implementation status

The repository contains a responsive Next.js dashboard, an existing PostgreSQL/Supabase-based app foundation, and a separate Cloudflare Worker/D1 migration path. The Cloudflare API is a dedicated service with its own schema and configuration. The inventory page now reads and writes through a server-side bridge to Cloudflare D1; it fails closed rather than falling back to the legacy PostgreSQL database. The wider dashboard and agency operations are not yet production-ready.

The dedicated Cloudflare D1 database, private R2 buckets, KV namespace and queues have been provisioned. OmniPoint business records are company-scoped in the D1 schema and API; stock-sale triggers reject cross-company product use. The new D1 core schema has been applied to the isolated migration-test database only. The production D1 database has not been migrated by this branch. No production Worker, custom domain, or provider integration is activated by this branch.

**Do not treat a successful build or health endpoint as proof that OmniPoint is production-ready.** Secure D1 staff provisioning, migration from the temporary legacy sign-in bridge to shared Otya Auth, end-to-end POS tests, backup/restore, and operational approval remain release gates.

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
- `wrangler.omnipoint.test.toml` describes the dedicated test configuration for the new API/schema work.
- `wrangler.omnipoint.toml` describes the proposed dedicated production Worker bindings. Do not deploy this configuration until the release gates are satisfied.
- The production config has no custom domain. Do not bind OmniPoint records into the shared `otya-core` Worker by default.
- Business routes verify the caller's Otya access token through the existing Auth Worker service binding, then require an active local staff record. The browser's role claims are never trusted. No public bootstrap-admin route exists.
- Cash POS posting is designed to use one D1 batch with stock guards, stock movements, balanced retail ledger entries and audit logging. Validate concurrency and failure rollback in CI and an isolated environment before production use.
- Agency transactions deliberately return a disabled response until verified provider adapters and status reconciliation are ready.

## Data migration and recovery

The older PostgreSQL/Supabase implementation must be treated as a legacy source/recovery copy during this transition, not as a second live writer. Do not dual-write financial records to PostgreSQL and D1. Do not delete the existing Supabase project or its records as part of this feature branch.

Before cutover, export and verify the approved data set, compare row counts and business invariants, test an isolated restore, and choose one writable primary. Follow the [Cloudflare resource inventory](docs/CLOUDFLARE_RESOURCE_INVENTORY.md) and [build gates](docs/OMNIPOINT_BUILD_GATES.md).

## Business and security boundaries

- Public self-registration is not allowed for staff.
- Staff access must be provisioned through a secure owner/management process.
- Roles and branch permissions are read from server-side OmniPoint records, never trusted from browser payloads.
- Do not store raw national ID numbers or identity-document images unless an approved, compliant requirement is established.
- Never commit credentials, database URLs, signing keys, provider secrets, or production data.
- No EFRIS, mobile-money, airtime or bill-payment integration should be represented as live until provider approval and end-to-end verification are complete.
