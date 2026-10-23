# OmniPoint D1 Spike — Execution Report

Date: 2026-10-23
Status: isolated schema smoke test passed; application migration is not complete.

## Isolated resource
- Cloudflare D1 database: `omnipoint-migration-test`
- Jurisdiction: EU
- Database UUID: `43d274ce-d46e-462f-bcef-59b93caefc21`
- This database is separate from the Otya D1 databases and from OmniPoint Supabase.
- Only synthetic test records were inserted. No production/Supabase data was exported or copied.

## Work completed
- Added `migration/d1/0001_schema.sql` on branch `chore/cloudflare-first-migration-plan`.
- Applied the schema to the isolated D1 database successfully.
- Inserted synthetic records to exercise User, Product, RetailSale, RetailSaleLine, StockMovement, AgencyTransaction, LedgerEntry, AuditEvent, and ReconciliationSession.
- Verified row counts for the key test records: User 1, Product 1, RetailSale 1, AgencyTransaction 1, LedgerEntry 2, AuditEvent 1, ReconciliationSession 1. The sale line and stock movement inserts also succeeded as part of the same smoke test.
- Schema uses integer-valued money columns in the test D1 schema to avoid SQLite floating-point money arithmetic. The conversion policy from PostgreSQL Decimal(18,2) must be decided explicitly; for UGX, verify currency precision and how the app represents amounts before integration.

## Important limits
This is a schema and synthetic-data smoke test, not an end-to-end or production-readiness test. It does not yet prove:
- atomic transaction behavior for stock + sale + ledger posting;
- balanced ledger invariants and reversal behavior;
- uniqueness/idempotency under retries and concurrent requests;
- inventory race-condition handling;
- authentication, session handling, role enforcement, and secure admin onboarding;
- backup/restore and recovery procedures;
- EFRIS integration or mobile-money provider integrations;
- Next.js runtime compatibility and production deployment on Cloudflare;
- complete transfer/verification of the two existing Supabase records.

## Next gates
1. Implement automated integration tests against the isolated D1 database for transaction atomicity, uniqueness/idempotency, foreign-key restrictions, balanced ledgers, stock updates, and rollback behavior.
2. Decide identity/session architecture before removing Supabase Auth dependencies.
3. Run a non-production app build and route-level tests after implementing the data-access layer.
4. Rehearse a verified backup/restore and data reconciliation procedure.
5. Only after all gates pass, request explicit approval for cutover. Do not pause or delete OmniPoint Supabase before then.
