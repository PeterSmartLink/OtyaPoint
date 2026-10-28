# Quickteller Web Checkout — sandbox implementation gate

This checklist is based on the official Interswitch Web Checkout documentation:
https://docs.interswitchgroup.com/docs/web-checkout

## What we can verify from public documentation

- The documented Web Checkout flow supports a Uganda example using currency code `800` (UGX).
- The sandbox/QA redirect form endpoint shown by the docs is `https://newwebpay-sandbox.interswitchng.com/collections/w/pay`.
- Required redirect-flow fields include `merchant_code`, `pay_item_id`, `txn_ref`, `amount`, `currency`, `cust_email`, and `site_redirect_url`.
- Amounts are supplied in the provider's documented minor-unit representation; do not convert or round an amount implicitly.
- A browser redirect/callback is not proof of payment. The backend must re-query the provider and validate transaction reference, final response code, and exact amount before fulfilling an order.

Public docs do not prove that this specific account has production access, an enabled UGX product, or agency cash-in/cash-out permissions.

## Required values — obtain from the user's Quickteller Business dashboard

- [ ] Merchant code
- [ ] Payable ID / pay item ID for the exact shop-checkout product
- [ ] Confirmed sandbox/test credentials or account configuration
- [ ] Confirmed UGX payment methods enabled for this account
- [ ] Approved redirect URL for the eventual environment
- [ ] The provider's current authentication and transaction-requery requirements for this account/API version

Do not paste credentials, private keys, or tokens into source code, issues, or chat. Configure secrets only in the appropriate server-side secret store when implementation is approved.

## Safe implementation sequence

1. Keep `DisabledPaymentProvider` as the default. Do not make payment requests unless an explicitly configured sandbox adapter is selected.
2. Build the checkout request using server-created OmniPoint transaction references; never accept a client-chosen amount or transaction status as authoritative.
3. Persist the OmniPoint transaction before redirecting, with a unique idempotency key and expected amount/currency.
4. Accept the browser return only as a signal to start server-side verification.
5. Re-query using the official account-specific API/authentication requirements. Match reference, amount and currency before any fulfillment or ledger posting.
6. Handle timeouts and ambiguous/pending responses as `UNKNOWN` or `PENDING`; query status before retrying.
7. Test duplicate returns, altered amount/reference, pending status, timeouts and failed transactions in sandbox.
8. Keep production endpoints and live credentials unavailable until the owner explicitly approves a separate release step.

## Explicitly out of scope until separately verified

- Airtime/data VAS
- Bill payments
- Agency cash-in/cash-out
- Agent float purchase
- Live money movement or production settlement

These are separate provider products and must not be inferred from Web Checkout access.
