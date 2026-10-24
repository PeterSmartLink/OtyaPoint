# OmniPoint implementation gates

**Legal owner:** Otya Hold Ltd. **Operating product/business name:** OmniPoint.

## Immediate release blockers from the 2026-10-24 read-only audit

- [ ] Reconcile production D1 with reviewed migrations. Read-only introspection confirms production lacks `company_id` on products, sales, stock movements, agency transactions, ledger entries, reconciliation sessions and audit events.
- [ ] Establish migration history. Production has no `d1_migrations` table; test records only `0001_core.sql` and `0002_company_scope.sql` even though staff-profile columns already exist there. Do not infer migration state from columns alone.
- [ ] Reconcile staff schema drift. Test has `display_name`, `email`, `agent_id`, `identity_status`, `phone`, `approved_by` and `approved_at`; the reviewed `0003_staff_profile.sql` defines only the first three. Decide which fields are required and make the migration chain reproduce the intended schema from empty D1.
- [ ] Clean up the migration-test baseline or document its legacy schema explicitly. It contains old Prisma-style tables alongside the new `omni_*` schema.
- [ ] Review every protected API query and write for server-derived company and branch scoping. Prove tenant isolation with adversarial tests.
- [ ] Verify the current D1 schemas using read-only introspection and update the resource inventory. The previous statement that production D1 has zero tables was incorrect.
- [ ] Confirm the dedicated OmniPoint Worker is absent or present through a fresh inventory; do not infer deployment from the config file.

## Current API capability snapshot (source review; not a production readiness claim)

Implemented in the Worker source on this branch:
- `GET /api/me`, `GET /api/products`, `GET /api/summary`, and `GET /api/ledger`.
- `POST /api/products`, `POST /api/stock-adjustments`, and `POST /api/sales` (cash-only; idempotency key required; stock, retail ledger and audit writes are batched).
- `POST /api/agency-transactions` intentionally returns `501 provider_adapter_required`; it does not call a provider or record an agency transaction.

Not yet implemented as end-to-end business flows: purchasing/supplier receiving, expenses, cash drawer opening/closing, returns/refunds, reconciliation approvals, EFRIS integration, and a real mobile-money/provider adapter. These must be built and tested before claiming full shop/agency operations. Source presence does not mean the Worker is deployed or safe to expose; production schema and identity integration remain release blockers.

## Stage 0 — Isolated foundation

- [x] Dedicated OmniPoint D1, R2, KV and queue resources provisioned.
- [x] Separate OmniPoint migration-test D1 exists.
- [x] Existing Otya resources inventoried and protected from reuse.
- [ ] Dedicated OmniPoint Worker configuration and schema reviewed.
- [ ] Production/test schema parity and migration order reconciled, including explicit migration-history strategy.
- [ ] Contract tests run against a clean isolated test database.
- [ ] No production route or custom domain attached until release gates pass.

## Stage 1 — Identity and staff authorization

- [ ] Confirm Otya Auth token issuer, signature algorithm/key, issuer, audience, expiry and revocation behavior from source and deployed configuration.
- [ ] Add OmniPoint local staff membership, company, branch, role, status and approval records.
- [ ] Require server-side identity-to-staff mapping on every protected API route.
- [ ] Scope every business read/write to the authorized company and branch using server-side membership data.
- [ ] Add rate limiting and audit events for authentication failures and privileged operations.
- [ ] Never accept role, company, branch or actor identity from request bodies.
- [ ] Secure owner recovery and staff provisioning; no public bootstrap-admin route.

## Stage 2 — Retail inventory and POS

- [x] Product/SKU create and read endpoints exist in Worker source; update and deactivate endpoints remain missing. Production release remains blocked.
- [ ] Opening stock and adjustment flows: adjustment exists in Worker source with a reason and audit before/after; opening-stock/purchase receiving flow and deployed-schema verification remain missing.
- [x] Cash sale posting code batches receipt, lines, stock deduction, balanced retail ledger entries and audit record; still needs clean-schema, concurrency, rollback and production-like integration tests.
- [ ] Duplicate request and duplicate receipt tests.
- [ ] Insufficient stock, inactive product, malformed amount, concurrency and rollback tests.
- [ ] Returns/refunds are compensating entries, never edits to historical ledger rows.
- [ ] EFRIS remains NOT_CONFIGURED until an approved integration and test credentials exist.

## Stage 3 — Agency operations

- [ ] Record requests with idempotency keys and provider status state machine.
- [ ] Verify provider callbacks cryptographically and/or query provider status server-side.
- [ ] Do not mark cash-in/out, airtime or bill payment as successful based only on a browser response.
- [ ] Separate cash, provider float, commission and settlement accounts in the agency ledger.
- [ ] Add reversal/refund, duplicate callback and timeout/unknown-state tests.
- [ ] No provider execution until contracts, credentials, settlement and compliance readiness are verified.

## Stage 4 — Jobs, storage, backups and observability

- [ ] Use queue events only after the business transaction commits; consumer idempotency and DLQ retry policy verified.
- [ ] Keep R2 private; enforce signed/short-lived access and content-type/size validation.
- [ ] Add scheduled encrypted backup exports, manifest/checksum, retention, alerting and restore drill.
- [ ] Add operational metrics that do not leak customer data, credentials or payment references.
- [ ] Test account-level recovery from an independent export; D1 Time Travel alone is not an independent backup.

## Stage 5 — Dashboard and shared ecosystem integration

- [ ] Replace Supabase/Prisma runtime calls with the approved OmniPoint API only after backend contracts are stable.
- [ ] Keep frontend demo fixtures on preview-only routes; never mix them with production data.
- [ ] Integrate Otya Auth using server-side token validation and local role mapping.
- [ ] Give Next only explicit, audited, scoped actions; no direct D1 access.
- [ ] Publish public documentation through OtyaHub only after reviewing it for private infrastructure and sensitive details.
- [ ] Verify mobile/touch UX, poor-network handling, receipts, keyboard workflows and accessible errors.

## Stage 6 — Release gates

A stage is not complete until all are true:

1. CI build, lint, type checks, schema validation and tests pass.
2. A second review confirms the security boundary and data ownership.
3. Tenant-isolation tests pass against the exact schema intended for deployment.
4. Backups and restore have been tested for any stateful release.
5. Logs and alerts are active without exposing secrets or personal data.
6. No provider operation is represented as successful without provider truth.
7. Rollback steps are written and rehearsed.
8. The exact deployment target and affected resources are known.
9. Production activation is a separate controlled step; a preview deployment is not a production cutover.
