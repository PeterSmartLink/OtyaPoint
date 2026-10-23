# OmniPoint single-shop rollout

Status: draft implementation plan for the owner's own shop in Mbiriizi, Lwengo, Uganda.
Scope: one business, one shop, UGX reporting. This is not a multi-tenant SaaS rollout.

## First release outcomes

1. **Daily overview:** retail sales, gross margin estimate, cash in drawer, each provider float, expenses, agent commissions, and unresolved/pending operations.
2. **Inventory:** phone/accessory/electronics catalogue, purchase cost, selling price, stock receiving and adjustment history, low-stock alerts.
3. **Retail checkout:** receipt, payment method, stock decrement, cost-of-goods, ledger and audit event must succeed atomically or not at all. Do not enable sale posting until D1 atomicity/concurrency tests pass.
4. **Agent desk:** record cash-in, cash-out, airtime, data, bill payment, bank deposit/withdrawal and provider float adjustments. Each operation has a unique reference and idempotency key; provider state and the shop's local record are distinct.
5. **Cashbook and float:** append-only cashbook and float movements; calculate balances from entries rather than overwriting a running balance. Keep drawer cash, each provider float, retail accounting and agency accounting separate.
6. **Close-of-day:** enter counted physical cash and provider-reported float, compare against ledger-derived expected amounts, explain differences and require manager approval for final close.
7. **Owner controls:** roles, immutable audit history, duplicate-submit protection, reversals instead of deleting completed records, export and restore tests.

## Agent transaction safety rules

- Creating an operation is not a payment and must not imply provider success.
- Manual entries must be clearly labeled MANUAL / unverified until reconciled against an official provider receipt or statement.
- Provider states include pending, succeeded, failed, unknown and reversed. A timeout is unknown, not failed; never retry a money movement without idempotency protection.
- A reversal is a new linked event/entry; do not erase or rewrite the original transaction.
- Store amounts as integer UGX shillings; validate all amounts and commissions as positive/non-negative safe integers.
- Never store PINs, OTPs, full payment credentials or provider secrets in records or logs.
- Quickteller or any other provider remains optional. Live execution requires an approved Uganda partner account, official API/sandbox access, callback verification, settlement/reversal tests and explicit go-live approval.

## Implementation boundary

The accompanying D1 migration creates data structures only. It does not change an existing database, deploy a Worker, configure secrets, connect a provider, or authorize a live transaction. Routes and tests must be implemented and reviewed before the tables are used. The Wrangler configuration must remain pointed at omnipoint-migration-test throughout this work.

## Acceptance checklist

- [ ] Migration filename/order validation and schema application pass on disposable D1.
- [ ] Auth/role checks cover every read and write.
- [ ] Idempotency tests prove repeated requests cannot create duplicate operations or movements.
- [ ] Status transition tests reject impossible transitions and preserve event history.
- [ ] Cash and float totals are derived and reconcile to independent counted/provider-reported values.
- [ ] Pending/unknown/reversed operations are visibly distinguished from verified success.
- [ ] No provider API call, production write, secret change or deployment occurs without approval.
