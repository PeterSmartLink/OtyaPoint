# Business-key uniqueness and tenant-scope review

**Status:** review inventory, not an approved migration specification. Documentation only; no database changes.

## Why this matters

OmniPoint adds `company_id` to business tables, but several original global unique constraints remain. API lookups that include `company_id` can disagree with global database constraints. Before multi-company or real transaction use, uniqueness scope must be explicit and tested.

## Current constraints and proposed scope to review

| Table / field | Current constraint | Proposed scope to review | Notes |
|---|---|---|---|
| `omni_products.sku` | Global unique | Company + SKU | Businesses may independently use the same internal/supplier SKU. |
| `omni_retail_sales.receipt_number` | Global unique | Company + receipt; branch scope only after sales have explicit branch ownership | Generated receipts include date/random suffix, but DB contract must match ownership rules. |
| `omni_retail_sales.idempotency_key` | Global unique | Company + key | API lookup is company-scoped. PR #54 fingerprints request payloads but does not remove the original global constraint. |
| `omni_agency_transactions.reference` | Global unique | Company + reference, after confirming internal reference-generation rules | Clarify whether this is internal or provider-issued. |
| `omni_agency_transactions.provider_reference` | No unique constraint | Provider + reference, with company/environment scope confirmed against provider guarantees | Must handle provider retries and sandbox/live namespaces safely. |
| `omni_agency_transactions.idempotency_key` | Global unique | Company + key | Must pair with canonical request fingerprints and safe retry/state-machine behavior before provider operations are enabled. |
| `omni_ledger_entries.idempotency_key` | Global unique | Company + key | Retail sale keys derive from request keys using `:cash` and `:revenue` suffixes; inspect other producers. |
| `omni_reconciliation_sessions` unique tuple | Ledger type + business date + prepared_by | Company + ledger type + date + prepared_by | Existing tuple omits company despite company_id being added later. |
| `omni_staff_memberships.identity_subject` | Global unique | Keep global only if one identity intentionally maps to one membership; otherwise redesign identity + company/branch model | Authorization model decision; check all auth queries before broadening memberships. |
| `omni_staff_memberships.agent_id` | Partial global unique for non-NULL values | Company + agent ID if agent codes are company-local | Confirm actual operating policy before changing. |
| `omni_audit_events` IDs | Primary key only | Keep generated event IDs globally unique; enforce company scope on access | No business-key migration currently indicated. |

These are recommendations to review, not final business policy.

## Required migration protocol

1. Confirm intended business rules for every field; do not infer branch/company rules from technical convenience.
2. Run read-only collision reports against the exact target DB before migration. Report counts and affected scopes without exposing customer data.
3. Produce a data-preserving SQLite/D1 migration plan. Rebuilding tables with global UNIQUE constraints requires special care because `omni_retail_sale_lines` references `omni_retail_sales` and triggers reference sales/products. A naive rebuild can break foreign keys, triggers, indexes, or history.
4. Prove the migration on a copy with foreign-key checks enabled. Verify rows, indexes, triggers, foreign keys, row counts, stock invariants, rollback and restore.
5. Add tests for duplicates within intended scope, independent reuse across companies, concurrency, legacy rows and cross-company isolation.
6. Only after review and explicit approval may a remote migration be considered. Exact-target and backup approval guards remain in force.

## Related tracking

- OmniPoint #53 — retail-sale request fingerprint.
- OmniPoint #55 — company-scoped retail-sale idempotency.
- OmniPoint #56 — audit global business-key uniqueness.
- Otya-Server #236 — ecosystem-wide upgrade coordination.

## Safety boundary

Documentation only. No runtime code, D1 data, constraints, Cloudflare resources, DNS, secrets or payment activation changed.