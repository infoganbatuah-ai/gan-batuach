# DIGITAL OBSERVER — PUSH 43 IMPLEMENTATION REPORT

Date: 2026-10-19

Target: `integration/development`

Status in this branch: **IMPLEMENTED — VALIDATION/INTEGRATION PENDING — CANONICAL NOT DONE**

## Delivered

- Partner organizations overlay canonical PUSH 41 organizations; partner customers map to existing organizations and Sites rather than creating a parallel tenant system.
- Idempotent customer provisioning links approved PUSH 40 entitlement grants, never client-declared entitlements.
- Partner-control and single-customer resource service-account mappings reuse PUSH 41 credentials and PUSH 42 HMAC/replay/idempotency receipts.
- External camera/Event/Incident/Evidence/Investigation/Watch/Webhook contracts remain PUSH 42-owned; delegated access is allowed only for an active mapped customer and explicitly linked non-kindergarten Site.
- Published `@digital-observer/sdk` server, browser and React surfaces cover signed auth, inventory/health, Events, Incidents, Evidence references, investigation, Watch Rules, webhooks, pagination/error contracts, partner provisioning and embedded-session issuance.
- Embedded sessions are opaque, hashed at rest, at most 60 minutes, audience/Origin/customer/Site/scope bound, revocable and never expose a long-lived service credential.
- White-label profiles configure partner/product name, logo, colors, domain, notification label and policy links while preserving mandatory legal notices. Domains remain unverified until separate proof.
- An independent sample imports only public SDK surfaces. Deterministic QA rejects private imports and verifies signed requests, idempotency, origin/audience gates and webhook signatures.

## Security and privacy

All eight new tables use RLS; mutations are service-side. Anonymous access is revoked. Direct authenticated writes are absent. Partner, customer, tenant, Site and resource boundaries are explicit. Kindergarten Sites are denied. Raw video, camera credentials, external customer references and raw embedded tokens are not stored. Sensitive biometrics stay disabled pending PUSH 45.

## Commercial and operational truth

PUSH 43 reuses PUSH 40 partner billing accounts and usage classes. Partners retain retail pricing control. No prices, settlement, provider, customer, external SSO, custom domain, live webhook, camera/VMS or paid resource were activated. Zero-install remains preferred and PUSH 46 retains real proof ownership.

## Remaining external proof

Canonical PUSH 43 remains `NOT DONE` until an owner-approved real OEM/white-label partner completes provisioning, customer/Site isolation, signed API/SDK operation, embedded branding, revocation, usage attribution, webhook receipt, vendor integration where applicable, support ownership and commercial/legal gates. PUSH 38–42 obligations remain unchanged.
