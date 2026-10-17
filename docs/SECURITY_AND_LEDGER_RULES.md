# Security and ledger invariants

These are implementation requirements, not claims that the prototype already enforces them.

## Ledger separation

- Every posted accounting entry has exactly one ledger type: `RETAIL` or `FINTECH_AGENCY`.
- Retail sales, cost of goods sold, inventory movements, and EFRIS metadata belong to retail workflows.
- Agency cash-in/out, provider float, and commission entries belong to fintech agency workflows.
- Cross-ledger transfers, if ever required, must be explicit, balanced, linked, and approved; never silently reclassify a transaction.
- Use decimal database types for money and integer minor units at provider boundaries where the provider contract requires them. Do not use JavaScript floating-point arithmetic for accounting totals.
- Posted ledger entries must be append-only. Corrections are compensating/reversal entries with a reason and audit record, not silent edits or deletes.
- Use database transactions and unique idempotency keys for posting; duplicate requests must not double-post.

## Provider transaction truth

- A local draft is not a provider transaction.
- Only a verified provider response or trusted status callback may transition a transaction to `SUCCEEDED`.
- Timeouts or ambiguous responses must remain `UNKNOWN`/pending until a provider status check resolves them.
- Never ask staff to enter or store customer PINs or OTPs.
- Store only the provider request/response fields needed for reconciliation. Redact secrets, authentication headers, PINs, OTPs, and unnecessary customer data from logs.
- A receipt must distinguish a local record from provider-confirmed success.

## Authentication and authorization

- Hash passwords with a modern password hashing algorithm; never store plaintext passwords.
- Enforce role permissions on the server for every protected action. Hiding a button is not authorization.
- Require re-authentication for sensitive operations; use a second approver for high-risk overrides where operationally feasible.
- Rate-limit authentication and provider initiation endpoints. Protect sessions with secure, HTTP-only, same-site cookies and CSRF defenses where applicable.
- Root administrator actions remain auditable; no role bypasses audit requirements.

## Audit trail

- Record actor, action, entity, timestamp, reason, request/correlation ID, and approved before/after state where safe.
- Audit events should be append-only at the application/database permission layer. Do not log passwords, tokens, PINs, OTPs, or full payment credentials.
- Stock adjustments, discounts above configured limits, reversals, ledger corrections, reconciliation approvals, and exports require audit events.
- Use UTC timestamps in storage and display local business dates consistently for Uganda operations.

## Data integrity and operational readiness

- Use database constraints, transactions, foreign keys, and least-privilege database roles.
- Backups must be encrypted, access-controlled, and restore-tested.
- Use separate development, staging, and production credentials and databases.
- Provider integration and EFRIS behavior must be validated against current official specifications and approved access before production claims.
- Production launch requires automated tests for role denial, idempotency, duplicate callbacks, ledger balancing, reversal handling, inventory concurrency, and reconciliation.
