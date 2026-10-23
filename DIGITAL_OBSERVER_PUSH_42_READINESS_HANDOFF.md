# DIGITAL OBSERVER — PUSH 42 READINESS HANDOFF

Date: 2026-10-19

State: readiness only — PUSH 42 is **NOT STARTED**

## Canonical objective

PUSH 42 owns the External API and Webhook Platform: a versioned, tenant-, organization- and Site-scoped public contract with service-account authentication, least privilege, rate limits, idempotency, audit, signed webhooks, sandbox fixtures, documentation and deprecation policy. Its independent acceptance gate is a consumer completing camera/status/Event/Evidence integration from the published contracts and conformance suite.

This handoff does not authorize implementation, an external connection, paid supplier activation, main, Production or Production migrations.

## Verified input baseline

- Required PUSH 39 notification/action and signed-webhook foundations are preserved; local full-stack PASS 24/24. External provider receipts remain open.
- Required PUSH 40 entitlement, billing and usage-attribution foundations are preserved; local full-stack PASS 6/6. Payment/legal/commercial proof remains open.
- Required PUSH 41 organization/Site authorization, RBAC, scoped service accounts, sessions and audit foundations are integrated. Local full-stack PASS 7/7; Enterprise schema/RLS PASS; Development drift PASS 251/251.
- Cumulative Product PASS 18/18 at integration commit `a7e484bd9413ee1e2c06be9b75bec129cc9367b3` in `DEVELOPMENT / INTEGRATION` with isolated `LOCAL_SUPABASE`.
- All 197 North-Star capability identities remain present. PUSH 38 exceptions and all PUSH 39–41 external proof obligations remain open.

## Canonical capability ownership

PUSH 42 is the single implementation owner for:

- DO-NS-007 DVR/NVR/VMS integrations.
- DO-NS-008 vendor Cloud/API integrations.
- DO-NS-082 existing VMS/NVR/camera-estate integration.
- DO-NS-083 integration without replacing the customer's VMS.
- DO-NS-085 customer-hosted video access.
- DO-NS-086 customer-hosted recording access.
- DO-NS-088 federated investigation.
- DO-NS-097 historical investigation API coverage.
- DO-NS-098 current/live investigation API coverage.
- DO-NS-103 investigation reports.
- DO-NS-112 public API.
- DO-NS-114 webhooks.
- DO-NS-115 Event callbacks.
- DO-NS-116 investigation API.
- DO-NS-117 Watch API.
- DO-NS-119 Evidence references for integrations.
- DO-NS-120 deep-link/open-camera integration contract.
- DO-NS-193 Gan Batuach Management integration contract.

Proof ownership remains where the capability map assigns it: PUSH 42 for contract/conformance gates, PUSH 47 for real business/VMS/Gan Batuach operational proof, and later legal/privacy gates where the data or workflow is sensitive. PUSH 43 continues to own SDK, OEM hierarchy, provisioning, branding and white-label proof.

## Mandatory implementation boundaries

1. Reuse PUSH 41 service accounts and organization/Site permissions; do not add permanent unrestricted API keys or a parallel role model.
2. Reuse canonical Camera, Event, Incident, Watch Rule, Evidence, Investigation, notification and billing domains; do not create parallel engines.
3. Version request, response, webhook and error contracts. Define a published compatibility and deprecation window.
4. Enforce server-side tenant/organization/Site/resource/action authorization, entitlement checks, bounded pagination and rate limits.
5. Require stable request/event identities, idempotency and replay-safe signed webhooks with truthful delivery lifecycle.
6. Evidence and playback references must remain authorized, short-lived and revocable; no raw credential or unrestricted media URL may cross the API.
7. Gan Batuach remains a separate authorization domain. Define explicit server-to-server capabilities and Garden/Site role mapping; do not grant parents, staff, inspectors or managers blanket Observer access.
8. Keep sensitive investigation and kindergarten workflows behind PUSH 45 lawful-use/privacy gates. Do not activate unfinished biometrics.
9. Account for partner/API usage through PUSH 40 contracts without implementing PUSH 43 partner hierarchy or controlling partner resale pricing.
10. Keep providers and external destinations disabled by default. No external consumer, webhook destination, VMS, Gan Batuach runtime or paid service may be activated without its scoped approval.

## Expected security and QA gates

- Wrong tenant, organization, Site, camera and resource denials.
- Revoked/expired service account, credential rotation and concurrent-old-key denial.
- Scope and entitlement denial, privilege-escalation denial and billing/operational separation.
- Version negotiation, invalid-version and deprecation behavior.
- Pagination, query limits, rate limits and bounded response sizes.
- Request idempotency, replayed webhook, forged signature, stale timestamp, SSRF/internal destination and callback duplication.
- Evidence-link expiry/revocation and unauthorized recording/investigation denial.
- Gan Batuach Garden/Site/role negative matrix with separate audit identities.
- PUSH 39, PUSH 40 and PUSH 41 regressions.
- TypeScript, canonical lint, Production build without deployment, domain, security/isolation, migration safety and release contract.

## Schema and migration readiness

PUSH 42 must first audit existing integration-client, service-account, webhook, rate-limit, audit, usage and Evidence schemas. A new migration is permitted only when an existing canonical table cannot safely own the required state. Any migration must be forward-only, additive, RLS-protected, indexed, volume/cost bounded and applied only to the canonical isolated Development database after exact-head CI and a verified backup. No Production migration is authorized.

## Completion boundary

Development completion requires the internal API/webhook implementation, exact-head CI, isolated Development schema proof when applicable, cumulative full-stack verification, published documentation/sandbox fixtures and an independent Development conformance client. Real VMS/vendor/Gan Batuach operation, sensitive investigation, external webhook delivery and partner/commercial proof remain separate real-proof gates and cannot be inferred from deterministic QA.

PUSH 42 may begin only under a separate explicit implementation instruction. It has not started in this task.
