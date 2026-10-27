# OmniPoint production readiness runbook

This runbook follows the owner-approved target architecture: **GitHub + Cloudflare only**. Supabase, Vercel and Appwrite are not operational dependencies. This is a readiness checklist, not authorization to deploy, change production resources, migrate real records, or enable money movement.

## 1. Runtime and configuration

- GitHub is the source-control and CI platform.
- Cloudflare Workers is the approved application/API runtime; D1 is the authoritative operational database; R2 is private object storage for controlled backups and files.
- Use KV only for reconstructable cache or short-lived state where its consistency characteristics are appropriate. Use Queues/Workflows only with tested retry, idempotency, dead-letter and replay handling.
- Keep secrets in Cloudflare Worker secrets, never in source, browser variables, test collections, issue comments or logs. Do not copy a signing secret between services merely to make authentication work.
- Confirm each Wrangler configuration explicitly targets the intended environment. The migration-test configuration must remain isolated from `omnipoint-prod`.
- Do not bind production domains, change DNS, rotate secrets, run remote migrations, or deploy until the owner approves a reviewed change and recovery plan.

## 2. Authentication and first owner/staff access

The existing dashboard contains legacy Supabase Auth and Prisma code. The Cloudflare Worker scaffold also has a token contract that does not yet match Otya Auth. Therefore the existing login and Worker business API must not be treated as a completed Cloudflare-native system.

Before any operational launch:

1. Define and document one versioned Otya Auth ↔ OmniPoint authentication contract. Prefer an authenticated Cloudflare Service Binding to Otya Auth or another independently reviewed verification mechanism; do not accept client-provided roles.
2. Test issuer/audience validation, expiry, logout/revocation, key rotation, staff deactivation, role changes, wrong tokens, and auth-service/D1 failure. All failures must deny access.
3. Resolve the verified identity to an active OmniPoint staff record in D1 on every sensitive request.
4. Provision the owner role only through a protected, reviewed, one-time administrative process. Never provide public signup, email-only privilege assignment, or an unauthenticated bootstrap endpoint.
5. Record owner/staff provisioning and privileged actions in append-only audit history. Remove or disable the one-time bootstrap path after use.

Do not create a live owner account, alter user records, or change authentication secrets as part of this documentation step.

## 3. Data and recovery

- D1 is the authoritative store for OmniPoint operational records. Do not dual-write financial records to a second database.
- Keep the migration-test database separate from production. Validate migrations locally and in isolated test resources; do not apply them to production as part of CI.
- Establish scheduled, private Cloudflare-native backups/exports to R2 with access controls, retention, integrity manifests and alerting.
- Demonstrate restoration into an isolated database and verify schema version, row counts, key relationships and ledger balance before declaring backups ready.
- A bucket existing is not proof a backup exists; a backup file existing is not proof restoration works.
- Preserve existing production records. No deletion, destructive migration or data transfer without explicit approval and a verified rollback/recovery procedure.

## 4. Repository and CI

- Pin dependencies and use the lockfile with `npm ci` where applicable.
- Require schema validation, lint, build, Worker contract tests, authorization tests, and financial invariant tests to pass before merge.
- Inspect GitHub Actions results for the exact commit being reviewed. A third-party preview status is not proof that Cloudflare production was deployed or verified.
- Ensure operational documentation no longer instructs staff to configure excluded platforms. Historical audit evidence may remain if clearly labeled as historical and not a current procedure.

## 5. Financial and provider launch gates

Keep live money movement disabled until all applicable gates pass:

- Retail checkout is atomic across receipt, stock movements, stock balance and balanced ledger entries.
- Agency records distinguish pending, confirmed, failed, reversed and unknown provider outcomes. A timeout is not a confirmed failure.
- Provider requests have idempotency, authenticated callbacks, replay protection, safe retries, reversal handling and reconciliation.
- Provider sandbox testing and required partner approvals are complete.
- Cash drawer, per-provider float, commissions, expenses, close-of-day and reconciliation are independently tested.
- Role authorization, audit immutability, backup/restore, monitoring, incident response and least-privilege access are verified.
- Uganda-specific tax, data-protection and payment-provider obligations are reviewed with qualified professionals.

## 6. Current go/no-go position

**Not ready for live financial use.** The authentication contract and dashboard runtime migration remain blockers; sales posting, provider execution and reconciliation must stay disabled until their acceptance tests pass. Documentation or CI success alone does not authorize production use.
