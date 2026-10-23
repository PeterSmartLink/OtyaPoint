# Savings groups — core foundation

This is an additive D1 schema foundation for OmniPoint's small community savings groups. It is intentionally limited to data structures; it does not expose write endpoints or move money yet.

## Included records
- Groups and configurable contribution frequency/share unit.
- Members with group-scoped member codes.
- Savings and share contributions with unique idempotency keys.
- Loans with approval/disbursement lifecycle fields and optional guarantor/schedule metadata.
- Repayments with explicit principal, interest, fee and penalty allocation.
- Group-scoped audit events.

## Money and integrity rules
- Store amounts as integers, never floating-point values. For UGX, integer amounts represent whole shillings; for currencies with minor units, use a documented minor-unit convention consistently.
- Every contribution, loan request, and repayment carries an idempotency key to prevent accidental duplicate posting.
- A repayment's amount must equal its principal, interest, fee and penalty allocations.
- Foreign keys prevent records from being attached to a member in another group.
- Reversals must be represented explicitly and audited; do not delete posted financial records.
- Loan approval and disbursement are separate states. A request must not be treated as disbursed merely because it was approved.
- Keep savings-group records separate from retail and agency-service ledgers.

## Before enabling API routes
1. Add migration to an isolated D1 test database and verify SQLite/D1 compatibility.
2. Add authenticated, role-checked routes with server-side validation and atomic D1 batches/transactions where supported.
3. Derive balances from posted, non-reversed entries; never trust a client-supplied balance.
4. Add tests for duplicate requests, cross-group access, repayment allocations, reversals, insufficient permissions, and concurrent updates.
5. Review lending rules, disclosures, privacy, retention, and Uganda regulatory requirements before any live use.

No live provider calls, production deployment, data migration, or secret changes are part of this foundation.
