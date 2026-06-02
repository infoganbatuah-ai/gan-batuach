# Digital Observer Learning Engine

Phase 2F creates the foundation for a kindergarten-level learning engine.

No real AI learning is implemented in this phase. There are no automatic decisions, no child profiling, and no behavioral labels on children.

## Purpose

The learning engine should eventually help the Digital Observer understand normal kindergarten operations:

- Where cameras are located.
- What each camera zone represents.
- What the daily routine usually looks like.
- What normal occupancy and movement patterns look like at a kindergarten level.
- Which signals may need human review.

The learning profile belongs to the kindergarten, not to individual children.

## Phase 1: Learn Environment

Foundation:

- Camera zones.
- Daily routine configuration.
- Opening hours.
- Pickup windows.
- Nap time.
- Outdoor activity hours.
- Meal times.
- Mock baseline signals.
- Mock risk profile.

No anomaly detection is active.

## Phase 2: Detect Anomalies

Future only:

- Compare current camera/routine signals to kindergarten baseline.
- Create suspected events when a signal is outside expected context.
- Keep all wording careful:
  - suspected
  - indicator
  - requires review

No automatic accusation.

## Phase 3: Reduce False Positives

Future only:

- Learn from manager/admin review decisions.
- Reduce repeated low-value alerts.
- Adjust cooldowns.
- Improve zone-specific thresholds.

Human review remains required.

## Phase 4: Predict Risks

Future only:

- Identify operational risk patterns at the kindergarten level.
- Suggest preventive actions.
- Surface trends for managers/admins.

The system must not label children or staff with behavioral scores.

## Data Model

### `kindergarten_learning_profiles`

Tracks:

- learning status
- learning start/completion
- baseline version
- confidence level
- metadata

### `camera_zones`

Supports:

- classroom
- playground
- entrance
- exit
- sleeping_area
- restricted_area
- kitchen
- staff_only
- bathroom_entrance

No drawing UI exists yet. Managers can assign a type to each camera zone.

### `kindergarten_routine_configs`

Stores:

- opening hours
- pickup windows
- nap time
- outdoor activity hours
- meal times

### `kindergarten_learning_signals`

Baseline-only future signals:

- normal occupancy
- normal movement patterns
- pickup routine
- staff routine
- opening routine
- closing routine

### `kindergarten_risk_profiles`

Mock scoring foundation:

- attendance
- pickup
- safety
- supervision
- camera coverage

Scores are for dashboard readiness only and do not trigger automatic decisions.

## Privacy Rules

- No automated accusations.
- No behavioral labels on children.
- No child-level learning profile.
- Human review is required.
- Learning profile belongs to the kindergarten.
- Parent visibility requires explicit human approval.
- Camera/audio/face analysis requires explicit consent before real activation.

## Manager Workflow

Manager can:

- View learning profile status.
- Configure daily routine.
- Assign camera zone types.
- Review mock risk categories.

Manager cannot:

- Enable real AI learning in this phase.
- Create child profiles.
- Trigger automatic decisions.

## Admin Workflow

Admin can:

- View learning progress across kindergartens.
- Review zone coverage.
- Review configured routines.
- Inspect mock risk readiness.

## Future Readiness

Before real learning:

1. Verify consent model.
2. Verify private storage and access control.
3. Run learning in shadow mode.
4. Measure false positives.
5. Keep human review mandatory.
6. Audit every baseline and review decision.
