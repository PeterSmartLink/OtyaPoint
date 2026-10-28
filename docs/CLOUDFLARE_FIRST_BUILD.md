# Cloudflare-first build plan

## Product boundary

OmniPoint is the private operations system for Otya Hold Ltd's own shop and future branches. It is not a multi-tenant SaaS product for unrelated businesses. Preserve existing code and resources while replacing legacy runtime dependencies safely.

## Target architecture

- Source control and review: GitHub; all changes enter through pull requests.
- Runtime/API: Cloudflare Workers.
- Authoritative business data: Cloudflare D1.
- Private documents and export files: Cloudflare R2.
- Cache: Cloudflare KV only for disposable cache/state with explicit TTLs.
- Background jobs: Cloudflare Queues only after idempotency, retry, and dead-letter tests pass.
- Identity: Otya Auth. Login does not grant OmniPoint staff access by itself; an active local staff membership and role are required.
- Clients: web dashboard and Android app share the same API and business rules.
- Payments: disabled until the specific provider product, server-side status verification, reconciliation, and owner approval are complete.

## Current verified starting point

- The root Wrangler configuration points to the isolated omnipoint-dev D1 database and dedicated development bindings.
- The development API is configured with workers_dev disabled; it has no public route or custom domain and has not been deployed by this configuration.
- The Worker already includes health, staff identity, product read/create, stock adjustment, cash-only sales, summary, and ledger paths.
- Provider transactions are disabled; the Quickteller sandbox form builder is not connected to the API.
- Existing Otya Workers and data resources must remain untouched.
- The existing Next.js dashboard still uses legacy Supabase/Prisma paths. Do not remove those dependencies until every required route is migrated and CI passes.

## First build sequence

### Gate 1 — identity contract (blocking)

The existing Next.js bridge signs a short-lived HMAC JWT using OMNIPOINT_API_HMAC_SECRET. The Cloudflare API instead sends the bearer token to the otya-auth service binding at /auth/verify. These are not proven to be the same token contract. Do not configure a production secret or deploy the bridge until the contract is confirmed and tested end-to-end.

Required work:
1. Document the token issuer, audience, expiry, subject, and verification rules used by Otya Auth.
2. Choose one trusted path: Otya Auth-issued access tokens or a narrowly scoped, independently authenticated service-to-service assertion verified by the API. Do not accept a role supplied by the browser as authority.
3. Add tests for expired, malformed, wrong-audience, wrong-issuer, revoked/invalid, and valid tokens.
4. Map the verified Otya identity to an active local OmniPoint staff membership; reject unknown or disabled staff.

### Gate 2 — one authoritative inventory path

1. Add server-side API bridge methods for inventory reads, product creation, and stock adjustments using the agreed identity contract.
2. Migrate app/inventory away from Prisma reads/writes to the Cloudflare API.
3. Preserve server-side authorization and audit events. Never let client-provided company or branch IDs override the authenticated membership.
4. Add contract tests and ensure the UI shows a clear unavailable state rather than silently presenting demo data as live records.
5. Keep legacy schema and dependencies until no live route imports them and tests prove removal is safe.

### Gate 3 — shop sales and ledger

1. Connect the POS to the Worker cash-sale endpoint.
2. Require stable idempotency keys, server-calculated totals, stock checks, and atomic sale/ledger/audit writes.
3. Test duplicate requests, concurrent sales, insufficient stock, rollback, and balanced ledger invariants.
4. Keep non-cash and provider payments disabled until their own verification gates pass.

### Gate 4 — real owner and staff setup

1. Establish the authorized owner identity and recovery process.
2. Provision a local SOVEREIGN membership only through an audited, owner-controlled administrative procedure.
3. Add staff onboarding, role changes, branch membership, and access revocation.
4. Never insert invented staff or sample stock into the authoritative business database.

### Gate 5 — backup and release readiness

1. Produce an encrypted, retrievable D1 export and private R2 backup.
2. Perform a restore test into an isolated database and verify row counts, constraints, and ledger balance.
3. Review logs, error responses, rate limits, secrets, and access boundaries.
4. Deploy only after the owner reviews the private preview and explicitly approves a release. Do not alter DNS, production routes, live secrets, or payment modes as part of this preparatory work.

## Data truth rules

- Empty tables mean the live business dataset has not yet been loaded; do not fabricate real inventory, transactions, staff, or balances.
- Label demo/sample data explicitly and never mix it with business records.
- All money amounts use integer minor units with explicit currency and server-side validation.
- Provider redirects and client messages are not proof of payment.
- A timeout is ambiguous, not automatically a failure; re-query before retrying any money movement.

## Current release state

This document is a build gate, not a claim of production readiness. The API is not deployed by the repository's development Wrangler configuration, the dashboard is not yet fully migrated, and payment operations remain disabled.
