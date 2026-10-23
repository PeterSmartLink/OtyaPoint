# Cloudflare platform map for Otya OS and OmniPoint

**Purpose:** a controlled plan for organizing the existing Cloudflare account. This is an inventory and target architecture, not a claim that every feature is enabled or every service is production-ready.

## Guardrails

- Preserve existing Workers, domains, databases, KV namespaces, queues, R2 objects, secrets and integrations.
- Do not rename, delete, recreate, attach, or repoint production resources during the inventory phase.
- Never print or commit secret values. Inventory only secret names and which Worker uses them.
- Separate preview/staging from production using separate resources and credentials where practical.
- Apply changes through reviewed code/configuration, previews, smoke tests and rollback plans.
- One legal company: **Otya Hold Ltd**, trading as **OmniPoint**. **Otya OS** is the connected ecosystem, not a reason to combine unrelated data stores.

## Existing inventory observed read-only

| Resource class | Observed resources | Initial interpretation |
|---|---|---|
| Workers | `otya-auth`, `otya-core`, `otya-next` | Existing production-labelled services; inspect source, triggers, versions, routes and callers before changing |
| D1 databases | `otya-auth-db`, `otya-store-db`, `omnipoint-migration-test` | Keep Auth and Store isolated; migration-test stays non-production. D1 inventory metadata reports zero tables for all three despite non-zero file sizes; reconcile with schema inspection before relying on that metadata |
| KV namespaces | `otya-auth-kv`, `otya-core-kv` | Auth/Core scoped. Determine key ownership, TTL, consistency expectations and restore/rebuild procedure |
| R2 buckets | `otya-assets`, `otya-player-releases` | Separate general assets from signed/versioned player release artifacts; document access, retention and public delivery |
| Queues | `otya-next-jobs`, `otya-next-jobs-dlq`, `otya-push`, `otya-push-dlq`, `otya-release-events`, `otya-release-events-dlq` | Existing producers/consumers are attached. Release-events currently reports no consumer; confirm whether intentional before changing |
| Workflow | `otya-release` bound to `otya-core` | Existing release automation; review retry, idempotency and failure alerts |
| AI Gateway | `otya-next-gateway` | Existing AI routing/observability candidate for Otya Next; inspect policies and usage before changing |
| Worker AI / AI Search / Browser | Bound to `otya-next` | Likely Otya Next capabilities; confirm cost, access restrictions, prompt/data handling and whether browser automation is necessary |
| Analytics Engine | Datasets referenced by Auth, Core and Next | Confirm dataset existence, data minimization, retention and query access |
| Domain zone | `petersmartlink.com` active | Existing business domain; no DNS edits in this plan |
| Cloudflare Access apps | None returned in account inventory | Evaluate for internal/admin surfaces; don't lock down customer-facing routes without a tested access plan |
| Hyperdrive | None returned | Candidate only if Workers need a supported connection path to the existing PostgreSQL/Supabase database; not required if the current app backend already handles database access |
| Secrets Store | Several Workers use references to stored secrets | Centralization candidate; preserve current bindings and rotate only through a separately approved process |
| Pages | Inventory request rejected its pagination options | Status unknown; retry with documented pagination or dashboard before concluding none exist |

**Important:** Worker settings include some production bindings that reference the same `otya-store-db` from both Core and Next. This is a data-ownership and blast-radius concern to review, not proof of a defect. Do not split or repoint the binding until source code, schema ownership, existing records and migration strategy are verified.

## Target organization

### 1. Edge and entry points

- Cloudflare DNS, CDN/cache and TLS for verified owned domains.
- WAF/managed rules, DDoS protections, rate limits and API Shield where supported and justified by plan/traffic.
- Turnstile on appropriate public forms or sign-up flows where abuse risk warrants it.
- Cloudflare Access for staff/admin tools, internal dashboards and operational endpoints; use identity-aware policies and test break-glass access.
- Keep public website traffic separate from privileged API routes. No broad wildcard Worker routes without a route-by-route inventory.

### 2. Compute and API contracts

| Service | Responsibility | Proposed boundary |
|---|---|---|
| Otya Auth | Identity, session validation, staff roles/permissions | Identity only; explicit issuer/audience/expiry and revocation rules; no retail or media business logic |
| Otya Core | Versioned shared APIs and common platform capabilities | Explicit service contracts and audit/correlation IDs; no undocumented cross-domain database writes |
| Otya Next | AI assistant and customer support | Scoped tool permissions, per-user/session limits, redaction and human escalation; no direct privileged financial actions |
| OmniPoint API (planned) | POS, retail inventory, agency ledger and reports | Add as a separate service only after repository/API contract and database ownership are decided; do not repurpose Otya Next/Core |
| Otya Media | Media-player APIs and release delivery | Keep media/release functionality independent from OmniPoint transactions |

Use Cloudflare service bindings for private Worker-to-Worker calls where suitable; avoid routing internal calls through public URLs unnecessarily. Version API contracts and authenticate any external webhook.

### 3. Data layer: choose each service for a reason

