# OmniPoint build status

## Direction

- **Cloudflare** is the target primary runtime and data platform for the new isolated OmniPoint service.
- **GitHub** is the canonical code repository and GitHub Actions is the primary quality gate.
- **Otya Auth** remains the shared identity provider only where its verified token contract is compatible; OmniPoint must still maintain local staff memberships and roles.
- **OmniPoint D1** is a dedicated business database. It must not share operational tables with Otya Auth, Otya Core, Otya Player, or Next.
- **R2, KV and Queues** are provisioned for private files, short-lived/reconstructable cache, and asynchronous jobs. Application authorization, retention, consumers, retry and restore behavior remain to be verified.
- **Supabase/PostgreSQL** is the legacy source/recovery copy during cutover planning, not a second live writer. Do not delete or alter it in this branch.
- **Vercel** remains the existing app hosting path until the frontend is migrated and the replacement runtime is verified. Do not change production routing as part of this branch.

## Current facts

- A dedicated production D1 database exists: omnipoint-prod. This branch has not applied its schema.
- A separate migration-test D1 database exists. The namespaced OmniPoint schema and company-scope migration were applied there for validation, with migration baseline entries recorded; existing tables from the prior test schema were left untouched.
- A separate Worker configuration exists for test and production bindings. The production config has no custom domain and has not been deployed by this branch.
- The API now has protected product reads, product creation, stock adjustment, cash POS posting, summary and ledger reads in code. The Worker now verifies access tokens through the existing Otya Auth service binding and loads the local OmniPoint role from D1. The same-origin bridge now forwards only a genuine HttpOnly `otya_access_token` to the Worker and no longer creates a locally signed substitute token. The current login flow does not yet issue this cookie, and staff provisioning into OmniPoint D1 is incomplete; live inventory must fail closed until both are implemented and tested.
- Agency provider execution remains disabled and returns a non-success response without making provider calls or recording a false success.
- The dashboard is not yet wired to the new API. Existing PostgreSQL/Supabase runtime code must not be removed until the new UI/API contract and migration/cutover are proven.

## Quality gates

1. Run the existing migration checks and Prisma validation for the legacy application.
2. Run the new local SQLite schema/invariant test suite.
3. Pass lint and build checks for the whole app and Worker code.
4. Validate the D1 migration against the isolated test database.
5. Verify authentication, role mapping, idempotency, stock concurrency, atomic rollback and ledger balance.
6. Configure backup exports and perform an isolated restore drill.
7. Wire the dashboard to the API using a server-side auth bridge, not browser-held secrets.
8. Deploy preview first, inspect logs and error handling, then plan a separate production release.
9. Only activate provider integrations after partner approval, credentials, callback verification and reconciliation are implemented.

No live provider operations, DNS cutover, production schema migration, or deletion of the legacy data source is part of this branch.
