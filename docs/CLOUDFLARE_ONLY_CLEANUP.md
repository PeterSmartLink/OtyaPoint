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
