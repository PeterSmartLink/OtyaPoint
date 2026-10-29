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

## Uganda eligibility and product boundary

Quickteller Business may provide hosted payment links/invoices, transaction and settlement reports, refund/dispute workflows, and supported checkout rails depending on the merchant account and market. Public documentation does **not** prove that all features or rails are available to Otya Hold Ltd in Uganda.

Before selecting this provider, obtain written confirmation from Interswitch of:
- Uganda merchant eligibility and the exact enabled product.
- Supported UGX methods, settlement account/currency, fees, and settlement timelines.
- Refunds, chargebacks, dispute handling, API/webhook access, and support/SLA.
- Current account-specific authentication, transaction-requery and sandbox requirements.

Quickteller merchant checkout is **not** a substitute for mobile-money agent cash-in/cash-out, agent float purchase, airtime/data VAS or bill-payment services. These require separate products, agreements, provider adapters and reconciliation controls.

Quickteller remains an optional processor. Cloudflare D1 is the source of truth for orders, payment attempts, inventory and ledger. Never store card PAN/CVV or provider secrets in D1. The provider remains disabled until a sandbox is explicitly configured and all tests pass; live collection requires separate owner approval.
