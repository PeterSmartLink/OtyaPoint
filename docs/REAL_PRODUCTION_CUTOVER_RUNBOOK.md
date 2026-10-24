# OmniPoint real-production cutover runbook

**Owner:** Otya Hold Ltd  
**Operating product/business:** OmniPoint  
**Status:** PREPARATION ONLY — do not execute a production migration from this document without a reviewed, explicit cutover approval.

This is a real business system. The production D1 database is not a sandbox. Do not insert synthetic sales, test staff, fake stock, or sample financial transactions into it. Synthetic data belongs only in isolated local/CI databases.

## Confirmed production facts

Read-only inspection on 2026-10-24 found the nine core `omni_*` tables in `omnipoint-prod`. The core tables inspected had no rows at that time, but that does **not** mean the entire database, other databases, R2 objects, or external systems contain no business data.

Production schema drift:
- `omni_products`, `omni_retail_sales`, `omni_stock_movements`, `omni_agency_transactions`, `omni_ledger_entries`, `omni_reconciliation_sessions`, and `omni_audit_events` lack `company_id`.
- `omni_staff_memberships` already has `company_id`, but lacks some profile/review fields expected by the Worker.
- Production has no `d1_migrations` table, so migration history cannot be trusted or inferred from column presence.
- The migration-test database has legacy tables and extra staff columns. It is not a reliable production baseline.

## Mandatory production cutover gates

### Gate 1 — freeze and inventory
1. Confirm the exact Cloudflare account, D1 database ID, environment, and currently deployed Worker/bindings.
2. Capture a timestamped schema-only inventory: tables, columns, indexes, triggers, constraints, and foreign keys.
3. Record row counts for every table and classify any data before changing schema. Never assume empty based on a subset of tables.
4. Inspect all callers and API queries for the exact schema assumptions they make.
5. Identify any active sales, payment, stock, or staff operations that require a maintenance window.

### Gate 2 — independent backup and restore proof
1. Produce a supported D1 export/backup outside the production database.
2. Record checksum, creation time, database identity, and storage location in a restricted operations log.
3. Verify that the backup can be restored into a separate disposable D1 database.
4. Compare restored schema and counts with the captured inventory.
5. Do not proceed if the export is incomplete, inaccessible, or cannot be restored.

### Gate 3 — prepare a forward-only migration
1. Do not blindly replay `0001_core.sql` or `0002_company_scope.sql` against production: existing objects and inconsistent migration history may cause partial failure or misleading success.
2. Derive a production-specific forward migration from the captured live schema. It must check every expected precondition before modifying anything.
3. Resolve tenant ownership explicitly. Do not rely on `omnipoint-default` as a silent catch-all for records whose company ownership is uncertain.
4. Decide the canonical staff profile/review columns, then make the migration chain reproduce that exact schema from a clean database.
5. Review indexes, triggers, foreign keys, idempotency, rollback/recovery, and whether D1 supports the exact SQL operations used.
6. Exercise the exact migration on a restored copy of production, never on the live database first.

### Gate 4 — API and business controls
- Confirm every read/write is scoped to the authenticated company and, where applicable, branch.
- Confirm staff role and approval checks are server-side; no public bootstrap-admin endpoint.
- Confirm sales, stock movements, ledger entries, and audit events are atomic or have a documented recovery mechanism.
- Verify idempotency under retries and concurrent requests.
- Verify reversals instead of deleting completed financial records.
- Keep payment-provider execution disabled until credentials, provider authorization, callback verification, reconciliation, and failure handling are reviewed.

### Gate 5 — controlled cutover
Production execution requires a separately approved change plan with:
- named operator and approver;
- exact database ID and migration checksum;
- backup/restore evidence;
- maintenance window and expected impact;
- preflight assertions and post-migration assertions;
- monitoring and a recovery/forward-fix plan;
- explicit go/no-go decision.

Apply only the reviewed forward migration, then immediately verify the live schema, constraints, triggers, API health, and logs. Do not seed test transactions into production to prove the POS works. Verify end-to-end flows in an isolated environment; use a separately approved, clearly identified low-value live transaction only if a real provider integration requires it.

## Current decision

**Do not run a production migration yet.** The missing migration history and schema drift make a blind migration unsafe. Continue code review, CI, schema comparison, and restore-based rehearsals while keeping live business data and existing Otya services untouched.
