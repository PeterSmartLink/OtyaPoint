# OmniPoint production boundary and D1 schema audit

Audit date: 2026-10-24  
Repository: PeterSmartLink/OmniPoint  
Branch: `security/production-worker-exposure-and-d1-audit-2026-10-24`  
Scope: Read-only Cloudflare schema inspection, read-only Vercel project/deployment metadata, and checked-in configuration/source review. No business row contents or secret values were retrieved.

## Summary

OmniPoint has a real Cloudflare D1 database named `omnipoint-prod`, a separate migration-test database, and a Vercel project linked to this repository. The production database currently exposes a legacy OmniPoint-prefixed schema that differs materially from the newer company-scoped schema documented in the repository as applied to the isolated migration-test database. The production Worker config is present in source but a dedicated `omnipoint-api` Worker was not found in the Cloudflare Worker inventory. The API is therefore not verified as deployed or connected to the production database.

## Evidence gathered

### Cloudflare D1

- `omnipoint-prod` — database ID `65868e64-ff39-4ed3-91de-59c237cd9cb0`.
- `omnipoint-migration-test` — database ID `43d274ce-d46e-462f-bcef-59b93caefc21`.
- The Cloudflare D1 listing reported `num_tables: 0` for these databases, but a read-only `sqlite_master` query returned 44 schema objects for `omnipoint-prod` and 109 for `omnipoint-migration-test`. The metadata table count is not reliable as a schema proof.
- `omnipoint-prod` contains tables such as `omni_products`, `omni_retail_sales`, `omni_retail_sale_lines`, `omni_stock_movements`, `omni_agency_transactions`, `omni_ledger_entries`, `omni_staff_memberships` and `omni_audit_events`.
- In the observed production definitions, `omni_staff_memberships` contains `company_id` and `branch_id`, but core product, sale, stock movement, agency transaction and ledger records do not show corresponding company/branch scope columns.
- The observed production `omni_ledger_entries` table has per-row debit/credit checks and a unique idempotency key, but no database-level mechanism to ensure all entries for a source transaction balance in aggregate.
- `omnipoint-prod` did not show a `d1_migrations` table in the queried schema metadata. This does not prove no migration ever ran; migration lineage must be reconciled with checked-in files before any change.
- `omnipoint-migration-test` has a mixture of Prisma-style names (e.g. `Product`, `RetailSale`, `User`) and OmniPoint-prefixed tables. It also contains a `d1_migrations` table. Confirm which schema lineage is intended before using the test database as the source for a production cutover.

No business rows, customer details, financial transaction records, or secret values were queried.

### Vercel

- Project `omnipoint` is linked to GitHub repository `PeterSmartLink/OmniPoint`.
- A production-target deployment exists on `main` at commit `8fb9ec909c9ac8420bba7b7f2852df3fddabc202`.
- The newest deployment observed was a READY preview deployment from branch `audit/otya-hold-ownership-and-schema-status`, not a production-target deployment.
- The project has a Vercel-provided domain `omnipoint-jet.vercel.app`; no custom domain was returned by the project-domain inventory.
- Vercel SSO protection is enabled for all deployments except custom domains. This is useful protection for the current project state, but it is not a substitute for API authentication or database authorization.

Deployment metadata does not prove the deployed application is connected to Cloudflare D1, nor does it prove its environment variables or API routes are healthy. Secret values were not retrieved.

## Source/configuration change in this branch

The production Wrangler configuration `wrangler.omnipoint.toml` previously set `workers_dev = true` while documenting that no public route/domain should be active yet. This branch changes it to `workers_dev = false` and clarifies that the source safeguard does not alter a deployed environment.

This change has no live effect unless someone later deploys the configuration. It deliberately does not deploy the Worker or attach a domain.

## Blocking items before production API connection or schema migration

