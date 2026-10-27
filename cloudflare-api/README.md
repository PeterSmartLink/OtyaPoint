# OmniPoint Cloudflare API spike

An isolated Cloudflare Worker + D1 API scaffold for OmniPoint. It is **not production-ready** and is not yet wired into the owner/staff dashboard. The approved target is GitHub + Cloudflare only; Supabase, Vercel and Appwrite are excluded from the target architecture.

## Safety boundaries

- Wrangler binds only to `omnipoint-migration-test`, an isolated D1 database.
- `GET /health` is a read-only database health check.
- Business routes verify short-lived Otya Auth bearer tokens through the private Cloudflare service binding `AUTH` (`GET https://auth/auth/verify`). There is no shared HMAC secret in the OmniPoint Worker contract.
- The verified Otya Auth subject must have an explicitly provisioned `AuthIdentity` row with provider `otya-auth`; the API then checks the current D1 staff profile and role on every request. No identity link is created by email matching.
- The Worker binding and `0005_otya_auth_identity.sql` migration are code changes only. Apply the migration only to the isolated migration-test D1 until it is reviewed and tested. Do not connect live staff or deploy business routes until identity provisioning, token lifecycle, authorization and failure-mode tests pass.
- Product reads and manager-only product creation are scaffolded. Sales posting, agency transactions, and reconciliation deliberately return `501` without recording anything until atomic financial behavior, provider adapters, and approval controls are implemented.
- Savings-group routes cover group/member records, contribution receipt records, loan requests and approvals, and repayment receipt records. Contribution and repayment records stay `PENDING` until balanced ledger posting is implemented; loan disbursement returns `501`. These endpoints are a foundation, not a completed savings/credit accounting system.
- The ordered D1 migrations live under `migration/d1`: core schema, explicit authentication identity links, then savings groups. Keep the test database isolated.
- No real data was copied; these changes do not deploy a Worker, alter DNS/secrets, migrate production data, or activate payment providers.

## Current route behavior

| Method and path | Behavior |
|---|---|
| `GET /health` | Read-only D1 health check |
| `GET/POST /api/products` | Read active products; manager-only atomic product + audit creation |
| `GET/POST /api/savings-groups` | List/create groups |
| `GET/POST /api/savings-groups/:id/members` | List/add members to active groups |
| `GET/POST /api/savings-groups/:id/contributions` | List/record pending contribution receipts; not ledger-posted |
| `GET/POST /api/savings-groups/:id/loans` | List/request loans |
| `POST /api/savings-groups/:id/loans/:loanId/approve` | Approve a pending loan request with an audit event; requester cannot approve their own loan |
| `POST /api/savings-groups/:id/loans/:loanId/reject` | Reject a pending loan request with an audit event; requester cannot act as their own approver |
| `POST /api/savings-groups/:id/loans/:loanId/disburse` | Deliberately returns `501`; no cash moves |
| `GET/POST /api/savings-groups/:id/loans/:loanId/repayments` | List/record pending repayment receipts; not ledger-posted |
| `POST /api/sales` | Deliberately returns `501`; no sale is recorded |
| `POST /api/agency-transactions` | Deliberately returns `501`; no provider call is made |
| `GET /api/ledger` | Restricted read-only ledger view |
| `POST /api/reconciliation` | Deliberately returns `501`; no reconciliation is created |

## Routes and acceptance gates

See [the route contract](../docs/cloudflare-api-route-contract.md) for the current API surface and required tests. Do not connect the dashboard or production traffic until authentication, authorization, audit completeness, ledger invariants, concurrency behavior, backups and rollback have passed verification.

## Local checks

From the repository root, install Wrangler in a development environment and run:

```sh
npx wrangler dev --config wrangler.toml
```

Check `GET /health`. Configure the `AUTH` Service Binding in the isolated test Worker and confirm it targets the intended `otya-auth` Worker. Never place access tokens in source code or logs.
