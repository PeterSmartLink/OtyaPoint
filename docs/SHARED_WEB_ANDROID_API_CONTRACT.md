# OmniPoint Shared API Contract — Web + Android

**Status:** Proposed contract baseline on an isolated branch. Not a production API guarantee until implemented and tested.
**Clients:** Next.js web/mobile web and approved Android client.
**Authority:** Dedicated OmniPoint Worker API. Client apps are untrusted.

## Contract rules

- Base path: `/api/v1` is the target versioned namespace. Existing unversioned routes must remain unchanged until a compatibility plan is tested and approved.
- Transport: HTTPS only; JSON requests/responses unless an endpoint explicitly documents otherwise.
- Authentication: Otya access token in `Authorization: Bearer <token>`; API verifies identity through Otya Auth and then checks active OmniPoint staff membership, company/branch scope, status and role.
- Never trust client-provided actor IDs, roles, company IDs, branch IDs, ledger types, provider status or approval decisions.
- All mutation responses include a stable request ID; errors have a machine-readable code and safe user-facing message.
- Financial and stock mutations require an idempotency key; the server must bind the key to actor/scope and request payload, reject conflicting reuse, and return the original result for an identical retry.
- Clients must distinguish `succeeded`, `pending`, `failed` and `unknown`. A timeout does not mean failure or success; fetch status before retrying a financial operation.
- Dates use ISO 8601 UTC instants. Money uses integer minor units or a documented decimal string, never binary floating-point. Currency is explicit (UGX by default where configured).
- Pagination is bounded and deterministic; never return all records without a limit.
- Do not put secrets, access tokens, full payment credentials or unnecessary personal data in URLs, logs, crash reports or analytics.

## Standard error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Check the submitted information.",
    "request_id": "opaque-request-id",
    "details": []
  }
}
```

Error codes should be stable and include at least: `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `IDEMPOTENCY_CONFLICT`, `INSUFFICIENT_STOCK`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, `TRANSACTION_PENDING`, `TRANSACTION_UNKNOWN`, and `INTERNAL_ERROR`.

## Initial resource contract

| Resource | Method | Intended behavior | Required guard |
|---|---|---|---|
| Current staff | GET | Return minimum profile and allowed capabilities | Valid identity + active local staff membership |
| Products | GET | Search/list with bounded pagination | Staff scope; company/branch filtering |
| Product | POST/PATCH | Create or update product | Manager-level permission, validated prices/SKU, audit |
| Stock adjustment | POST | Record movement and resulting quantity | Permission, reason, idempotency, atomic stock invariant |
| Retail sale | POST | Post sale, lines, stock movements, balanced retail ledger and audit atomically | Idempotency; active products; sufficient stock; scoped actor |
| Receipt | GET | Retrieve receipt projection | Same company/branch authorization |
| Summary/reports | GET | Aggregated business metrics | Role and scope; documented time/currency definitions |
| Retail ledger | GET | Read-only ledger/report view | Manager-level permission and scope |
| Agency transaction request | POST | Future provider workflow; disabled until release gates pass | Idempotency, verified provider status, reconciliation |
| Agency transaction status | GET | Retrieve server/provider-confirmed status | Staff scope; never infer success from client state |

This table is a target contract, not evidence that all routes exist today.

## Client behavior requirements

### Next.js web and mobile web
- Use a single typed API client module; do not access D1 or database credentials from browser code.
- Show clear loading, empty, validation, permission and service-unavailable states.
- Never put secrets in NEXT_PUBLIC variables or client bundles.
- Do not cache authenticated business responses in a shared CDN cache or service-worker cache.
- For a retryable write, preserve the idempotency key across retries of the exact same payload.

### Android
- Use the same endpoint definitions, validation rules, error codes and idempotency behavior.
- Store session credentials only in platform-appropriate secure storage.
- On session expiry, stop protected writes and require reauthentication.
- Offline support may cache safe reference data and draft inputs. Do not locally mark financial operations successful or silently replay money movement.
- On timeout or network loss, show an explicit pending/unknown state and query the server before offering another attempt.

## Required contract tests before client integration

1. Missing, invalid, expired and revoked tokens.
2. Valid Otya identity without active OmniPoint membership.
3. Cross-company and cross-branch access attempts.
4. Insufficient role, malformed payload and oversized request.
5. Duplicate identical idempotency key returns the original result.
6. Same key with a different payload returns a conflict.
7. Concurrent stock/sale operations cannot produce negative stock or unbalanced ledger entries.
8. Request timeout followed by status lookup does not create duplicate work.
9. Error response contains no stack trace, credentials, or raw provider payload.
10. Web and Android execute the same scenario against an isolated test environment and receive consistent business outcomes.

## Migration and compatibility

Implement in small steps: freeze existing behavior in tests; add contract types and adapters; expose versioned routes without deleting old routes; integrate web in preview; integrate Android in preview; compare outcomes; document rollback; then request explicit approval before production cutover.

No production deployment, D1 migration, secret change, live provider activation, legacy service deletion or PR merge is authorized by this document.
