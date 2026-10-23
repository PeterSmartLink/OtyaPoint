# Airtel Money Uganda integration handoff

OmniPoint is being prepared for the owner's Airtel API implementation from the official developer console. This document is a checklist, not a claim that Airtel is connected.

## Official starting point

- Airtel Africa Developer Portal: https://developers.airtel.africa/developer
- Airtel portal country selection includes Uganda. Select Uganda before registering/reviewing the application.
- Airtel's public developer announcement describes payment collection and wallet disbursement APIs, but the logged-in country-specific console and the product approved for the business are authoritative: https://www.airtel.africa/assets/pdf/press-release/Airtel-Africa-Developer-Portal_ENGLISH.pdf

## What the owner should create in the console

1. Select Uganda as the operating country.
2. Create or select the OmniPoint application.
3. Add only the Airtel Money products needed for the first stage (start with collection for shop checkout if available to this business; request disbursement only if there is a real approved use case).
4. Enable the sandbox/UAT product and obtain sandbox credentials.
5. Download or copy the exact country/product API documentation and sample requests from the logged-in console.
6. Confirm OAuth/token endpoint, scopes, required headers, API origin, payment request schema, status enquiry, callback/webhook signature verification, idempotency/reference rules, timeout behavior, reversals/refunds, limits, fees and currency rules.
7. Keep production/live access disabled.

## How to share the contract safely

Share the documentation text, endpoint paths, non-secret example payloads and sample responses here or in the repository. Do **not** share client secrets, access tokens, PINs, private keys, production credentials or real customer details. If a screenshot contains a secret, redact it first.

Store credentials only as Cloudflare Worker secrets in the isolated test environment when we explicitly prepare the sandbox. Never put them in GitHub source, a Postman collection, a browser environment variable, or chat. Do not set any production secrets or deploy without the owner's explicit approval.

## Adapter contract and current behavior

- `cloudflare-api/src/providers/airtel.ts` defines typed operation/config contracts and a fail-closed placeholder.
- It does not call Airtel, mint tokens, or initiate any transaction.
- `submitAirtelOperation` returns `NOT_CONFIGURED`; it never fakes a success.
- The Worker does not route financial operations to this module yet.
- Even when sandbox credentials are available, the adapter must remain disabled until the exact Uganda contract is reviewed and local tests prove the safe behaviors.

## Implementation sequence after docs are supplied

1. Add token acquisition using the exact documented grant and audience; cache only for the documented lifetime, with a safety margin.
2. Implement collection first, using a stable OmniPoint operation ID/idempotency key and the documented Airtel reference fields.
3. Implement status enquiry before treating an operation as complete.
4. Verify callbacks from raw request bytes using Airtel's documented mechanism, replay protection and event deduplication.
5. Cover success, decline, pending, timeout/unknown, duplicate request, invalid signature, callback replay and status enquiry in local unit tests and approved sandbox Postman tests.
6. Add disbursement/refund only if explicitly required and contractually enabled.
7. Keep retail and agency ledgers separate; only verified final status may post a financial ledger entry. Unknown status must be reconciled, never blindly resubmitted.
8. Production remains out of scope until security review, partner approval, reconciliation tests and explicit owner approval.

## Safety invariant

This repository scaffold is not a live Airtel integration. No provider requests, payments, refunds, disbursements, deployments, production database changes or secret changes are performed by these files.
