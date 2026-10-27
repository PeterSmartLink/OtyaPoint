# OmniPoint

**Legal operator:** Otya Hold Ltd T/A OmniPoint. OmniPoint is the operating name for the owner's shop in Mbirizi, Lwengo District, Uganda—not a separate legal company and not a multi-tenant SaaS product. It is not being built as a multi-tenant SaaS product.

## What OmniPoint must do

- Retail sales, receipts, purchasing, stock movements, margins and low-stock alerts for phones, accessories and electronics.
- Agent desk for recording mobile-money cash-in/out, airtime, data, bill payments and approved bank-agency services.
- Separate cash drawer and per-provider float tracking.
- Expenses, commissions, reversals, transaction history and end-of-day reconciliation.
- Owner/staff access controls, audit history, backups and reports in UGX.

Retail sales and agency services must have separate accounting sub-ledgers. No operation may be marked provider-confirmed success based only on a button click or a local form submission.

## Approved platform boundary

- **GitHub:** source code, reviewed changes and automated checks.
- **Cloudflare:** application runtime (Workers), primary operational database (D1), private object storage (R2) and background processing (Queues/Workflows/Cron) where justified.
- **Postman:** API contract and endpoint testing only; it is not a production runtime dependency.

Supabase, Appwrite and Vercel are **not part of the target architecture**. The repository still contains legacy Next.js/Prisma/Supabase-auth code that must be migrated behind the Cloudflare runtime before its dependencies can safely be removed. Do not deploy that legacy app as the final system or add new dependencies on those services. Do not delete external projects or data as a side effect of code cleanup.

## Current status and safety

This project is under development and is **not ready for live business or financial use**. The Cloudflare Worker scaffold has a health endpoint, product read/create scaffolding and routes that intentionally reject sale posting, provider transactions and reconciliation until their financial invariants and authorization tests are complete. The D1 migration directory is for an isolated test database, not production. No payment provider is connected.

Never store PINs, OTPs, payment credentials or secrets in source control or Postman collections. Use synthetic test data. A provider timeout is an unknown result, not a confirmed failure. Keep duplicate protection, reversal history and reconciliation in place before enabling money movement.

## Development

Requirements: Node.js 20+ and Python 3.

```bash
npm install
python3 migration/d1/validate_migrations.py
python3 migration/d1/test_schema.py
npx wrangler dev
```

Wrangler configuration is intentionally scoped to the isolated `omnipoint-migration-test` D1 database. Do not repoint it to production or apply migrations to a live database without explicit approval and a reviewed recovery plan.

## Delivery order

1. Cloudflare-only runtime and secure owner/staff identity.
2. Inventory and stock receiving/adjustment.
3. Safe retail checkout with atomic stock, receipt and balanced ledger posting.
4. Cashbook, provider float accounts and agent transaction recording.
5. Day-close reconciliation, audit, backups and operational reports.
6. Optional live provider adapter only after Uganda partner approval, sandbox tests, callback verification and explicit go-live approval.
