# Backend delivery roadmap

## Phase 1 — Data model
- [x] Define isolated retail and agency domain entities in Prisma.
- [x] Add user roles, audit-event model, stock movements, provider states, and reconciliation sessions.
- [ ] Replace the earlier Supabase-database assumption with the approved Cloudflare-owned OmniPoint database design. Existing D1 migration-test schema is compatibility-only; production cutover remains unapproved.
- [ ] Reconcile the checked-in SQL migration with Prisma CLI migration history before relying on automated deploy migrations.
- [ ] Add development-only seed data that is clearly marked as synthetic.

## Phase 2 — Secure application services
- [x] Add Supabase Auth server client, sign-in page, session-refresh middleware, and active staff-profile guard for the dashboard.
- [ ] Configure Supabase URL/anon key in a local environment and verify sign-in with a manually provisioned test account.
- [ ] Enforce server-side role/permission checks on every protected API/service operation and re-authentication for sensitive actions.
- [ ] Product catalogue and inventory operations with concurrency-safe stock changes.
- [ ] Retail sale posting in one database transaction: sale, lines, stock movements, and balanced ledger entries.
- [ ] Agency transaction lifecycle with idempotency and provider status verification.
- [ ] Append-only audit service and privileged-action approval workflow.

## Phase 3 — Operational workflows
- [ ] Daily reconciliation with separate retail and agency views.
- [ ] Reports and CSV exports with access controls and audit events.
- [ ] Low-stock and high-value alert rules.
- [ ] Automated tests for accounting invariants, authorization, idempotency, and failure recovery.

## Phase 4 — Integrations and production
- [x] Create a Uganda compliance register covering EFRIS, data protection, agency/payment boundaries, accounting controls and hosting readiness; obtain expert confirmation before production.
- [ ] Confirm approved MTN/Airtel provider route and current API contracts.
- [ ] Confirm EFRIS integration requirements and validate invoice workflow.
- [ ] Configure Telegram notifications without exposing customer or credential data.
- [ ] Configure staging, backups, monitoring, incident response, and production deployment.

## Explicit non-goals for the prototype
- No real payment initiation or claim of provider success.
- No fabricated live balances, product stock, prices, or tax compliance.
- No credentials committed to Git.
- No reuse of Otya's existing database, credentials, or production configuration.
