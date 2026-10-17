# Backend delivery roadmap

## Phase 1 — Data model
- [x] Define isolated retail and agency domain entities in Prisma.
- [x] Add user roles, audit-event model, stock movements, provider states, and reconciliation sessions.
- [x] Create and apply the initial SQL migration to the dedicated empty Supabase project; verify all nine tables and RLS settings.
- [ ] Reconcile the checked-in SQL migration with Prisma CLI migration history before relying on automated deploy migrations.
- [ ] Add development-only seed data that is clearly marked as synthetic.

## Phase 2 — Secure application services
- [ ] Authentication and secure session lifecycle.
- [ ] Server-side role/permission checks and re-authentication for sensitive actions.
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
- [ ] Confirm approved MTN/Airtel provider route and current API contracts.
- [ ] Confirm EFRIS integration requirements and validate invoice workflow.
- [ ] Configure Telegram notifications without exposing customer or credential data.
- [ ] Configure staging, backups, monitoring, incident response, and production deployment.

## Explicit non-goals for the prototype
- No real payment initiation or claim of provider success.
- No fabricated live balances, product stock, prices, or tax compliance.
- No credentials committed to Git.
- No reuse of Otya's existing database, credentials, or production configuration.
