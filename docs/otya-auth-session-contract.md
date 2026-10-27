# Otya Auth session migration checkpoint

This checkpoint migrates the dashboard sign-in path away from Supabase and the product bridge away from the legacy HMAC token. It is source-code work on the isolated pull-request branch only; it has not been deployed.

## Runtime settings

Configure only in an isolated preview environment until the checks below pass:

- `OTYA_AUTH_WORKER_URL`: HTTPS base URL for the existing Otya Auth Worker. The app posts to `/auth/login`.
- `OMNIPOINT_CLOUDFLARE_API_URL`: HTTPS base URL for the OmniPoint Cloudflare API Worker.

Do not put access or refresh tokens in public `NEXT_PUBLIC_*` variables. The login action stores both tokens in HttpOnly cookies; the browser cannot read them. The access cookie lasts 15 minutes and the refresh cookie lasts 30 days, matching the Auth Worker token TTLs.

## Trust boundaries

- Middleware checks only for cookie presence to avoid an unauthenticated navigation. This is not authentication.
- Every protected server page calls `requireStaff()`, which sends the access token to the Cloudflare API `/api/me` endpoint.
- The API verifies the token through its Otya Auth service binding and resolves the staff record through an explicitly provisioned `AuthIdentity(provider='otya-auth')` row in D1. It does not match identities by email or trust a role sent by the browser.
- The product bridge forwards the Otya access token. It no longer creates an HMAC token.
- Missing configuration, token errors, missing staff links, inactive/unverified staff, and upstream errors fail closed.

## Not yet production-ready

- Same-origin `POST /api/auth/refresh` now refreshes the access cookie using the HttpOnly refresh cookie; the dashboard sign-out control calls `POST /api/auth/logout`, which attempts server-side refresh-token revocation and clears browser cookies even if Auth is unavailable. These routes still need dedicated automated tests and end-to-end browser verification. The refresh token is not rotated by the current Auth Worker contract.
- An Otya Auth account is not automatically an OmniPoint staff account. A privileged administrator must explicitly provision and verify the D1 staff identity link.
- Existing inventory, management and operational actions still include legacy Prisma/PostgreSQL assumptions. This checkpoint does not claim that all dashboard routes have been migrated to D1.
- Sales posting, agency-provider transactions and reconciliation remain disabled. No live payment was called and no sale was recorded.
- Do not point this branch at the production D1 database, deploy, change secrets/DNS, or migrate data until the authentication, migration, financial-invariant and rollback reviews are complete.

## Verification

Run the repository's `npm run test:worker-auth`, `npm run lint` and `npm run build` checks, plus dedicated refresh/logout route tests. Review the current GitHub Actions result for the exact branch head before treating this checkpoint as validated.
