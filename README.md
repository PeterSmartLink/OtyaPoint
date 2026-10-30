# OtyaPoint

OtyaPoint is the retail and financial-agency operations system for **Otya Hold Ltd**, the owner's own business in Uganda. This repository and application use the OtyaPoint product identity; older names such as OmniPoint and PeterSmart Link are retained only where needed to identify legacy code, resource names, or migration history.

## Current implementation status

The repository contains a responsive Next.js dashboard, a legacy PostgreSQL/Supabase-based application foundation, and a separate Cloudflare Worker/D1 migration path. The Cloudflare API is not yet confirmed connected to the existing dashboard, and it is not ready to execute mobile-money or bill-payment operations.

The Cloudflare account currently contains both canonical OtyaPoint resources and retained legacy-named resources. In particular, the D1 databases `otyapoint-db` and `omnipoint-dev` exist, as do isolated restore-verification databases. The nine core business tables checked on 2026-10-30 were empty in those four D1 databases. This does **not** establish that the legacy PostgreSQL source or every other service has no historical business data. Preserve all potential sources until the authoritative source is identified and recovery is independently verified.

The root `wrangler.toml` declares an `otyapoint-api` Worker, but that Worker was not observed among the deployed Workers during the 2026-10-30 inventory. Configuration is not deployment evidence. No production cutover should be inferred from a local build, schema test, resource creation, or documentation change.

## Architecture direction

- **Cloudflare runtime and data:** a dedicated OtyaPoint Worker, D1 for relational operational data, private R2 for protected documents/receipts/exports, KV only for reconstructable short-lived state, and Queues for retryable asynchronous work.
- **Shared identity, separate authorization:** use the trusted Otya Auth identity contract, then map the verified identity to an active OtyaPoint staff membership and locally assigned role. Never trust browser-supplied roles.
- **Isolated business data:** products, stock, sales, agency operations, reconciliation and ledgers belong in OtyaPoint's own business database, not shared identity, core, or media databases.
- **Separate ledgers:** retail sales and cost of goods are distinct from agency cash, float, provider settlement and commissions.
- **Provider truth:** an agency transaction is not successful until a cryptographically verified provider response/status confirms it. Provider execution remains disabled until partner contracts, credentials, callbacks, reconciliation and compliance controls are implemented.
- **Offline-friendly counter:** the staff interface should be touch-friendly and handle poor connectivity without pretending that an unconfirmed transaction succeeded.

See [the ecosystem contract](docs/ECOSYSTEM_CONTRACT.md), [the Cloudflare inventory](docs/CLOUDFLARE_RESOURCE_INVENTORY.md), and [the implementation gates](docs/OMNIPOINT_BUILD_GATES.md). Legacy document filenames are preserved to avoid breaking existing references.

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

- `wrangler.toml` is configuration only; confirm its bindings against live Cloudflare before use.
- Use `npx wrangler dev --config wrangler.toml` for local development. Do not deploy until release gates pass.
- Business routes must validate Otya Auth through a trusted server-side contract and require an active local OtyaPoint staff record.
- Cash POS posting must preserve atomic stock guards, stock movements, balanced retail ledger entries, idempotency and audit logging; concurrency and rollback tests remain required.
- Agency transactions remain disabled until provider adapters, cryptographic callback verification, status reconciliation and settlement controls are ready.

## Data migration and recovery

The legacy PostgreSQL implementation and any associated Supabase project must be treated as potential source/recovery data during transition, not as a second live writer. Do not dual-write financial records. Do not delete the legacy project or records as part of a feature branch.

Before cutover:
1. Identify the authoritative source and its owners/consumers.
2. Export the approved data set and independently verify backup checksums and isolated restore.
3. Compare row counts, foreign keys, balances, stock quantities and business invariants.
4. Choose one writable primary and use a reviewed, repeatable migration with rollback.
5. Preserve old resources until cutover and recovery are verified.

## Business and security boundaries

- No public self-registration for staff.
- Staff access must be provisioned through a secure owner/management process.
- Roles and branch permissions come from server-side OtyaPoint records.
- Do not store raw national ID numbers or identity-document images without an approved, compliant requirement.
- Never commit credentials, database URLs, signing keys, provider secrets, or production data.
- Do not represent EFRIS, mobile-money, airtime or bill-payment integration as live until provider approval and end-to-end verification are complete.
- Do not change production routes, DNS, secrets, bindings, or financial data, and do not delete resources, without explicit approval and a reviewed rollback plan.