1. **Reconcile schema lineage.** Compare `cloudflare-api/migrations` with both live D1 schemas. Produce a table-by-table diff, explicit forward migration and rollback/recovery plan, and verify whether any existing production records require preservation.
2. **Confirm tenancy model.** Decide whether production is intentionally single-company or must support multiple companies/branches. Before enabling multi-tenant writes, scope every relevant query and mutation and every unique constraint to the authorized company/branch where appropriate.
3. **Enforce balanced journals in the service.** Post all entries for a source event atomically, validate aggregate debits equal credits, and make duplicate retries safe. Do not edit historical ledger entries to correct errors; use compensating entries.
4. **Verify identity mapping.** The API must use Otya Auth verification through the service binding and map the verified subject to an active OmniPoint membership. Never trust role, company, branch or actor IDs from browser input.
5. **Verify provider truth and idempotency.** Mobile-money, airtime and bill-payment operations must remain disabled until provider contracts, credentials, signed callbacks/status verification, reconciliation, duplicate handling and reversal behavior are tested.
6. **Verify recovery.** The R2 backup bucket existing is not proof of a usable backup. Add encrypted exports, retention/alerts and a restore test into an isolated resource.
7. **Run isolated tests.** Run the Worker typecheck and schema contract tests against the isolated test database, plus service-boundary tests for cross-company isolation, concurrent stock/sale operations, duplicate idempotency keys, queue retries and auth outage behavior.
8. **Release only after review.** Confirm the exact target, backup and rollback, reviewed migration plan and human approval. No production migration or deployment is authorized by this audit.

## Explicit non-actions

This audit did not write to either D1 database, read business/customer rows, inspect secret values, modify deployed bindings, deploy a Worker, attach domains, execute a provider transaction, or migrate production data. The production config edit exists only on this review branch. A successful Vercel deployment or Worker health response must not be treated as proof of financial or production readiness.

## Follow-up live read-only verification — 2026-10-27

This follow-up was performed with Cloudflare D1 SQL queries that only read SQLite metadata and aggregate row counts. Every query returned `changed_db: false` and `rows_written: 0`.

### Confirmed production state

- `omnipoint-prod` is reachable and contains the expected OmniPoint-prefixed tables and stock triggers. The prior dashboard metadata value `num_tables: 0` must not be used as proof that the database has no schema.
- The live production `sqlite_master` query returned 10 application tables plus 4 triggers (indexes are additional schema objects).
- Core production tables currently have **zero rows**: `omni_products`, `omni_staff_memberships`, `omni_retail_sales`, `omni_ledger_entries`, and `omni_stock_movements`. This confirms the database is provisioned but does **not** contain usable shop inventory, staff membership, sales, ledger or stock-movement records at the time of this check. Do not seed sample data or claim production business data is already available.
- Production `omni_staff_memberships` has `company_id` and `branch_id`, but is missing the profile fields `display_name`, `email`, and `agent_id` expected by the newer API contract.
- Production `omni_products`, `omni_retail_sales`, `omni_stock_movements`, `omni_agency_transactions`, `omni_ledger_entries`, `omni_reconciliation_sessions`, and `omni_audit_events` do not currently have `company_id` columns. The API must remain unavailable for writes until the approved company-scope migration has been validated and applied through a reconciled migration process.
- Production `omni_ledger_entries` has no `journal_id` column, and no `omni_ledger_journals` table was found. Aggregate double-entry balancing and posted-journal immutability are therefore not yet enforced by the production database.
- The isolated migration-test database contains both legacy Prisma-style tables and the newer OmniPoint-prefixed schema. It must not be treated as a production backup or as proof that the production migration sequence is correct.

### Release decision

**Do not connect customer-facing writes or enable sales/payment workflows against this production database yet.** The safe next step is a reviewed migration rehearsal against a fresh isolated D1 database created from the exact current migration files, then a comparison of that result to the production schema. Resolve migration ordering and idempotency, company-scoping, journal constraints, and staff identity fields in code and tests first. A production migration, seed/import of real shop records, Worker deployment, or payment activation remains separately gated by explicit approval.

This follow-up did not retrieve individual business rows, customer data or secret values and did not write to either D1 database.

