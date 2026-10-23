# OmniPoint Cloudflare Migration Plan

Status: planning only. No production cutover, schema mutation, data export, secret access, DNS change, or Supabase pause is performed by this plan.

## Current assessment (2026-10-23)

- OmniPoint Supabase project `iptzfakfeiyjnvepfqcg` is healthy in `eu-west-2`.
- Nine public business tables were present. `User` and `AuditEvent` each had one row; the other seven tables had zero rows in the read-only inventory.
- The application uses Next.js, Prisma configured for PostgreSQL, Supabase Auth, and Supabase-connected database access.
- The README describes the app as a frontend prototype, not a production-ready financial system.

## Important compatibility decision

Cloudflare D1 uses SQLite, not PostgreSQL, so it is not a drop-in replacement for the current Prisma schema. The schema relies on PostgreSQL enums, Decimal money fields, relations, uniqueness, and ledger invariants. A deliberate schema rewrite and tests are required. If D1 cannot safely support the required financial invariants, evaluate Workers with PostgreSQL through Cloudflare Hyperdrive instead; that is Cloudflare-first compute, but the database would remain an external PostgreSQL service.

Supabase Auth is also not automatically replaced by Cloudflare Access. Define and test the staff identity, session, revocation, role, onboarding, and admin authorization design before removing it.

## Phases

1. **Preserve:** keep Supabase available as the reference; use version-controlled Prisma schema and migration files as the schema baseline. Do not expose secrets or export live data without separate approval.
2. **Compatibility spike:** check Cloudflare account limits and costs, then create a separately named non-production D1 database only when safe. Use synthetic data only. Test decimal money handling, referential integrity, atomic sale/stock/ledger updates, balanced ledger posting, idempotency, reversals, audit history, auth, and role denial.
3. **Application abstraction:** separate application routes from database-provider details; add contract and authorization tests; keep privileged onboarding closed by default.
4. **Restore rehearsal:** validate migrations with synthetic data first. Any real-data export requires explicit approval, protected handling, row-count/checksum validation, and a successful restore rehearsal.
5. **Cutover gate:** require CI, auth/data compatibility, verified backup and restore, single-writer fencing, tested rollback, and explicit approval before changing production environment variables, deploying, changing traffic/DNS, or disabling Supabase.
6. **Retirement:** pause Supabase only after the app no longer depends on it and a restore has been verified. Delete only after separate explicit confirmation and retention review.

## Acceptance checklist

- [ ] Database target selected using compatibility evidence.
- [ ] Synthetic sale, stock, ledger, reversal, and idempotency tests pass.
- [ ] Auth, sessions, role checks, and onboarding tests pass.
- [ ] Backup integrity and restore rehearsal pass.
- [ ] Cost and usage limits checked.
- [ ] Single-writer and rollback plan tested.
- [ ] Owner approves any production cutover and eventual Supabase retirement.
