# OtyaPoint Cloudflare Authentication Migration Contract

Status: implementation contract; not a deployment authorization.
Owner: OtyaPoint / Otya OS.
Target foundation: GitHub + Cloudflare Workers + D1. Do not introduce Supabase, Appwrite, or Vercel.

## Why this migration is staged

The current Next.js dashboard still imports Supabase in `middleware.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/auth.ts`, `app/login/actions.ts`, and staff invitation actions. The current dashboard also uses Prisma for staff profiles and audit events. Removing the Supabase packages or environment variables before migrating these call sites would break authentication and staff administration.

The Otya Server `auth-worker` already exposes password login, refresh, logout, and JWT verification routes. Its login response includes `access_token`, `refresh_token`, and a user object. The existing worker code documents a 15-minute access-token lifetime and a 30-day refresh-token lifetime. OtyaPoint's Cloudflare API Worker already verifies bearer access tokens through the `otya-auth` service binding and then checks the local staff membership. These are useful building blocks, but they do not by themselves replace Next.js cookie/session handling or staff invitations.

## Required architecture

1. **One identity authority:** `otya-auth` owns password verification, access/refresh token issuance, token refresh, and logout/revocation.
2. **One OtyaPoint authorization authority:** the OtyaPoint API checks the verified Otya identity against `omni_staff_memberships`, including active status, company, branch, and role. A valid Otya account alone must not grant shop access.
3. **Server-side browser session:** Next.js server actions call the approved Otya Auth endpoint or an approved private service binding. Browser JavaScript must never receive the refresh token. Store access and refresh tokens only in separate `HttpOnly; Secure; SameSite=Lax` cookies scoped to the app; use `Path=/`, bounded expiry, and explicit logout clearing. Do not add a broad parent-domain cookie unless a reviewed cross-subdomain requirement exists.
4. **No client-supplied identity claims:** company ID, role, staff ID, or verified email supplied by a browser must never authorize a request. Resolve those claims from the verified token and server-side staff record.
5. **No secret exposure:** no JWT signing secret in OtyaPoint; no refresh token in localStorage/sessionStorage; no token values in logs; no secrets in `NEXT_PUBLIC_*` variables.
6. **Private network path first:** prefer a Cloudflare service binding where the runtime supports it. If the Next.js runtime cannot use the binding, use a documented HTTPS endpoint with strict origin/rate limits and never expose internal administrative endpoints publicly. Confirm actual runtime and routing before selecting the transport.

## Verified transport finding (2026-10-29)

A supported routing path already exists in the Otya Server repository:

