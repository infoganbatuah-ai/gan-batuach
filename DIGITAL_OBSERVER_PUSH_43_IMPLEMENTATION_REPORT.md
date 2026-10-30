# DIGITAL OBSERVER — PUSH 43 IMPLEMENTATION REPORT

Date: 2026-10-19

Target: `integration/development`

Status: **DEVELOPMENT COMPLETE — EXTERNAL PROOF PENDING — CANONICAL NOT DONE**

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

## Development completion evidence

- PR #210 integrated the implementation after 9/9 exact-head checks; PRs #211–#218 preserved bounded QA, migration receipts, runtime-secret isolation, delegated usage, embedded-origin and canonical embedded-data fixes with 9/9 exact-head checks on every merged head.
- The three additive migrations `20261019040000_digital_observer_push43_oem_sdk.sql`, `20261019041000_digital_observer_push43_delegated_usage.sql` and `20261019042000_digital_observer_push43_embed_origin_constraint.sql` are applied only to isolated Development. Drift is 255/255 and Production access is false.
- The final exact runtime `42a680218005403c6501ce4264e7e5a5cc4e201d` is labeled `DEVELOPMENT / INTEGRATION`, uses `LOCAL_SUPABASE`, and passes the cumulative Product 18/18 plus PUSH 39 24/24, PUSH 40 6/6, PUSH 41 7/7 and PUSH 42 10/10 regressions.
- The independent public-SDK partner application passes 15/15 against synthetic Development data: partner auth, idempotent customer provisioning, customer/Site isolation, camera/Event/Incident access, branded embedded UI, origin denial, session revocation and measured customer usage attribution. It imports no private server module.
- Five existing North-Star rows were truthfully updated to `IMPLEMENTED — NEEDS REAL PROOF`; all 197 capability identities remain and none was promoted to `DONE + REAL PROOF`.
- Incremental supplier cost is ₪0. No paid provider, real partner/customer, main, Production, Production migration or scheduled release was activated.

## Remaining external proof

Canonical PUSH 43 remains `NOT DONE` until an owner-approved real OEM/white-label partner completes provisioning, customer/Site isolation, signed API/SDK operation, embedded branding, revocation, usage attribution, webhook receipt, vendor integration where applicable, support ownership and commercial/legal gates. Custom-domain verification, external partner SSO, real camera/VMS integration, commercial settlement and Production proof are also open. PUSH 38–42 obligations remain unchanged. PUSH 44 is readiness-only and was not started.
