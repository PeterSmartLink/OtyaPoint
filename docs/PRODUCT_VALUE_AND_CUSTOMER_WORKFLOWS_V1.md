# OmniPoint — Product Value and Customer Workflows v1

Status: product proposal for review. Not production readiness, legal advice, or authorization to process live financial transactions.
Review date: 2026-10-23

## 1. Product promise

OmniPoint is not a chatbot that tells a shopkeeper how to run a shop. It is the daily operating tool they use to run it: record sales, know what stock remains, see what money should be in the drawer, manage staff, and close the day with evidence.

Primary users:
- Owner/manager: performance, cash, margins, staff, approvals and reports.
- Cashier: fast sales, returns only when permitted, receipt and shift handling.
- Stock controller: receiving, counts, adjustments and low-stock alerts.
- Mobile-money attendant: record and reconcile approved agency transactions without confusing agency float with retail revenue.
- Accountant/auditor: exports, traceable corrections, summaries and audit history.
- Support/implementation operator: onboarding and troubleshooting with customer-authorised access only.

## 2. First customer and first value

Start with one type of customer: a small Ugandan shop selling phones, accessories and electronics, with an owner/manager and one or more attendants. Add agency workflows only after the retail workflows and financial safeguards are proven.

The customer should be able to:
1. Create a business workspace and branches.
2. Invite staff and assign roles.
3. Import or enter products, opening stock, cost and selling price.
4. Record a real test sale in a sandbox and see stock reduce exactly once.
5. Record supplier stock received and see stock increase with an audit trail.
6. Open and close a shift, enter counted cash and compare expected versus counted cash.
7. See daily sales, gross margin estimate, best-selling items, low stock and exceptions.
8. Export their data and understand who changed what.

Do not start by promising every feature. Deliver this complete, dependable daily loop first.

## 3. Core retail workflow

### Setup
- Create tenant and business profile; set currency UGX, time zone Africa/Kampala and receipt settings.
- Add branches and storage locations.
- Invite staff with least-privilege roles.
- Import products by CSV or add them manually; validate duplicates and required fields.
- Record opening stock through a reviewed opening-stock operation, never by silently editing balances.

### Sale
1. Cashier selects or scans product.
2. System checks active product, available stock, price, discount permission and open shift.
3. Show itemised total and tender type.
4. On final confirmation, create the sale, sale lines, stock movements, payment record and audit event atomically where supported.
5. Generate a unique receipt and show the final result only after the server confirms commit.
6. Retries must not create duplicate sales; use an idempotency key and clear retry result.
7. A failed or uncertain operation must show its status and recovery path, not claim success.

### Stock and purchasing
- Supplier directory, purchase/receiving records, stock transfers and stock counts.
- Stock ledger records every movement with reason, actor, timestamp and source reference.
- Adjustments require reason and appropriate approval.
- Prevent negative stock by default; exceptions require an explicit business policy.
- Reorder levels generate actionable alerts.

### Shift and day close
- Opening float, cash sales, cash refunds, cash in/out with reason and approval policy.
- Expected drawer balance compared with actual counted balance.
- Variance is visible, not silently overwritten.
- Owner reviews exceptions and signs off; preserve history.
- Retail cash, bank/mobile-money tenders, mobile-money agent cash and agent float must be distinct ledger categories.

## 4. Mobile-money agency workflows — gated phase

Do not represent an internal note as a real mobile-money transaction. Until an approved provider integration is live, agency entries are records of attendant-reported activity only, visibly labelled as unverified/manual.

Before enabling live provider transactions, require:
- Confirmed commercial/provider authorization and API access.
- Transaction status model (initiated, pending, confirmed, failed, reversed), verified provider reference and idempotency.
- Separate cash and float ledgers, commission calculation, reversal handling and end-of-day reconciliation.
- Role limits, supervisor approval for exceptions, immutable audit trail and tested recovery.
- Fraud controls, monitoring, dispute process and security/regulatory review.
- Reconciliation against provider statements; never infer provider success from a button click.
- No production cash movement or customer money transfer until these controls are tested and formally approved.

## 5. Receipts, taxes and EFRIS

- Build a normal internal sales receipt, clearly distinct from an official URA EFRIS fiscal document.
- Do not market OmniPoint as EFRIS-compliant or issue official EFRIS documents until the integration path, applicable obligations, provider requirements and any required URA approval/accreditation are verified.
- If EFRIS integration is required, evaluate URA's current official options and published list of accredited software integrators; do not assume access to an undocumented API.
- Keep tax configuration versioned and reviewable. Do not hard-code a universal tax treatment for every customer.
- Provide exports and records that help the business and its accountant; do not claim to replace professional tax advice.