- `src/app/auth/[...path]/route.ts` forwards `/auth/*` requests through the OpenNext Cloudflare `AUTH` service binding.
- `src/production-router.mjs` classifies `/auth` and `/auth/*` as core backend routes.
- The production auth Worker handles `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, and `GET /auth/verify`.
- Both the auth Worker and the core route are configured with `workers_dev = false`; this does not mean the existing core-domain route is unavailable, because it is reached through the core Worker route configuration.

This establishes a known route family, not permission to deploy or a guarantee that a separately hosted OmniPoint dashboard can use a Cloudflare service binding. Before implementation, confirm the actual deployed dashboard host and its runtime. If the dashboard remains a separate Next.js service, use the existing HTTPS core-domain `/auth/*` route only through a server-side `OTYA_AUTH_BASE_URL` configuration and validate it against the expected trusted origin. Do not accept an arbitrary URL from a request or form. If the dashboard is later hosted in the same Cloudflare Worker runtime, prefer the configured `AUTH` service binding.

The transport must be tested in a non-production preview with synthetic accounts before changing the active login path. Do not send real credentials as a connectivity test. Do not create a new public route or expose the service binding solely to make the dashboard integration work.

## Newly verified identity-provisioning blocker

The existing implementation has two distinct staff identity records that must not be silently conflated:

- The dashboard's Prisma `User` model uses a local `id`, email, role, activation state, and identity-verification status. It currently has no `identitySubject` field.
- The Cloudflare API authorizes staff by matching the Otya Auth `user_id` to `omni_staff_memberships.identity_subject`, then requires the membership status to be `ACTIVE` and a recognized role.
- The current staff-invitation action creates the identity through Supabase Admin and then creates a Prisma profile. That does not provision an Otya Auth account or an `omni_staff_memberships` row.

Therefore, a login proxy alone is not a complete or safe migration. Before activating Otya Auth for staff, implement and test an explicit invitation/provisioning flow that creates or invites the Otya identity, maps its immutable user ID to a company-scoped staff membership, and preserves pending approval, duplicate prevention, and audit records. Existing staff must be mapped using verified identity evidence; do not auto-link by email alone or grant access based only on a successful login. Test that pending, rejected, inactive, and cross-company accounts are denied.

Until this is implemented, keep the current login and invitation paths intact. Do not remove Supabase packages, disable the legacy auth environment, or treat a successful Worker build as proof that staff can sign in.

## Provisioning endpoint safety rule

The inspected Otya Auth Worker exposes `POST /auth/register` as a self-service registration route. It must **not** be used as an administrative staff-invitation endpoint: a public registration flow does not establish management authorization, company ownership, branch assignment, staff role, or approval. Do not send privileged role/company fields from the browser or trust client-supplied claims.

The required next API is a separately authorized, server-to-server staff-provisioning operation. It must authenticate the managing actor, enforce company/branch scope and allowed roles, create or invite the identity idempotently, write the pending staff membership and audit event, and return no credentials. The design must handle partial failure and duplicate requests without leaving orphaned identities or active memberships. Only after this path has tests for unauthorized callers, duplicate invitations, cross-tenant attempts, pending/rejected users, and retries should dashboard login be cut over.

## Verified token-lifecycle constraints from the current Otya Auth implementation

The current auth Worker implementation was inspected before designing the session adapter:

- `POST /auth/login` returns both `access_token` and `refresh_token`.
- `POST /auth/refresh` looks up the supplied refresh token and returns a new access token, but the inspected handler does not rotate the refresh token.
- `POST /auth/logout` revokes the supplied refresh token in KV. The inspected flow does not itself revoke already-issued access JWTs, so a previously issued access token may remain valid until its expiry unless a separate revocation check exists.
- `GET /auth/verify` validates the access JWT and returns `user_id` and email; it does not itself establish OtyaPoint staff membership or approval.

Adapter requirements arising from this inspection:

1. On refresh, preserve the existing refresh cookie unless the auth API is deliberately changed to return and rotate a new token; never overwrite it with an absent field.
2. On logout, clear both browser cookies unconditionally, even if the upstream call fails. Treat residual access-token lifetime as a documented risk; do not claim immediate access-token revocation.
3. Keep access-token lifetime short, do not expose either token to browser JavaScript, and ensure every business request rechecks the active OtyaPoint membership.
4. Add tests for replay of a refresh token, concurrent refresh requests, logout followed by reuse of the old access token, expired access tokens, and an identity with no staff membership. Decide whether refresh rotation or token-version/revocation support is needed before treating logout as immediate revocation.

This is a source inspection finding, not proof that the deployed Worker exactly matches the current main branch. Confirm the deployed revision before enabling the new session flow.

## Login/session contract

- `POST /auth/login`: validate email/password server-side; use the auth worker's current response shape; set secure HttpOnly cookies only after a successful response. Do not pass through arbitrary upstream headers or return token values to the browser.
- `GET /auth/verify`: send the access token as a bearer token from the server. A successful identity response must be checked against the expected schema; malformed/timeout responses fail closed.
- `POST /auth/refresh`: refresh server-side when needed; validate the response shape and update cookie expiry. On refresh failure, clear both session cookies and require sign-in.
- `POST /auth/logout`: attempt upstream revocation and always clear local cookies. A failed upstream logout must not leave a browser session cookie behind.
- All cookie-mutating server actions must enforce same-origin/CSRF protections and must not accept arbitrary redirect targets. Preserve the existing safe relative-path redirect rule.
- Never rely on middleware alone for authorization. Every protected server action and API route must perform server-side identity/staff checks.

## Staff invitations are a separate blocker

The existing staff invitation flow uses Supabase Admin `inviteUserByEmail`, then creates a Prisma staff profile and audit record, with compensation if the profile write fails. Do not replace this with ordinary public `/auth/register` or direct writes to Otya Auth's users table.

Before removing `lib/supabase/admin.ts`, implement and test a dedicated privileged invitation contract. It must:
- be callable only from a trusted server/service binding;
- authenticate the acting OtyaPoint manager and re-check their role on the server;
- validate and normalize email/display name/agent ID/role;
- create an identity invitation with a one-time, expiring, single-use setup flow;
- preserve the pending/inactive staff profile until required identity checks and approval finish;
- handle retries idempotently and compensate or reconcile partial failures;
- write an auditable event without tokens, invitation secrets, or sensitive credential data;
- prevent arbitrary callers from inviting users or assigning roles.

The Otya Auth worker's existing public registration route is not a substitute for this contract.

## Concrete session adapter acceptance contract

The first implementation should be additive and feature-flagged off by default. It must not change the current login path until every gate below passes.

### Cookie and route contract

- Use a host-only, `Secure`, `HttpOnly`, `SameSite=Lax` access cookie and a separate host-only refresh cookie with the narrowest practical `Path` (the refresh endpoint path). Do not set a broad `Domain` attribute unless the verified deployment topology proves it necessary.
- Cookie names must use the `__Host-` prefix where the required path rules allow it; because refresh cookies need a narrower path, choose and document a compatible name/attribute combination rather than incorrectly applying the prefix.
- Return `Cache-Control: no-store` on every login, refresh, logout, and session response. Never return tokens in page props, server-action results, browser storage, logs, or error messages.
- Require same-origin `Origin` on cookie-mutating requests; compare normalized origin to the configured public application origin, not an untrusted `Host` header. Reject missing or mismatched origins for browser-originated mutation requests.
- Do not follow caller-supplied redirect URLs. Redirects, if required, must be relative paths checked against a strict allow-list.
- Bound upstream request duration and response size; reject non-JSON, malformed, or unexpected upstream payloads without reflecting raw response bodies to clients.

### Required behavior

| Action | Expected result |
| --- | --- |
| Login | Call Otya Auth server-side; set cookies only after a valid response; do not create an OtyaPoint session until staff membership is confirmed active |
| Refresh | Send refresh cookie server-side; update access cookie; preserve refresh cookie unless upstream explicitly returns a replacement; deny on expired/revoked token |
| Logout | Attempt upstream revocation; clear both cookies regardless of upstream availability; return no token material |
| Authenticated business request | Verify access token and re-check active staff membership, company and branch scope, and role on the server |
| Identity without membership | Deny access; never auto-provision a staff membership from identity login |
| Staff invitation | Use a dedicated privileged server-side provisioning flow; never use public self-service registration to grant roles |

### Release gate

Before enabling the flag, CI must cover malformed inputs, auth timeout, cookie attributes, CSRF/origin rejection, token expiry/replay/logout behavior, no-membership denial, inactive staff denial, company/branch isolation, and manager-only action authorization. Run the full repository build and Worker checks, then validate with synthetic identities against development-only resources. Leave the flag off until the auth service's refresh/revocation semantics and the exact dashboard runtime/host are verified.

## Data and authorization migration

- Keep the existing D1 `omnipoint-dev` schema as the development target. Do not point the development Worker at `otya-store-db`.
- Map the current Prisma `User` and `AuditEvent` use cases to the established OtyaPoint D1 tables only after reviewing the full Prisma schema, migrations, and data-preservation requirements.
- Keep `identity_subject` as the explicit join between Otya identity and OtyaPoint staff membership; do not join by mutable email alone.
- Verify company/branch scoping and role checks for every read/write route. Retail sale writes, stock movements, ledger entries, and audit events must remain atomic or have a documented, tested recovery strategy.
- Do not copy or delete existing data as part of the auth code migration. First produce a reviewed, repeatable migration and reconciliation report.

## Required test gates

### Authentication and cookies
- Valid login; wrong password; unknown user; malformed JSON; oversized input; auth service timeout; invalid upstream JSON.
- Access token expiry, successful refresh, expired/revoked refresh token, logout, and replay after logout.
- Cookies are HttpOnly, Secure in deployed environments, SameSite=Lax, correctly scoped, and absent from browser-readable storage.
- Cross-site POSTs and untrusted Origin/Host headers cannot mutate a session; redirect parameter cannot create an open redirect.
- No auth tokens or secrets appear in logs, errors, telemetry, or HTML.

### Authorization and tenancy
- Valid Otya identity without staff membership is denied.
- Pending, inactive, rejected, or malformed-role staff are denied.
- Staff from company A cannot read or mutate company B records, including by guessing IDs.
- Branch-scoped staff cannot bypass branch restrictions.
- Manager-only actions reject attendant roles, including direct server-action invocation.
- Repeated staff invitation requests do not create duplicate users/profiles or multiple valid invitations.

### Regression and deployment
- Run lint, TypeScript, unit/integration tests, full Next build, Worker type-check, Wrangler dry-run/bundle, migration tests, and dependency/security checks.
- Run a private preview against development-only resources with payment-provider actions disabled.
- Verify backup export, restore into an isolated target, and row-count/checksum reconciliation before any production data migration.
- Require explicit approval for production deploys, DNS/route changes, remote migrations, secrets changes, or live payment activation.

## Ordered implementation plan

1. Inventory every Supabase and Prisma import/call site and map it to its replacement.
2. Add and test a server-only Otya Auth client/session adapter without switching production behavior.
3. Add the secure cookie login/refresh/logout flow and test it independently.
4. Add the privileged staff invitation contract and test partial failure/retry behavior.
5. Move staff lookup and audit writes to the reviewed OtyaPoint D1 model; keep authorization fail-closed.
6. Switch one route group at a time behind a feature flag that defaults off; validate with development-only identities.
7. Run repository-wide search and CI; remove Supabase dependencies and env references only after no runtime call sites remain.
8. Prepare a private preview after reconciling the development Worker and its bindings. No deployment or resource mutation is implied by this document.

## Current known blocker

The live Cloudflare account contains the development D1/R2/KV/queue resources, but the configured `omnipoint-dev-api` Worker is absent from the live Worker script inventory. Its Wrangler configuration has `workers_dev = false`; do not enable a public preview endpoint or deploy it until the private-access design and binding inventory are reviewed.
