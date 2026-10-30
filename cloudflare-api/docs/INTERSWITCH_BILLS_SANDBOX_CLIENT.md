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

The access token is injected by the caller. The client does not acquire or store client credentials. It sends a Bearer token, which is based on the dashboard's token_type example; the precise authentication contract still needs provider verification. It hard-codes the sandbox base URL and does not provide a live endpoint.

## Safety and known gaps

- The module has no automatic side effects; no network request occurs until a method is called.
- It is not imported by the Worker router and cannot currently initiate a real customer payment through the application.
- Payment submission is disabled unless `allowSandboxPaymentSubmission: true` is explicitly supplied.
- Transport errors are intentionally sanitized. After a timeout, query status using the **same** request reference before deciding whether another attempt is safe.
- It does not map provider status strings to final success/failure, create ledger entries, or mark bills paid.
- Amount is passed through as the documented decimal number; no unit conversion is attempted. Do not enable payment until InterSwitch confirms amount scale, currency, UGX coverage, fees and status-code meanings.
- Dashboard examples show NGN (currency code 566), which does not establish Uganda/UGX support.
- No credentials, live API calls, production changes, D1 migrations, or deployments were performed.

## Next validation

1. Verify the exact token header requirements and each endpoint's schema with InterSwitch.
2. Add mocked unit/contract tests using the project's established test setup.
3. Confirm Uganda biller catalogue, UGX semantics, amount units, response/status mapping, reference uniqueness and duplicate behavior.
4. Integrate into authenticated agency workflow only after tests pass, with provider readiness and live-money feature flags remaining OFF.
