# PROD 4 AI Observer Architecture Inventory

Date: 2026-06-27

Camera prerequisite: PROD 3 completed with camera status `gateway_ready_no_camera`. No real camera gateway stream or frame source was validated before this phase.

Current AI status: shadow_ready / mock_only.

Real AI live: false.

## Code Inventory

| File/route | Purpose | Current status | Mode | Security/privacy risk | Required next step |
|---|---|---:|---|---|---|
| `/api/ai/observe` | Signed AI observer ingestion endpoint | Exists, hardened | Shadow/readiness | Must reject restricted event types and require secret | Connect only after provider contract and signed webhook validation |
| `/api/ai-camera-events` | Admin-created AI camera event workflow | Exists | Mock/shadow | Admin-only mock must not look like live inference | Keep mock copy and no parent visibility |
| `/api/ai-camera-events/[id]/action` | Human review actions | Exists | Review workflow | Manager/inspector scoping must hold | Manual role tests required |
| `/api/ai-events/[id]/action` | Legacy AI event actions | Exists | Review/actions | Parent visibility must stay blocked | Keep legacy action labels non-accusatory |
| `/api/admin/ai-observer/run-mock-job` | Mock observer job runner | Exists | Mock/shadow | Must not claim real video processing | Keep restricted to admin |
| `/api/ai-observer-rules` | Observer rule configuration | Exists | Readiness | Rules must not enable audio/face for Gan Batuach | UI now offers safe event candidates only |
| `/dashboard/admin/ai-observer` | Worker/jobs/rules dashboard | Exists | Mock/shadow | Could imply worker is live | Copy states local shadow only |
| `/dashboard/admin/ai-events` | Admin review queue | Exists | Shadow review | Raw event access admin-only | Keep parent raw visibility blocked |
| `/dashboard/garden/ai-events` | Manager scoped review queue | Exists | Scoped review | Must remain own-kindergarten only | Manual role tests required |
| `/dashboard/inspector/ai-events` | Inspector scoped signals | Exists | Assigned-garden review | Must remain assigned-only | Manual role tests required |
| `/dashboard/parent/ai-events` | Parent legacy AI event surface | Exists | Must show reviewed/approved only | Risk if raw `ai_events` are exposed | Requires manual privacy test before parent pilot |
| `/dashboard/admin/observer-pilot` | Shadow pilot/calibration view | Exists | Shadow/readiness | Must not imply production AI | Keep status as shadow |
| `/dashboard/admin/observer-test-center` | Calibration/review testing | Exists | Mock/shadow | Reviewer evidence access must be scoped | Manual admin-only test required |
| `/digital-observer/dashboard` | Standalone product dashboard | Exists | Product readiness | Must stay product-scoped | Verify no Gan Batuach data leakage |

## Domain Helpers

| File | Purpose | Current status |
|---|---|---:|
| `lib/domain/ai-provider-guardrails.ts` | AI provider mode, frame source and legal guardrails | Added in PROD 4 |
| `lib/domain/ai-frame-source.ts` | Safe frame source readiness abstraction | Added in PROD 4 |
| `lib/domain/vision-provider.ts` | Provider-agnostic vision adapter facade | Hardened to require real inference mode and frame source |
| `lib/domain/vision-analysis-pipeline.ts` | Diagnostics/vision summary helpers | Exists |
| `lib/domain/ai-observer.ts` | Signed structured observer ingestion | Hardened for Gan Batuach restricted event blocking |
| `lib/domain/ai-digital-observer.ts` | AI camera event taxonomy and labels | Labels softened in PROD 4 |
| `lib/domain/ai-observer/worker.ts` | Local shadow worker/job pipeline | Exists, mock only |
| `lib/domain/ai-observer/detection-engine.ts` | Mock detection engine | Labels softened in PROD 4 |
| `lib/domain/ai-observer/local-vision-adapter.ts` | Local placeholder frame adapter | Exists, wipes frame references and marks shadow |
| `lib/domain/capability-policy-engine.ts` | Capability policy blocks for sensitive AI/camera features | Exists |
| `lib/domain/digital-observer-product.ts` | Digital Observer product separation/copy guardrails | Exists |

## Database / Model Inventory

Relevant migrations and models found:

- `ai_camera_events`: shadow/review event readiness; default `parent_visible=false`.
- `ai_events`: legacy observer events.
- `ai_observer_rules`: threshold/cooldown rules.
- `observer_workers`: mock/local worker registry.
- `observer_jobs`: worker queue.
- `observer_job_logs`: worker logs.
- `observer_frame_sampling_jobs`: frame sampling readiness.
- `observer_pose_adapter_readiness`: pose adapter readiness.
- `observer_pilot_quality_snapshots`: calibration snapshots.
- `observer_pilot_dataset_registry`: pilot datasets.
- `observer_pilot_safety_rules`: pilot safety rules.
- `observer_capability_registry`: capability legal matrix.
- `observer_vertical_capability_decisions`: vertical-specific capability decisions.
- `observer_capability_audit_events`: capability audit.

## Capability Matrix Status

Gan Batuach Israel Mode restrictions are represented in migrations and code:

- Audio recording/analytics: disabled.
- Keyword/speech recognition: disabled.
- Face recognition/matching: disabled.
- Biometric child profile: disabled.
- Persistent/cross-day identity tracking: disabled.
- Raw AI parent visibility: disabled.
- Automatic accusations/disciplinary actions: disabled.

Allowed/readiness-only with human review:

- Motion anomaly candidate.
- Zone anomaly candidate.
- Crowding candidate.
- Inactivity candidate.
- Fall suspected candidate.
- Camera health event.
- Pose/skeleton metadata only where legally safe.

## PROD 4 Code Hardening

- Added centralized AI provider guardrails.
- Added frame source readiness abstraction.
- `.env.example` now includes generic AI provider/frame/review env names only.
- Vision provider no longer reports configured real processing unless provider mode, endpoint and frame source readiness are present.
- Signed AI observer ingestion blocks restricted Gan Batuach event types such as audio/violence detection.
- Admin AI rule UI no longer presents audio, keyword, face recognition or violence detection as selectable live features.
- UI labels were softened from accusation-like wording to candidate/review wording.

## Current Next Step

Connect a safe non-sensitive frame source or gateway snapshot, configure a test inference endpoint, run a single shadow inference test, verify event creation and review queue, then verify parent denial and product separation.
