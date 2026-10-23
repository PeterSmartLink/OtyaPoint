# OmniPoint

OmniPoint is the retail, inventory and agency-operations product of **Otya Hold Ltd, trading as OmniPoint**. It is being built for Uganda with a focus on clear workflows, trustworthy records and a friendly, accessible counter experience.

## Current status

This repository contains a frontend prototype and evolving foundations. Some screens use illustrative/sample data. Do not assume that payment execution, inventory persistence, agency ledger/reconciliation, EFRIS, telecom-provider integrations or Telegram workflows are production-ready merely because a UI or API scaffold exists. Authentication and database paths require environment configuration and end-to-end verification.

See [Foundation standards](docs/FOUNDATION.md) for security, data integrity, deployment, recovery and delivery gates, and [Brand and product language](docs/BRAND-AND-PRODUCT-LANGUAGE.md) for the approved company/product hierarchy.

## Run locally

Requirements: Node.js 20.9+ and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Build verification

```bash
npm run db:validate
npm run lint
npm run build
```

Run the checks supported by the repository before submitting a change. A successful build alone does not prove database connectivity, correct authorization, provider confirmation or production readiness.

## Environment configuration

Use local environment files only on your machine and encrypted provider environment variables for deployments. Never commit secrets. Browser-safe Supabase URL/publishable keys are not database credentials; service-role keys, database URLs, signing keys and provider secrets must remain server-side. Configure only the variables required by the code path being deployed.

## Staff access

Public self-registration and public bootstrap-admin endpoints must not be introduced. Staff invitations and activation require verified management authorization, server-side permission checks and audit events. The first administrator must be provisioned through a controlled, documented process. Collect and retain personal identity data only when necessary and approved.

## Product boundaries

- **Retail:** catalog, stock movements, sales, cost of goods sold and tax-invoice metadata.
- **Agency operations:** cash-in/out, float movements, commissions and provider reconciliation.
- **Separation:** retail and agency financial records must not be silently merged.
- **Auditability:** privileged actions require server-side authorization and an audit trail.
- **Provider truth:** a request is not successful until the authoritative provider confirms it.
- **Legal identity:** use “Otya Hold Ltd trading as OmniPoint” where the formal legal entity is required; do not imply OmniPoint is a separate legal company without verified registration evidence.

## Architecture guardrails

- PostgreSQL and Cloudflare D1 (SQLite) are different database engines. Test compatibility explicitly; do not blindly port Prisma/PostgreSQL schema or migrations to D1.
- Keep test databases isolated from production data.
- Treat Supabase as a recovery capability only after backup/restore has been tested. Treat Appwrite as contingency only after compatibility and failover have been proven.
- No production DNS/routing changes or live financial operations without an approved plan, end-to-end tests, monitoring and rollback.

## Delivery sequence

1. Foundation, naming, environment and security boundaries.
2. Authentication, authorization, roles and audit events.
3. Retail catalog, inventory and point of sale.
4. Agency ledger, idempotency and reconciliation.
5. Reports, exports and management dashboards.
6. Approved provider integrations, compliance review and deployment hardening.
