# DIGITAL OBSERVER — GAN BATUACH INTEGRATION REQUIREMENTS

Date: 2026-10-18
Current status: FOUNDATION; runtime integration explicitly disabled

## Product boundary

Digital Observer is the camera and AI intelligence engine. Gan Batuach Management remains the management, Garden, child/family, staff, inspector and role-authorization product. The systems may share approved infrastructure, but must not share an uncontrolled authorization domain.

Current code truth is getDigitalObserverServiceReadiness().ganBatuachIntegration = disabled, active = false and auditedApiRequired = true. Management safety-camera surfaces deliberately label Live as requiring Production verification. This is truthful foundation evidence, not an active integration.

## Contractual integration scope

PUSH 42 owns the versioned server-to-server contract, dependent on PUSH 41 authorization and PUSH 45 privacy/legal decisions. The contract must cover:

- kindergarten camera onboarding and compatibility assessment;
- camera and component health with provenance and freshness;
- reviewed safety Events and canonical Incidents;
- Watch Rule lifecycle and ownership;
- alerts/escalation after human/policy gates;
- short-lived authorized playback and Evidence references;
- bounded investigation requests/results;
- inspector access and reason capture;
- role/Garden/Site isolation;
- capability truth: UI, contract, provider, production and provenance states.

## Authority split

Gan Batuach authorizes the actor, role, Garden, child/family context, purpose and permitted action. Digital Observer authorizes the requested camera/Event/Evidence resource within its tenant/Site boundary and returns only scoped results. Both products log the same correlation ID. Neither trusts a browser-supplied role or inherited parent access.

Required request context: actor ID, role, tenant, Garden, Site, purpose, case/incident where applicable, requested scope, issued-at, expiry and nonce/correlation ID. Tokens must be short-lived, audience-bound and revocable.

## Role requirements

| Role | Minimum allowed scope | Mandatory denials |
|---|---|---|
| Parent | Explicitly opened camera/context tied to their child and Garden; reviewed parent-safe output | Other Gardens/children, unrestricted replay, raw AI, identity search, credentials |
| Staff | Assigned Garden/area and explicit staff policy | Other Gardens, parent-only data, unrestricted investigation |
| Manager/Owner | Managed Gardens/Sites and policy-approved camera/incident operations | Platform-wide or unrelated tenant access |
| Inspector | Assigned Garden, approved purpose/reason, evidence/investigation scope and expiry | Broad live surveillance, unrelated sites, silent access |
| Platform/Support | Time-limited support or platform role with audit | Implicit child/family authorization or raw sensitive data without purpose |

## Kindergarten privacy requirements

- external legal basis and notices for the exact camera and AI uses;
- sensitive-area exclusion and camera-area policy;
- recording and Evidence retention limits;
- strict parent and staff access windows;
- inspector assignment, reason, expiry and audit;
- no raw or unreviewed AI conclusion to parents;
- no automatic accusation or disciplinary conclusion;
- biometric/face/Re-ID disabled unless separately approved for the precise purpose;
- incident escalation and safeguarding responsibilities;
- deletion/export/legal-hold procedures;
- data minimization and no camera credentials in Management.

Consent alone is not blanket authorization for children, employees, biometrics, sensitive areas or indefinite retention.

## End-to-end acceptance

A qualifying Development/QA proof must onboard one isolated synthetic Garden/Site, bind cameras without exposing secrets, ingest truthful health, deliver a reviewed canonical Event/Incident, enforce parent/staff/manager/inspector negatives, issue and expire authorized playback/Evidence, perform one bounded investigation where allowed, preserve audit correlation and prove cross-Garden/cross-tenant denial. Real Production activation additionally requires external legal review and explicit owner release authorization.
