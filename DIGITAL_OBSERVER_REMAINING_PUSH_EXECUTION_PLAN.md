# DIGITAL OBSERVER — REMAINING PUSH EXECUTION PLAN

Date: 2026-10-19
Scope: canonical PUSH 39–52 only
PUSH 39 is Development-complete under the separately authorized canonical task, but remains canonically NOT DONE while external provider and real-action proof is unavailable. PUSH 40 is Development-complete after its internal gates and remains canonically NOT DONE while payment-provider sandbox and real commercial proof are unavailable. PUSH 41 is Development-complete after exact-head CI, isolated Development migration/RLS/drift and cumulative local full-stack verification, but remains canonically NOT DONE while external enterprise identity, independent service-account, MFA/recovery, real multi-site and Production-scale proof remain unavailable. This document does not replace existing PUSH definitions and does not authorize PUSH 42, main or Production.

## Sequence and acceptance reconciliation

| PUSH | Existing objective | Actual status | Primary capability ownership | Dependencies | Reconciled acceptance and real proof |
|---:|---|---|---|---|---|
| 39 | External Notifications, Actions and Escalation | DEVELOPMENT COMPLETE — NOT DONE | Providers, callbacks, actions, escalation, quiet hours, acknowledgement | 10, 25, 27; provider sandboxes | PRs #186–#191 exact-head gates, isolated Development migrations, 249/249 drift, canonical Product 18/18 and PUSH 39 full-stack 24/24 pass; real provider sandbox retry/dedupe/ack/failure receipts and real authorized actions remain open; explicit reversible activation; no automatic sensitive action |
| 40 | Billing, Subscription and Entitlement Production | DEVELOPMENT COMPLETE — NOT DONE | Provider-neutral checkout, subscriptions, internal invoices, entitlements, partner metering foundation, self-service activation | 25, 39; payment/invoice/legal approval | Internal deterministic/RLS/migration/full-stack gates; approved provider sandbox then limited authorized real proof, legal invoice process and cost reconciliation remain open |
| 41 | Enterprise Tenancy, RBAC, SSO and Service Accounts | DEVELOPMENT COMPLETE — EXTERNAL PROOF PENDING — NOT DONE | Organizations, multi-Site roles, SSO/SCIM, service accounts, SLA/access policy | 25, 26, 36 | Exact-head CI, isolated Development migration/RLS/drift and cumulative full-stack gates pass; independent multi-organization/IdP/SCIM/MFA/service-account, penetration and real-scale proof remain open |
| 42 | External API and Webhook Platform | NOT STARTED; internal APIs only | Public API, Gan Batuach contract, VMS/source integrations, webhooks, sandbox/docs | 25, 26, 41 | Independent consumer conformance; versioning, rate limits, idempotency, signed webhooks and authorized Evidence |
| 43 | SDK, OEM and White-Label Proof | NOT STARTED | SDK, embedded components, OEM hierarchy/provisioning, branding and upgrade contract | 42 | External sample/partner provisions isolated customer and embeds/branded flow without first-party UI |
| 44 | Native Mobile Production Readiness | NOT STARTED; contracts/store preparation only | Signed iOS/Android, push, deep links, mobile onboarding and personal-safety client | 25, 39 | Real-device supported matrix, permissions/background/resume/push and store policy review |
| 45 | Legal, Privacy and Compliance Closure | NOT STARTED; policy registry/drafts exist | Video, home/workplace, kindergarten, retention, biometrics/Re-ID, DPA/notices | 25; defined pilots | Written external decisions; deletion/export/legal hold; sensitive features remain disabled until approved |
| 46 | Real External Home Pilot | NOT STARTED | Profile A zero-install proof, PUSH 38 home obligations, external quality/support | 16, 23, 25, 28, 38, 39, 45 | Non-team consented home; agreed duration; direct path where compatible; reliability, quality, support and cost log |
| 47 | Real External Business Pilot | NOT STARTED | SMB/multi-Site, VMS/NVR/recording integration, operations and customer value | 41, 45, 46 | Paying or contractually committed external business with notices, zones, support and referenceable exit result |
| 48 | 100+ Camera / Monitoring-Center Pilot | NOT STARTED | Multi-camera tracking/correlation, advanced investigation, person/vehicle Re-ID, real scale/DR | 37–43, 45, 47 | Real 100+ deployment, operator load, failover, cross-camera quality and authorized investigation case |
| 49 | Production Economics and KPI Proof | NOT STARTED; cost/quality engines exist | Quality cohort, SLA/KPI, historical infrastructure/registered-user ₪15 target, all-in/active-paying-user ₪15 ceiling, unit economics and drift | 28, 33, 38, 46–48 | Sustained auditable metrics reconcile invoices, taxes/FX and revenue; calculate both ratios separately with explicit denominator rules and no substitution pending owner decision |
| 50 | Acquisition Technical DD and Data Room | Documentation-only preparation allowed; final NOT STARTED | Architecture/security/test/IP/license/runbook/evidence reconciliation | Final closure of 24–49 | Independent reader reproduces claims; no unresolved ownership or hidden evidence gap |
| 51 | Paying Customers, Growth, Funding and Strategic Partnerships | LATE STAGE | Repeatable revenue, retention, support, partner/OEM commercial proof | 46–49 | Multiple paying customers and at least one measured strategic/partner integration outcome |
| 52 | Acquisition Process and Exit Readiness | LATE STAGE | Competitive buyer process and final readiness | 43, 49–51 | Complete DD, ownership/contract readiness and multiple qualified buyer paths |

## Ownership additions without new PUSHes

- DO-NS-191 Face detection → PUSH 48 implementation/proof, blocked by PUSH 45.
- DO-NS-192 Vehicle Re-ID → PUSH 48 implementation/proof, blocked by PUSH 45 where personal-data rules apply.
- DO-NS-193 Gan Batuach integration → PUSH 42, with PUSH 41 and 45 dependencies; operational proof in PUSH 47.
- DO-NS-194 OEM hierarchy/provisioning → PUSH 43, dependent on 41–42.
- DO-NS-195 Partner metering/settlement → PUSH 40, dependent on 42–43; economics proof in 49.
- DO-NS-196 Dual-denominator cost ceiling evidence → PUSH 49; final relationship between the historical registered-user target and current active-paying-user ceiling requires owner decision.
- DO-NS-197 Consumer/SMB self-service activation → PUSH 40; external proof in 46–47.

## Execution gates

Every PUSH uses an isolated branch, exact-head CI, risk-specific tests, remote preservation and ledger entry before Development integration. No remaining PUSH may touch main, Production, Production migrations or paid provider activation without new explicit owner authorization. External pilots require legal approval, bounded scope, rollback/support plan and cost ceiling preflight. Real evidence is additive; failed evidence is retained.

## Next canonical PUSH

PUSH 42 is readiness-only after PUSH 41 closed its mandatory internal gates at integration commit `a7e484bd9413ee1e2c06be9b75bec129cc9367b3`: cumulative Product 18/18, PUSH 39 24/24, PUSH 40 6/6, PUSH 41 7/7, Enterprise schema/RLS PASS and migration drift 251/251. PUSH 42 has not started. PUSH 38 reliability exceptions, PUSH 39 external-provider/real-action proof, PUSH 40 payment-provider/legal/commercial proof and PUSH 41 external enterprise identity proof remain explicitly open; deterministic or isolated-Development implementation does not convert them into real proof.
