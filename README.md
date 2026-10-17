# OmniPoint

OmniPoint is a new, standalone retail and fintech agency operations platform for Uganda, operated by OmniPoint UG Limited under Otya Hold.

## Product boundaries

- **Retail ledger:** product sales, inventory, cost of goods sold, and EFRIS invoice metadata.
- **Fintech agency ledger:** cash-in/out records, float movements, and earned commissions.
- **Strict separation:** retail sales and agency transactions are never silently merged.
- **Auditability:** privileged actions require authorization and leave an audit trail.
- **Provider truth:** a locally recorded transaction is not represented as successful until the relevant provider confirms it.

## Initial architecture

- Responsive web application for touch-friendly counter use.
- TypeScript frontend and API boundary.
- PostgreSQL relational data model.
- Role-based access control for attendants, managers, directors, and the root administrator.
- Provider adapters for future MTN, Airtel, EFRIS, and Telegram integrations.

## Development status

This repository is the independent home for OmniPoint. Do not import Otya application code, databases, credentials, or production configuration.

Integrations, tax compliance, and live financial transaction execution require approved credentials, provider access, and verification before production use.

## Planned delivery sequence

1. Foundation, environment configuration, and security boundaries.
2. Authentication, users, roles, and audit events.
3. Retail catalog, inventory, and POS.
4. Fintech agency ledger and reconciliation.
5. Reports, exports, and management dashboards.
6. Provider integrations and deployment hardening.
