# Digital Observer External API v1

Status: Development contract. External activation and Production use are not authorized.

## Purpose and boundaries

The API exposes canonical Camera, Event, Incident, Evidence, Investigation and Watch Rule data to an authorized organization-scoped machine identity. It does not create a parallel Event or Incident engine. It does not expose camera credentials, raw private video in JSON, unrestricted Evidence URLs, private child information, biometric conclusions or internal secrets.

The base path is `/api/digital-observer/external/v1`. The machine-readable contract is available at `GET /openapi.json`. Breaking versions require a new URL version and, after owner-approved external activation, at least 180 days of deprecation notice.

## Authentication

Create a Site-scoped Service Account through the Enterprise identity center. Its secret is displayed once and is never stored in plaintext. Send it as `Authorization: Bearer dosvc_…`.

Every request is also signed. Send:

- `X-DO-Timestamp`: current Unix timestamp in seconds.
- `X-DO-Nonce`: unique 16–120 character URL-safe value.
- `X-DO-Signature`: `v1=<hex HMAC-SHA256>`.
- `X-Request-ID`: optional caller correlation ID.
- `Idempotency-Key`: required for mutating operations.

The signing string is six newline-separated values: API version, uppercase method, path plus query, timestamp, nonce, and the SHA-256 body digest. The HMAC key is the one-time Service Account secret. Requests outside the five-minute replay window, reused nonces, inactive credentials, revoked accounts and out-of-scope Sites fail closed.

## Authorization and commercial enforcement

Each endpoint maps to the PUSH 41 permissions already assigned to the Service Account. The service revalidates organization ownership, explicit Site scope, credential expiry/revocation and PUSH 40 `api_access` entitlement on every Site request. Billing permissions do not grant Camera, Evidence or Investigation access.

The default application-side ceiling is 120 requests per Service Account per minute. Hourly measured usage is attributed to Service Account, Site and operation. Limits and costs are not fabricated when provider evidence is absent.

## Resources

- `GET /cameras`: bounded Camera Source inventory and health metadata.
- `GET /events`: canonical Events; observed fields and inferred risk remain distinct.
- `GET /incidents`: canonical Incident state, timeline and verification metadata.
- `GET /evidence/{id}`: metadata and an authorized media path; no media is embedded.
- `GET /evidence/{id}/media`: reauthorizes and redirects to a 60-second private object URL.
- `POST /investigations/search`: runs the existing grounded Investigation compiler/search over authorized retained data.
- `GET|POST /watch-rules`: reads rules, compiles proposals or changes state. External compilation never activates a rule and never executes an external action.
- `GET|POST /webhooks/subscriptions`: manages allowlisted HTTPS destinations in DISABLED or SANDBOX mode. POST bodies use the explicit `register`, `rotate_key` or `revoke` action; rotation accepts only a secret-store reference and never a raw signing secret.
- `GET /integrations/capabilities`: returns truthful DVR/NVR/VMS/vendor/federation capability state.
- `POST /integrations/deep-links`: creates a configured customer-VMS deep link without disclosing credentials.
- `POST /federation/query`: validates authorization and source scope. It returns `NOT_EXECUTED` until an approved adapter exists; it never pretends an external query succeeded.
- `GET /gan-batuach/contract`: describes the separate authorization boundary and links to the existing dedicated data endpoint.

List endpoints accept `site_id`, `limit` (maximum 100), opaque `cursor`, and where relevant `camera_id`, `from` and `to`. Responses include `api_version`, `request_id` and bounded pagination metadata.

## Webhooks

Destinations must use HTTPS, contain no embedded credentials, resolve to an explicitly configured host, and cannot target local/private/link-local networks. Payloads use `do-external-webhook-v1`, include a stable delivery ID and contain references rather than sensitive media. Delivery reuses PUSH 39 bounded retry, acknowledgement, dead-letter and unknown-outcome semantics.

Receivers verify the timestamp, stable delivery ID, key version and HMAC signature, reject payloads outside the five-minute replay window, and process delivery IDs idempotently. The independent example exports `verifyDigitalObserverWebhook` for this verification without importing private server code. An accepted endpoint registration is not delivery proof. Real sandbox receipts remain separately tracked.

## DVR, NVR, VMS and federation truthfulness

The integration registry distinguishes DISABLED, configured inactive, connected, degraded and revoked sources, plus not-proven, sandbox-proven and real-proven evidence. No row implies universal compatibility. Customer-hosted video or recording access requires an actual approved adapter and authorization path; Cloud cannot reach arbitrary LAN-only RTSP devices without such a path.

Federation returns observed facts separately from inferred movement and identity. Missing-person, biometric, Re-ID, child-safety and other sensitive workflows remain subject to PUSH 45 legal/privacy approval and later real-pilot owners.

## Gan Batuach boundary

Digital Observer and Gan Batuach Management remain separate products and authorization domains. No direct table sharing or blanket Parent, staff, manager or inspector access is created. The dedicated adapter returns only mapped, reviewed metadata and authorized media references. PUSH 45 owns child/privacy approval and PUSH 47 owns operational proof.

## Example consumer

`examples/digital-observer-external-api/client.mjs` is intentionally independent: it imports no private server module. It signs HTTP requests using only this published contract and Node platform APIs.

## Errors and support status

Errors use a stable code, message and request ID. Unknown provider or integration outcomes remain unknown. This Development contract has no Production SLA, supported provider or external delivery claim until owner-approved activation and independent proof.
