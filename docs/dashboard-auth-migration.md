# Dashboard migration: Supabase/Prisma to Otya Auth + Cloudflare

## Status

This is a migration plan for the existing OmniPoint dashboard, not a claim that the dashboard has already been migrated. The dashboard currently imports Supabase Auth and Prisma. Do not remove these dependencies until each import has been replaced and the dashboard has build and authorization tests.

The Cloudflare Worker authentication spike uses the existing Otya Auth service through a private service binding. The Otya Auth Worker contract in `Otya-Server/auth-worker/src/index.ts` implements `GET /auth/verify`: it requires a Bearer access token, returns HTTP 401 for invalid/expired tokens, and returns `{ ok: true, user_id, email }` for a valid token. Access tokens are short-lived (15 minutes); refresh tokens are separate and must not be treated as access tokens.

## Required target

- Browser and mobile clients authenticate through the existing Otya Auth service.
- The dashboard never receives the Otya Auth JWT signing secret and never verifies JWTs using a copied/shared secret.
- Server-side requests verify access tokens through the private Cloudflare service binding or call the authenticated OmniPoint API.
- Staff authorization comes from an explicit identity link and the current authoritative OmniPoint D1 staff record—not email matching, client-supplied roles, or stale JWT role claims.
- Cloudflare D1 is the authoritative OmniPoint business database. Keep business data separate from Otya Auth's identity database.
- Use Secure, HttpOnly, SameSite cookies for browser sessions; never expose refresh tokens to client-side JavaScript. Add CSRF protections for cookie-authenticated state-changing requests.
- All sign-in, refresh, logout, expiry, disabled-staff, revoked-link and Auth outage paths fail closed and have automated tests.

## Migration sequence

### 1. Freeze and inventory (current stage)

- Keep the current dashboard build intact while the API authentication spike is reviewed.
- Inventory every Supabase import, Prisma call, server action, route handler, middleware guard and role check.
- Map each operation to an existing OmniPoint Worker endpoint or mark it as not implemented. Do not silently fall back to the old database.
- Confirm the deployed Otya Auth route and service binding target before any production configuration change.

### 2. Implement the browser session boundary

- Add a server-only session adapter that calls Otya Auth `POST /auth/login` and validates the response shape.
- Store access and refresh credentials only in protected server-managed cookies or a server-side session store; design refresh rotation and logout/revocation explicitly.
- Replace Supabase middleware with the new session guard only after login, expiry, refresh, logout and CSRF tests pass.
- Keep `/login` reachable during Auth outages and show a safe service-unavailable message without leaking infrastructure details.

### 3. Replace staff authorization and database access

- Route staff data access through the Cloudflare OmniPoint API; do not use Prisma to reach a parallel business database.
- Provision the Otya Auth `user_id` to OmniPoint `AuthIdentity` mapping through an audited, explicit process.
- Check active status, verified status and current D1 role for each protected request.
- Implement read-only screens first. Leave sales posting, cash-in/out, provider calls, reconciliation and other money-moving operations disabled until atomic ledger, idempotency, reversal, audit and dual-control tests pass.

### 4. Remove legacy dependencies only after coverage

- Replace all imports of `@supabase/ssr`, `@supabase/supabase-js`, Prisma client helpers and Prisma database calls.
- Search the whole repository for remaining Supabase/Prisma imports and environment variables.
- Remove packages and old migration scripts only after repository-wide search, production-like build, auth tests, role-boundary tests and route tests pass.
- Update CI to prevent reintroducing Supabase or Prisma as OmniPoint runtime dependencies.

## Acceptance gate before cutover

- [ ] Otya Auth service binding target and response contract verified against the deployed worker.
- [ ] Access-token expiry, invalid token, refresh rotation, logout and revoked-session behavior tested.
- [ ] Staff identity mapping is explicit and audited; no automatic email-based linking.
- [ ] Disabled/unverified staff, unknown roles and role changes fail closed.
- [ ] Browser cookies are HttpOnly/Secure/SameSite and CSRF controls are tested.
- [ ] Every dashboard page/action is mapped to the Cloudflare API; no hidden Prisma/Supabase fallback remains.
- [ ] Production D1 backup/restore and migration rehearsal completed with row counts/checksums.
- [ ] A reviewed cutover/rollback plan is approved before any production binding or data change.

## Safety boundary

This document and the associated code branch do not change Cloudflare production resources, DNS, secrets, production D1, user identities, live payments or deployment state. Keep PR #22 unmerged until the required reviews and acceptance gates are complete.
