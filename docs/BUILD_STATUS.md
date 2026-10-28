# OmniPoint build status

## Decision

- **Cloudflare** is the default runtime and data platform.
- **GitHub** is the canonical source repository and CI platform.
- **D1** is the authoritative relational business database.
- **R2** is for private files and verified backup artifacts.
- **KV** is only for reconstructable cache, never for financial records.
- **Queues** are for asynchronous work after retry/idempotency/DLQ behavior is tested.
- **Otya Auth** provides shared identity; OmniPoint retains its own staff membership and role authorization.
- **AWS** is not part of the default stack. Reconsider only for a verified requirement such as provider-approved static egress.

## Fresh development foundation

- D1 `omnipoint-dev`, UUID `2c4de5d4-6898-4768-9a60-091bca7779b5`, EU jurisdiction.
- R2 `omnipoint-dev-private` and `omnipoint-dev-backups`.
- KV `omnipoint-dev-cache`, UUID `69ca8a463e60410d907749d4e863faf4`.
- Queues `omnipoint-dev-jobs` and `omnipoint-dev-jobs-dlq`.
- Core, company-scope and staff-profile migrations applied to the new D1 database; migration history recorded.
- Read-only verification found the expected core tables, indexes and triggers, zero rows in the nine core business tables, and no foreign-key violations.
- No OmniPoint Worker has been deployed from the new configuration. The single `wrangler.toml` has public `workers_dev` access disabled and no route/custom domain.

## Legacy components and cleanup

The older `omnipoint-prod`, `omnipoint-migration-test`, their related buckets/cache/queues, and duplicate Wrangler configurations are legacy OmniPoint-only resources. They are not bound to the existing Otya Workers. Retire them only after the single-config cleanup is merged and a final binding/object/key/consumer check confirms they remain unused. Do not modify Otya Auth/Core/Next or Otya-owned data resources.

The existing Next.js dashboard still contains Supabase/Prisma code. It is not the target runtime and is not yet connected to the Cloudflare API. Remove those dependencies only after the dashboard has been migrated and tests prove it no longer imports them. No new OmniPoint feature should be built on that legacy data path.

## Required gates before a private preview

1. CI passes migration validation, schema tests, type-check, lint and build.
2. Otya Auth token response and local staff authorization are contract-tested.
3. Staff provisioning and owner recovery are secure and audited.
4. Sale posting passes idempotency, concurrency, insufficient-stock, duplicate-request and rollback tests.
5. Ledger balancing, refunds/reversals and audit behavior are verified.
6. An independent backup export is retrieved, checksummed and restored to an isolated database.
7. The UI sends tokens through a secure server-side auth bridge and calls only the documented API.
8. Preview access is private; logs do not expose secrets or sensitive business records.
9. No payment provider is activated until partner requirements, callbacks, settlement and reconciliation are implemented.

Passing a build or health check is not proof of production readiness.
