# Cloudflare API route contract (migration spike)

Worker entry: `cloudflare-api/src/index.ts`. Wrangler config binds only to the isolated D1 database.

## Authentication boundary

All routes except `GET /health` require a short-lived HMAC-SHA256 bearer token signed with the `AUTH_HMAC_SECRET` Worker secret. Claims must include `sub`, one of the five OmniPoint roles, `exp`, `iss: "omnipoint"`, and `aud: "omnipoint-api"`.

**Do not deploy business routes until a trusted issuer, staff identity verification, key rotation, token revocation/session expiry, and role provisioning are implemented and independently tested.** This scaffold does not mint tokens, enroll staff, or replace the current Supabase Auth flow. Never create tokens manually in a browser or expose the HMAC secret.

## Routes

| Method and path | Current behavior |
|---|---|
| GET /health | Read-only D1 health check; no authentication |
| GET /api/products | Authenticated list of active products |
| POST /api/products | Manager/director/chairman/sovereign only; validates required fields and audits create |
| GET /api/ledger?type=RETAIL or FINTECH_AGENCY | Restricted read-only ledger view |
| POST /api/sales | Deliberately returns 501; no sale recorded until atomic posting is verified |
| POST /api/agency-transactions | Deliberately returns 501; no transaction recorded without provider adapter |
| POST /api/reconciliation | Deliberately returns 501; no reconciliation until ledger calculation and dual approval are implemented |

Amounts in the D1 spike are integers in the configured currency convention. Confirm the UGX precision policy and convert Prisma Decimal values explicitly before integration.

## Required acceptance tests before cutover

- Staff identity lifecycle, disabled accounts, role boundaries, expired/forged tokens, rotation and revocation.
- Duplicate SKU and idempotency handling.
- Atomic sale + stock decrement + movement + balanced retail ledger, including concurrent sales for the final item.
- Provider idempotency, pending/unknown/reversal behavior, and no false success states.
- Retail and fintech ledger separation, balanced postings, audit completeness and dual-control reconciliation.
- Backup/restore, migration row counts/checksums, rollback and observed production-like load.
