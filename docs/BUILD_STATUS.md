# OmniPoint build status

## Direction

- **GitHub** is the canonical code repository.
- **GitHub Actions** is the primary quality-check workflow.
- **Supabase** remains the source of truth for PostgreSQL data and staff authentication.
- **Cloudflare Workers** is the proposed hosting target, subject to compatibility testing.
- **Vercel** remains the existing fallback until a separately approved migration is verified.
- **GitLab** is temporary and should not host a second independent development workflow.

## First working slice: live inventory

This branch introduces a database-backed inventory workspace at `/inventory`.

- Reads active products from the existing Prisma/Supabase PostgreSQL database.
- Allows authorized managers and senior management to create products.
- Records opening stock as a stock movement.
- Allows authorized staff to adjust stock with a required reason.
- Prevents an adjustment from making stock negative.
- Writes the product/stock movement and audit record in a database transaction.
- Does not create retail sales, execute mobile-money transactions, post ledger entries, or call EFRIS.
- Uses existing tables and requires no database migration.

## Important verification

- This branch must pass the existing GitHub Actions checks before it is merged.
- Test with an isolated development environment and non-production data first.
- Verify authorization, duplicate SKU handling, insufficient-stock handling, and audit records.
- Cloudflare compatibility is a separate workstream. The current app uses Next.js 15 and Prisma 6, so the deployment adapter and database connectivity must be verified before changing hosting.
- Do not connect a custom domain, change DNS, modify production settings, run migrations, or merge to `main` without the owner's approval.

## Planned next slices

1. Complete inventory tests and connect dashboard navigation.
2. Retail POS with atomic stock deduction, receipt numbering, and balanced retail ledger entries.
3. Fintech agency records with idempotency, provider-status verification, commissions, and float reconciliation.
4. Management reports, audit review, and controlled exports.
5. Provider integrations only after credentials, contracts, and compliance requirements are confirmed.
6. Cloudflare preview deployment and cutover only after compatibility checks and explicit approval.
