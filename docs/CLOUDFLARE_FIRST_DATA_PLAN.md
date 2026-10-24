# Cloudflare-first data and cutover plan

## Decision

OmniPoint is being built as a new, isolated Cloudflare service. Cloudflare is the target primary runtime and operational data platform. The dedicated OmniPoint D1 database is separate from Otya Auth/Core/Player data. The existing PostgreSQL/Supabase implementation is a legacy source and recovery copy during cutover planning; it must not be a second writable primary.

This plan does not claim that the production schema, authentication bridge, backups or production API deployment are complete.

## Current verified starting points

- Existing Cloudflare Workers include otya-auth, otya-core and otya-next. These serve separate workloads and must not be repurposed for OmniPoint writes.
- Dedicated D1 resources exist for omnipoint-prod and omnipoint-migration-test. The new namespaced core schema was applied to migration-test only. Production schema application remains a separate gated step.
- Dedicated R2 buckets exist for omnipoint-private and omnipoint-backups.
- A dedicated KV namespace exists as omnipoint-cache.
- Queues omnipoint-jobs and omnipoint-jobs-dlq exist. Producer/consumer wiring and retry/DLQ behavior still require implementation and testing.
- The existing OmniPoint dashboard uses Next.js/Prisma/PostgreSQL and an earlier Supabase Auth path. It is not yet wired to the new Worker.
- See docs/CLOUDFLARE_RESOURCE_INVENTORY.md for the read-only resource snapshot and identifiers.

## Target responsibilities

| Concern | Primary target | Rules |
| --- | --- | --- |
| Web UI | Existing Next.js app until a compatible replacement is proven | Keep staff routes protected; do not mix fixtures with live data |
| Operational API | Dedicated OmniPoint Worker | No custom domain until preview validation passes |
| Relational business data | Dedicated OmniPoint D1 | One writable primary; isolated schema; explicit migration history |
| Shared identity | Existing Otya Auth after token contract verification | Local OmniPoint staff mapping and roles remain authoritative |
| Private documents/receipts/exports | omnipoint-private R2 | Private by default; short-lived authorized access |
| Backups | omnipoint-backups R2 plus independent export/recovery procedure | Verify access, retention, checksums and actual restore |
| Cache | omnipoint-cache KV only for reconstructable short-lived data | Never use as financial source of truth |
| Background jobs | omnipoint-jobs and omnipoint-jobs-dlq | Idempotent consumers, bounded retries, dead-letter alerts |
| Legacy recovery | Existing PostgreSQL/Supabase OmniPoint project | Read-only during transition; no dual-write |

## Data ownership and migration

1. Do not query Otya databases from OmniPoint or bind OmniPoint writes into otya-core.
2. Keep staff membership, branch/tenant scope, product catalog, inventory, retail sales, agency transactions, reconciliation, audit events and ledgers in OmniPoint-owned tables.
3. Use stable verified identity subjects from Otya Auth, but do not copy passwords, refresh tokens or session secrets into OmniPoint.
4. Do not copy legacy records until a migration mapping and row-level comparison are approved.
5. Do not delete the legacy PostgreSQL/Supabase project. First take an approved consistent export, validate row counts and balances, restore into an isolated target, and document rollback.
6. Never dual-write the same financial operation to both systems. Cut over one writer at a time after freeze, export, replay/compare and acceptance checks.

## Required D1 acceptance tests

- Schema migration is repeatable and adds no sample/business rows.
- Foreign keys, unique SKU, unique receipt and unique idempotency constraints behave correctly.
- Sale posting atomically creates sale, sale lines, stock movement, balanced retail ledger entries and audit record.
- Insufficient stock, inactive products, duplicate requests, and database failures do not leave partial sales.
- Concurrent sale attempts cannot drive inventory negative.
- Retail and agency ledger totals are checked independently.
- Agency status remains pending/unknown until provider truth is verified.
- Reconciliation is ledger-derived, auditable, and supports independent approval.
- Backup export and isolated restore preserve schema, rows, stock totals, ledger balance and audit continuity.

The Python SQLite suite validates schema and trigger behavior only; Cloudflare D1 integration tests are still required.

## Otya Auth integration gate

The dedicated OmniPoint Worker verifies access tokens by calling the existing Otya Auth Worker through a Cloudflare service binding. Confirm this binding in the deployed environment and test invalid, expired, revoked and unavailable-token cases. OmniPoint must map a verified identity subject to an active local staff membership. A global Otya login is not a grant of OmniPoint manager or cashier permissions. Never copy the Otya signing secret or refresh-token store into OmniPoint or a browser/APK.

## Release sequence

1. Complete isolated schema and Worker contract tests.
2. Implement and review the verified Otya Auth-to-OmniPoint token bridge and staff provisioning.
3. Validate product and stock APIs, then cash POS atomicity, idempotency, concurrency and rollback.
4. Keep mobile-money provider execution disabled until contracts, credentials, callback verification, settlement and compliance controls pass.
5. Add private R2 access controls, backup automation, retention, failure alerts and restore drills.
6. Wire the dashboard through a server-side API boundary; remove legacy database calls only after migration acceptance.
7. Deploy a preview Worker without custom domain, test logs and failure behavior, and verify no unrelated Otya service changes.
8. Apply production schema and deploy production API only after approval and successful gates.
9. Perform a controlled one-writer cutover and keep a tested rollback path.
10. Retire the legacy database only after an explicit separate decision.

## Safety rules

- No provider execution, DNS cutover, production migration, secret rotation or legacy project deletion is implied by this plan.
- Never put secrets, payment credentials, national ID numbers or unnecessary personal data into logs, events or backups.
- A health endpoint, CI pass, or deployed Worker is not evidence of partner readiness or regulatory compliance.
