# OmniPoint Cloudflare platform blueprint

Status: implementation plan; no production resource changes or deployments are authorized by this document.
Date: 2026-10-23

## Goal

Prepare the full Cloudflare platform OmniPoint may need, not only D1. Prefer a small set of services with a clear job and a free/open-source implementation path. Enable services incrementally only when a real feature needs them. Avoid provisioning unused namespaces, queues, buckets, AI products, or custom-domain routes.

## Target architecture

- **Web UI:** existing Next.js UI may stay on Vercel while the migration is validated. Later evaluate Cloudflare Workers/Static Assets or the supported Next.js-on-Workers path; do not move hosting merely for consistency.
- **Android/mobile:** Flutter client calls the same versioned HTTPS Worker API as the web UI. No database credentials in either client.
- **Workers:** API boundary, authentication verification, authorization, input validation, provider adapters, rate limiting, and request correlation.
- **D1:** relational source of truth for organization, staff profiles, products, stock movements, sales, receipts, expenses, provider transaction state, accounting ledgers, reconciliation, and audit records—after compatibility and financial transaction tests pass.
- **Queues:** asynchronous work such as retryable provider callbacks, notifications, report generation, import processing, and reconciliation tasks. Consumers must handle at-least-once delivery using idempotency.
- **Workflows:** multi-step durable processes such as nightly close/reconciliation, bulk import, provider settlement matching, or approved onboarding. Use only where retries, waits, and durable progress justify it.
- **R2:** private documents, exports, generated reports, product images, and other binary objects. D1 stores metadata and object keys; use private buckets and short-lived authorized download links for sensitive files.
- **KV:** non-authoritative cache for feature flags, public configuration, and low-risk reference data. Never use it for balances, inventory counts, permissions, or financial truth.
- **Durable Objects:** only when single-owner coordination or persistent WebSockets are actually required, such as live till coordination or a real-time operations board. Do not use them as a substitute for the core relational ledger.
- **Cron Triggers:** scheduled non-interactive work, such as daily summaries and periodic health checks. For critical financial jobs, combine with durable execution, idempotency, run records, alerts, and manual recovery.
- **Workers AI / AI Gateway / Vectorize:** optional later for help search, document classification, or operational assistance. AI output must never authorize payments, approve staff, alter stock, or post ledger entries. Do not store sensitive business or identity data in vector indexes without a defined retention and access policy.
- **Turnstile / WAF / rate limits / Access:** protect public forms, administrative surfaces, and abusive endpoints where appropriate. Server-side authorization is still mandatory; bot challenges are not authentication.
- **Analytics Engine / Logs / tracing:** use structured, privacy-minimized logs, request IDs, error metrics, and alerts. Never log tokens, secrets, identity documents, or full payment credentials.
- **Email/notifications:** use an email provider or Cloudflare-supported email capability only after delivery, domain, abuse, and bounce behavior are verified. Keep notification failure separate from transaction success.
- **Backups/recovery:** automated D1 export/backup strategy, private R2 storage where appropriate, retention rules, checksums, restore drills, and a documented recovery point/time objective. A backup is not proven until restore-tested.
- **Secrets:** Worker secrets and deployment environment variables only; rotate and document ownership. Never put server secrets in `NEXT_PUBLIC_*`, mobile binaries, source control, or logs.

## Data and domain boundaries

Keep separate accounting domains:
1. Retail commerce and stock.
2. Mobile-money/financial agency cash and float.
3. Provider transaction/settlement records.
4. Any group/savings/loan features, only if explicitly approved and modeled separately.

A transaction crossing domains must use an explicit linking reference and reconciliation—not shared mutable balances. Ledger postings are append-only; corrections use reversals. Money uses integer minor units or validated fixed-precision strings, never binary floating point. D1 transactions, conditional updates, uniqueness constraints, and race behavior must be tested against the actual D1 runtime before money-moving operations are enabled.

## Resource preparation policy

The existing Wrangler config is intentionally bound to `omnipoint-migration-test`. Keep it that way for the current spike. Prepare additional bindings in a separate reviewed configuration only after:
- the service has a concrete feature and owner;
- its free-tier limits, quotas, data location, retention, and cost risks are checked;
- the binding has a non-production resource and least-privilege access;
- tests, monitoring, backup/restore, and cleanup steps exist.

Do not add fake IDs to an active Wrangler config, create resources just because they exist, or deploy placeholder bindings. Resource provisioning and production configuration require a separate explicit approval.

## Suggested staged implementation

### Stage A — foundation (now)
- Keep D1 migration-test isolated.
- Define shared API contracts and standard errors.
- Add Worker-specific type checking and automated auth/API tests.
- Add dependency/licence inventory and secret scanning.
- Document resource ownership and environment separation.

### Stage B — safe core operations
- Complete identity bridge and account-linking workflow.
- Product/catalog read API and inventory read path.
- Stock movement and product updates with concurrency controls and audit.
- Add pagination, filtering, request IDs, rate limits, and tenant/org authorization.

### Stage C — retail workflow
- Purchases, suppliers, stock receiving, POS checkout, receipts, returns/refunds, expenses, shifts and end-of-day reconciliation.
- Atomic stock decrement, sale record, stock movement, ledger postings, and audit event.
- Offline client queue only after conflict and duplicate-submission policy is tested.

### Stage D — operations platform
- Queues for notifications and retryable work.
- Workflows for imports, reconciliation and approved onboarding.
- R2 for private exports and product media.
- Cron, structured observability, alerts, backup and restore drills.

### Stage E — provider sandbox
- Provider-neutral adapters; fake provider first, then official sandbox.
- Verify callbacks/signatures, replay protection, idempotency, timeout/unknown state, reversals and settlement reconciliation.
- Live payment execution stays disabled until provider agreements, applicable regulatory responsibilities, and operational controls are confirmed.

### Stage F — optional advanced services
- Durable Objects for justified real-time coordination.
- Workers AI/AI Gateway/Vectorize only for bounded, low-risk support use cases.
- Evaluate Cloudflare hosting for the Next.js UI only after compatibility and rollback tests.

## Exit gates

No production cutover until CI, worker tests, D1 concurrency/atomicity tests, authorization tests, API contract tests, recovery drills, financial reconciliation tests, and a rollback rehearsal pass. No secrets, DNS, production database, payment provider, or deployment changes without separate approval.
