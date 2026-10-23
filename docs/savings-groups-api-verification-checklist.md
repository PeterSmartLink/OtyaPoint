# OmniPoint savings-group API verification checklist

The route module is a development foundation and must not be treated as production-ready.

## Required checks before merge
- Run TypeScript type-check and Worker build against the exact Cloudflare Workers/D1 types.
- Verify every mutation writes its business record and audit event atomically using D1 batch/transaction semantics.
- Ensure loan approval/rejection state changes and audit records are atomic, with conditional state transitions checked for actual affected-row count.
- Enforce group-scoped access policy for all reads and writes; a valid global token must not grant every group's private records.
- Add contribution/repayment reversal workflows that append compensating records and audit reasons; do not edit/delete posted financial history.
- Add loan balance calculation from disbursed principal and posted, non-reversed allocations. Reject overpayment and mismatched currency.
- Validate payment-method evidence; MOBILE_MONEY must not be considered received merely because a request body says so.
- Ensure D1 uniqueness errors map to 409 and all other failures fail closed with a request ID.
- Test malformed JSON, oversize payloads, invalid role, expired token, duplicate idempotency key, cross-group member ID, duplicate group/member/loan code, invalid status transitions, concurrent approval, and failed audit insert rollback.
- Keep loan disbursement disabled until an atomic cash/ledger posting flow and cash-availability check are implemented.
- Keep provider integrations and live payment calls disabled.

## Test command
Run the repository's quality workflow and the isolated SQLite migration tests. A passing SQLite schema test alone does not prove route correctness or production readiness.

## Safe rollout
Test only against the isolated `omnipoint-migration-test` D1 database. No production migration, DNS change, secret rotation, deployment, or live-money action is authorized by this checklist.
