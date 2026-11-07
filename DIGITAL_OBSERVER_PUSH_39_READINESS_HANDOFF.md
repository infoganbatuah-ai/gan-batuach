# DIGITAL OBSERVER — PUSH 39 READINESS HANDOFF

Date: 2026-10-18
Canonical baseline: `integration/development@1bcd11b0a5f632f13805d63bc6e027080081db83`
Status: **READY FOR A SEPARATE IMPLEMENTATION TASK — NOT STARTED**

This handoff prepares PUSH 39 only. It does not implement PUSH 39, enable an external provider, authorize a paid service, modify Production, apply a migration, or authorize a merge to `main`.

## Canonical definition

**PUSH 39 — External Notifications, Actions and Escalation**

- Objective: activate provider-isolated push, email, SMS, WhatsApp, webhook and phone workflows safely.
- Dependencies: PUSH 10, PUSH 25 and PUSH 27, plus approved provider sandboxes.
- Canonical pass condition: every enabled provider passes retry, deduplication, acknowledgement, quiet-hours and failure tests; activation is explicit, reversible and auditable.
- Current roadmap status: `NOT STARTED`.

## North-Star ownership

PUSH 39 is the single implementation owner for 27 capabilities. It is the proof owner for 24 of them; real proof for universal controls, autonomous actions and natural-language physical commands remains deliberately assigned to PUSH 46.

| Capability IDs | Current truth | PUSH 39 responsibility | Proof owner |
|---|---|---|---|
| DO-NS-013–020 | FOUNDATION / NOT STARTED | Universal control capability mapping; PTZ, zoom, presets, speaker, siren and light under explicit policy | 39, except DO-NS-013 → 46 |
| DO-NS-024, DO-NS-026 | FOUNDATION / NOT STARTED | Safety-event routing only after approved detection, human review and lawful scope | 39 |
| DO-NS-047–053 | FOUNDATION / PARTIAL / NOT STARTED | Predictive-risk boundary, recommendations, escalation, emergency workflows, human gates and action authorization | 39, except DO-NS-049 → 46 |
| DO-NS-055, DO-NS-057–058 | FOUNDATION / NOT STARTED | User instructions and conversational/natural-language action confirmation | 39, except DO-NS-058 → 46 |
| DO-NS-064, DO-NS-068, DO-NS-073 | FOUNDATION / NOT STARTED | Governed watchlist/child-safety/check-in escalation boundaries; no sensitive automatic enablement | 39 |
| DO-NS-099–101 | FOUNDATION / NOT STARTED | Continuous Watch targets and authorized appearance alerts | 39 |
| DO-NS-118 | FOUNDATION | Audited provider result delivery and receipt lifecycle | 39 |

No capability status is upgraded by this handoff.

## Existing foundations to reuse

- Canonical Event, Incident, Evidence, verification and decision paths exist.
- Risk engines emit `NOTIFY_IN_APP` and `ESCALATION_CANDIDATE`, but external escalation is disabled by policy and no external provider is invoked.
- In-app notification tables, recipient isolation, read/archive UX, preferences and quiet-hours fields exist.
- Digital Observer alert-channel settings and delivery records exist with provider mode, attempt count, sent/acknowledged timestamps and failure reason.
- Mock/push-test routes and provider/webhook signature foundations exist; they are not proof of live provider delivery.
- Management delivery/outbox, dedupe and concurrency foundations are implementation references, not automatic cross-product authorization.
- Camera action schemas, queue contracts and guarded command acknowledgement exist. Unknown physical outcomes are intentionally non-retryable until reconciled.

## Missing implementation

1. A Digital Observer-owned orchestration contract from reviewed decision to channel/action intent, without coupling Gan Batuach authorization.
2. Provider adapters and isolated sandbox credentials for each selected channel; a provider is not enabled merely because a schema row exists.
3. Durable delivery state machine: idempotency key, bounded retry/backoff, terminal failure, cancellation, acknowledgement, expiry and dead-letter review.
4. Per-recipient authorization, consent/preferences, severity routing, quiet hours, rate limits and abuse controls.
5. Human-verification gates and reversible confirmation for emergency or physical actions; no automatic sensitive action.
6. Signed webhook delivery with replay protection, destination allowlisting/SSRF defense, lifecycle rotation and versioned payloads.
7. Operator escalation ownership, acknowledgement timers, fallback order, suppression and audit trail.
8. Provider-neutral observability, truthful health, support runbook and bounded cost metering.

## Security, privacy and legal gates

- Tenant/Site/recipient isolation and negative cross-tenant tests are mandatory.
- Secrets remain server-side in the approved provider store; never in client bundles, logs, Git or delivery payloads.
- Notification content is minimized and must not expose private video, child data or biometric conclusions.
- Kindergarten panic notifications and sensitive child-safety actions remain human-reviewed and policy-gated.
- Emergency, watchlist, biometric or physical-device actions require PUSH 45 lawful-use approval before real activation.
- Webhook signatures, timestamps, replay windows, destination validation and key rotation are blocking controls.
- Every action records requester, authorization basis, policy decision, confirmation, result, uncertainty and reversal/closure.

## Migration readiness

PR #184 and this closure introduce **no migration**. The current isolated Development database passes 247/247 drift verification: 227 baseline-included and 20 post-baseline migrations.

Before PUSH 39 creates SQL, audit and reuse the existing notification, alert-channel, delivery-event, push-log, external-delivery, workflow-escalation and camera-action contracts. Any unavoidable schema addition must be a new ordered additive migration with data owner, sensitivity, retention, expected volume, indexes, RLS, idempotency, rollback/recovery and cost impact documented. Production application is not authorized.

## Required QA and completion gates

1. Deterministic provider-contract tests for success, timeout, 4xx/5xx, ambiguous acknowledgement, rate limit, retry/backoff, dedupe, cancellation and terminal failure.
2. Role, tenant, Site and recipient isolation; unauthenticated, revoked, expired and cross-Site negatives.
3. Quiet-hours, preference, consent, severity, accessibility and localization tests.
4. Webhook signature/replay/SSRF tests and credential rotation/revocation.
5. Human confirmation and fail-safe tests for physical/emergency actions; unknown outcome must never be blindly retried.
6. Sandbox E2E for each enabled channel, with receipts that distinguish sandbox from Production.
7. Bounded load, queue recovery, offline/resync, observability and cost measurement.
8. Exact-head repository CI, remote branch preservation, ledger entry, Development integration and cumulative local Product verification.
9. Real provider activation, paid capacity, `main`, Production or Production migrations require separate explicit owner authorization.

## Baseline verification and known QA note

The merged Development runtime passed 18/18 scoped full-stack probes and a non-mutating real-browser login for the synthetic Development owner. A legacy Management dashboard role harness still expects removed selector `#dashboard-child`; the current UI contract was independently verified with four authorized child cards under `.parent-child-selector-track`. This is recorded test-harness drift and must be reconciled before that legacy suite is used as a PUSH 39 completion gate. No Product code was changed in this closure.

## Start condition

PUSH 39 may begin only as a new scoped task/branch after confirming this baseline is still the current `origin/integration/development`, re-reading `AGENTS.md`, selecting the provider sandbox scope and confirming no new cost or legal approval is required. This document itself does not start the PUSH.
