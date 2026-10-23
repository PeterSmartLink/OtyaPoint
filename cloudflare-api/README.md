# OmniPoint Cloudflare API spike

An isolated Worker + D1 API scaffold for the OmniPoint migration. It is **not production-ready** and is not wired into the Next.js dashboard or the existing Supabase Auth session flow.

## Safety boundaries

- Wrangler binds only to `omnipoint-migration-test`, an isolated D1 database.
- `GET /health` is a read-only database health check.
- Business routes require a signed short-lived HMAC bearer token. Without `AUTH_HMAC_SECRET`, they fail closed with `503 auth_not_configured`.
- The token verification scaffold does not mint tokens, enroll staff, or provide revocation/key rotation. It resolves the verified upstream subject through the D1 `AuthIdentity` link table and then checks the current D1 staff profile. The trusted issuer, link provisioning, revocation/key rotation, and lifecycle are still not implemented. Do not deploy business routes until these are implemented and reviewed.
- Product reads and manager-only product creation are scaffolded. Sales posting, agency transactions, and reconciliation deliberately return `501` without recording anything until atomic financial behavior, provider adapters, and approval controls are implemented.
- No real data was copied; this change does not deploy a Worker or alter DNS, Vercel, or Supabase.

## Routes and acceptance gates

See [the route contract](../docs/cloudflare-api-route-contract.md) for the current API surface and required tests. Do not connect the dashboard or production traffic until authentication, authorization, audit completeness, ledger invariants, concurrency behavior, backups and rollback have passed verification.

## Local checks

From the repository root, install Wrangler in a development environment and run:

```sh
npx wrangler dev --config wrangler.toml
```

Check `GET /health`. Set `AUTH_HMAC_SECRET` only as a Worker secret in the approved test environment; never commit it or place it in a `NEXT_PUBLIC_*` variable.
