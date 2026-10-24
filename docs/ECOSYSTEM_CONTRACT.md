# Otya ecosystem integration contract

## Purpose

This contract defines how OmniPoint relates to Otya products without merging their data, permissions, or production risk. It is the source-of-truth boundary for implementation work across the PeterSmart Link / Otya ecosystem.

## System map

- **Otya Auth (otya-auth)** — shared identity verification only. A successful login does not automatically grant access to any product or business.
- **Otya Core (otya-core)** — shared Otya APIs and release/notification infrastructure. OmniPoint business transactions must not be implemented by adding OmniPoint tables or routes to the same production Worker unless a reviewed architecture decision explicitly chooses that coupling.
- **OmniPoint API (dedicated Worker, planned)** — isolated business API with its own D1 database, R2 namespace, cache namespace, queue and role checks. It is the only service allowed to write OmniPoint operational records.
- **OmniPoint web app** — staff-facing UI. It calls the OmniPoint API; it must not connect directly to D1 or hold privileged credentials.
- **Next (otya-next)** — owner assistant and approved automation interface. It can request scoped API operations but must not bypass OmniPoint authorization or directly write operational tables.
- **Otya Player** — offline-first media app. Local media remains local by default; its core playback must not depend on OmniPoint or cloud availability.
- **OtyaHub** — public product, documentation, policy and partner surfaces. Public content must not reveal private infrastructure, user records, or credentials.
- **PeterSmart Link / Otya Hold / OmniPoint UG Limited** — business and product ownership labels, not database-sharing permissions. Each company, branch, till, and business activity needs explicit tenancy and role scope.

## Ownership rules

| Data domain | Authoritative owner | Sharing rule |
| --- | --- | --- |
| Global Otya identity | Otya Auth | Share stable identity subject only; never copy password or session secrets into OmniPoint |
| OmniPoint staff membership, role, branch, approvals | OmniPoint | Map verified identity to an active local staff record; roles come from server-side records, never browser claims |
| Retail products, stock, sales, receipts, returns | OmniPoint | Private to OmniPoint business scope; no Otya Player or public-hub access |
| Agency transactions, provider references, cash/float, commissions | OmniPoint | Separate agency ledger; provider-confirmed status only; no inferred success |
| Retail ledger and agency ledger | OmniPoint | Separate ledger types and balanced entries; never silently net against each other |
| Public product information and docs | OtyaHub | Publish only reviewed public-safe material |
| Media files and release metadata | Otya Player / Otya Core release service | No default upload of local libraries or vault contents |
| Owner-assistant conversations and approved action records | Next / Otya Core, according to its existing schema | Tool calls must carry actor, purpose, scope, approval and audit context |
| Shared static assets | Relevant product namespace | Signed/short-lived access for private files; no public bucket for receipts or exports |

## Communication pattern

1. Today, the website still authenticates through the existing staff session/profile system; shared Otya Auth is the target and has not been migrated into the web login yet.
2. The current compatibility path verifies the existing web staff session server-side, issues a short-lived HMAC-signed OmniPoint token, and has the dedicated Worker verify that signature before mapping the subject to an active D1 staff membership. This adapter is temporary; the target ecosystem path is shared Otya Auth verification followed by local OmniPoint authorization. Do not claim the shared-identity migration is complete.
3. The API maps the identity subject to an active OmniPoint staff membership and loads role, company, branch and permissions from OmniPoint-owned records.
4. The API executes business operations against OmniPoint D1 only.
5. Durable events are emitted after a successful committed transaction; queue consumers are idempotent and send poison messages to the OmniPoint dead-letter queue.
6. Other products consume only explicitly published API responses or versioned events; no product queries another product's database directly.

## Security invariants

- Do not bind OmniPoint production data into otya-core merely for convenience. The dedicated API should bind only the OmniPoint D1 database and its OmniPoint resources.
- No browser, Android APK, public website or Git repository may contain service tokens, HMAC signing secrets, provider credentials or backup credentials.
- Do not trust a client-supplied role, actor ID, ledger type, provider success status or approval status.
- Every privileged write records the authenticated actor, action, entity, reason where relevant, request ID and timestamp.
- Idempotency keys are mandatory for retryable financial operations.
- Cash/retail posting must be atomic across sale, sale lines, stock movement, ledger and audit writes.
- Agency transactions must remain pending/unknown until the provider's authenticated response or status inquiry confirms the outcome.
- Retail and agency ledgers remain separate and reconcile independently.
- Next may propose or request high-impact actions, but sensitive operations require the same server-side permission checks and explicit approval as the staff UI.
- No direct database access from the UI and no cross-product SQL joins.

## Event envelope

Version 1 events should include:

- eventId: globally unique event ID
- eventType: namespaced string, e.g. omnipoint.retail.sale.completed.v1
- occurredAt: UTC ISO-8601 timestamp
- producer: service name
- tenantId, branchId: scope identifiers where applicable
- actorSubject: stable server-verified identity subject or service actor
- entityType, entityId
- correlationId, idempotencyKey
- schemaVersion
- data: minimal non-secret payload; never include access tokens, national ID numbers, full payment credentials or unnecessary personal data

Events are notifications, not a second ledger. Consumers must retrieve authoritative details from the owning API and must not treat queue delivery alone as proof of a financial transaction.

## Rollout rule

The OmniPoint API is a new, isolated service. Build and test on a feature branch and isolated database first. Production database schema application, secret configuration, provider activation, DNS changes and live transaction enablement are separate gated steps. A successful build or health endpoint does not mean payment services are ready.
