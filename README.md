# OmniPoint

OmniPoint is a standalone retail and fintech-agency operations platform for Uganda, operated by OmniPoint UG Limited under Otya Hold.

## Product goal

Give a small business one simple, reliable workspace for staff, products, stock, sales, cash and float tracking, savings groups, reconciliation, and management reports. Retail commerce and financial-agency records must remain separate.

## Current engineering status

This repository is under active development and is **not production-ready**. The web dashboard contains prototype/sample data and some draft workflows. A Cloudflare Worker API and D1 migration schema are being built alongside the existing web application. The API currently protects routes with signed bearer-token claims, has product-read/product-create and savings-group routes, and deliberately rejects sales posting, provider transactions, and reconciliation until their accounting and provider safeguards are implemented. A successful build does not prove the service is configured, deployed, or safe for live financial operations.

The savings-group foundation includes groups, members, contributions, loans, repayment allocations, audit events, role checks, and idempotency controls. These features still require end-to-end tests, authorization review, accounting-invariant checks, and operational validation before production use.

## Cloudflare-first target architecture

- **Workers:** API and server-side business logic.
- **D1:** primary operational database for application records and transactional workflows.
- **R2:** private documents and receipt/file storage when needed, with access controls.
- **Queues / Workflows:** retryable background jobs, provider callbacks, notifications, and scheduled processing where appropriate.
- **Workers observability:** structured logs, request IDs, error monitoring, and alerts.
- **Vercel:** web frontend hosting if retained; it must call the Cloudflare API rather than use Supabase as the primary application database.
- **External providers:** MTN, Airtel, EFRIS, and other partners only through approved, isolated adapters and sandbox testing.

This is the target architecture, not a claim that every service is already provisioned or connected. The current `wrangler.toml` intentionally targets an isolated migration-test D1 database. Do not point it at production data until the cutover plan and safety checks are approved.

## Local development

Requirements: Node.js 20.9+ and npm.

```bash
npm install
npm run dev
npm run db:validate
npm run lint
npm run build
```

The repository also includes a D1 schema compatibility test:

```bash
python3 migration/d1/test_schema.py
```

Keep dependency installation reproducible with the committed lockfile and use `npm ci` in CI when the lockfile is valid and current.

## Financial and security rules

- Never combine retail sales and fintech-agency transactions into one ledger.
- Treat amounts as integer minor units where the API schema specifies integers; validate all inputs on the server.
- Use idempotency keys for retryable financial writes.
- Never claim a payment succeeded until the relevant provider confirms it.
- Record auditable actor, action, entity, and request identifiers for sensitive operations.
- Require least-privilege roles, verified staff accounts, and appropriate second-person approval for high-risk adjustments.
- Make posted financial records immutable; correct them through explicit reversal/adjustment entries.
- Calculate expected balances from ledger entries; never accept a client-supplied expected balance as authoritative.
- Never expose secrets in browser bundles, repository files, logs, or chat.
- Do not create a public bootstrap-administrator endpoint.
- Do not enable live money movement until provider approval, reconciliation, idempotency, duplicate-callback handling, and recovery tests pass.

## Delivery priorities

1. Resolve CI/build issues and keep security checks green.
2. Establish Cloudflare D1 schema, migrations, isolated test fixtures, and safe environment separation.
3. Finish server-side authentication, staff lifecycle, role enforcement, and audit integrity.
4. Deliver product catalogue, stock movements, and atomic sale/receipt/stock/ledger posting.
5. Deliver agency cash/float records and reconciliation with approval controls.
6. Complete savings-group member, contribution, share, loan, disbursement, and repayment workflows with balanced ledgers.
7. Add reports, export controls, backups, restore drills, observability, and operational runbooks.
8. Integrate external providers in sandbox mode, then perform independent security and accounting reviews before production.

## Safety boundaries

Development changes must stay on a feature branch until reviewed. Do not merge pull requests, deploy production, migrate or delete existing data, change secrets, or enable live payments without explicit approval. Never reuse credentials, databases, or production configuration from other projects.
