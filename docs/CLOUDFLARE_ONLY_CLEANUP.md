# Cloudflare-only cleanup and migration gates

## Product decision

OmniPoint is for one shop, not a multi-tenant product. Keep only the modules required for retail, agency operations, cash/float management, expenses, reconciliation, owner/staff access, audit, and reporting.

## Target platform

GitHub is the source-control and CI platform. Cloudflare is the application runtime and data platform. Postman is used for API testing. Supabase, Appwrite and Vercel are not allowed as target runtime dependencies.

## Legacy items identified during repository inspection

- The Next.js/Prisma dashboard still imports Supabase SSR/Auth and uses Supabase identity for staff sessions.
- The Worker token verifier currently expects `idp: "supabase"` and looks up a D1 AuthIdentity bridge. It is not Cloudflare-native authentication yet.
- Vercel-specific preview logic and setup instructions remain in legacy UI/docs.
- Savings-group routes/schema/tests are unrelated to this single-shop operating system and should be retired from active routes after dependency and migration review.
- The current package manifest still includes Prisma and Supabase packages because application modules depend on them. Removing packages before replacing those imports would break the build.

## Safe order to finish cleanup

1. Implement Cloudflare-native owner/staff identity: password hashing with a reviewed algorithm, rate-limited login, secure session cookies or short-lived signed tokens, session revocation, active-staff checks, and audit events. No public signup or self-assigned privileged roles.
2. Move dashboard reads/writes off Prisma and legacy Supabase calls to the Cloudflare API. Keep money-related actions disabled until API contracts and atomicity tests pass.
3. Migrate the dashboard runtime to Cloudflare Workers using a supported Next.js/OpenNext adapter, or replace it with a Workers-native UI if the current app cannot be safely hosted there. Do not use Vercel.
4. Remove Supabase and Prisma packages, files, environment names, and CI references only after repository-wide import searches and builds confirm they are unused.
5. Retire savings-group API handlers and UI. Keep old migration history immutable; only add reviewed cleanup migrations for the isolated test database. Never drop live data as part of this code-only cleanup.
6. Remove obsolete Vercel-specific preview code and documentation once equivalent local/Cloudflare development paths are available.
7. Run GitHub Actions, Worker tests, migration validation, and Postman collection tests. No deployment, secret changes, or production database operations without explicit approval.

## Current limitation

This cleanup branch removes Supabase-specific CI placeholders and makes the architecture decision explicit, but it does not yet claim that the legacy UI is independent of Supabase. Until steps 1–4 are complete, do not deploy the legacy UI as the final system.


## Verified dependency inventory (2026-10-27)

The following files were confirmed to contain legacy runtime coupling in the cleanup branch:

| Surface | Current coupling | Required replacement before removal |
|---|---|---|
| `package.json` | `@supabase/ssr`, `@supabase/supabase-js`, Prisma client/CLI | Remove only after all imports and DB calls are replaced and CI passes. |
| `middleware.ts` | Supabase cookie refresh and `auth.getUser()` gate | Cloudflare/Otya Auth session validation with secure cookie handling, expiry, logout/revocation, and fail-closed behavior. |
| `lib/auth.ts` | Supabase user identity plus Prisma `User` lookup | Verify an Otya Auth subject, then resolve active staff/role from authoritative D1 on every request. |
| `lib/supabase/server.ts`, `lib/supabase/admin.ts` | Supabase client factories | Retire after all callers are migrated and repository-wide import search is clean. |
| `app/login/actions.ts`, `app/login/page.tsx` | Supabase sign-in and Supabase-specific error text | Replace with the reviewed Otya Auth login/session flow; no public self-registration or self-assigned staff role. |
| `README.md`, `docs/BUILD_STATUS.md`, `docs/IMPLEMENTATION_ROADMAP.md`, `docs/production-readiness.md` | Historical or contradictory Supabase/Vercel setup statements | Rewrite to state the Cloudflare + GitHub target and label historical findings as historical; never publish steps that ask an operator to configure excluded services. |

### Authentication contract blocker — do not paper over it

The OmniPoint Worker scaffold currently validates a locally HMAC-signed token whose claims require `idp: "supabase"`, `iss: "omnipoint"`, and `aud: "omnipoint-api"`, then resolves `AuthIdentity` in D1. The existing Otya Auth Worker issues access JWTs with `sub`, `email`, `iat`, and `exp` and exposes `GET /auth/verify` for backend verification. These are **not yet the same token contract**. Do not simply change the string `supabase` to `otya-auth`, trust client-provided roles, or share the signing secret across services. Implement and test one explicit contract using the Cloudflare Service Binding to Otya Auth (or a separately reviewed public-key/JWKS contract), map the verified subject to an active D1 staff record, and test expiry, revocation, wrong audience/issuer, role changes, and auth-service failure. Until that passes, the business API must remain fail-closed and money-moving routes disabled.

### Cleanup acceptance gate

A Cloudflare-only cleanup is complete only when all of the following are true:

- No runtime import or executable config requires Supabase, Appwrite, or Vercel.
- No setup guide instructs an operator to configure excluded services; historical audit notes are clearly labeled.
- The app is served by the approved Cloudflare runtime, not merely built in CI or previewed through an excluded host.
- Login, logout, revocation, active-staff checks, authorization, and audit events pass automated tests against the agreed Otya Auth contract.
- D1 schema and migrations are validated without applying them to production; backup and restore are demonstrated using Cloudflare-native private R2 storage.
- GitHub Actions and Worker/API tests pass. Passing third-party status checks alone is not proof of a Cloudflare deployment.
