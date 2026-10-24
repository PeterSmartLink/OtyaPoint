# Cloudflare resource inventory — read-only audit

Audit date: 2026-10-24 UTC. This is a snapshot from Cloudflare API inventory, not a guarantee that every account resource is listed.

## OmniPoint resources observed

| Resource | Name | Identifier / notes | Current assessment |
| --- | --- | --- | --- |
| D1 | omnipoint-prod | 65868e64-ff39-4ed3-91de-59c237cd9cb0; EU jurisdiction | Dedicated database exists; API inventory reports zero tables, so production schema is not applied |
| D1 | omnipoint-migration-test | 43d274ce-d46e-462f-bcef-59b93caefc21; EU jurisdiction | Isolated test database |
| R2 | omnipoint-private | private operational documents/receipts/exports target | Bucket exists; upload authorization and lifecycle are not yet verified |
| R2 | omnipoint-backups | reserved backup target | Bucket exists; backup jobs, encryption/access controls, retention and restore drills are not yet verified |
| KV | omnipoint-cache | cc30449e4a93428c989a564cebf80417; EU jurisdiction | Cache namespace exists; use only for reconstructable/short-lived data |
| Queue | omnipoint-jobs | bd18ce6e20e943779022ee845ec38380; EU jurisdiction | Queue exists; currently no producer or consumer is attached |
| Queue | omnipoint-jobs-dlq | cf8f143e40404863930ffa44662fcf1d; EU jurisdiction | Dead-letter queue exists; currently no consumer is attached |

## Existing Otya resources observed — do not repurpose

- Workers: otya-auth, otya-core, otya-next.
- D1: otya-auth-db, otya-store-db.
- R2: otya-assets, otya-player-releases.
- KV: otya-auth-kv, otya-core-kv.
- Queues: otya-next-jobs, otya-next-jobs-dlq, otya-push, otya-push-dlq, otya-release-events, otya-release-events-dlq.

The existing Otya resources serve separate production workloads. They must not be renamed, deleted, or have bindings changed as part of OmniPoint setup.

## Key findings

1. The dedicated OmniPoint D1 database exists but has no tables yet. Do not point a live dashboard at it and imply it is ready.
2. The Otya Core worker has existing production routes and bindings. OmniPoint should be a separate Worker instead of expanding the shared production Worker as the default approach.
3. OmniPoint queues exist but are unattached. Queue producer/consumer configuration and retry/DLQ handling must be added in a dedicated OmniPoint Worker configuration and tested.
4. R2 buckets are provisioned but application access controls, retention, backup automation and recovery are not verified. Do not store public receipts or sensitive identity documents in them.
5. Cloudflare location hints and jurisdiction labels are not a blanket guarantee of end-to-end data residency. Review the location policy for each service before making residency claims.

## Required next checks

- Inspect current schema and table counts in the Supabase OmniPoint project without changing it; treat it as a legacy/recovery source, not a second live writer.
- Inspect the D1 schema on both OmniPoint databases directly, since the Cloudflare list endpoint's table-count field is not always a substitute for a schema query.
- Validate the dedicated Worker binding and API contract against the intended D1 schema.
- Verify the Otya Auth issuer, audience, signing-key rotation and revocation contract before integrating shared identity.
- Add a controlled backup export, retention policy, alert and an actual isolated restore test before storing live financial records.
- Keep deployment and provider execution disabled until security, transaction, concurrency and reconciliation tests pass.
