# InterSwitch Bills Payment sandbox client

This is an **isolated contract client**, not a live integration. It is intentionally not wired into the Worker request router, D1 ledger, UI, queues, or any production workflow.

## File

`src/providers/interswitch-bills-sandbox.ts`

## Implemented client operations

- Fetch billers: `GET /v1/vas/billers`
- Fetch payment items: `GET /v1/vas/billers/payment-item?biller-id=...`
- Validate customer: `POST /v1/vas/validate-customer` using the array body shown in the user's developer dashboard
- Submit payment: `POST /v1/vas/pay`, disabled by default and requiring explicit opt-in for a controlled sandbox test
- Query transaction: `GET /v1/vas/transactions?request-reference=...`

The access token is injected by the caller. The client does not acquire or store client credentials. It sends a Bearer token, which is based on the dashboard's token_type example; the precise authentication contract still needs provider verification. It hard-codes the documented Nigerian-hosted sandbox base URL (`https://sandbox.interswitchng.com/marketplace-routing/api`) and does not provide a live endpoint. Per the integration guidance, the shared `.ng` sandbox host is expected for sandbox traffic across markets; do not search for a `.ug` sandbox host. Production must use the region-specific URLs and credentials Interswitch issues at Go Live.

## Sandbox routing, currency and amount findings

Sandbox hostname and transaction currency are separate concerns: routing sandbox calls through Interswitch's Nigerian-hosted core does not by itself mean a Uganda integration is denominated in NGN. Keep UGX support and amount semantics tied to the exact product/merchant contract, not to the sandbox hostname.


- The [InterSwitch FAQ](https://docs.interswitchgroup.com/docs/frequently-asked-questions) lists UGX = `800`, NGN = `566`, KES = `404`, DRC = `976`, and USD = `840`.
- The FAQ says amounts should be passed in the specified currency rather than a naira equivalent, and says the transaction-creation endpoint it discusses expects minor currency units.
- The [Web Checkout guide](https://docs.interswitchgroup.com/v1.1/docs/web-checkout) explicitly shows `currency: 800` for its Uganda checkout example.
- The separate [Bills Payment API documentation](https://docs.interswitchgroup.com/docs/bills-payment-1) describes a different API family and routes. The user's Marketplace Routing `/v1/vas/pay` example does **not** show a `CurrencyCode` field in its request body. Do not add an undocumented currency field or transfer Web Checkout amount conventions to this endpoint without provider confirmation.
- The Marketplace Routing examples supplied by the user show NGN/566. The general currency list and Web Checkout example do not by themselves prove that this specific Marketplace Routing Bills Payment product has Uganda billers enabled or supports UGX for this merchant/terminal.
- Do not infer the amount unit from `amount: 100` and `ApprovedAmount: "30000"`; that discrepancy remains unresolved for this API product.

## Safety and known gaps

- The module has no automatic side effects; no network request occurs until a method is called.
- It is not imported by the Worker router and cannot currently initiate a real customer payment through the application.
- Payment submission is disabled unless `allowSandboxPaymentSubmission: true` is explicitly supplied.
- Transport errors are intentionally sanitized. After a timeout, query status using the **same** request reference before deciding whether another attempt is safe.
- It does not map provider status strings to final success/failure, create ledger entries, or mark bills paid.
- No credentials, live API calls, production changes, D1 migrations, or deployments were performed.

## Next validation

1. Verify exact token/header requirements and each endpoint's schema with InterSwitch.
2. Confirm whether the Marketplace Routing Bills Payment product and this merchant account/terminal support Ugandan billers and UGX; identify the documented currency selection mechanism for this product.
3. Confirm amount scale, fees, status mapping, reference uniqueness and duplicate behavior for this exact API.
4. Add mocked unit/contract tests using the project's established test setup.
5. Integrate into authenticated agency workflow only after tests pass, with provider readiness and live-money feature flags remaining OFF.
