# Interswitch / Quickteller integration plan

## Objective

Integrate approved Interswitch / Quickteller services into OmniPoint through a server-side Cloudflare Worker adapter. OmniPoint remains responsible for the retail POS, inventory, user permissions, internal accounting, transaction audit trail, and reconciliation workflow. Interswitch remains the external provider of only those payment and value-added services enabled for the OmniPoint merchant account and approved for Uganda.

## Current state confirmed by repository inspection

- The main app is a Next.js/TypeScript prototype and its README still documents Supabase Auth and PostgreSQL.
- An isolated Cloudflare Worker + D1 migration spike already exists in `cloudflare-api/`; Wrangler points at `omnipoint-migration-test`, not production.
- The Worker intentionally leaves sales posting, agency transactions, and reconciliation disabled.
- No Interswitch adapter is currently wired into the Worker.
- Do not treat the existence of a developer account as approval for live processing or as proof that every API is available in Uganda.

## Integration boundaries

1. Browser and mobile clients must never receive Interswitch client secrets, signing keys, access tokens, or private merchant credentials.
2. All provider calls originate server-side from the Cloudflare Worker or a dedicated server-side provider module.
3. Each local attempt gets an immutable OmniPoint reference and idempotency key before any external request.
4. A submitted request is not a successful transaction. Persist `PENDING` / `UNKNOWN` until a trusted status query, signed callback, or documented provider response confirms the final state.
5. A timeout after submission is ambiguous; query status before retrying. Do not blindly replay money-moving requests.
6. Record provider references, sanitized request/response metadata, timestamps, actor, and every state transition in the audit trail. Never store PAN/CVV, passwords, raw identity documents, or secrets in logs.
7. Keep the retail ledger and fintech-agency ledger separate. Provider settlement and commission figures must reconcile against immutable transaction records.
8. All amounts are integer minor units only after the exact currency/precision convention is confirmed for the selected Uganda product. Do not copy the legacy React SDK's Nigerian-kobo assumption into UGX.

## Candidate capability mapping — subject to account approval

| Capability | OmniPoint responsibility | Provider dependency / gate |
|---|---|---|
| Retail checkout | Cart, stock reservation, sale record, receipt, retail ledger | Confirm Quickteller Business payment product, currency, Uganda merchant eligibility and callback/status verification |
| Airtime / data / bills | Agent UI, customer validation inputs, transaction history, commission reporting | Confirm Uganda billers, product codes, validation and status APIs, reversals and settlement rules |
| Agency cash-out / mobile money | Agent workflow, cash/float book, maker-checker controls and reconciliation | Written confirmation of Uganda service coverage, agent onboarding, float process, limits and API access |
| Transfers, wallet, paycodes, lending or cards | UI only if separately approved | Treat as unavailable until product-specific approval and documentation are supplied |
| POS terminal | OmniPoint checkout workflow and transaction correlation | Requires supported terminal, SDK, merchant setup and device-specific certification |

## Required developer-console inventory

Record these in project documentation without copying secrets:

- Exact account / project environment: sandbox or production.
- Product/API names enabled on the application.
- Official product documentation URL for each enabled API.
- Country and currency supported by the specific product.
- Required merchant onboarding or KYC status.
- Sandbox base URL and authentication method, copied from current product documentation.
- Merchant code / pay item identifier if the product uses them; store as configuration, not source-code constants.
- Callback / redirect requirements, signature verification rules, transaction enquiry endpoint, status codes, idempotency behavior, reversal rules, rate limits, and settlement/report formats.
- Whether the account has test credentials and a test merchant or test payment instruments.

**Never commit or send client secrets, API keys, private keys, passwords, one-time codes, live access tokens, or unredacted credential screenshots.** Configure secrets only in the approved Cloudflare test environment after the exact product flow is verified.

## Delivery stages

### Stage 1 — sandbox readiness
- Confirm products enabled and Uganda eligibility with current docs / Interswitch support.
- Build the provider adapter contract and unit tests with mocked responses.
- Define normalized statuses, safe retry rules, idempotency, audit events, and transaction enquiry.
- Keep real-money routes disabled.

### Stage 2 — one non-live product
- Choose the first approved sandbox capability.
- Implement only its documented request/response schema and authentication flow.
- Test success, decline, timeout, duplicate request, delayed status, malformed response, callback forgery, reversal, and provider outage.
- Verify that no test response can be mistaken for a live transaction.

### Stage 3 — ledger and reconciliation
- Post balanced entries only from verified state transitions.
- Reconcile provider transaction reports and settlements; require dual approval for adjustments.
- Prove duplicate callbacks and concurrent retries cannot double-post.

### Stage 4 — partner approval and controlled pilot
- Complete business/KYC, security review, operational procedures, limits, support/escalation and reconciliation sign-off.
- Enable live credentials and live routes only after explicit approval; no automatic production cutover.

## Initial acceptance criteria

- No provider secret appears in browser bundles, logs, Git history, or API responses.
- Unconfigured provider calls fail closed and do not create a successful transaction.
- Every external attempt is correlated to one OmniPoint reference and idempotency key.
- Pending / unknown states never trigger fulfilment.
- Duplicate callbacks and repeated status queries are safe.
- Currency precision, country, provider product and allowed transaction types are explicit configuration, not guessed defaults.
- Automated tests cover failure and ambiguity as thoroughly as success.
