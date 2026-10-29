# Sovereign Founder Access — Cloudflare target specification

## Goal

Provide one protected owner role for the verified founder of Otya Hold Ltd T/A OmniPoint. The role represents owner-level administration for this single shop; it must not be assigned automatically or through public registration. This specification does not grant access by itself.

## Approved platform boundary

- GitHub: source control, reviewed changes and CI.
- Cloudflare Workers: approved runtime and API.
- Cloudflare D1: authoritative OmniPoint staff and operational records.
- Otya Auth: candidate shared identity service, integrated only after its verification contract is explicitly defined and tested.
- Supabase, Vercel and Appwrite are excluded from the target architecture.

The legacy implementation referenced Supabase Auth, Prisma and PostgreSQL. Those instructions are historical and must not be used to provision a new live owner account.

## Authorization model

- Store the current active staff profile and role in authoritative OmniPoint D1 records.
- Verify the caller through the reviewed Otya Auth ↔ OmniPoint contract. Prefer the authenticated Cloudflare Service Binding or another independently reviewed token-verification design.
- Never trust client-supplied roles or stale role claims without a current D1 authorization lookup.
- Fail closed when the token is expired, invalid, revoked, the auth service is unavailable, the staff profile is inactive/unverified, or the D1 authorization lookup fails.
- Only the explicitly verified owner account may receive `SOVEREIGN`. Ordinary staff-management flows must never grant this role.
- Keep the bootstrap process private, one-time, idempotent, auditable and disabled after successful provisioning. No public bootstrap endpoint.
- Require appropriate step-up verification for high-impact actions such as changing owner access, changing security configuration, exporting sensitive data or authorizing exceptional financial operations.

## Authentication contract blocker

The current OmniPoint Worker scaffold expects a locally HMAC-signed token with `iss: "omnipoint"`, `aud: "omnipoint-api"` and `idp: "supabase"`. Otya Auth currently issues a different JWT claim shape and exposes `GET /auth/verify`. These contracts must not be assumed compatible.

Before enabling owner access through the new runtime, define and test a versioned contract covering issuer, audience, subject mapping, expiry, logout/revocation, key rotation, staff deactivation, role changes, and service failure. Do not merely replace the `supabase` string or copy the signing secret between services.

## Financial integrity and audit

- Preserve append-only ledger and audit history.
- Correct posted financial errors through linked reversals or adjustment entries, never by editing or deleting prior financial entries.
- Record actor, action, target, reason, request ID and relevant before/after state for privileged changes.
- Perform authorization checks server-side on every sensitive mutation, including staff changes, transaction approvals, configuration changes, exports and reconciliation.
- Keep live provider operations disabled until provider approval, signed callback verification, replay protection, idempotency, timeout/retry behavior, reversals and reconciliation are tested.

## Provisioning acceptance checklist

1. Verify the owner's identity using a protected administrative procedure; never grant access solely because an email address matches.
2. Confirm the target D1 schema version and ensure there is no conflicting owner/staff record.
3. Provision the owner role using a reviewed one-time operation that fails closed on mismatch and emits an audit event.
4. Verify sign-in, logout/revocation, active-staff checks, authorization denials, role changes and failure behavior.
5. Disable/remove the bootstrap path after successful use and verify it cannot be invoked again.
6. Keep the account unprovisioned until the auth contract and tests are ready.

## Current status

This document is a specification, not an executed provisioning action. No owner account has been created or modified by this change. No database, secret, DNS, deployment or payment-provider state has been changed. Do not use this as authorization to launch production.
