# AWS supporting-services plan for OmniPoint

## Why AWS is included

AWS is being considered specifically to satisfy payment-partner **server source-IP allowlisting**. A partner such as Airtel Money may require API requests to originate from a known, stable public IPv4 address. Cloudflare Workers do not provide a dedicated static outbound IP by default.

The intended design is hybrid, not a second application stack:
- **Cloudflare Workers:** primary application API, authentication/authorization, business rules, provider-neutral orchestration.
- **Cloudflare D1:** canonical operational database and financial records (inventory, sales, cashbook, float, idempotency, payment operations, audit and ledgers).
- **AWS static-egress relay:** narrow outbound gateway only for a partner whose approved integration requires a fixed public source IP.
- **GitHub:** source and CI; Postman/local mocks for tests.

AWS must not become a second ledger or source of truth. Do not dual-write financial state to AWS.

## Proposed outbound relay (not deployed)

For low-volume server-to-server API calls, evaluate a small, hardened AWS compute instance with an attached Elastic IP, or another AWS design only after comparing total monthly cost and operational overhead. The partner should allowlist the actual public Elastic IP used for outbound calls. Never guess an IP or use the phone's IP.

A second option is Lambda in a private VPC with outbound traffic through a NAT Gateway carrying an Elastic IP. This can provide controlled static egress but may have materially higher fixed monthly cost. Do not choose it without a cost estimate. The relay itself is not a payment processor and must not update balances or decide whether a payment succeeded.

### Mandatory relay controls

- Accept only authenticated server-to-server calls from the OmniPoint Worker using a strong request signature (HMAC over method, exact path, body hash, timestamp and nonce) or a reviewed mutually authenticated channel.
- Reject expired timestamps and reused nonces; use durable replay protection with short retention.
- Allow only the approved partner hostnames and documented API paths; fixed destinations, no user-controlled URL, redirects disabled or strictly revalidated.
- Permit only required HTTP methods and content types; cap request/response sizes, enforce short timeouts and rate limits.
- Keep provider credentials on the server side only; use a secret store or protected environment, rotate credentials, and never return credentials to Cloudflare or the browser.
- Redact tokens and sensitive payload fields from logs. Log correlation IDs, timestamps, response classes and elapsed time only.
- Apply least-privilege IAM, minimal inbound ports, OS patching, host firewall rules, TLS, alarms, and a documented update/rollback process.
- Fail closed on missing credentials, failed signature, invalid destination, rate limit, or unknown configuration.
- Return the provider's result as an untrusted response to the Worker. Only the Worker service layer, after provider-specific validation and status enquiry rules, may update operation state. A timeout after possible submission means UNKNOWN, not FAILED.
- Do not allow the relay to accept browser/client calls or perform arbitrary shell commands.

Cloudflare Workers' source IPs may not be fixed, so an IP allowlist alone cannot authenticate Worker-to-relay traffic. The relay must verify the request signature. The partner allowlist concerns the relay's outbound source IP; the relay's inbound authorization is a separate control.

## Provider allowlist verification

Before creating the relay or submitting any IP to the partner:
1. Confirm the exact provider and product (for example Airtel Money Uganda collection vs disbursement).
2. Confirm whether allowlisting applies to sandbox/UAT, production, or both.
3. Obtain the provider's documented destination hosts, TLS requirements, request contract, callback rules, status enquiry and idempotency requirements.
4. Verify the actual outbound public IP from the provisioned server using a controlled egress check and confirm it remains stable after restart/redeployment.
5. Ask the provider to allowlist that exact address in the correct environment; never allowlist an unverified IP.
6. Test only with synthetic customers and sandbox credentials, and block production hosts in tests.
7. Keep live processing disabled until contract approval, sandbox tests, reconciliation, security review and explicit owner approval.

See also `docs/AIRTEL_MONEY_UGANDA_HANDOFF.md`, which identifies the Airtel developer portal as the authoritative source for the Uganda-specific product contract.

## Current AWS inventory

Read-only inventory of enabled AWS regions found no Elastic IP allocations, EC2 instances or NAT Gateways. In eu-west-2 it also found no S3 buckets, Lambda functions, DynamoDB tables, SQS queues, RDS instances, API Gateway v2 APIs or completed CloudFormation stacks. This is a scoped inventory of those resources, not proof that every AWS service or every region is empty.

No AWS resources have been created by this plan. Do not create billable resources automatically; first produce an itemized cost estimate and obtain explicit approval for the proposed deployment and spending limit.

## Cost and deployment choices

Compare at least:
- A small EC2 instance + Elastic IP (low traffic, but requires OS patching and service hardening).
- Lambda + private VPC + NAT Gateway + Elastic IP (managed compute but higher fixed networking cost is possible).
- Any available provider-accepted Cloudflare dedicated-egress offering (may have plan/add-on constraints).

Include region, hourly compute, public IPv4/EIP, data transfer, NAT charges if applicable, logs/alarms, backup, and tax in the estimate. Free-tier eligibility is account-specific and must not be assumed. Do not add S3, RDS, DynamoDB, queues or a second database just because AWS is connected.

## Data and financial safety

- No production data, payment credentials, PINs, OTPs, raw card data or provider secrets in development resources.
- Use synthetic test records only.
- Financial events remain append-only in D1; an AWS backup is a recovery copy, never a second live ledger.
- Do not store provider secrets in Git, client bundles, Postman exports or chat.
- The relay cannot mark a payment successful based only on HTTP 200 or a browser redirect. Validate provider-specific response fields and verify final status through the approved status-enquiry/callback contract.
- Reversals are compensating entries; never edit/delete posted ledger entries.

## Delivery gates

1. Confirm the provider's exact IP allowlist requirement and sandbox behavior.
2. Present an itemized monthly cost estimate and least-privilege architecture.
3. Obtain explicit approval before creating any AWS resource or reserving an Elastic IP.
4. Deploy only an isolated relay with no production data and no live credentials.
5. Test signature verification, replay rejection, destination restrictions, timeouts, redaction and stable outbound IP.
6. Run approved provider sandbox tests, including ambiguous timeout and status enquiry.
7. Keep production credentials, production allowlisting, live deployment and real money movement behind separate explicit owner approval.
