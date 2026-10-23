# Open-source payment integration research for OmniPoint

Research date: 2026-10-23

## Objective

Find reusable implementation patterns for provider abstraction, idempotency, payment status, callbacks, reconciliation, and testing. OmniPoint is targeting Cloudflare Workers + D1 and the approved Uganda provider contracts. A repository claiming to support a network is not proof that it supports the provider's current official Uganda API or is safe to use in production.

## Candidate repositories and references

### 1. AfriLink OSS — African mobile-money SDK

Repository: https://github.com/SyncSphere7/Afrilink-oss

The public README claims a unified SDK for MTN MoMo and Airtel Money among other networks, with Uganda listed for MTN and Airtel. Its public page lists an MIT licence. It may be useful for studying common interfaces and country/provider configuration.

**Decision: inspect further; do not add as a runtime dependency yet.** This is a very new/small project in the search results. Before adoption, inspect source and release history, validate the actual Uganda provider implementations against official current docs, verify callback authentication and status enquiry behavior, check dependency vulnerabilities, and run its tests. Verify the exact licence file and licence of every dependency at the commit being considered. Do not copy credentials, undocumented endpoints, or code that bypasses provider agreements.

### 2. g-j4mb/payment-orchestrator — general payment orchestration

Repository: https://github.com/g-j4mb/payment-orchestrator

The public README describes a Java/Spring Boot multi-provider gateway with a common provider abstraction, idempotency, webhook handling, circuit breaking, audit logging, and crash-safe reconciliation. The README states MIT licence.

**Decision: design reference, not a direct dependency.** Its Java/Spring Boot/PostgreSQL stack does not match the Cloudflare Workers/D1 target. Review its state-machine, reconciliation, and test ideas; independently implement only the patterns appropriate for OmniPoint.

### 3. Zirzir — African mobile-money orchestration

Project page: https://recitelabs.com/products/zirzir/

The project page describes a self-hosted orchestration engine with provider plugins, integer-unit ledgering, idempotency, and signed webhooks, and describes itself as early release.

**Decision: research reference only.** Confirm repository/source availability, exact licence, maturity, provider coverage, and Worker compatibility before considering reuse. Do not assume a listed plugin supports the exact current Airtel Money Uganda or MTN MoMo Uganda contract.

## Patterns to reuse (implemented independently unless approved otherwise)

- Provider adapters behind a narrow internal interface; never leak vendor-specific status into the business ledger.
- Immutable operation IDs and idempotency keys with request fingerprint checks.
- Explicit transaction states including UNKNOWN, and provider status enquiry before any retry after ambiguous network outcomes.
- Callback signature verification using the exact provider contract, replay protection, and duplicate event handling.
- Append-only audit and compensating ledger entries for reversals.
- Circuit breaker/health state for routing only before a money-moving request is submitted.
- Unit tests, provider-mock integration tests, contract tests, sandbox tests, and reconciliation fixtures.
- Secrets isolated by environment; no credentials in source, docs, Postman exports, logs, or test fixtures.

## Cloudflare compatibility filter

Any dependency considered for production must be evaluated for:
1. Cloudflare Workers runtime compatibility (no reliance on unsupported Node/native APIs unless explicitly supported).
2. D1/SQLite transaction and concurrency assumptions.
3. Provider-specific official Uganda API correctness.
4. Idempotency across Worker retries, queue redelivery, and duplicate callbacks.
5. Security maintenance, dependency health, licence obligations, and reproducible builds.
6. Tests for timeout ambiguity, duplicated events, delayed/out-of-order callbacks, provider outage, and reconciliation mismatch.

## Provider documentation remains authoritative

- Airtel: https://developers.airtel.africa/developer (select Uganda)
- MTN MoMo: https://momodeveloper.mtn.com/
- MTN Uganda Open API overview: https://www.mtn.co.ug/helppersonal/mtn-open-api/
- Interswitch: https://docs.interswitchgroup.com/docs/home
- Quickteller Business: https://docs.interswitchgroup.com/docs/overview

No third-party library can replace the need to confirm product eligibility, merchant/agent onboarding, current authentication, callback verification, settlement, fees, and reversal rules with each provider.

## Status

No third-party payment library has been installed or copied into OmniPoint as part of this research. Provider adapters in this branch remain fail-closed scaffolds and do not send requests.
