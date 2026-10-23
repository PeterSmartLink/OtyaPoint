# OmniPoint Cloudflare API spike

This is an isolated Worker + D1 API scaffold for the migration spike. It is **not production-ready** and is not wired into the Next.js application yet.

## Safety boundaries

- Wrangler binds only to the isolated `omnipoint-migration-test` D1 database.
- `GET /health` verifies that the Worker can query D1.
- All other routes return 404; there are no public business-data endpoints or writes.
- Do not point this binding at production, import real data, or route customer traffic until authentication, role authorization, audit logging, transaction invariants, and concurrency behavior have been tested.

## Local checks

Install Wrangler in a development environment, then run:

```sh
npx wrangler dev
```

Check `GET /health`. For remote testing, use an explicitly approved test deployment only. This repo change does not deploy a Worker or alter DNS/Vercel/Supabase.
