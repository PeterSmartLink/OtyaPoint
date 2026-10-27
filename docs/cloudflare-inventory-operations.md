# Cloudflare D1 inventory operations

## Implemented on the isolated branch

- The inventory page reads the catalogue from the Cloudflare API instead of Prisma/PostgreSQL.
- Product creation is routed to `POST /api/products`; the Worker validates fields and writes the product, optional opening-stock movement, and audit event in one D1 batch.
- Stock adjustments use `POST /api/products/:id/stock-adjustments`, require a manager-level role, require a reason, reject negative stock, and use a compare-and-set quantity check to avoid overwriting concurrent adjustments.
- Stock movement and audit records are written in the same D1 batch as the quantity update. If the guarded update does not change a row, dependent inserts are gated and the request returns a conflict.
- UGX amounts are whole shillings stored as integers in this D1 schema. The UI does not silently round fractional amounts.
- Worker tests cover authorization and invalid product payloads; the repository verification workflow also runs lint/build and SQLite migration checks.

## Important limitations

- This branch is still a review candidate. It has not been merged or deployed, and the configured D1 binding is the isolated `omnipoint-migration-test` database.
- Existing production data has not been copied or migrated. The D1 catalogue may be empty until real products are deliberately provisioned into the approved target database.
- Retail sales, cashbook/ledger posting, mobile-money transactions, Airtel/MTN/Interswitch calls, EFRIS, and reconciliation remain disabled or not integrated. Inventory writes do not record a sale or move money.
- Before production cutover, validate D1 batch result metadata and compare-and-set behavior against Cloudflare D1, add database-level integration tests for rollback and concurrent adjustments, review authorization provisioning, back up and reconcile existing records, and obtain explicit approval for deployment/data migration.
- Do not change DNS, secrets, production bindings, live payment settings, or deploy from this branch without explicit approval.
