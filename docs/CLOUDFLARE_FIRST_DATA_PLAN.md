# Cloudflare-first architecture and Supabase recovery plan

## Decision

OmniPoint should move toward a Cloudflare-first runtime and data architecture. Supabase remains a separate disaster-recovery/backup target during the migration and should not be removed until Cloudflare production data has been migrated, verified, and restore-tested.

This document is a plan, not evidence that backups or a production migration are already configured.

## Current verified starting points

- OmniPoint currently uses Prisma with the PostgreSQL provider and `DATABASE_URL`; its current application is not a drop-in D1 application.
- Cloudflare account currently contains Workers named `otya-auth`, `otya-core`, and `otya-next`.
- Cloudflare D1 databases include `otya-auth-db` and `otya-store-db`.
- Cloudflare R2 buckets include `otya-assets` and `otya-player-releases`.
- Otya Auth is a separate shared identity service. OmniPoint must keep its own staff authorization, approvals, and operational roles; a valid global login must not automatically grant retail or fintech permissions.
- Existing Supabase project `OmniPoint` remains the current PostgreSQL reference until migration acceptance criteria are met.

Resource names were inspected read-only. No Cloudflare or Supabase resources were created, changed, or deleted as part of this plan.

## Target responsibilities

| Concern | Primary target | Recovery/backup role |
| --- | --- | --- |
| Web UI and API | Cloudflare Workers / compatible app runtime, selected after compatibility tests | Git history and repeatable deployment |
| Shared login | Existing Otya Auth Worker | Documented recovery procedure; do not duplicate credentials |
| Operational relational data | A dedicated OmniPoint data store selected after schema/transaction compatibility review | Scheduled encrypted/controlled exports to a separate backup target |
| Product images, documents, exports | Cloudflare R2 | Separate versioned/retained backup copies where appropriate |
| Cache, temporary state, revocation/session lookups | KV only where its consistency and expiry semantics fit | Reconstructable where possible |
| PostgreSQL recovery copy during migration | Existing Supabase OmniPoint project | Logical export/import and periodic restore drills |

Do not repurpose `otya-store-db` for OmniPoint until its existing schema, bindings, owner, and workload are reviewed. Do not put ledger entries, inventory, auth state, and unrelated products into one shared database just because they share a Cloudflare account.

## Database decision gate

The current Prisma schema uses PostgreSQL-specific types and enums, and the application expects Prisma/PostgreSQL. D1 is SQLite-based and is not a drop-in PostgreSQL endpoint for the existing Prisma schema.

Before selecting D1 for the operational ledger, inventory, sales, and reconciliation tables, prove that:
1. All required schema types, constraints, indexes, and foreign keys can be represented.
2. Sale posting, stock deduction, audit append, and ledger writes remain atomic.
3. Idempotency and provider-status transitions prevent duplicate financial operations.
4. Concurrent stock updates cannot create negative inventory or lost updates.
5. Migration and rollback are tested against a disposable copy.
6. Capacity, query limits, retention, and cost are acceptable for the expected business.

If D1 fails this gate, use a Cloudflare-connected PostgreSQL path as an interim option rather than forcing a risky database rewrite. That is Cloudflare-fronted PostgreSQL, not a full Supabase exit.

## Supabase backup and recovery policy

Supabase is a recovery copy, not a second live writer. Do not dual-write the same transactions independently to both databases: that can create divergent sales, stock counts, and ledger balances.

Implement the backup pipeline only after selecting the primary schema:
1. Take an initial consistent export of the approved source schema and data.
2. Store backup artifacts in a restricted location; never commit data dumps, customer data, tokens, or secrets to Git.
3. Schedule recurring backups with clear timestamps, retention, encryption/access control, and failure alerts.
4. Record schema/migration version and backup checksum/manifest with each export.
5. Periodically restore a backup into an isolated database and verify table counts, constraints, balances, audit continuity, and application reads.
6. Document recovery-point objective (maximum acceptable data loss) and recovery-time objective (maximum acceptable downtime).
7. For failover, stop writes to the old primary, restore/replay to one chosen primary, verify ledger and stock invariants, then switch traffic. Never allow two writable primaries.

Cloudflare D1 Time Travel is useful for point-in-time recovery, but it is not by itself an independent off-platform backup. Keep a separate export/recovery copy for protection against account-wide mistakes or loss of access.

## Otya Auth integration gate

Before OmniPoint trusts Otya Auth access tokens, verify the deployed verifier and token issuer implementation, expiry handling, signature key handling, logout/revocation semantics, and client/audience separation. The documented JWT payload currently lists `sub`, `email`, `iat`, and `exp`; do not assume an audience claim exists. Require an explicit OmniPoint authorization mapping from stable Otya identity to an approved active OmniPoint staff record and role. Never accept a role supplied only by a browser/client.

## Rollout sequence

- [ ] Inventory current Cloudflare bindings, D1 schemas, Worker routes, and existing workloads.
- [ ] Inspect `otya-store-db` before considering reuse; prefer a dedicated OmniPoint database for workload isolation.
- [ ] Confirm Otya Auth token validation and staff-role mapping.
- [ ] Choose the primary data store using the database decision gate.
- [ ] Implement migrations and repository/data-access layer on a feature branch.
- [ ] Test inventory, sale, ledger, reconciliation, audit, duplicate-request, and failure-recovery cases against disposable data.
- [ ] Add scheduled backup exports and restore verification; confirm alerts and access controls.
- [ ] Run a rehearsal migration and compare row counts, constraints, stock totals, and ledger balances.
- [ ] Switch preview/testing traffic first, then perform an explicit cutover after acceptance checks.
- [ ] Retain Supabase as a read-only recovery copy until restore drills and a defined stability window pass.
- [ ] Only then consider retiring Supabase; deletion requires a separate explicit decision.

## Safety rules

- No production data deletion, project deletion, schema migration, secret rotation, or traffic cutover is authorized by this plan alone.
- Never log or store access tokens, refresh tokens, password hashes, provider secrets, or full payment credentials in audit events.
- Treat provider-confirmed fintech results as the only evidence that an external cash-in/cash-out operation succeeded.
- Correct posted financial records with traceable compensating entries, not silent edits.
