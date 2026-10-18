# Sovereign Founder Access

## Goal

Introduce a single `SOVEREIGN` authorization role for the verified founder account, representing Founder, Chairman, and Managing Director responsibilities. This is a proposed implementation specification; it does not grant access by itself.

## Authorization model

- Add `SOVEREIGN` to the Prisma `UserRole` enum and the corresponding PostgreSQL enum through a reviewed migration.
- Keep ordinary staff roles unchanged.
- Centralize permission checks in a server-only authorization module. Do not rely on hidden UI controls or client-supplied role values.
- Sovereign permissions cover staff administration, management configuration, operational workflows, transaction initiation and authorization, reconciliation, and audit viewing.
- All privileged actions must require a valid Supabase-authenticated user and a matching active, verified staff profile.
- Only the explicitly provisioned founder account may receive `SOVEREIGN`. Never allow public sign-up or ordinary staff-management forms to assign this role.
- Do not allow routine API actions to grant or remove Sovereign privileges. Any future transfer/recovery process must be a separate, explicitly controlled operational procedure.

## Financial integrity

- Preserve append-only ledger and audit history.
- Correct posted financial errors through linked reversals or adjustment entries, not edits or deletions.
- Record actor, action, target, reason, request ID, and before/after state where appropriate for every privileged change.
- Make authorization decisions server-side for every sensitive mutation, including transaction approval, staff role changes, account suspension, and configuration changes.
- Do not claim live mobile-money execution until provider integration, credentials, callbacks, idempotency, reconciliation, and sandbox/production verification are implemented.

## First-founder bootstrap

1. Confirm the target Supabase Auth user ID and verified email using a privileged, server-side setup process; link the staff profile using the normalized email because OmniPoint resolves staff profiles by email, while the Prisma staff ID is a separate internal ID.
2. Verify there is no conflicting staff profile and confirm the schema/migration version.
3. Provision exactly one staff profile for that normalized email, using a new internal Prisma staff ID, role `SOVEREIGN`, `isActive=true`, `identityStatus=VERIFIED`, and approval timestamp; record a bootstrap audit event where supported.
4. Make the bootstrap operation idempotent and non-public. It must fail closed if the expected account does not match.
5. Remove/disable the one-time bootstrap path after successful provisioning; never expose service-role credentials in browser code or logs.
6. Test login, authorization for each permission group, denial for ordinary staff, and financial-history immutability before deployment.

## Current limitations

This document does not perform a database mutation, deploy application code, or activate an account. The feature requires coordinated Prisma/schema migration, server authorization changes, tests, and a protected deployment. Keep the existing production deployment protected and do not merge or promote until checks pass.
