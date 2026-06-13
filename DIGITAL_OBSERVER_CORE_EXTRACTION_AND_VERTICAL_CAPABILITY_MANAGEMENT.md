# Digital Observer Core Extraction & Vertical Capability Management

## Purpose

Phase 151 prepares a strategic separation between Gan Batuach and Digital Observer Core without creating a new repository, moving infrastructure or duplicating code.

The current product remains Gan Batuach: a regulated kindergarten implementation for Israel. Digital Observer Core is mapped as a future reusable intelligence platform that can power additional verticals.

## Core Architecture

Current:

```text
Gan Batuach
├─ camera platform
├─ observer platform
├─ AI governance
├─ risk and anomaly engines
├─ incident, workflow and audit engines
├─ notification and analytics engines
└─ kindergarten-specific modules
```

Future target:

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

No extraction happens in this phase. The implementation adds a registry, profile model, package plan and dashboard so future extraction can happen safely.

## Capability Inventory

The `digital_observer_core_capabilities` table inventories reusable capabilities:

- camera platform
- secure streaming
- observer events
- AI model registry
- pose analytics
- skeleton analytics
- motion analytics
- anomaly detection
- risk scoring
- incident engine
- workflow engine
- audit engine
- notification engine
- analytics engine
- inspection engine
- compliance engine

Restricted or disabled capabilities are also tracked:

- audio analytics
- face recognition
- unrestricted biometrics
- soft biometrics
- gait analytics

## Vertical Capability Matrix

The existing `vertical_capability_matrix` is extended, not duplicated.

Supported verticals:

- Digital Observer Core
- Gan Batuach
- School Safe
- Business Observer
- Home Observer
- Municipality Observer
- Enterprise Observer

Capability statuses:

- `enabled`
- `disabled`
- `restricted`
- `legal_review_required`

This allows Digital Observer Core to retain a full capability inventory while Gan Batuach applies Israeli kindergarten restrictions.

## Vertical Profiles

### GAN_BATUACH_PROFILE

Enabled:

- inspections
- compliance
- parent portal
- child timeline
- pose analytics
- skeleton analytics
- motion analytics
- anomaly detection
- camera platform
- secure streaming

Disabled:

- audio analytics
- face recognition
- unrestricted biometrics

Restricted:

- soft biometrics
- gait analytics
- persistent identity tracking
- cross-day identity matching

### Future Profiles

Future-ready profiles are registered for:

- School Safe
- Business Observer
- Home Observer
- Municipality Observer
- Enterprise Observer

These profiles are not activated. They require separate legal, privacy and operational reviews.

## Core Services Registry

`observer_core_services_registry` maps current services to future packages:

- AI model service -> `ai-core`
- AI inference service -> `ai-core`
- anomaly service -> `ai-core`
- camera service -> `camera-core`
- streaming service -> `camera-core`
- workflow service -> `workflow-core`
- audit service -> `audit-core`
- analytics service -> `analytics-core`
- risk service -> `analytics-core`
- notification service -> `workflow-core`
- incident service -> `workflow-core`
- inspection service -> `observer-core`
- compliance service -> `workflow-core`

## Package Plan

`observer_shared_package_mapping` defines future extraction targets:

- `observer-core`
- `camera-core`
- `ai-core`
- `workflow-core`
- `audit-core`
- `analytics-core`
- `ui-core`

The first extraction candidates are camera, observer, AI and audit contracts because they are reusable and strongly bounded.

## Cross-Vertical Policy Engine

`observer_cross_vertical_policies` defines:

- allowed verticals
- restricted verticals
- disabled verticals
- approval requirements
- restriction summaries

Policy examples:

- pose analytics are allowed in Gan Batuach only as non-identifying signals with human review.
- audio analytics are disabled for Gan Batuach.
- face recognition is disabled for Gan Batuach and legal-review-only elsewhere.
- risk recommendations are advisory only.
- parents never see raw observer signals.

## Data Boundary Model

`observer_data_boundary_map` separates:

- core observer data
- vertical data
- shared boundary data
- derived anonymous data

Key rules:

- child records remain Gan Batuach vertical data.
- parent-visible timelines remain Gan Batuach vertical data.
- skeleton keypoints are derived anonymous data only.
- streaming sessions are shared boundary data and must stay permission-scoped.
- audit events can become reusable core data if append-only guarantees remain intact.

## Dashboard

Admin dashboard:

```text
/dashboard/admin/digital-observer-core
```

It shows:

- core capability inventory
- vertical profiles
- enabled, disabled, restricted and legal review items
- service registry
- future package mapping
- data boundaries
- cross-vertical policies
- roadmap registry
- dynamic readiness score

## Extraction Rules

Before any real extraction:

1. Do not move kindergarten-specific child, parent, medical or tuition data into core packages.
2. Do not expose raw observer events to parents.
3. Do not enable audio, face recognition or unrestricted biometrics for Gan Batuach.
4. Keep RLS and tenant isolation intact.
5. Keep all sensitive AI events under human review.
6. Extract contracts and pure services before UI.
7. Add integration tests before moving shared packages.

## Remaining Gaps

- No separate `apps/digital-observer` application exists yet.
- No package extraction has been performed.
- The package boundary is documented and registered, but imports still live in the current app.
- Future verticals need legal review, pricing, roles and tenant policies.
- UI components need a later pass before `ui-core` can be safely extracted.
