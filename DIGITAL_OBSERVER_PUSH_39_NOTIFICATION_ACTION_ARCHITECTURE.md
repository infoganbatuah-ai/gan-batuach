# DIGITAL OBSERVER — PUSH 39 NOTIFICATION, ACTION AND ESCALATION ARCHITECTURE

Date: 2026-10-18
Environment: Development only
Production providers: disabled

## Canonical boundary

PUSH 39 extends the existing Event, Incident, Risk, Verification, Decision, Watch Rule and camera-command contracts. It does not introduce a second Event or Incident engine.

```text
REAL EVENT
→ canonical INCIDENT
→ RISK
→ VERIFICATION
→ DECISION
→ AUTHORIZED ACTION INTENT
→ delivery or supported camera-command boundary
→ ACKNOWLEDGEMENT
→ bounded ESCALATION or CLOSURE
```

Raw Event ingestion may write the local in-app journal entry. It cannot activate an external provider. Mock, shadow and unconfirmed Watch Rule output cannot create an executable action intent.

## Provider modes

Push, email, SMS, WhatsApp, signed webhook and phone/call share one adapter contract. Each channel supports `disabled`, deterministic internal `sandbox`, and a reserved `production` mode. New rows default to disabled/inactive. The public Development configuration API accepts only disabled or internal sandbox. A production adapter cannot be constructed from database configuration alone and no paid or live sender is included in this PUSH.

Deterministic sandbox success proves only the adapter/state-machine contract. It is not a provider sandbox receipt and not Production delivery proof.

## Durable delivery

The delivery identity is a stable SHA-256 value over Site, action intent, recipient and channel. Database uniqueness and conditional state transitions provide duplicate-effect protection across worker retries, repeated requests and concurrent claims. Every provider attempt is append-only.

Delivery states include queued, suppressed, dispatching, sent, delivered, acknowledged, retry scheduled, unknown outcome, terminal failure, dead letter, expired and cancelled. Backoff is bounded. Unknown outcomes are terminal for automatic retries and require operator reconciliation.

Authorization is checked when a delivery is created and again immediately before dispatch. The second check covers Site, active profile/membership, role, recipient identity, preference, channel eligibility, consent/legal basis, revocation, quiet hours, emergency override and current provider configuration. Recipient and provider rate limits are bounded.

## Privacy and tenancy

Stored payloads are bounded operational summaries. The minimizer removes credential-shaped text, RTSP URLs and arbitrary links; only authorized Digital Observer product paths may be retained. Raw video, camera credentials, unrestricted Evidence URLs, child-private data and biometric conclusions are outside this contract.

All new state is Site-owned and RLS-enabled. Authenticated clients receive scoped read access only for durable action/delivery history. Mutating orchestration uses authorized server endpoints; direct authenticated writes to provider channels, webhook endpoints, deliveries, attempts, callbacks and action audit are denied.

Kindergarten-linked Sites are rejected by the recipient-delivery boundary. Gan Batuach Management remains a separate authorization domain. Kindergarten safety activation remains blocked on PUSH 45 legal/privacy approval.

## Human and physical action safety

Natural language produces a structured, non-executing proposal. Physical and emergency actions require immediate explicit human confirmation. Siren, speaker, lighting and phone escalation also require a documented lawful-use approval before authorization can advance.

PTZ, zoom, preset, speaker, siren and lighting map to normalized live capabilities. Unsupported actions and unknown presets are rejected. The existing camera queue still performs fresh capability, binding, one-time confirmation, expiry, acknowledgement and non-retryable unknown-outcome checks.

Historical Digital Guard policies are preserved for audit but disabled by the PUSH 39 migration. The service-role autonomous command function is revoked. A persistent policy is no longer sufficient to execute a sensitive physical action.

## Webhooks and callbacks

Webhook contracts are versioned and HMAC-signed over version, key version, timestamp, delivery ID and exact body. Validation enforces an HTTPS allowlist, rejects embedded credentials and literal local/private/link-local destinations, applies a bounded replay window and stores provider event IDs idempotently. Production callback acceptance additionally requires a current active Production provider configuration, matching provider identity and current key version.

No Production webhook sender or secret is activated by this PUSH. DNS resolution must be revalidated by any future owner-authorized Production adapter before connection to prevent DNS rebinding.

## Cost and retention

PUSH 39 contacts no paid provider, so measured incremental provider usage and cost are zero. Unit-cost fields and attempt usage units support future Site/provider attribution, but projected external cost is unknown until approved supplier rates and retry distributions exist. Both canonical denominators remain separate: infrastructure cost per registered user and all-in attributable cost per active paying user.

Delivery, attempt, callback and action audit records follow the Site security/audit retention policy. The migration stores no media or credentials. Recovery is fail-closed: disable providers, stop workers, preserve append-only history, and restore code/schema through a reviewed forward migration.
