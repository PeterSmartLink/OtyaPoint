# Quickteller Business: optional payment-provider readiness

Status: research and design only. No Quickteller account, credentials, API calls, payment collection, or live integration has been configured.

## What it may provide

Quickteller Business is an Interswitch merchant platform. Its official documentation describes:
- payment links and invoices for collecting customer payments;
- transaction and settlement reports, refund tracking, dispute management, audit history, and staff permissions;
- developer tools and test-mode onboarding before live credentials are issued;
- payment integration options including web checkout, card APIs, and non-card methods such as bank transfer, USSD, QR, and supported wallets, depending on merchant configuration and market availability.

Official references:
- https://docs.interswitchgroup.com/docs/quickteller-business
- https://docs.interswitchgroup.com/docs/overview
- https://docs.interswitchgroup.com/docs/non-card-payments
- https://interswitchgroup.com/ug/products

These published capabilities do not prove that every payment rail, terminal, or merchant feature is available to OmniPoint in Uganda. Before choosing Quickteller, obtain written confirmation from Interswitch of Uganda merchant eligibility, supported local payment methods, settlement currency/accounts, fees, settlement timelines, refunds, chargebacks, API/webhook access, and support/SLA.

## Where it could fit in OmniPoint

Quickteller would be an optional external payment processor—not OmniPoint's database, POS, inventory engine, accounting system, or source of truth.

Potential future use cases, after approval:
1. Accept remote customer payments for orders created in OmniPoint.
2. Generate a hosted checkout/payment link or invoice from an OmniPoint sale.
3. Receive verified payment notifications and update the related payment attempt.
4. Compare provider settlement reports with OmniPoint's provider-clearing ledger.
5. Support controlled refund and dispute workflows.

It must not be used as a replacement for Uganda mobile-money agent operations. A merchant payment gateway and an agent's cash-in/cash-out/float service are different products and require separate agreements and transaction flows.

## Required safe integration design

- Keep the provider behind a typed payment-adapter interface so OmniPoint remains provider-neutral.
- Store order/payment references, amount in UGX minor units, provider, status, timestamps, and reconciliation references in Cloudflare D1. Never store card PAN/CVV or provider secrets in D1.
- Generate an unpredictable, unique idempotency/reference value for each payment attempt.
- Use explicit states such as `CREATED`, `PENDING`, `SUCCEEDED`, `FAILED`, `EXPIRED`, `UNKNOWN`, `REFUND_PENDING`, and `REFUNDED`; do not assume a timeout means payment failed.
- Verify webhook authenticity and replay protection, then verify the transaction with the provider where supported. A browser redirect or screenshot is not proof of payment.
- Only post the sale, stock movement, receipt, and balanced ledger entries after a trusted payment result and a tested atomic posting path. Duplicate notifications must not post twice.
- Reconcile provider transactions against settlement reports and bank receipts. Record fees and settlement differences explicitly; never silently edit ledger history.
- Keep sandbox and production credentials separate in Cloudflare Worker secrets. Do not request or commit credentials in source code, logs, issues, or chat.
- Add contract tests with a fake provider first. Enable a real sandbox only after account eligibility and developer access are confirmed. Live collection stays disabled until business, legal/compliance, reconciliation, and rollback gates are approved.

## Recommended decision

Do not connect Quickteller yet. First finish Cloudflare-native identity, D1-backed inventory and double-entry ledger controls, and automated tests. Then evaluate Quickteller's Uganda-specific offer against other available options and integrate only if it fills a confirmed business need. This preserves the Cloudflare-first architecture while leaving a clean path for a future payment partner.
