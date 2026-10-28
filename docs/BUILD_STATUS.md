# OmniPoint build status

## Decision

- Cloudflare is the primary runtime and data platform.
- GitHub is the canonical source repository and CI platform.
- D1 is the authoritative relational business database.
- R2 is for private files and backup artifacts.
- KV is only for reconstructable cache, never for financial records.
- Queues are for asynchronous work after retry/idempotency/dead-letter behavior is tested.
- Otya Auth provides shared identity; OmniPoint retains its own staff membership and role authorization.
- AWS is not part of the default stack. Reconsider only for a verified payment-provider requirement.

## Current isolated development stack

- D1 `omnipoint-dev`, UUID `2c4de5d4-6898-4768-9a60-091bca7779b5`, EU jurisdiction.
- R2 `omnipoint-dev-private` and `omnipoint-dev-backups`; both currently empty.
- KV `omnipoint-dev-cache`, UUID `69ca8a463e60410d907749d4e863faf4`.
- Queues `omnipoint-dev-jobs` and `omnipoint-dev-jobs-dlq`.
- Core, company-scope and staff-profile migrations applied; migration history recorded.
- Read-only verification found expected core tables/indexes/triggers, zero rows in the nine core business tables, and no foreign-key violations.
- A single root `wrangler.toml` points to development resources. `workers_dev=false`; no Worker is deployed, and no route or custom domain is configured.
- Legacy OmniPoint-only D1 databases, R2 buckets, KV namespace and queues were deleted after checking that no deployed Worker used them, old R2 buckets and KV were empty, and old queues had no producers or consumers.
- Existing Otya Workers, D1 databases, R2 buckets, KV namespaces, queues and secrets were left untouched.

## Legacy application code

The existing Next.js dashboard still contains Supabase/Prisma code and is not connected to the Cloudflare API. It is not the target runtime. Remove those dependencies only after migrating the dashboard and verifying it no longer imports them. Do not add new OmniPoint features to the legacy data path.

## Release gates before private preview

1. CI passes migration validation, schema tests, type-check, lint, build and Wrangler dry-run config validation.
2. Otya Auth token response and local staff authorization are contract-tested.
3. Staff provisioning and owner recovery are secure and audited.
4. Sale posting passes idempotency, concurrency, insufficient-stock, duplicate-request and rollback tests.
5. Ledger balancing, refunds/reversals and audit behavior are verified.
6. An independent backup export is retrieved, checksummed and restored to an isolated database.
7. The UI sends tokens through a secure server-side auth bridge and calls only the documented API.
8. Preview access is private; logs do not expose secrets or sensitive business records.
9. Payment providers remain disabled until partner requirements, callbacks, settlement and reconciliation are implemented.

Passing a build or health check is not proof of production readiness.
