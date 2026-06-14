# Digital Observer Capability Legal Review Matrix & Vertical Launch Decision

Phase 160 creates the internal capability governance layer for Digital Observer and all future vertical products. It does not replace external legal advice, ISO review, penetration testing, or camera-law review.

## Purpose

Digital Observer Core can remain a powerful technical engine while each product vertical receives its own legal, privacy, product, and launch decision.

Gan Batuach uses only the capabilities permitted for Israeli kindergarten operations. Restricted capabilities are blocked by policy until external review and explicit approval are recorded.

## Implemented Platform Components

- Admin dashboard: `/dashboard/admin/capability-legal-review`
- Migration: `supabase/migrations/20260612016000_digital_observer_capability_legal_review_matrix.sql`
- Runtime helper: `lib/domain/capability-policy-engine.ts`
- Navigation and route safety registration
- Parent camera token guard connected to the capability policy engine

## Capability Registry

The `observer_capability_registry` table records every sensitive capability:

- Camera: live streaming, playback, recording, snapshots, parent viewing, watermarking, anti-screen-capture readiness, camera health monitoring
- AI vision: pose estimation, skeleton analytics, motion analytics, fall suspected detection, inactivity suspected detection, crowding suspected detection, restricted area detection, object detection
- Identity and biometrics: face recognition, face matching, gait recognition, soft biometric matching, contextual child association, persistent skeleton identity, cross-day identity tracking, child biometric face profile
- Audio: audio recording, audio analytics, keyword detection, speech recognition, distress sound detection
- Observer workflows: risk scoring, anomaly scoring, incident recommendations, predictive safety, human review queue, investigation linking
- Data: medical data processing, child data processing, parent data processing, staff data processing, AI telemetry, audit logs, raw child data access
- Future analytics: occupancy analytics, regional analytics, multi-site observer

Each capability stores risk level, sensitivity, parent visibility boundary, DPIA requirement, consent requirement, human-review requirement, and product wording guardrails.

## Vertical Registry

The `observer_verticals` table defines launch and regulatory profiles:

- `digital_observer_core`
- `gan_batuach`
- `school_safe`
- `home_observer`
- `business_observer`
- `office_observer`
- `warehouse_observer`
- `municipality_observer`
- `enterprise_observer`

Each vertical stores country, regulatory profile, allowed capabilities, restricted capabilities, disabled capabilities, required approvals, launch status, and launch decision summary.

## Gan Batuach Israel Profile

Profile key: `GAN_BATUACH_ISRAEL_PROFILE`

Allowed capabilities:

- Pose estimation
- Skeleton analytics
- Motion analytics
- Fall suspected detection
- Inactivity suspected detection
- Crowding suspected detection
- Restricted area detection
- Camera health monitoring
- Reviewed safety summaries
- Human review workflows
- Watermarking and anti-screen-capture readiness
- Audit logs and AI telemetry without direct PII

Disabled capabilities:

- Audio recording
- Audio analytics
- Keyword detection
- Speech recognition
- Distress sound detection
- Face recognition
- Face matching from kindergarten cameras
- Child biometric face profiles
- Raw AI parent visibility
- Automatic AI accusations
- Automatic disciplinary actions

Legal-review-required capabilities:

- Parent camera streaming policies
- Live streaming for parent visibility
- Contextual child association through skeleton or daily context
- Soft biometric matching
- Gait recognition
- Persistent skeleton identity
- Cross-day identity tracking
- Object detection in child environments
- Predictive safety scoring
- Playback, snapshots, and recording policies

## Digital Observer Core Profile

Profile key: `DIGITAL_OBSERVER_CORE_PROFILE`

Digital Observer Core is a technical registry, not a legal product profile. It may include capabilities that are disabled or restricted in Gan Batuach.

Core availability does not authorize production use in any vertical. Each vertical must have a capability decision before launch.

## Per-Vertical Decision Matrix

The `observer_vertical_capability_decisions` table records each capability decision per vertical.

Decision statuses:

- `allowed`
- `disabled`
- `restricted`
- `legal_review_required`
- `consent_required`
- `external_provider_required`
- `future_only`

Every decision also stores:

- Legal status
- Risk level
- Enabled flag
- Review owner
- External legal review requirement
- Consent requirement
- Parent visibility rule
- Human-review requirement
- DPIA requirement
- Launch blocker flag
- Decision reason

