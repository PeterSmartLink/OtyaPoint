# OmniPoint open-source building blocks

Status: shortlist for review, not a list of dependencies already installed.
Date: 2026-10-23

## Selection rules

- Prefer actively maintained projects with a clear OSI-style licence, security policy, tests, and documented release process.
- Inspect exact repository licence and dependency licences at the selected commit before copying code or shipping binaries.
- Use small libraries and reference implementations where possible; avoid importing an entire POS/ERP backend when OmniPoint needs its own Uganda-specific workflows and Cloudflare architecture.
- Record attribution and preserve required notices. Copyleft licences may impose source-distribution obligations on modified/combined products; obtain legal review before adopting them into a proprietary or hosted product.
- Free/open source does not mean free hosting, SMS, payment access, support, or unlimited usage.

## Shortlist

| Area | Candidate | How to use it | Licence / caution |
|---|---|---|---|
| Worker HTTP routing | Hono — https://github.com/honojs/hono | Evaluate as a lightweight TypeScript router for Workers if current hand-written routing becomes hard to maintain. | MIT; verify current repository licence and compatibility before adding. |
| Validation | Zod — https://github.com/colinhacks/zod | Shared schemas for request/response validation; keep Worker as the authoritative validator. | MIT; pin a reviewed version. |
| SQL query builder | Drizzle ORM — https://github.com/drizzle-team/drizzle-orm | Evaluate D1-compatible typed SQL/migrations; do not assume the existing Prisma schema can be translated automatically. | MIT; test migration and transaction behavior on D1. |
| API contracts | OpenAPI — https://github.com/OAI/OpenAPI-Specification | Keep a versioned API contract for web and Flutter clients; generate clients only after contract tests exist. | Specification repository licence and generated-code licences should be checked separately. |
| API contract tests | Schemathesis — https://github.com/schemathesis/schemathesis | Consider later for automated API edge-case/property tests if its runtime fits the project. | Verify licence and CI footprint before adoption. |
| Observability | OpenTelemetry — https://github.com/open-telemetry | Adopt trace/request correlation and standard telemetry where runtime support fits; do not emit sensitive fields. | Component-specific licences and Cloudflare compatibility must be checked. |
| Error monitoring | GlitchTip — https://github.com/glitchtip/glitchtip | Evaluate self-hosted error monitoring only if the team can operate it; otherwise start with provider logs and alerting. | Check exact release licence, hosting burden, retention, and privacy before selection. |
| Retail workflow reference | Posnic POS — https://github.com/Posnic/POS | Study checkout, stock, returns, cash close, offline and hardware test cases; do not wholesale-copy it into OmniPoint. | Repository reports AGPL-3.0-only for its own source and separately licensed bundled components; legal review is needed before reuse/distribution. |
| ERP/accounting reference | ERPNext — https://github.com/frappe/erpnext | Study purchasing, stock, accounting, roles and reconciliation concepts; borrow requirements and tests before considering code reuse. | GPL-3.0; copyleft and runtime assumptions require legal/architecture review. |
| General-purpose POS reference | uniCenta POS — https://github.com/unicenta/unicentaopos | Research retail checkout and hardware patterns only if needed. | Verify the current repository and component licences; do not assume all modules/dependencies share one licence. |
| Payment integration | Official provider SDKs / sandbox examples | Prefer official provider documentation, SDKs and sandbox over unofficial payment-switch repositories. Create a provider-neutral OmniPoint adapter and fake provider for tests. | Payment access, certification, fees and regulated activity are not supplied by open-source code. |

## Recommended default stack

- TypeScript for the Worker API and shared contracts.
- Hono only if it materially simplifies routing; retain a small dependency footprint.
- Zod or equivalent for boundary validation.
- Native D1 prepared statements / tested SQL first; evaluate Drizzle when migration and transaction behavior are proven.
- OpenAPI contract and API-level tests for web and Flutter.
- Python standard library for local schema checks; Node test runner for Worker/API tests.
- GitHub Actions for CI, pinned action versions, dependency review, lockfiles and secret scanning.
- Cloudflare Workers, D1, Queues, Workflows, R2, KV and Durable Objects as separate services with clear ownership—not all enabled by default.

## Due diligence before adding a package

1. Confirm repository URL, maintainer activity, security policy and release cadence.
2. Inspect root and nested licences, notices, transitive dependencies and whether the licence fits OmniPoint's distribution model.
3. Check known vulnerabilities and lock to a reviewed version.
4. Add only the smallest required module.
5. Add tests and update the software bill of materials / third-party notices.
6. Document why it is needed and how to remove or replace it.

## Research sources

- Cloudflare Workers and storage options: https://developers.cloudflare.com/workers/platform/storage-options/
- Cloudflare Workers pricing/limits: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Workers examples (Apache-2.0): https://github.com/cloudflare/python-workers-examples
- Posnic POS repository and licence notes: https://github.com/Posnic/POS
- ERPNext repository: https://github.com/frappe/erpnext
