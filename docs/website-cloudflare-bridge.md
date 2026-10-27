# Legacy website ↔ Cloudflare API bridge — superseded

> **Status: historical implementation note only. Do not follow as a deployment runbook.** This document describes an earlier Next.js bridge that used Supabase Auth and Vercel preview environment variables. The owner-approved target is GitHub + Cloudflare only; Supabase, Vercel and Appwrite are not part of the target system.

## Historical behavior

The earlier bridge added `GET /api/bridge/products` to a Next.js dashboard, reused the Supabase-authenticated `requireStaff()` guard, minted a short-lived HMAC token server-side and forwarded read-only product requests to an isolated Cloudflare Worker. That implementation is not the approved final architecture and must not be promoted as the final application.

## Required replacement

- Serve the dashboard/API through the approved Cloudflare runtime.
- Use the Otya Auth Worker through a verified Cloudflare Service Binding (or a separately reviewed authentication-verification contract).
- Resolve the verified subject to an active OmniPoint staff record in D1 on every sensitive request. Never trust a role supplied by the browser.
- Do not use a shared static HMAC secret as a shortcut for identity verification. The current OmniPoint Worker expects a token contract that does not match the current Otya Auth JWT contract; document and test the agreed contract before connecting them.
- Keep D1 migration-test data isolated. Never treat test inventory as real shop stock or import it into production by assumption.
- Keep sales posting, mobile-money/provider execution, ledger writes and reconciliation disabled until atomicity, authorization, idempotency, audit, reversal and reconciliation tests pass.

## Safety and acceptance gates

1. Review the current GitHub branch and its exact CI results.
2. Validate the Otya Auth ↔ OmniPoint contract, including expiry, revocation, wrong issuer/audience, staff deactivation, role changes and auth-service outage.
3. Run the UI against the isolated Cloudflare test Worker/D1 environment without exposing secrets to the browser.
4. Confirm signed-out and unauthorized users are denied and errors do not disclose infrastructure details.
5. Verify that the intended Worker and D1 binding are the test resources before any test deployment.
6. Obtain explicit owner approval before any production deploy, DNS change, secret change, data migration or provider activation.

No production traffic, DNS, secrets, database records or payment integrations are changed by this document.
