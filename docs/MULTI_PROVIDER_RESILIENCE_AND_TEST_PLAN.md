# OmniPoint multi-provider resilience and test plan

## Decision

OmniPoint will be designed to support:
- Airtel Money Uganda
- MTN MoMo Uganda
- Interswitch / Quickteller products that are explicitly approved for this Ugandan business

Quickteller is an Interswitch product family, not automatically a separate independent payment rail. Configure the actual product (for example, hosted checkout, Quickteller Business, value-added services, or an approved agent product) separately. Do not count overlapping products as independent redundancy.

## Core resilience rule

Provider availability is a customer-choice and operations problem, not permission to duplicate money movement. If a provider is clearly unavailable before a request is sent, OmniPoint may offer another eligible provider. Once a request may have reached a provider, record the attempt as UNKNOWN and reconcile using the same stable reference/status enquiry before any alternative attempt. Never automatically switch provider after a payment timeout, ambiguous response, or missing callback.

The UI must show accurate states: Ready, Awaiting customer, Pending, Checking status, Confirmed paid, Failed, or Needs staff review. Only verified provider status confirms payment. A redirect, screenshot, SMS shown by a customer, or local timeout is not authoritative proof.

## Provider contract

Every provider/product adapter must implement the same internal contract only after its official Uganda documentation is available:
- capability discovery and explicit feature gate;
- sandbox authentication/token acquisition;
- collection initiation or service request;
- status enquiry by stable provider reference;
- callback verification using the provider's documented mechanism;
- provider-specific error mapping and rate-limit handling;
- idempotency/replay protection;
- reconciliation export/enquiry;
- redacted structured logs and correlation IDs.

Do not assume identical auth, callback signatures, amount units, transaction states, refund rules, or available capabilities across providers. Do not invent endpoints from tutorials. The provider console and current product documentation are the source of truth.

## Routing policy

1. Keep a per-provider/per-product operational state: disabled, sandbox-only, ready, degraded, or manually suspended.
2. Prefer explicit customer-selected method for checkout when more than one is available.
3. Automatic routing is allowed only before any provider request is sent and only among contract-approved eligible routes.
4. A provider-specific decline can be offered for a new attempt on another eligible route only if the provider contract confirms the first attempt is final and no debit occurred.
5. A timeout, connection reset after submission, unknown status, or callback delay must never trigger a second charge automatically.
6. Use circuit breakers to hide/deprioritize persistently failing providers; half-open probes must be non-financial status/health checks where supported, never synthetic real-money charges.
7. Keep customer payment attempts separate from shop inventory sales and agency cash/float ledgers.

## Ledger and audit requirements

- Use UGX integer minor units and convert only according to each provider's current API contract.
- Create immutable internal operation IDs and idempotency keys.
- Enforce unique idempotency key + request fingerprint and unique provider reference.
- Store append-only state transitions and audit events.
- Keep RETAIL, FINTECH_AGENCY, physical CASH, and provider FLOAT movements distinct.
- Book reversals as compensating entries; do not delete or edit posted entries.
- Record commissions only when verified by contract/provider report.
- Daily reconciliation must identify unmatched, duplicate, pending, reversed, and amount-mismatched records for human review.

## Cloudflare target architecture

- Workers: API, authorization, routing policy, provider adapters, callback verification.
- D1: canonical operations, idempotency, audit, ledger, provider refs, state history, reconciliation exceptions.
- Queues: deferred status checks and reconciliation work after safe idempotency and retry rules exist.
- Workflows: longer-running status/reconciliation workflows with persisted checkpoints, only after tests cover duplicate delivery and replay.
- KV: non-authoritative cache only; never the source of truth for money, balances, or payment status.
- R2: private reports/receipts only if needed, with access controls.
- Secrets: environment-scoped Worker secrets, separate sandbox and production. Never commit credentials or put secrets in Postman exports.

Do not deploy or create/change Cloudflare resources as part of this scaffold. Validate first in local Wrangler and the isolated test database.

## Test plan

