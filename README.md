# OmniPoint

OmniPoint is a new, standalone retail and fintech agency operations platform for Uganda, operated by OmniPoint UG Limited under Otya Hold.

## Current status

The repository currently contains a **frontend prototype** with a responsive dashboard, sample inventory, navigation between planned workflows, a demo retail cart selector, a local-only fintech draft form, and a light/dark theme toggle. It is not a production-ready financial system. Sample records are illustrative, and no payment, inventory, ledger, export, EFRIS, or Telegram backend is connected. A Supabase Auth sign-in foundation has been added but still requires environment configuration, staff provisioning, and verification before it can be used.

## Run locally

Requirements: Node.js 20.9+ and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Build verification:

```bash
npm run db:validate
npm run lint
npm run build
```

The CI workflow checks migration filenames for the required 14-digit timestamp and rejects duplicate migration versions. All four migration filenames match the versions recorded in the connected Supabase project, including the foreign-key index migration applied on 2026-10-17 UTC. Do not rename or edit an applied migration; add a new, later migration for schema changes. Do not rename or edit an applied migration; add a new, later migration for schema changes.

## Environment configuration

Set `DATABASE_URL` in `.env.local` for local Prisma access and as an encrypted environment variable in Vercel for each required deployment target (Production, Preview, and Development). Use the database connection string from Supabase project settings; never commit it or paste it into chat. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are the browser-safe Auth configuration, not database credentials. A successful build does not prove the database is reachable or staff access is configured.

## Product boundaries

- **Retail ledger:** product sales, inventory, cost of goods sold, and EFRIS invoice metadata.
- **Fintech agency ledger:** cash-in/out records, float movements, and earned commissions.
- **Strict separation:** retail sales and agency transactions must never be silently merged.
- **Auditability:** privileged actions require authorization and leave an audit trail.
- **Provider truth:** a locally recorded transaction is not represented as successful until the relevant provider confirms it.

## Initial architecture

- Responsive web application for touch-friendly counter use.
- TypeScript frontend and API boundary.
- PostgreSQL relational data model (not yet implemented).
- Role-based access control for attendants, managers, directors, and the root administrator (not yet implemented).
- Provider adapters for future MTN, Airtel, EFRIS, and Telegram integrations.

## Security and project isolation

This repository is the independent home for OmniPoint. Do not import Otya application code, databases, credentials, or production configuration. Never commit real credentials. Financial transaction execution, EFRIS compliance, and telecom integrations require approved access, provider-specific implementation, and verification before production use.

## Planned delivery sequence

1. Foundation, environment configuration, and security boundaries.
2. Authentication, users, roles, and audit events.
3. Retail catalog, inventory, and POS.
4. Fintech agency ledger and reconciliation.
5. Reports, exports, and management dashboards.
6. Provider integrations, automated tests, and deployment hardening.
