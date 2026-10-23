# OmniPoint multi-provider static-egress relay preparation

**Status: design/code-preparation only. Not deployed. No AWS resources, Elastic IPs, provider credentials, production allowlists, or live payments are enabled.**

## Goal

Prepare one narrowly scoped outbound relay that can support multiple provider adapters without moving OmniPoint's application or financial source of truth away from Cloudflare Workers + D1. The relay is only an egress boundary for provider calls whose approved contract requires a stable source IPv4 address.

- **Cloudflare Worker:** authenticate the user/business request, authorize role and operation, validate the operation, enforce idempotency, write the D1 operation/audit state, select the provider adapter, and interpret provider-specific outcomes.
- **Cloudflare D1:** canonical operational and financial records, idempotency, provider-operation state, audit trail, reconciliation. Never dual-write ledgers to AWS.
- **AWS relay (future, isolated):** authenticate signed Worker requests, enforce provider-specific fixed destination/method/path, forward only approved sandbox requests, redact diagnostics, return a bounded untrusted response. It must not make accounting decisions or mark a payment successful.
- **Provider adapters:** separate contract modules for Airtel Money Uganda, MTN MoMo Uganda, and Interswitch/Quickteller. A provider being listed here does not mean its contract, credentials, sandbox, or allowlist requirement has been confirmed.

## Provider readiness matrix

| Provider | Contract / allowlist status | Required next evidence |
|---|---|---|
| Airtel Money Uganda | Not confirmed for this OmniPoint merchant/product/environment | Merchant product, sandbox base URL, collection/disbursement scope, source-IP allowlist rule, auth/signature, callbacks, status enquiry, idempotency and test credentials |
| MTN MoMo Uganda | Public MTN material confirms a developer sandbox; a public MTN MoMo API reference describes an IP-not-authorized response for some disbursement calls, but Uganda product applicability must be confirmed | Confirm exact Uganda API product and whether sandbox/UAT needs IP allowlisting; collect current Uganda-specific portal contract and test credentials |
| Interswitch / Quickteller | Not confirmed | Exact product/merchant profile, sandbox endpoints, source-IP rule, auth, request signing, callbacks/status enquiry and idempotency |
| Multiple providers | Architecture target only | Confirm each provider independently; do not assume a single IP rule or API contract applies to all |

**Region rule:** do not choose or provision a region until each intended provider confirms whether the source IP must be in a particular geography/network, and latency has been measured. Mumbai is currently the lowest-cost candidate among regions previously compared, not a confirmed selection.

## Worker-to-relay request authentication contract

Use HMAC-SHA-256 over an unambiguous canonical request. Suggested canonical string, each line separated by a single LF and with no trailing LF:

1. HTTP method in uppercase.
2. Exact URL path, including query string in the exact transmitted order/encoding.
3. Lowercase hex SHA-256 of the exact raw request body bytes (empty body hashes as SHA-256 of zero bytes).
4. Unix timestamp in seconds.
5. Random nonce (at least 128 bits, encoded as base64url or hex).
6. Provider key identifier (non-secret, for rotation).

Headers: X-Omni-Timestamp, X-Omni-Nonce, X-Omni-Key-Id, X-Omni-Signature. Compare signatures in constant time. Reject missing/malformed fields, timestamps outside a short approved window (initial proposal ±60 seconds), unknown key IDs, and replayed (key_id, nonce) values. Replay prevention must use a durable atomic store with expiry; do not rely on process memory alone. Keep separate keys for test and production and allow rotation overlap only by explicit configuration.

Never accept a provider URL from the caller. The request carries a provider enum and a contract-defined operation; the relay maps these to a fixed host, path prefix, HTTP method, content type, and required headers. Reject arbitrary host, port, scheme, path traversal, redirects, unsupported methods, oversized body/response, and unexpected content types. Enforce DNS/IP protections against private/link-local destinations and DNS rebinding where applicable. Set short connect/read/total timeouts and bounded concurrency/rate limits. Never log credentials, signatures, phone numbers, account identifiers, full bodies, or provider tokens.

