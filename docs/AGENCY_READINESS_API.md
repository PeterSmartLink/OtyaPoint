# Agency readiness API

**Route:** `GET /api/agency-readiness`  
**Access:** authenticated active staff with a management role  
**Effects:** read-only; never submits a provider request or writes a transaction

The endpoint reports the actual local agency-record counts for the caller's company and lists the provider adapter readiness states currently declared by the Worker.

## Response contract

- `service`: `otyapoint-agency`
- `currency`: `UGX`
- `mode`: `LOCAL_RECORDS_ONLY`
- `transactionCreation`: explicit disabled reason until adapters and controls are verified
- `providers`: Interswitch/Quickteller, Airtel Money, MTN Mobile Money, each marked `NOT_READY` / `NOT_IMPLEMENTED`
- `records`: total, pending, unknown/reconciliation counts, and locally recorded counts by provider
- `liveMoneyEnabled`: always `false` in this implementation

A zero record count means this database contains no matching local rows; it does **not** establish that no historical records exist in other systems. Provider statuses are implementation declarations, not evidence of partner approval or a live connection.

## Activation requirements

Do not enable transaction creation or change provider statuses until the relevant adapter is implemented, provider credentials are securely configured, callback authenticity/replay protection and status lookup are verified, ledger/reconciliation controls pass review, and the owner explicitly approves live activation.