- **OmniPoint operational database:** must be a Cloudflare-owned operational data path; Supabase is NOT OmniPoint's database and must not be configured as its live data source. The existing `omnipoint-migration-test` D1 contains OmniPoint-shaped tables, but its name indicates a test/migration resource. Keep it isolated until ownership, schema/migrations, data contents, bindings and restore behavior are verified; do not silently promote it to production.
- **D1:** the current OmniPoint schema in D1 must be reconciled with the repository's Prisma/PostgreSQL schema. They are different database engines and differ in types, SQL, transactions and migration tooling. Decide and document the supported Cloudflare-native production database path only after compatibility tests. Hyperdrive is not an OmniPoint/Supabase default and should not be used to reconnect OmniPoint to Supabase.
- **KV:** suitable for cacheable config, feature/config flags, short-lived lookups or session data where eventual consistency is acceptable. Do not store the only copy of a financial ledger or authorization state requiring immediate revocation.
- **R2:** large files, media, signed release packages, export files and encrypted backup artifacts where policy allows. Keep private objects private; use short-lived signed access and integrity hashes.
- **Durable Objects:** introduce only for workloads needing strongly coordinated state, such as per-tenant realtime coordination or serialized job/session state; not as a default database.
- **Queues:** background email/push delivery, webhook processing, exports and retryable non-blocking jobs. Require idempotent consumers, bounded retries, DLQ monitoring and a safe replay procedure.
- **Workflows:** long-running release, export, onboarding or reconciliation orchestration that needs durable steps and retry visibility. Never assume retries make financial actions safe; enforce idempotency at the domain boundary.
- **Analytics Engine / Web Analytics / logs:** operational metrics and aggregate usage, with redaction and retention rules. Analytics is not the accounting ledger.

### 4. Security and secrets

- Keep secrets in Worker secret bindings or Cloudflare Secrets Store where supported; never put secret values in plain-text vars, GitHub, frontend bundles or logs.
- Inventory secret *names*, consumers, owner, rotation date and recovery steps; don't export values.
- Review least privilege and service-to-service authentication. Use separate secrets per environment/service where feasible, and a tested rotation process.
- Add WAF/rate limiting and schema/authorization checks at API boundaries. API Shield and mTLS are candidates for suitable API/partner traffic, not blanket requirements.
- Audit admin endpoints, CORS allowlists, webhook signature verification, JWT issuer/audience/expiry, CSRF where cookie sessions are used, and object-level authorization.
- Ensure logs redact query strings, tokens, phone numbers and unnecessary customer/financial data.

### 5. AI and customer support

- Use the existing AI Gateway for provider routing, spend/latency/error visibility and controlled fallback, if current configuration supports those policies.
- Use Workers AI for eligible inference workloads only after quality, latency, privacy and cost evaluation.
- Use Vectorize/AI Search only when retrieval is needed; define source-of-truth documents, tenant filters, freshness, deletion and access controls.
- Use Durable Objects/Agents SDK only if durable conversation state, tool execution or human-in-the-loop coordination is needed.
- Browser automation is a privileged capability. Restrict destinations, credentials, network egress and user-triggered actions; don't grant broad access by default.
- AI output must not authorize refunds, stock overrides, account changes or mobile-money transactions without deterministic server-side permissions and confirmation.

### 6. Reliability and operations

- Enable appropriate Workers observability with query-string redaction; tune sampling based on volume/cost rather than disabling essential error logs.
- Use Analytics Engine for operational measures, dashboards and alerts; monitor queue age, DLQ count, workflow failures, API 4xx/5xx, latency, auth failures and provider reconciliation exceptions.
- Add health endpoints that reveal no secrets or customer data.
- Define retention and privacy rules for logs and analytics.
- Maintain a resource register containing owner, environment, purpose, bindings, data class, backup/restore method, alert, cost owner and decommission conditions.
- Use Terraform/Pulumi or a reviewed configuration inventory once current resources have been imported/represented safely. Do not apply a bulk plan before drift review and state backup.

### 7. Backups and recovery

- Identify the authoritative database and required RPO/RTO per data domain.
- Back up relational data, schema and migration history; encrypt, restrict access and retain multiple recovery points.
- R2 may store encrypted exports/manifests, but a copy in the same account is not a complete disaster-recovery strategy.
- Restore into an isolated target and verify row counts, constraints, application behavior, migration compatibility and access controls.
- Supabase is a recovery layer only after a real restore drill. Appwrite remains contingency only after compatibility, restore and failover are tested.
- Test recovery for Workers source/config, KV reconstruction, R2 object integrity, queue replay and workflow state assumptions.
- Never automatically fail over writable ledgers to a second database without a single-writer/fencing strategy.

## Feature selection matrix

