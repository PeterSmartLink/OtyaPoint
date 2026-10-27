# OmniPoint Implementation Audit — 2026-10-27

**Scope:** Read-only inspection of the default OmniPoint branch and its isolated API-contract branch. This report does not change runtime behavior.

## Confirmed current state

- The dashboard is a Next.js client UI, but its overview metrics and inventory watch are hard-coded illustrative values.
- The Inventory screen requests `GET /api/bridge/products`; if the request fails, it silently returns to the sample product list and labels the source as demo. This is safer than pretending the request succeeded, but users need a persistent and unmistakable connection/error state before a real-business rollout.
- The existing bridge documentation says the route uses the old website authentication path and forwards a short-lived server-signed token to a separate Cloudflare Worker. That path depends on legacy Supabase-authenticated staff profiles and test-only configuration. It is not yet the desired Otya Auth + Cloudflare-only final architecture.
- The dedicated Cloudflare Worker has product read/create, stock-adjustment and cash-sale logic, but the dashboard does not yet consume a complete, typed API for its main overview, POS, reconciliation, reports, or agency workflows.
- Agency/provider execution is intentionally not ready. The interface correctly describes it as a draft/demo, and no live money movement should be enabled until provider status verification, idempotency, reconciliation, permissions and audit invariants are tested.
- The root package manifest defines build/lint/type-check scripts but the inspected repository path did not contain a root `package-lock.json`. The current CI therefore uses `npm install`, not a reproducible `npm ci` install. Do not change this to `npm ci` until a lockfile is intentionally generated, reviewed and committed.
- The current CI workflow includes migration filename checks, SQLite schema tests, Prisma validation, Worker type-check, lint and build. The workflow also validates legacy Supabase migration filenames; this should be separated from the target Cloudflare/D1 release gate as migration strategy becomes final.
- Repository search did not establish that an OmniPoint Android app source is present in the inspected repo. The OtyaPlayer repo is a separate Flutter media-player product and must not be repurposed as OmniPoint. Continue a full repository/branch inventory before creating a second Android app.

## Highest-priority engineering risks

1. **Data truth in UI:** The overview always shows sample values; other screens are explicitly demo workflows. Never present sample data as live data.
2. **Authentication transition:** The web login and bridge currently depend on legacy auth. Introduce Otya Auth integration only after token verification, active staff membership, company/branch scope and role checks have contract tests. Keep legacy paths for recovery until an approved cutover.
3. **Single-writer rule:** Do not let the dashboard write to legacy PostgreSQL and Cloudflare D1 in parallel. Declare one authoritative write path per release and reconcile before cutover.
4. **Atomic stock and sales:** Verify concurrent sales/adjustments, trigger behavior, idempotency-key payload binding and balanced ledger writes with real test execution against an isolated D1 database.
5. **Client contract parity:** Web and Android must use the same API/error contract; no direct database credentials in either client.
6. **Production safeguards:** No provider credentials or secrets in client bundles, no live provider execution, no production deployment, no destructive migrations and no data deletion until explicitly approved.

## Execution order

### Gate 1 — Baseline and Android discovery
- Inspect every installed GitHub repository and likely Android branches for a real OmniPoint Android source.
- Confirm the root lockfile status and reproduce existing CI checks in an isolated environment.
- Record the current route map and authentication/data dependencies.

### Gate 2 — API and data integrity
- Add/verify isolated tests for authorization, company/branch scoping, invalid payloads, duplicate/conflicting idempotency keys, concurrent stock operations, sales/ledger atomicity, safe errors and request IDs.
- Confirm D1 schema, constraints and triggers match the Worker assumptions.
- Keep provider routes disabled.

### Gate 3 — Web integration in preview
- Add a typed same-origin API client and explicit loading/empty/error states.
- Replace the overview's sample metrics only when backed by the authenticated Cloudflare API.
- Ensure API failure shows an error, not fabricated live data; sample data must be explicitly labeled.
- Integrate POS and stock workflows against isolated D1 only after their invariant tests pass.

### Gate 4 — Android integration in preview
- Reuse the existing OmniPoint Android source if found. Otherwise, choose a client only after confirming requirements and keeping it separate from Otya Media.
- Share API contract, identity/role model, request IDs, idempotency and pending/unknown transaction semantics.
- Run Android build and device/emulator tests against isolated API and synthetic data.

### Gate 5 — Release readiness
- Test independent backup restore, rollback, access revocation, monitoring and recovery.
- Produce evidence of passing CI and web/Android parity.
- Request explicit approval before any production route/secret changes, real-data migration, deployment or live payment activation.

## Current completion statement

This audit is a repository-grounded plan, not proof that the application is integrated or production-ready. The inspection did not deploy code, change secrets, read production business rows, migrate data, enable payments or merge a pull request.
