# OmniPoint payment provider architecture

## Decision

Interswitch / Quickteller is the preferred first provider to evaluate for Uganda, not a hard dependency. OmniPoint owns its transaction IDs, business rules, ledger, audit trail, customer experience and reconciliation records. Provider references are stored separately. The adapter contract must let us replace or add a provider without rewriting the shop and agency workflows.

**Current state:** contracts and a safe disabled provider are defined. No Interswitch/Quickteller adapter exists, no credentials are configured, and no provider requests or real-money operations are enabled.

## Boundary

```text
Web / Android
    |
OmniPoint Worker API
    |
OmniPoint transaction + idempotency + ledger rules
    |
PaymentProvider contract
    |-- DisabledPaymentProvider (current safe default)
    |-- Interswitch/Quickteller adapter (future, after account/API verification)
    |-- Airtel adapter (future, if needed and approved)
    |-- MTN adapter (future, if needed and approved)
```

Clients must never call a provider directly or receive provider secrets. Keep all credentials in Cloudflare Worker secrets and use only documented endpoints/products available to this Ugandan account.

## Service capability is explicit

Online collections, shop checkout, airtime/data, bill payments, agency cash-in/cash-out, and float purchase are distinct capabilities. Do not infer that an online gateway supports agency cash operations. Enable each service only after the specific product, account eligibility, Uganda coverage, settlement flow and API contract are confirmed.

## Transaction safety requirements

1. Create an OmniPoint transaction ID before initiating a provider request.
2. Require a stable idempotency key for retries of the same logical operation.
3. Persist provider name and provider reference separately from the OmniPoint ID.
4. Use `PENDING`, `SUCCEEDED`, `FAILED`, `UNKNOWN`, `REVERSED` and `REFUNDED` states. A timeout is not proof of failure.
5. On timeout or ambiguous response, inquire by provider reference/idempotency key before retrying. Never blindly create a second money movement.
6. Verify webhook authenticity using the provider's documented signing scheme; deduplicate event IDs and confirm amounts, currency and references before posting.
7. Post financial ledger entries only through an atomic, audited business transaction. Callbacks alone must not bypass authorization or reconciliation.
8. Reconcile OmniPoint records against provider transactions, fees, settlements, refunds and reversals.
9. Keep secrets server-side, redact sensitive data from logs, and test failure/duplicate/out-of-order events in sandbox.
10. Do not enable live mode until sandbox tests, account eligibility, settlement/reconciliation, backup/restore and explicit owner approval are complete.

## Implementation sequence

- [x] Define provider-neutral types, status model and service capabilities.
- [x] Add a disabled implementation that performs no network calls and cannot claim success.
- [ ] Verify the exact Quickteller/Interswitch Uganda product, API version, credentials and permitted use from the user's developer account.
- [ ] Implement only the verified product's server-side adapter and documented callback/status verification.
- [ ] Add automated tests for idempotency, duplicate/out-of-order callbacks, timeouts, mismatched amount/currency, reversals, and reconciliation.
- [ ] Keep agency cash-in/cash-out disabled until their specific product access is confirmed.
- [ ] Review, test and approve before any deployment or live payment activation.

## Money representation

Use integer minor units and an explicit currency. Do not use floating-point values for money. Any provider-specific amount conversion must be isolated in that adapter and tested against the provider's actual Uganda documentation.
