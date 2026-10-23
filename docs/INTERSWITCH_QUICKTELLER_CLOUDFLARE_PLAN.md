# Interswitch + Quickteller integration plan for OmniPoint

## Decision and scope

OmniPoint is a private, single-shop operating system for the owner's Uganda business. The approved platform is GitHub + Cloudflare; Postman is for testing. Do not use Supabase, Appwrite, or Vercel as target services. Do not deploy, change secrets, mutate production data, or process live transactions without explicit owner approval.

Build one internal payment/agency orchestration layer. Interswitch and Quickteller are related product families, not automatically two independent rails. Each operation must select one explicitly configured product/route. Never retry the same business operation through a second product merely because the first is slow or uncertain.

## Selected capabilities

1. Mobile-money agency: cash-in/out only through a specifically authorized Uganda agent product and channel. Quickteller Agent/Paypoint availability and the exact API contract must be confirmed with Interswitch; a merchant checkout API is not a substitute for agent permissions.
2. Airtime and data: Quickteller SVA/value-added-services API only after confirming Uganda network/product catalogue, currency, funding instrument and agent agreement.
3. Bill payments: Quickteller SVA biller catalogue, customer validation, payment advice and transaction enquiry only where the Uganda contract supports the required biller.
4. Shop customer payments: Quickteller Business/Interswitch Payment Gateway for a sale-linked checkout, subject to Uganda onboarding and enabled payment channels.
5. Bank/card/USSD: use only channels explicitly enabled on the approved merchant account; prefer hosted checkout/tokenized provider flows. OmniPoint must never store raw card PAN/CVV.
6. Float purchase and balance tracking: record owner-entered and provider-confirmed float movements separately. If the provider does not expose a balance API, label balances as locally calculated/last reconciled, not real-time provider balances.

## Cloudflare architecture

- Cloudflare Worker: authenticated API, business rules, provider adapter, signature verification and rate limiting.
- D1: canonical records for operation attempts, idempotency, status history, cashbook, float movements, sale linkage, provider references and audit.
- Queues/Workflows: later, for retries/status enquiries and reconciliation jobs. A retry must reuse the same operation/idempotency identity and must not blindly repeat a money-moving POST.
- R2: only for private receipt/report exports if needed; never store card secrets.
- KV: non-authoritative cache only (e.g. short-lived catalogue cache), never balances or transaction status source of truth.
- Postman: local Wrangler first; approved provider sandbox only after endpoint/auth details and test credentials are confirmed. Credentials are environment secrets, never collection variables or committed files.

## One transaction model

Every operation has an OmniPoint-generated immutable operation ID and idempotency key, a unique provider reference when assigned, service type, provider/product, UGX amount in integer minor units as required by the exact API, customer/biller reference, actor, timestamps, and append-only status events.

Use states such as DRAFT -> PENDING -> SUCCEEDED / FAILED / UNKNOWN -> REVERSED. UNKNOWN means do not retry or tell the customer it failed; query the provider and reconcile. Only a verified provider response or verified transaction enquiry may set provider-confirmed success. A browser return/redirect or user screenshot is not proof of payment.

Separate accounting:
- RETAIL ledger: sale, inventory/COGS, fees and verified customer receipt.
- FINTECH_AGENCY ledger: cash-in/out, airtime/data/bills, commissions and provider settlement.
- Cashbook: physical cash movements.
- Float ledger: append-only float purchases and consumption.
Do not count a retail payment as agency turnover, or a provider transaction as a second payment receipt. Commission is recorded only when supported by the approved contract/provider record.

## Duplicate prevention and failure handling

- Unique database constraint on idempotency key scoped to business operation.
- Unique constraint on provider + provider transaction reference when supplied.
- Store request fingerprint; reject reuse of an idempotency key with different amount/service/customer.
- Use atomic D1 batch/transactional patterns for local state and ledger writes.
- Verify provider signatures over the exact raw request bytes; check timestamp/replay window and deduplicate event IDs.
- On timeout after sending a provider request, mark UNKNOWN and query by stable reference; do not issue a fresh payment request.
- Record reversals as compensating entries; never edit/delete the original posted ledger movement.
- Daily reconciliation compares OmniPoint's expected activity with provider statement/transaction enquiry and separately counted cash/float. Mismatches go to an exception queue, not silent balance adjustment.

## Postman test stages

A. Local safety tests now: health, auth/role denial, invalid payloads, duplicate idempotency keys, repeated callbacks, amount/currency validation, disabled sale/agency/reconciliation endpoints returning 501, and proof no provider network request is made.

B. Sandbox contract tests after provider access is approved: auth/token, catalogue reads, customer validation, successful simulated payment, declined payment, timeout/UNKNOWN enquiry, duplicate request, invalid signature, duplicate webhook/event, reversal/void if supported, and transaction search/reconciliation. Use synthetic customers and sandbox-only amounts. Tests must not point to production hosts.

C. Never place production URLs or credentials in the default Postman collection. Do not enable a provider adapter by changing only an environment variable; require explicit feature gate plus reviewed config and tests.

## Required gates before any live operation

1. Interswitch confirms in writing which Uganda products/APIs are enabled for this business: Quickteller Agent/Paypoint, Quickteller SVA, Quickteller Business/IPG, and each required channel.
2. Obtain product-specific current docs, test credentials, currency/amount conventions, settlement/commission schedules, reversal rules, status enquiry and callback-signature details.
3. Pass Worker unit/integration tests and Postman sandbox tests, including duplicate and timeout cases.
4. Verify D1 schema and migration integrity on the isolated `omnipoint-migration-test` database only.
5. Review authentication, role checks, audit, rate limits, secret handling, backups and reconciliation.
6. Owner explicitly approves any production secrets, deployment, production data migration and live processing. Until then all financial endpoints remain disabled.

## Official references checked

- Interswitch Uganda products: https://interswitchgroup.com/ug/products
- Interswitch Uganda solutions: https://interswitchgroup.com/ug/solutions
- Interswitch platform API documentation: https://docs.interswitchgroup.com/docs/home
- Quickteller Business overview/onboarding: https://docs.interswitchgroup.com/docs/overview
- Quickteller Value Added Services overview: https://docs.interswitchgroup.com/docs/value-added-services-overview
- Quickteller Agent onboarding: https://selfservice.interswitchgroup.com/support/solutions/articles/48001248352-how-do-i-get-started-as-an-agent-

These public references describe product families but do not establish that every API or channel is available to this specific Ugandan business. Confirm contract eligibility and exact country-specific API docs before implementation.