| Cloudflare feature | Decision | Reason |
|---|---|---|
| Workers + service bindings | Use / audit existing | API and service runtime |
| D1 | Limited / compatibility-tested | SQLite workloads; not a blind replacement for Prisma/Postgres |
| Hyperdrive | Not for OmniPoint by default | Supabase is not OmniPoint's database; only evaluate for a separately approved PostgreSQL workload with an explicit owner |
| KV | Use selectively | Fast config/cache; eventual consistency caveat |
| R2 | Use | Media, releases, private exports and permitted backups |
| Queues + DLQs | Use where asynchronous work exists | Durable delivery and retry isolation |
| Workflows | Evaluate for multi-step jobs | Durable retryable orchestration |
| Durable Objects | Workload-driven | Strong coordination/realtime, not blanket adoption |
| AI Gateway | Audit existing | Provider control, visibility and cost policies |
| Workers AI | Evaluate | Cost/quality tested inference |
| AI Search / Vectorize | Need-driven | Retrieval for knowledge support |
| Browser Rendering | Restricted, need-driven | Browser automation only for explicit product workflows |
| Analytics Engine / observability | Use with privacy limits | Health, performance, operational metrics |
| WAF / DDoS / rate limiting | Audit and configure safely | Reduce attack surface and abuse |
| Access | Add for internal/admin surfaces after testing | Identity-aware staff access |
| Turnstile | Use where abuse warrants | Public form/bot protection |
| API Shield / mTLS | Evaluate for exposed or partner APIs | API schema and client identity controls |
| Images / Stream | Need-driven | Only if product needs managed image/video delivery |
| Email Routing / Email Workers | Evaluate separately | Domain email routing or transactional processing; don't change mail records without review |
| Tunnels / Spectrum / private networking | Not by default | Only if private origin/TCP/UDP connectivity requires them |
| Workers for Platforms | Not now | Only if customers will deploy their own code |
| Containers / Browser Run / RealtimeKit | Not now by default | Add only for a defined workload |
| Pipelines / K2 / R2 SQL / Data Catalog | Future/volume-driven | Event streaming and analytics data lake when volumes justify operational complexity |
| Flagship feature flags | Evaluate later | Controlled rollouts after basic CI/deployment gates exist |
| Terraform/Pulumi | Target state | Managed infrastructure-as-code after inventory and drift plan |

## Implementation phases

### Phase 0 — read-only baseline
1. Export a sanitized inventory of Workers, routes/custom domains, bindings, versions, secrets *names*, D1 schemas, KV namespaces, R2 buckets, queues/consumers, Workflows, AI Gateway, Access, DNS and Pages.
2. Inspect source repositories and Wrangler configs; map each binding to a named owner and environment.
3. Reconcile D1 inventory metadata against actual schema queries and data sizes.
4. Confirm which services are used by Otya Media/PeterSmart Link versus OmniPoint/Otya OS.

### Phase 1 — contracts and environment boundaries
1. Document API schemas, service bindings and versioning.
2. Define dev/preview/staging/production resources and secret ownership.
3. Separate OmniPoint data from media/store workloads only through tested, additive migrations.
4. Add CI checks, deployment previews, security scanning and release/rollback checklist.

### Phase 2 — protect and observe
1. Review WAF/rate limits, Access policies, CORS, webhook signatures and staff/admin APIs.
2. Add dashboards/alerts for Worker errors, queues/DLQs, workflow failures and database health.
3. Add privacy-safe audit/correlation IDs and retention controls.
4. Test queue retries, idempotency, DLQ replay and provider sandbox failures.

### Phase 3 — resilience and selective advanced features
1. Complete backup/restore drills and set RPO/RTO.
2. Evaluate Hyperdrive for the chosen PostgreSQL access pattern.
3. Add Workflows for appropriate long-running jobs.
4. Evaluate AI Gateway policies, Workers AI and retrieval against measurable quality/cost targets.
5. Consider Terraform/Pulumi after state/drift review.

### Phase 4 — controlled production release
Only after reviewed PRs, green CI, preview smoke tests, security review, tested migrations/restore, monitoring and rollback are complete. No production DNS/route changes or live money movement as part of the inventory phase.

## Immediate findings to resolve

1. D1 metadata reports `num_tables: 0` for non-empty files; verify actual schema and explain the mismatch.
2. `otya-store-db` is referenced by both Core and Next; its live schema contains media, bot, release, device and notification tables. Determine table ownership and whether both services truly need direct access.
3. `omnipoint-migration-test` contains OmniPoint-shaped D1 tables even though the D1 list endpoint reports zero tables. Keep it test-only until schema/migration provenance and environment bindings are reconciled; do not treat it as production merely because tables exist.
4. `otya-release-events` has an R2 producer but no configured queue consumer in the current queue inventory; confirm whether a consumer is intentionally external or missing before attaching one.
5. Worker settings show a mix of ordinary text and secret bindings. Review whether anything sensitive is incorrectly stored as plain text; do not rotate/change values until impact is understood.
6. Access apps inventory returned empty; identify which admin endpoints need identity-aware protection and test a policy before enforcing it.
7. Pages inventory succeeded with valid pagination and returned an empty list for this account. Recheck the dashboard/connected account if the user expects Pages projects elsewhere.
8. Verify custom Worker routes and zone DNS records separately; the active zone alone does not reveal all routing behavior.

## Completion criteria

The Cloudflare foundation is organized only when each live resource has a known owner/purpose/environment, least-privilege bindings, documented source and deployment, alerts, privacy-safe logging, backup/restore expectations, tested rollback and a named decision to use or not use each relevant product. “Available in the dashboard” is not itself a reason to enable a feature.