Official reference points to re-check before implementation:
- URA EFRIS: https://ura.go.ug/en/efris/
- URA accredited EFRIS software integrators: https://ura.go.ug/en/efris/list-of-accredited-efris-software-integrators/

## 6. Why customers would choose OmniPoint over generic AI

OmniPoint must deliver persistent, operational results that a chat answer alone cannot:
- Real business workspace with products, stock, users and branches.
- Fast, repeatable point-of-sale interface.
- A consistent stock and payment event history.
- Permission-controlled staff operations.
- Shift closing, cash variance and reconciliation.
- Reliable receipts, reports and exports.
- Alerts, reminders and low-stock actions.
- Integration status, audit evidence and recovery tools.
- A support workflow tied to the user's actual setup, only with consent.
- Reliable daily use on the devices and network conditions the customer has.

AI can be a helper inside OmniPoint: explain a variance, draft an import mapping, identify unusual patterns or answer “which products are nearly out?” It must not be the ledger, source of truth or permission authority.

## 7. Pricing direction

Use a free trial/demo with sample data, then price real business value:
- Free sandbox: sample products and sales, training and demo reports. No live financial provider operations.
- Starter: one shop, core POS, product catalogue, stock ledger, basic reports and limited staff.
- Business: more staff/branches, purchase orders, low-stock alerts, exports, shift close and audit reports.
- Agency add-on: only when the controlled agency workflow is ready and authorized.
- Pay-as-you-go services: onboarding, data import, receipt printer setup, migration, training and approved integrations.
- Annual plans: transparent discount, renewal and cancellation terms.

Do not charge per ordinary sale in a way that surprises small shops. Show plan limits and all extra fees before purchase. Final pricing should follow a pilot and real support/cloud cost measurement.

## 8. Trust and security requirements

- Tenant isolation is enforced server-side on every query and mutation.
- Every staff member has a unique identity; no shared cashier account.
- Server-side role and permission checks; hiding a button is not authorization.
- MFA or stronger verification for privileged roles where supported.
- Audit log for sales, refunds, price/discount overrides, stock adjustments, staff changes, exports and approvals.
- Never store raw national ID or identity-document images without a documented necessity, lawful basis, access controls and retention policy.
- Secrets remain server-side; no service-role key in browser code.
- Backups and restore drills, documented retention and export/delete process.
- Validate inputs, rate-limit endpoints and test unauthorized, cross-tenant and duplicate requests.
- Financially sensitive actions fail closed if authorization, database integrity or provider confirmation is missing.

## 9. Implementation sequence and release gates

### Gate 1 — reliable retail demo
- Confirm the actual database provider and deployment environment; reconcile D1/SQLite scaffold with Prisma/Postgres expectations before migration.
- Demo data clearly separated from real tenant data.
- Product catalogue, stock movements, sale, receipt, shift close and reports.
- Automated tests for duplicate requests, stock invariants, cross-tenant access and unauthorized staff actions.
- CI and preview deployment pass; no live financial actions.

### Gate 2 — controlled pilot
- Use a small number of consenting test businesses.
- Import real product catalogues only after backup, mapping preview and owner approval.
- Verify every transaction and receipt; provide support and rollback/recovery.
- Measure speed, errors, reconciliation accuracy and user satisfaction.

### Gate 3 — production retail
- Security review, backups/restore proof, monitoring, incident response, privacy/terms, staff onboarding and support.
- Owner approval for production rollout.
- Tax/EFRIS claims only after the relevant path is verified.

### Gate 4 — agency operations
- Provider contracts/integration, ledger and reconciliation design, threat modelling, test evidence and formal approval.
- No live mobile-money processing before all gates pass.

## 10. Pilot acceptance criteria

A pilot is not successful because a dashboard loads. A real shopkeeper should be able to complete a sale and close the shift correctly.

- [ ] User can create a business and invite a least-privilege cashier.
- [ ] Product import validates rows and reports errors without partial silent import.
- [ ] Sale commit updates stock and payment records exactly once.
- [ ] Concurrent sales cannot silently oversell stock.
- [ ] Failed requests do not leave a sale without corresponding stock/payment/audit records.
- [ ] Refunds and stock adjustments are permission-controlled and traceable.
- [ ] Cash close reports counted cash, expected cash and variance.
- [ ] Tenant A cannot read or mutate Tenant B's records.
- [ ] Customer can export products, sales and audit records.
- [ ] Backup restoration is tested and documented.
- [ ] Internal receipts are not misrepresented as EFRIS fiscal documents.
- [ ] Agency financial operations remain disabled until provider and safety gates pass.
