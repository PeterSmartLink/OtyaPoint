# Resend email integration

Resend is the approved outbound transactional email provider for the Otya ecosystem, including OmniPoint. It complements (not replaces) Cloudflare Workers, D1, R2, Queues, and GitHub Actions. Do not add Supabase, Appwrite, or Vercel for email delivery.

## Architecture

- Application/business state remains in Cloudflare D1.
- Cloudflare Worker code calls Resend's HTTPS API for transactional delivery.
- Never send email from the browser or expose the Resend API key to clients.
- Do not send mail inside a D1 transaction. Commit business state first, then enqueue or attempt notification separately; email delivery failure must not undo a completed business operation.
- For durable/high-volume delivery, use a Cloudflare Queue with retries and an idempotency key. Do not claim delivery merely because a request was accepted by the API.
- Keep email events auditable without logging API keys, access tokens, full message bodies, or unnecessary personal information.

## Configuration

Set these on the relevant Cloudflare Worker only after the sender domain and recipient policy are approved:

- Secret: `RESEND_API_KEY` — add through Cloudflare Worker secret management, never commit it.
- Variable: `RESEND_FROM_EMAIL` — a sender on a domain verified in Resend.
- Optional variable: `RESEND_REPLY_TO` — an approved monitored reply address.

No credentials are stored in this repository. Do not use a real sender or send test messages until the domain, sender, recipient, and cost/limits are confirmed. No Cloudflare resources or secrets were changed by adding this integration code.

## Supported code contract

`cloudflare-api/src/resend.ts` exports a small server-side helper. It validates basic message fields, uses a bounded timeout, sends only through `https://api.resend.com/emails`, never logs message content or secrets, and returns a typed result. Callers should use reviewed templates and recipient allowlists for operational alerts, password/reset workflows, receipts, and staff notifications. Do not expose a general-purpose arbitrary-email endpoint to unauthenticated clients.

## Readiness boundary

The helper is code-only until a verified sender and Cloudflare Worker secret/configuration are set. Email is not considered live, and no messages have been sent by this change. Production secret configuration and deployment require separate approval.