## Payment outcome rules

- A relay HTTP 2xx is transport success only, **not** proof a payment succeeded.
- The Worker validates the provider-specific response schema and correlation/reference IDs.
- Any timeout after a request might have reached the provider becomes **UNKNOWN / RECONCILIATION_REQUIRED**, never automatically FAILED.
- Query provider status or consume authenticated provider callbacks according to the provider contract before final state transitions.
- Idempotency keys and provider references must be persisted in D1 before submission. Do not blindly retry non-idempotent requests.
- Only reviewed Worker service logic can trigger balanced, append-only D1 ledger posting; reversals are compensating entries.
- Browser/client traffic must never reach the relay directly.

## Isolated infrastructure shape (review only)

Future Terraform or equivalent should be kept under a dedicated infra/aws-egress-relay/ directory and must default to a non-production sandbox mode. Proposed minimal first iteration: one small Linux ARM64 EC2 instance + one Elastic IP, one dedicated security group, minimal inbound access (prefer SSM Session Manager rather than public SSH if account prerequisites are met), host firewall, dedicated unprivileged service account, TLS termination, patching, process supervision, log redaction and budget alarms.

Do not include or provision a NAT Gateway, RDS, DynamoDB, S3, queues, load balancers, or a second database unless a reviewed requirement demonstrates a need. Replay storage can be designed behind an interface, but do not silently introduce a second financial database. Choose a replay store only after evaluating the smallest safe option and its durability/cost; for the initial sandbox, fail closed if durable replay protection is unavailable.

Terraform files, if added, must use explicit variable inputs, no default production values, no embedded secrets, least-privilege IAM, immutable image/AMI selection where practical, encrypted volumes, restricted network rules, resource tags, and a destroy/rollback runbook. No automatic apply/deploy workflow. A plan must be reviewed before any apply.

## Test gates before any provider sandbox call

1. Unit tests for canonicalization (raw bytes, query encoding, case normalization, empty body), valid signatures, tampering, stale/future timestamp, missing key, key rotation, constant-time comparison review.
2. Replay tests including concurrent duplicate nonce submissions and replay-store outage; outage must fail closed.
3. Destination tests: allowlisted sandbox host/path/method only; reject user-controlled URL, redirects, non-HTTPS, private IPs, unexpected DNS resolution, oversized response and unsupported content types.
4. Network tests: short timeout, cancellation, rate/concurrency limits, provider outage and ambiguous timeout.
5. Logging tests prove secrets and sensitive fields are redacted.
6. Contract tests with synthetic fixtures for each provider, without real credentials or network access.
7. Confirm Worker remains the sole authority for payment state and D1 ledger invariants; no AWS ledger writes.
8. Review Cloudflare route/auth/session lifecycle before connecting this relay. Existing Cloudflare API scaffold explicitly is not production-ready and is not wired to the dashboard auth flow.
9. Separate approval before creating AWS resources; separate approval again before any production allowlisting, production credentials, or live transaction.

## Cost and approval

Current planning estimate for an always-on t4g.micro plus one public IPv4 is about **$7.74/month base in Mumbai**, before disk, transfer, logs, taxes and other charges; a planning range of **$9–12/month** was previously estimated. The account's Free Tier/credit eligibility has not been verified, so this is not assumed to be free. AWS charges for public IPv4 addresses and idle Elastic IPs. No resources are created by this document.

Reference: [AWS Elastic IP documentation](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html), [AWS VPC pricing](https://aws.amazon.com/vpc/pricing/), [MTN Uganda Open API overview](https://www.mtn.co.ug/helppersonal/mtn-open-api/).

## Explicit non-goals

No production changes, DNS changes, Cloudflare deployment, changes to existing Otya Workers, D1 production migration, live payment enablement, provider credential creation, IP submission to providers, AWS resource creation, or AWS spending authorization.
