# OtyaPoint

OtyaPoint is the retail and financial-agency operations system for Otya Hold Ltd T/A OtyaPoint, the owner's own business in Uganda.

## Current implementation status

The repository contains a responsive Next.js dashboard, an existing PostgreSQL/Supabase-based app foundation, and a separate Cloudflare Worker/D1 migration path. The Cloudflare API work is now being developed as an isolated service with its own schema and configuration. It is not yet connected to the production dashboard and is not ready to execute mobile-money or bill-payment operations.

The original OtyaPoint-specific Cloudflare resources remain isolated and undeployed. A fresh development stack now exists: EU-jurisdiction D1 database `otyapoint-dev`, separate development R2 buckets, a development-only KV namespace and queues. The core, company-scope and staff-profile migrations were applied to that new D1 database, and the core business tables were verified empty. No Worker has been deployed from the new configuration; no custom domain or payment-provider operation is active. The unused older OtyaPoint-only D1 databases, R2 buckets, KV namespace and queues have been removed after verifying no deployed Worker depended on them. Existing Otya resources were not changed.

**Do not treat a successful build or health endpoint as proof that OtyaPoint is production-ready.** Staff token issuance, Otya Auth integration, secure staff provisioning, end-to-end POS tests, backup/restore, and operational approval remain release gates.

## Architecture direction

- **Cloudflare-first runtime and data:** a dedicated OtyaPoint Worker, D1 for relational operational data, private R2 for protected documents/receipts/exports, KV only for reconstructable short-lived state, and Queues for retryable asynchronous work.
- **Shared Otya identity, separate authorization:** use the approved Otya Auth identity flow where appropriate, then map the verified identity to an active OtyaPoint staff membership and locally assigned role.
- **Isolated business data:** OtyaPoint products, stock, sales, agency operations, reconciliation and ledgers are not stored in Otya Auth/Core/Player databases.
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

- `wrangler.toml` is the single configuration and points only to the isolated `otyapoint-dev` database and development resources.
- It has `workers_dev = false`; no Worker has been deployed from this configuration, and no public route or custom domain is configured.
- Use `npx wrangler dev --config wrangler.toml` for local development. Do not deploy until the release gates pass.
- Business routes validate Otya Auth through a service binding, then require an active local OtyaPoint staff record. Browser-supplied roles are never trusted.
- Cash POS posting is designed around a D1 batch with stock guards, stock movements, balanced retail ledger entries and audit logging. Concurrency, idempotency and rollback tests remain required.
- Agency transactions remain disabled until provider adapters, cryptographic callback verification, status reconciliation and settlement controls are ready.

## Data migration and recovery

The older PostgreSQL/Supabase implementation must be treated as a legacy source/recovery copy during this transition, not as a second live writer. Do not dual-write financial records to PostgreSQL and D1. Do not delete the existing Supabase project or its records as part of this feature branch.

Before cutover, export and verify the approved data set, compare row counts and business invariants, test an isolated restore, and choose one writable primary. Follow the [Cloudflare resource inventory](docs/CLOUDFLARE_RESOURCE_INVENTORY.md) and [build gates](docs/OMNIPOINT_BUILD_GATES.md).

## Business and security boundaries

- Public self-registration is not allowed for staff.
- Staff access must be provisioned through a secure owner/management process.
- Roles and branch permissions are read from server-side OtyaPoint records, never trusted from browser payloads.
- Do not store raw national ID numbers or identity-document images unless an approved, compliant requirement is established.
- Never commit credentials, database URLs, signing keys, provider secrets, or production data.
- No EFRIS, mobile-money, airtime or bill-payment integration should be represented as live until provider approval and end-to-end verification are complete.
