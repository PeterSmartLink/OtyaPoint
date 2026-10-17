# OmniPoint

OmniPoint is a new, standalone retail and fintech agency operations platform for Uganda, operated by OmniPoint UG Limited under Otya Hold.

## Current status

The repository currently contains a **frontend prototype** with a responsive dashboard, sample inventory, navigation between planned workflows, a demo retail cart selector, a local-only fintech draft form, and a light/dark theme toggle. It is not a production-ready financial system. Sample records are illustrative, and no payment, inventory, ledger, export, EFRIS, or Telegram backend is connected. A Supabase Auth sign-in foundation and management-controlled staff invitation flow are being implemented. The system remains non-production until staff provisioning, identity checks, provider integrations, and operational controls are verified.

## Run locally

Requirements: Node.js 20.9+ and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Build verification:

```bash
npm run build
npm run lint
```

## Secure staff onboarding

- Public self-registration is not available. Only a verified Managing Director or Chairman can invite staff from `/management/staff`.
- Invitations use Supabase Auth Admin and require `SUPABASE_SERVICE_ROLE_KEY` as a server-only Vercel environment variable. Never expose this key with a `NEXT_PUBLIC_` prefix or commit it to Git.
- New staff profiles are inactive and have `PENDING` identity status. Login is denied until management records identity verification and activates the profile.
- The unique agent ID is 6–12 uppercase letters/digits (for example, `2IQ35198`). Email and agent ID must both be unique.
- Verify national ID and required documents through the organization’s approved process. This implementation deliberately does not store raw national ID numbers or identity-document images.
- The first management administrator must be provisioned manually through the Supabase Dashboard and matching Prisma staff profile, with verified status and active access. Never add a public bootstrap-admin endpoint.
- Audit events record invitations and approval/rejection decisions. These application controls do not replace independent security review or regulatory/provider approval.

## Required environment variables

- `DATABASE_URL` — server-side PostgreSQL connection string.
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase publishable/anon key for user sessions.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only Supabase Admin key, required for invitations; set as an encrypted Vercel environment variable for the required deployment environments.

Never commit environment files or secrets. After changing the Prisma schema, run `npm run db:validate`, `npm run db:generate`, and apply the migration using the approved migration process.

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