### Stage 1 — local unit tests, no network
- all provider adapters fail closed by default;
- invalid origin and disabled environment rejected;
- no credentials in response, logs, OpenAPI examples, or collection;
- invalid amount (negative, fractional, unsafe integer, zero where disallowed) rejected;
- stable idempotency key with identical payload returns the same operation; changed payload conflicts;
- no second provider request after UNKNOWN;
- verified success is the only path that records a receipt;
- role denial and unauthenticated request;
- audit entry and ledger writes are atomic;
- retail and agency ledgers do not mix;
- duplicate provider reference rejected;
- webhook duplicate/replay rejected;
- bad signature/timestamp rejected;
- webhook body is verified using raw bytes per the actual provider contract;
- timeout marks UNKNOWN, never FAILED by assumption;
- provider decline maps to final failure only when documented;
- reversal creates compensating entries and preserves the original.

### Stage 2 — local integration with provider mocks
- collection initiation success, decline, timeout-before-response, connection reset after submission;
- status enquiry pending/success/failure/not-found;
- callback arrives before API response, after response, twice, out of order, or not at all;
- two concurrent requests reuse the same idempotency key;
- one provider degraded while others are healthy;
- all providers unavailable;
- D1 transient error before/after local writes;
- queue retry and dead-letter/manual review;
- daily reconciliation with missing, duplicate and mismatched records;
- simulated provider rate limits and malformed responses;
- customer cancels or abandons checkout;
- staff manually suspends a provider.

### Stage 3 — official sandbox tests
Only after the owner supplies/approves each current Uganda provider contract and sandbox access:
- provider-specific auth and token expiry;
- sandbox collection or supported service operation;
- status enquiry and callback verification;
- invalid signature, duplicate event, stale event;
- declined payment and ambiguous timeout;
- provider-specific amount/currency/reference conventions;
- reconciliation and supported refund/reversal behavior.
Tests must use synthetic customer details and sandbox-only credentials. Block known production hosts in the test harness.

### Stage 4 — release candidate and operational rehearsal
- clean install/build and database migration validation on isolated test D1;
- end-to-end inventory sale with mock payment, including stock and ledger invariants;
- cash-in/out simulation with float and cashbook invariants;
- backup/restore rehearsal and audit export;
- role-based security, rate-limit and request-size tests;
- provider outage tabletop drill and operator instructions;
- verify support escalation and a manual status-check process;
- written sign-off for every provider/product and separate explicit approval before live credentials, deployment or live transactions.

## Open-source research

Candidate: [Zirzir](https://recitelabs.com/products/zirzir/) describes itself as an early, self-hosted open-source mobile-money orchestration project with integer-unit ledgering, idempotency, signed webhooks, and provider adapters. It is useful as a design reference, not a drop-in dependency: its listed provider support and maturity do not establish compatibility with MTN Uganda or the exact Airtel/Interswitch products needed here. Before copying code or adding a dependency, inspect the actual repository, licence file, recent commits, security posture, supported providers, test coverage, and transitive dependencies. Do not copy proprietary provider SDKs or code with incompatible licensing.

Prefer small, well-understood dependencies and our own narrow adapter interfaces. Avoid adopting a whole payment orchestrator until a proof-of-concept demonstrates it supports Cloudflare Workers/D1, the required Uganda provider contracts, and the project's licence/security requirements.

## Official starting points

- Airtel Africa Developer Portal (select Uganda first): https://developers.airtel.africa/developer
- MTN Uganda Open API information: https://www.mtn.co.ug/helppersonal/mtn-open-api/
- MTN MoMo sandbox developer portal: https://momodeveloper.mtn.com/
- Interswitch API documentation: https://docs.interswitchgroup.com/docs/home
- Quickteller Business overview: https://docs.interswitchgroup.com/docs/overview
- Cloudflare Workflows overview: https://www.cloudflare.com/products/workflows/

Public overview pages do not prove that a specific product is approved or available to this business. Follow the authenticated Uganda console and provider agreement for exact endpoints, credentials, limits, status codes, callback signing and settlement rules.

## Current implementation status

Provider modules are deliberately non-operational scaffolds. They perform no provider network requests and cannot create a payment. Local tests and mocked provider behavior must be implemented and pass before sandbox adapters are enabled. Production readiness is not claimed.
