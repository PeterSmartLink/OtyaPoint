# Local development setup

## Prerequisites
- Node.js 20.9 or later
- npm
- A PostgreSQL database for database-backed work

## Install
```bash
npm install
cp .env.example .env.local
```

Set `DATABASE_URL` in `.env.local` to a development-only PostgreSQL database. Do not paste production credentials into issues, commits, or chat.

## Validate the schema
```bash
npm run db:validate
npm run db:generate
```

## Create the first migration
After reviewing the schema and connecting to a disposable local development database:
```bash
npm run db:migrate:dev -- --name init
```

Commit the generated `prisma/migrations` directory after reviewing the SQL. Production deployments should use `npm run db:migrate:deploy` only after backups, review, and approval.

## Current limitation
The Prisma schema and shared server-side client are foundational code only. Authentication, API authorization, service-layer transactions, migrations, and provider integrations are not complete. Do not deploy this project as a live POS or financial ledger yet.