Automatic action is constrained to `false` at the database level.

## Runtime Enforcement Model

The helper `lib/domain/capability-policy-engine.ts` exposes:

- `isCapabilityAllowed`
- `requireLegalReview`
- `assertCapabilityEnabled`
- `listRestrictedCapabilities`
- `getCapabilityDecisionReason`

Sensitive modules can call `assertCapabilityEnabled` before executing restricted features.

Current guard point:

- Parent camera viewing token creation checks `gan_batuach / parent_viewing`.

If a capability is disabled or requires legal review without approval, execution is blocked and a capability audit event is attempted.

## Policy Override Workflow

Restricted activation must not be a simple admin toggle.

Required evidence:

- Legal review record
- Privacy review record
- DPIA approval where required
- AI governance review where relevant
- Super-admin approval
- Immutable audit event

The migration extends `legal_review_items` with capability, vertical, reviewer, decision, expiration, supporting documents, DPIA linkage, AI governance linkage, and privacy-impact reference fields.

## DPIA And Privacy Linkage

High-risk capabilities are marked with `dpia_required = true`.

Examples:

- Parent camera viewing
- Live streaming
- Face recognition
- Audio analytics
- Contextual child association
- Persistent identity tracking
- Predictive safety
- Medical and child data processing

## Parent Visibility Rules

Gan Batuach parent visibility boundaries:

- Raw AI event: disabled
- Raw observer signal: disabled
- Skeleton event: internal only
- Internal risk score: internal only
- Reviewed safety summary: allowed only after approval
- Camera stream: legal-review-required and camera-policy controlled
- Documents: approved document only

Parents may see only approved information related to their own child and garden.

## Capability Audit Events

The `observer_capability_audit_events` table tracks:

- Capability enabled
- Capability disabled
- Capability blocked
- Legal review required
- Override requested
- Override approved
- Override rejected
- Runtime guard blocked

This complements the immutable audit trail. Production deployments should forward these events to the final WORM-ready audit layer when the external infrastructure is selected.

## Launch Decision Model

Vertical launch statuses:

- `not_ready`
- `internal_testing`
- `pilot_ready`
- `legal_review_required`
- `production_ready`
- `blocked`

Gan Batuach is seeded as `pilot_ready` with legal-review dependencies still open for parent camera streaming and identity-like AI capabilities.

Future verticals are seeded as `legal_review_required`.

Digital Observer Core is seeded as `internal_testing` because it is a technical core, not a standalone legal product.

## Product Copy Guardrails

Forbidden Gan Batuach claims:

- AI identifies children
- AI detects violence with certainty
- AI replaces human supervision
- Automatic safety decisions

Safer wording:

- Detects motion anomalies
- Assists review
- Supports safety monitoring
- Requires human review
- Generates reviewed safety insights

## External Review Package

Before production launch, prepare these review packages:

- Privacy lawyer: Gan Batuach restrictions, parent camera policy, DPIA links, parent visibility rules
- ISO consultant: capability matrix, audit evidence, policy records, launch decisions
- Penetration tester: runtime guards, camera token flow, access checks, sensitive routes
- AI governance reviewer: human review workflow, explainability, restricted capabilities
- Camera compliance reviewer: no direct RTSP, tokenized WebRTC, viewing hours, watermarking, child checked-in rule

## Future Extraction Plan

No extraction is performed in this phase.

Future target architecture:

```text
apps/
  gan-batuach
  digital-observer

packages/
  observer-core
  camera-core
  ai-core
  workflow-core
  audit-core
  analytics-core
  ui-core
```

Extraction should happen only after:

- Tenant boundaries are verified
- Vertical capability decisions are stable
- Shared package interfaces are documented
- RLS and storage policies are validated
- Legal review confirms product separation rules

## Remaining Legal And Product Gaps

- External legal approval is still required for parent camera streaming policy.
- Contextual child association remains legal-review-required.
- Soft biometric matching, gait recognition, persistent skeleton identity, and cross-day identity tracking remain blocked for Gan Batuach.
- Public or parent-facing safety scores require legal/product review before exposure.
- Runtime guards should be expanded to every sensitive module, including AI ingestion, audio modules, face/identity modules, observer summaries, risk scoring, and parent-visible AI summaries.
- Future verticals need country-specific legal analysis before pilot launch.
