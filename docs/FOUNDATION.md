# OmniPoint Foundation Standards

**Status:** engineering baseline, not a production-readiness certification.

## Legal identity and product family

- Legal company: **Otya Hold Ltd**.
- Trading name: **OmniPoint**. Use “Otya Hold Ltd trading as OmniPoint” where formal legal identity is required.
- Ecosystem: **Otya OS**.
- Products: **Otya Auth** (identity/access), **Otya Core** (shared APIs/platform services), **Otya Next** (AI/customer support), **Otya Media** (offline media), **OmniPoint** (retail, inventory and agency operations).
- “T/A” means “trading as”; it does not create another legal entity. Do not call OmniPoint a separate legal company without verified registration evidence. Verify required Uganda tax/invoice wording against official documents and professional advice.
- Keep customer-facing language clear, friendly, accessible and consistent.

## Architecture rules

1. **Connected ecosystem, bounded services.** Integrate products through documented, authenticated, versioned APIs. Avoid undocumented direct database coupling.
2. **One source of truth per data domain.** Document ownership, replication and restore paths. A backup is not a second writable primary.
3. **Preserve existing resources.** Inspect repositories, workers, bindings, databases, migrations, routes, domains and integrations before changes. Do not rename/delete/recreate resources or repoint production as cleanup.
4. **Small, reversible changes.** Use branches and PRs, automated checks, preview environments and rollback instructions.
5. **Fail closed.** If identity, authorization, provider status or ledger integrity cannot be verified, deny sensitive actions and never claim a payment succeeded.
6. **Least privilege.** Keep database URLs, service-role keys, signing keys and provider credentials server-side. Never commit secrets or print them in logs/chat.
7. **Observable and recoverable.** Use structured redacted logs, correlation IDs, health checks, alerts, verified backups and restore drills.

## Service ownership

| Area | Responsibility | Boundary |
|---|---|---|
| Otya Auth | Identity, sessions, roles and permissions | Does not own stock or financial ledgers |
| Otya Core | Shared APIs and common services | Versioned contracts; no implicit cross-service writes |
| Otya Next | AI and customer support | No privileged action without server authorization and audit |
| Otya Media | Offline audio/video | No dependency on retail transactions |
| OmniPoint | Retail POS, inventory and agency operations | Separate retail and agency ledgers, permissions and reconciliation |
| Supabase | Approved backup/recovery capability | Not automatic writable failover; prove restore first |
| Appwrite | Contingency candidate | Not failover-ready until restore, compatibility and switching are tested |

Cloudflare can host runtime/API services; that alone does not prove a Worker, binding, database or route is production-ready.

## Financial and data integrity

- Separate retail sales, inventory and cost of goods sold from agency cash-in/out, float and commissions.
- Prefer append-only financial events and explicit reversals over silent history edits.
- Use idempotency keys for retries/provider callbacks and enforce uniqueness in the database.
- Verify actor, permissions, amount, currency, timestamp, provider reference and state server-side.
- A pending request is not success. Confirm with the authoritative provider and reconciliation rules.
- Prevent negative stock/float unless an explicitly approved rule permits it.
- Audit privileged changes with actor, action, target, timestamp, result and correlation ID; redact secrets and unnecessary personal data.
- EFRIS/tax invoicing, mobile-money/telecom integrations and financial workflows require provider approval, Uganda-specific compliance review and sandbox/end-to-end tests before production.

## Identity and security

- Enforce authorization on every sensitive server API and object; UI hiding is not authorization.
- Do not add public self-registration or bootstrap-admin endpoints.
- Require verified, active staff profiles and role checks for invitations, activation, refunds, stock adjustments, float/cash operations and exports.
- Use short-lived sessions, secure cookie settings where applicable, token revocation/rotation, rate limits, CSRF protection for cookie-authenticated mutations, server-side input validation and safe errors.
- Avoid collecting raw national ID numbers/documents unless necessity, access, retention and security controls have been reviewed.

## Database and migrations

- Prisma/PostgreSQL and Cloudflare D1/SQLite are different engines. Do not assume SQL, schema, transaction or migration compatibility.
- Do not attach production data to test databases or run exploratory writes against existing databases.
- Before schema changes, identify the authoritative database, inspect data and migration state, verify a backup, and test migration/recovery on an isolated copy.
- Never edit/rename an applied migration; add a new forward migration.
- A database name does not prove its ownership. Inspect non-empty or unclear databases before reuse.
- Assign a single owner to each data domain; avoid cross-service table writes.

## Environments and releases

- Separate development, preview/staging and production data/credentials.
- Validate required environment variables safely at startup; fail with actionable, non-secret messages.
- Keep secrets in encrypted provider settings, never in source or client bundles.
- CI should run applicable dependency install, lint, type checks, tests, migration validation and production build.
- Preview deployments must use test data and sandbox credentials. Smoke-test auth, permissions, persistence, error paths and logging before release.
- Release gate: reviewed PR, green CI, migration/backup plan, security review, smoke tests, monitoring and rollback owner/steps.
- No production DNS/routes changes or live money movement in foundation changes.

## Backup and disaster recovery

- Set recovery point/time objectives before choosing backup frequency.
- Back up data, schema and migration history; re-provision secrets securely rather than putting them in ordinary backups.
- Encrypt backups, restrict access and retain multiple recovery points.
- Restore into isolation and validate constraints, relationships, counts, migration state and app behavior.
- Document restore order, data-loss boundaries, route-switch criteria, rollback and operator responsibilities.
- Supabase is a recovery layer only after restores are proven. Appwrite is contingency only after repeatable failover tests.

## Definition of done

A feature is done only when server permissions and denied cases are tested; validation, retry/duplicate and failure paths are tested; audit events exist; secrets/sensitive data do not leak; CI and preview smoke tests pass; migration/recovery is documented where relevant; customer wording is clear; and remaining limitations are stated honestly.

## Delivery order

1. Verify repository, CI, deployment and environment names without exposing secrets.
2. Standardize legal/product naming and architecture docs.
3. Add automated quality/security checks and secret/dependency scanning.
4. Audit identity, roles and server-side API authorization.
5. Confirm the authoritative PostgreSQL path and migrations; keep D1 isolated until compatibility is evidenced.
6. Complete retail catalog, stock and POS with audit/tests.
7. Complete agency ledger, idempotency, reconciliation and provider sandbox adapters.
8. Add reports, Uganda tax/provider compliance checks and monitoring.
9. Prove restore and disaster recovery before claiming resilience or production readiness.
