# OmniPoint implementation gates

## Stage 0 — Isolated foundation

- [x] Dedicated OmniPoint D1, R2, KV and queue resources provisioned.
- [x] Separate OmniPoint migration-test D1 exists.
- [x] Existing Otya resources inventoried and protected from reuse.
- [ ] Dedicated OmniPoint Worker configuration and schema reviewed.
- [ ] Contract tests run against the isolated test database.
- [ ] No production route or custom domain attached.

## Stage 1 — Identity and staff authorization

- [ ] Confirm Otya Auth token issuer, signature algorithm/key, issuer, audience, expiry and revocation behavior from source and deployed configuration.
- [ ] Add OmniPoint local staff membership, company, branch, role, status and approval records.
- [ ] Require server-side identity-to-staff mapping on every protected API route.
- [ ] Add rate limiting and audit events for authentication failures and privileged operations.
- [ ] Never accept role or actor identity from request bodies.

## Stage 2 — Retail inventory and POS

- [ ] Product/SKU create, update, deactivate and read endpoints.
- [ ] Opening stock and adjustment endpoints with mandatory reason and before/after audit data.
- [ ] Atomic sale posting: receipt, sale lines, stock deduction, stock movements, balanced retail ledger and audit record in one transaction/batch.
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
3. Backups and restore have been tested for any stateful release.
4. Logs and alerts are active without exposing secrets or personal data.
5. No provider operation is represented as successful without provider truth.
6. Rollback steps are written and rehearsed.
7. The exact deployment target and affected resources are known.
8. Production activation is a separate controlled step; a preview deployment is not a production cutover.
