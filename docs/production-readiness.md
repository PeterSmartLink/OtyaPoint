# OtyaPoint production readiness runbook

This runbook reflects the current Cloudflare-first direction. It is a gate checklist, not a claim that production readiness has been achieved. Keep live money movement disabled until every applicable gate is verified.

## 1. Canonical runtime

- Source of truth: GitHub repository `PeterSmartLink/OtyaPoint`.
- API runtime target: Cloudflare Worker `otyapoint-api`.
- Business database target: Cloudflare D1 `otyapoint-db`.
- Private object storage and backups: R2 buckets `otyapoint-private` and `otyapoint-backups`.
- Cache: the configured OtyaPoint KV namespace.
- Identity: shared Otya Auth Worker, with OtyaPoint-local staff membership and authorization.
- Transactional email: shared Resend configuration where needed.

The Wrangler configuration disables public `workers.dev` access and declares no custom route. Do not enable a public route until the restricted preview and release gates pass. Never copy secrets into source control or chat.

## 2. Data preservation and backup/restore

- Compare `omnipoint-dev` and `otyapoint-db` by schema, migration history, and business-row counts/table contents using read-only queries.
- Reconcile discrepancies before selecting the single authoritative OtyaPoint business database.
- Export each database using the supported Cloudflare D1 export workflow, polling until the export reaches a terminal state.
- Store the completed export in a verified private backup destination and confirm object size/checksum and retrieval.
- Restore into an isolated destination and run schema, row-count, stock/ledger invariant, and application tests.
- Record the restore result and recovery steps before any legacy cleanup.

The previously attempted temporary export download returned HTTP 403. Until a fresh export is stored and restore-tested, backup/restore is **not verified**. Do not delete a database, bucket, KV namespace, or queue merely because its name contains “old” or “dev”.

## 3. Identity, staff access, and owner recovery

- Verify the Otya Auth token contract and audience/issuer expectations.
- Ensure a valid Otya identity does not grant OtyaPoint access without an active local staff membership.
- Test least-privilege roles, company scoping, disabled staff, expired/revoked sessions, and denied requests.
- Create the first manager through a reviewed, authenticated administrative procedure. Do not create a public bootstrap endpoint, store passwords in SQL, or grant a role solely because an email address matches.
- Verify audit records for staff provisioning and privilege changes.
- Test owner recovery without weakening MFA or bypassing normal authorization.

## 4. Application build and CI

- Run the existing GitHub Actions verification workflow and fix failures rather than bypassing security checks.
- Validate all D1 migrations and their order.
- Run both SQLite schema test suites, Worker type-checking, Wrangler dry-run bundling, lint, and the dashboard build.
- Use reproducible dependency installation only after a committed lockfile exists and matches the repository's supported Node/npm version.
- Audit legacy Prisma/Supabase imports and remove runtime dependencies only in reviewed, tested changes after the dashboard is migrated to the Cloudflare API.
- Require review and successful checks before merging deployment-related changes.

## 5. Private preview and operational monitoring

- Deploy only to a restricted preview without changing DNS, public routes, or the existing customer-facing site.
- Verify every required binding and secret by name and presence; never print secret values.
- Test health, identity, authorization, inventory, staff, stock adjustments, cash sale idempotency, ledger balance, and rollback behavior.
- Confirm logs and traces redact sensitive values, and verify alert routing by causing a controlled non-production alert.
- Test queue producer/consumer behavior, retries, dead-letter handling, and idempotency before attaching a consumer.
- Verify backup schedules, restore procedures, and incident response contacts.

## 6. Payment and financial launch gates

Keep Airtel Money, MTN MoMo, Interswitch/Quickteller, and all real-money actions disabled until:
- Provider approval and sandbox flows are verified.
- Callback signatures, timestamps, replay protection, and idempotency are implemented and tested.
- Timeouts, duplicate callbacks, retries, reversals, reconciliation, and failed/rolled-back transactions are covered.
- Ledger entries remain balanced and immutable, with audit trails for every financial operation.
- Provider IP allow-list requirements are met through an approved, stable egress design if required.
- Applicable Uganda tax, financial-service, consumer, and data-protection obligations have been reviewed with qualified professionals.

## 7. Cleanup policy

A resource is eligible for deletion only after:
1. Its live bindings, code references, queue producers/consumers, and domain dependencies are checked.
2. Its data is inventoried and, if applicable, backed up and restore-tested.
3. A replacement is operational and monitored.
4. The proposed deletion is recorded in a reviewed change.
5. A rollback or recovery path exists.

Never delete canonical Otya Auth/core/store Workers, Otya assets/release artifacts, or any database with unverified data dependencies as part of routine cleanup.
