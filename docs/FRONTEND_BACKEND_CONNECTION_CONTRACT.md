# OtyaPoint frontend–backend connection contract

## Public experience

The public-facing product is **OtyaPoint**. Customers and business visitors should see the OtyaPoint brand, clear navigation, accessible layouts, and useful empty/error states—not internal environment labels, migration names, provider names, database names, or engineering status badges.

Internal architecture and release controls remain documented for maintainers. Removing a visible label must never imply that a capability is active when its service is not connected.

## Connection architecture

- Browser UI → same-origin Next.js route handlers/BFF → authenticated Cloudflare Worker API → D1.
- Keep the Worker origin and service credentials on the server. Do not expose service-binding names, provider secrets, database IDs, or bearer tokens in browser code.
- The frontend must not send role claims as authority. The Worker verifies the Otya Auth token and maps its subject to an active, company-scoped staff membership.
- Use same-origin route handlers as the integration seam where available. This avoids browser CORS coupling and keeps server-only credentials out of client bundles.
- Treat API responses as the source of truth. Do not synthesize products, sales, float balances, commissions, or reconciliation records to make screens look populated.
- Show neutral empty states when no records exist and actionable unavailable/error states when the backend cannot be reached. Do not label customer-facing UI “demo”, “live”, or “preview”.

## Current Worker contract

All routes below are served by the Cloudflare Worker only when that Worker is explicitly configured and reachable. Their presence in source code does **not** mean they are deployed or connected to the public frontend.

| Method | Route | Access and purpose |
|---|---|---|
| GET | /api/products | Authenticated staff; active products scoped to the staff member's company |
| GET | /api/summary | Manager-level summary, scoped to company |
| POST | /api/products | Manager-level product creation; starts with zero stock |
| POST | /api/stock-adjustments | Manager-level, audited stock adjustment |
| POST | /api/sales | Authenticated staff; cash-only retail sale, requires an Idempotency-Key |
| GET | /api/agency-transactions | Authenticated staff; company-wide for managers, creator-scoped for other staff |
| GET | /api/agency-readiness | Manager-only readiness information |
| POST | /api/agency-transactions | Intentionally unavailable until provider adapters and controls are approved |

Worker error responses use a stable JSON error code and may include a requestId. The UI should present a safe message and retain the request ID for support, without displaying internal exception text.

## Frontend data requirements

1. Fetch inventory and overview data through a server-side adapter, not directly from a database or provider.
2. Validate and normalize the API payload at the boundary. Render UGX amounts using integer minor-unit rules confirmed for the relevant operation; do not infer provider amount units.
3. Distinguish an empty successful response from an unavailable API. Empty data is not an error, and an API failure is not an empty inventory.
4. For sale submission, generate a fresh idempotency key for a new attempt and reuse it only when retrying the same unchanged request. Do not offer non-cash methods until the backend explicitly enables them.
5. Do not present an agency transaction as successful unless the backend returns a verified provider-confirmed state. Drafts must not be described as recorded transactions.
6. Handle 401 by asking the user to sign in again; 403 by showing an access-denied state; 409 as a conflict requiring refresh/review; 422 as a capability or validation issue; and 503 as a temporary service-unavailable state.
7. Do not cache authenticated business responses in shared/public caches.

## Readiness and release gates

The source-level API contract is defined, but end-to-end frontend connectivity is **not yet certified**. Before connecting a public deployment, maintainers must verify:

- an approved Worker deployment and service binding/origin configuration;
- a real sign-in flow and securely provisioned staff membership;
- matching frontend proxy routes and backend paths;
- request/response schemas and authentication forwarding;
- company/branch authorization tests;
- API failure, timeout, empty-state and idempotency behavior;
- database migration compatibility, backup/restore, and audit/ledger invariants;
- CI checks passing and browser/device verification.

Do not deploy, change DNS, alter secrets, enable provider execution, or process live financial transactions as part of this contract alone.

## Authentication contract discovery (2026-10-30)

The connected OtyaEnd repository was inspected read-only. Its Auth Worker documents and implements these server endpoints:

- `POST /auth/login`: email/password login; successful response includes `ok`, `access_token`, `refresh_token`, and a `user` object.
- `POST /auth/refresh`: request JSON includes `refresh_token`; successful response includes a new `access_token` and may include a rotated `refresh_token`.
- `POST /auth/logout`: revokes a refresh token.
- `GET /auth/verify`: bearer access-token verification; the OtyaPoint Worker specifically requires `{ ok: true, user_id: <non-empty string> }`.

This establishes the source-level payload shape, **not** a production-ready OtyaPoint browser session. The current Otya Auth Wrangler entrypoint is `src/production-entrypoint-miniapp.ts`, which wraps the production entrypoint and refresh-token store. OtyaPoint's existing Next.js app does not currently demonstrate a verified Cloudflare service binding/runtime configuration, cookie-domain decision, CSRF/origin controls, refresh rotation behavior, or login/session integration tests. Do not copy cookie-domain settings from another app or assume that the dashboard is hosted under the same parent domain. Validate those deployment facts before implementing browser cookies or forwarding tokens.

The safe next implementation unit is a same-origin session BFF with HttpOnly Secure SameSite cookies, strict same-origin checks for mutating requests, bounded request bodies, no token logging, refresh/logout revocation, and tests for auth outage/rotation/replay. Until that BFF is implemented and tested, keep the product bridge fail-closed and keep legacy authentication dependencies in place; do not mint local JWTs or accept browser-provided identity/role claims.
