# Website ↔ Cloudflare API bridge

This branch adds a same-origin Next.js route at `GET /api/bridge/products` and connects the Inventory view to it. The route reuses the website's existing Supabase-authenticated `requireStaff()` check, then creates a short-lived HS256 token server-side and forwards the request to the isolated Cloudflare Worker. The HMAC key is never sent to the browser.

## Required server-side environment

Configure these only in an isolated preview environment until all checks pass:

- `OMNIPOINT_CLOUDFLARE_API_URL`: base URL of the deployed **test** Worker, e.g. `https://<test-worker>.<your-subdomain>.workers.dev`.
- `OMNIPOINT_API_HMAC_SECRET`: a newly generated high-entropy secret stored as a server-only Vercel environment variable.
- Cloudflare Worker secret `AUTH_HMAC_SECRET`: the exact same secret value, configured with Wrangler secrets for the **test Worker only**.

Do not use a `NEXT_PUBLIC_` variable for the secret. Do not set production values until the isolated integration is validated. Never commit secrets.

## Important safety limits

- The Worker is not deployed by this change; no production URL or secret is assumed.
- The bridge currently exposes read-only product listing only. Sales, mobile-money provider operations, ledger writes and reconciliation remain disabled.
- Existing Supabase/PostgreSQL remains the source for login and staff profiles. The D1 test database is separate; its product records are test data and must not be treated as production inventory.
- Before enabling writes, reconcile identity mapping: the current bridge passes the verified PostgreSQL staff ID in `sub`, while a migrated D1 `User` row with the same ID must exist for audit foreign keys. Role changes, staff deactivation, token revocation, secret rotation, and rate limits need dedicated tests.
- Keep the UI clearly marked as test data until a read-only preview has been tested with authorized staff.
- Do not switch production traffic, change production secrets, migrate real data, or disable Supabase as part of this spike.

## Validation checklist

1. Confirm CI passes for the branch.
2. Deploy the Worker to a separate test environment and apply the D1 migration there.
3. Set the two Vercel variables only in Preview and set the matching Worker secret.
4. Sign in as an active, verified staff member; open Inventory and confirm product rows come from the test D1 database.
5. Confirm signed-out users receive 401, missing configuration fails closed, and Worker errors do not reveal secrets.
6. Confirm all financial write routes remain blocked until transaction invariants, identity mapping, and provider integration are implemented and tested.
