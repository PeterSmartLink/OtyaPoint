# AWS egress relay source scaffold (not deployable)

This folder is a source-only preparation area. No infrastructure definition, AWS deployment workflow, provider forwarding code, credentials, or provider destinations are present yet.

- auth.mjs verifies the proposed Worker-to-relay HMAC envelope.
- auth.test.mjs contains synthetic unit tests runnable with Node.js 22+: `node --test infra/aws-egress-relay/src/auth.test.mjs`.
- A durable atomic nonce-store adapter is deliberately not implemented. The verifier fails closed without it.
- Provider routing and outbound HTTP are deliberately omitted until each provider's sandbox contract and allowlist requirement are confirmed.
- Do not expose this module as an HTTP endpoint or deploy it as-is. It is a reviewed building block, not a complete secure relay.

Canonical request: uppercase method, exact path+query, lowercase SHA-256 hex of raw body, timestamp text, nonce, and key ID, joined by LF with no trailing LF; signature is HMAC-SHA-256 hex. Test and production keys must be distinct. Never commit real keys.
