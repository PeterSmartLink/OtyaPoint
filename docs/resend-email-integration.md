# Resend across the Otya ecosystem

Resend is the designated shared transactional email provider for Otya Hold Ltd. Otya Auth already has a server-side Resend transport; OmniPoint is being connected through that central service. Otya Media and future Otya services should reuse the same provider when they add email notifications rather than create separate email systems.

## Existing account verified directly

The connected Resend account currently lists:
- Verified sending domain: petersmartlink.com; sending is enabled.
- Existing API keys include Auth Send Email and otya-store-worker.
- Six published Otya templates for welcome, verification, password reset, security alerts, service notices, and updates.
- An enabled webhook on https://petersmartlink.com/webhooks/ for email sent/delivered/delayed/complained/bounced/failed/suppressed events.
- A separate legacy webhook targeting Appwrite is disabled and is not part of the target architecture.

A read-only check on 27 October 2026 also found the ten most recent transactional emails marked delivered, including Otya operations and backend abuse reports. This confirms existing Resend sending is active; it does not prove the new OmniPoint notification path is deployed or live. These are account observations, not proof that every Worker has the correct secret configured or that every notification path is live.

## Target architecture

- Resend account: one source for sending domain, shared templates, provider delivery status, and delivery webhooks.
- Otya Server / otya-auth: central server-side Resend transport. It owns the Resend API key and uses the existing verified domain.
- OmniPoint Worker: sends a narrowly scoped low-stock event over its Cloudflare Service Binding to Otya Server. It does not receive the Resend API key and cannot choose arbitrary recipients.
- Recipients: low-stock notices go only to the operator addresses configured in ADMIN_EMAILS on the central Otya Auth Worker.
- State: product and stock truth stays in Cloudflare D1. Notification failures must never undo a completed inventory write.
- Duplicate suppression: the central service suppresses repeated low-stock messages for the same SKU for 24 hours.
- Future events: receipts, staff/security alerts, service notices, and approved operational reports should reuse this central service and reviewed event-specific templates. Add durable Cloudflare Queue delivery/retries before treating notifications as guaranteed.

## Low-stock route

The internal service-binding route is POST /internal/notifications/omnipoint/low-stock.

It accepts only product name, SKU, quantity on hand, and reorder threshold. It rejects invalid values, only sends when quantity is at/below the positive reorder threshold, takes recipients from server configuration, and returns no provider error details. The route is intended for service-binding calls, not a public arbitrary-email API.

## Safety and rollout

- The code changes in the related pull requests are not deployed.
- No Resend API key was created, rotated, exposed, or copied into OmniPoint.
- No Cloudflare secret, DNS record, production Worker, or live customer email was changed by this code work.
- Deployment should be staged: first verify the existing RESEND_API_KEY secret on Otya Auth without reading or exposing its value; then deploy the central handler; then deploy the OmniPoint caller; finally send a test only to an explicitly approved operator address.
- The Resend webhook currently points to the existing Otya site. Keep it intact until the receiver is audited; do not point it at a new endpoint without a separate reviewed change.
