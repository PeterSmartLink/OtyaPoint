# OtyaPoint Agency Operations and Provider Contract

**Scope:** OtyaPoint is the shop/agency application operated by Otya Hold Ltd T/A OmniPoint. This document defines the target business and provider boundary; it does not claim that provider execution is implemented or live.

## Operating modules

1. **Cash counter:** opening/closing cash, cash-in/cash-out requests, cash movements, safe/hand-over controls and shift summaries.
2. **Provider float:** opening float by provider and agent account, purchases/top-ups, transfers, usage, low-float alerts and closing balances.
3. **Commissions:** expected provider commission, received commission, adjustments, payout/reconciliation and variance reporting.
4. **Airtime/data and bills:** catalogue and pricing policy, customer request, provider reference, pending/confirmed/failed state, receipt and reconciliation.
5. **Retail shop:** products/SKUs, supplier purchases, stock movements, sales, returns and cost of goods; separate from agency float/settlement.
6. **Staff and shifts:** server-validated role/branch scope, shift opening/closing, cash counts, supervisor review and audit history.
7. **Operations dashboard:** pending/unknown transactions, low float, unmatched provider settlements, cash variance, failed jobs and backup/recovery status.

## Transaction state machine

Use durable states:
- **created** — locally recorded and validated; not sent to provider.
- **submitted** — request dispatched with idempotency key.
- **pending** — provider accepted but final outcome is not known.
- **confirmed** — trusted provider response or server-side status query confirms completion.
- **failed** — trusted provider evidence establishes failure.
- **unknown** — timeout or ambiguous response; reconciliation required before retry.
- **reversal_pending** — reversal requested and awaiting provider confirmation.
- **reversed** — provider confirms reversal.
- **reconciliation_required** — local and provider records disagree.

Do not treat a browser redirect, client toast, HTTP 200 from an intermediary, or missing callback as proof of success. Do not automatically retry a non-idempotent money movement after timeout.

## Provider adapter interface

Implement each provider behind a versioned adapter with a common internal contract. Provider-specific payloads and signatures must never leak into the UI.

Expected operations:
- capability discovery and readiness status;
- authenticated submit with server-generated correlation/idempotency key;
- trusted status lookup;
- callback signature verification and replay protection;
- reversal/refund where contractually supported;
- settlement/commission report ingestion;
- provider error normalization and retryability classification;
- sandbox mode and redacted diagnostics.

Provider-specific adapters may differ in capabilities. Expose unsupported operations rather than pretending all providers behave identically.

## Provider priority and replaceability

Interswitch/Quickteller, Airtel Money and MTN Mobile Money are candidate/target integrations. Maintain one provider-neutral business transaction model and separate adapters, credentials, callbacks, limits and settlement rules.

Developer-account access does not prove production approval or live credentials are available. Store secrets only in protected server-side bindings/secrets. Never place provider credentials in Flutter, browser code, public repositories or logs. Use sandbox credentials and partner-approved test cases first. A live adapter remains disabled until provider approval, callback verification, reconciliation and operational support are accepted.

## Ledgers and invariants

Keep separate accounts and entries for physical cash; provider float per provider/account; customer cash-in/cash-out obligations; retail sales and cost of goods; expected/received commissions; provider settlement and fees; and refunds/reversals/reconciliation adjustments.

Financial records are append-only. Correct errors through compensating entries, never silent edits. Each posted transaction must be idempotent, auditable and balanced. Retail stock deduction, sale record, ledger entries and audit record must commit atomically or roll back together.

## Staff authorization

Every protected operation must validate authenticated identity from trusted Otya Auth; active local staff membership; company/branch scope and role; operation limits and supervisor approval; idempotency key and amount/currency; rate limits and audit event.

Never accept actor identity, role, company or branch from a request body as authoritative. Owner-only administration and high-value overrides require server-side step-up and explicit action-bound approval.

## Reconciliation and exception queue

Reconcile local versus provider transaction; local cash/float movement versus provider statement; expected versus received commission; pending/unknown transactions past SLA; duplicate callbacks/provider references; opening balance + movements = closing balance; and retail stock opening + receipts - sales/returns/adjustments = closing quantity.

Every variance must create a reviewable exception with amount, reference, age, owner and resolution history, with customer data redacted from logs.

## Operational resilience

Durable queue processing happens only after the initiating transaction commits. Consumers are idempotent; retries are bounded and exhausted messages enter a dead-letter/review queue. Provider outages trigger health status and a clear unavailable/pending message. Do not fail open to a second provider for the same in-flight financial operation; resolve status first.

Use Cloudflare D1 transactions/batches for atomic local state and Queues/Workflows for asynchronous retries/reconciliation where supported. Back up operational records and verify restore in isolation. Alert on low float, aged unknown transactions, callback signature failures, cash variance, reconciliation mismatch and backup failure.

## Implementation gates

Before real-money activation:
1. Confirm authoritative data source and preserve legacy records.
2. Verify Otya Auth signature, issuer, audience, expiry, revocation and staff role enforcement.
3. Complete schema migration and idempotent ledger/stock tests.
4. Complete provider sandbox submit/status/callback/reversal tests.
5. Verify callback signature and replay protection against real provider documentation.
6. Test timeout/unknown-state reconciliation and duplicate callback handling.
7. Reconcile cash, float, commission and settlement reports against provider evidence.
8. Perform independent backup and restore test.
9. Test staff separation, limits, audit, redaction, incident alerts and rollback.
10. Obtain partner approval and explicit owner authorization for production activation.

Until all gates pass, show the integration as NOT_READY or SANDBOX_ONLY, never LIVE.
