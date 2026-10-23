# Cloudflare API route contract (migration spike)

Worker entry: `cloudflare-api/src/index.ts`. Wrangler config binds only to the isolated D1 database.

## Authentication boundary

All routes except `GET /health` require a short-lived HMAC-SHA256 bearer token signed with the `AUTH_HMAC_SECRET` Worker secret. Claims must include `sub`, `exp`, `iss: "omnipoint"`, and `aud: "omnipoint-api"`. The Worker resolves the current role, active state, and identity verification from the D1 `User` row on every request; any role claim in the token is ignored.

**Do not deploy business routes until a trusted issuer, staff identity verification, key rotation, token revocation/session expiry, and role provisioning are implemented and independently tested.** This scaffold does not mint tokens or enroll staff. The `sub` claim must be the corresponding D1 `User.id`, issued only by a trusted server-side identity bridge after verifying the upstream identity token and account link. The current Supabase Auth flow is not yet bridged to this Worker. Never create tokens manually in a browser or expose the HMAC secret.

## Routes

| Method and path | Current behavior |
|---|---|
| GET /health | Read-only D1 health check; no authentication |
| GET /api/products | Authenticated list of active products |
| POST /api/products | Manager/director/chairman/sovereign only; validates fields and atomically inserts product plus audit event using a D1 batch |
| GET /api/ledger?type=RETAIL or FINTECH_AGENCY | Restricted read-only ledger view |
| POST /api/sales | Deliberately returns 501; no sale recorded until atomic posting is verified |
| POST /api/agency-transactions | Deliberately returns 501; no transaction recorded without provider adapter |
| POST /api/reconciliation | Deliberately returns 501; no reconciliation until ledger calculation and dual approval are implemented |

Amounts in the D1 spike are integers in the configured currency convention. Confirm the UGX precision policy and convert Prisma Decimal values explicitly before integration.

## Required acceptance tests before cutover

- Staff identity lifecycle, disabled accounts, role boundaries, expired/forged tokens, rotation and revocation.
- Duplicate SKU and idempotency handling.\n- D1 profile lookup on every request; disabled/unverified users and stale role claims fail closed.\n- Product insert and audit event are atomic: both persist or neither persists.
- Atomic sale + stock decrement + movement + balanced retail ledger, including concurrent sales for the final item.
- Provider idempotency, pending/unknown/reversal behavior, and no false success states.
- Retail and fintech ledger separation, balanced postings, audit completeness and dual-control reconciliation.
- Backup/restore, migration row counts/checksums, rollback and observed production-like load.
