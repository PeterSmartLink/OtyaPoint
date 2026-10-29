# Cloudflare API route contract (migration spike)

Worker entry: `cloudflare-api/src/index.ts`. Wrangler config binds only to the isolated D1 database.

## Authentication boundary

All routes except `GET /health` require a valid short-lived Otya Auth access token. The Worker verifies the bearer token through the private Cloudflare Service Binding `env.AUTH` using `GET https://auth/auth/verify`; it does not trust decoded client claims or a shared static HMAC secret.

The verified response must contain `{ ok: true, user_id: string }`. The verified `user_id` is then mapped through an explicitly provisioned `AuthIdentity` link with provider `otya-auth`. The current D1 `User` row is checked on every request for active status, verified identity state, and current role. Email matching alone must never create an identity link, and the browser must never supply a role as proof of authorization.

The new `0005_otya_auth_identity.sql` migration expands the identity-provider constraint while preserving existing rows. It must be applied and tested only against the isolated migration-test database until reviewed. The Wrangler `AUTH` service binding is configuration for the Worker; this change does not deploy it or alter production resources.

**Still required before business routes can be enabled for real use:** explicitly provision and audit the correct owner/staff identity link; test expired/invalid tokens, logout/access-token expiry, disabled or unverified staff, role changes, missing links, Auth service timeout/failure, and D1 failure. Auth verification failure returns a denial or service-unavailable response. Do not provision an owner account or activate money-moving routes as part of this code change.

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
- Duplicate SKU and idempotency handling.\n- D1 `AuthIdentity` and profile lookup on every request; disabled/unverified users, missing/revoked links and stale role claims fail closed.\n- Product insert and audit event are atomic: both persist or neither persists.
- Atomic sale + stock decrement + movement + balanced retail ledger, including concurrent sales for the final item.
- Provider idempotency, pending/unknown/reversal behavior, and no false success states.
- Retail and fintech ledger separation, balanced postings, audit completeness and dual-control reconciliation.
- Backup/restore, migration row counts/checksums, rollback and observed production-like load.
