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
