# Advanced Learning Engine

## Purpose

The Advanced Learning Engine prepares the Digital Observer to understand normal site behavior over time and compare future indicators against a site-level baseline.

This phase is mock/readiness only:

- No autonomous decisions.
- No accusations.
- No automatic enforcement.
- No automatic parent notifications.
- Human review remains required.
- No child profiling.
- No staff scoring.

## Architecture

The learning engine uses reviewed signals to improve site-level confidence.

Flow:

1. Camera, audio, pickup, safety or watch-request event is created.
2. Human reviewer confirms, dismisses, escalates or marks false positive.
3. Review outcome is stored in `learning_feedback_signals`.
4. Confidence is adjusted deterministically.
5. Site/camera/zone learning profiles are updated.
6. Future anomaly readiness increases only after enough reviewed feedback.

No event automatically causes enforcement or parent messaging.

## Baseline Creation

Baselines are stored in `site_behavior_baselines`.

Supported baseline types:

- normal occupancy patterns
- normal movement patterns
- normal activity levels
- normal active hours
- normal pickup patterns
- normal staff presence
- normal camera activity
- normal zone usage

Baselines are per site or kindergarten. They are not per child and not per staff member.

## Camera Learning Profiles

`camera_learning_profiles` prepares camera-level readiness for:

- activity frequency
- motion frequency
- occupancy frequency
- offline history
- obstruction history
- anomaly history

The profile does not store raw video, face data or personal identity.

## Zone Learning Profiles

`zone_learning_profiles` prepares zone-level readiness for:

- expected occupancy
- expected activity
- expected schedules
- expected movement frequency
- restricted-area behavior

Restricted area learning is conservative. It should create indicators for human review only.

## Confidence Adjustment

Reviewed outcomes adjust confidence:

- confirmed: confidence increases
- valid detection: confidence increases
- escalated: confidence increases
- needs more data: small increase
- dismissed: confidence decreases
- false positive: confidence decreases more strongly

This is deterministic and mock-only. It does not represent a trained AI model.

## Learning Maturity

Maturity is site-level:

- `new`
- `learning`
- `calibrated`
- `mature`

Maturity advances only with reviewed feedback and sufficient confidence. It must never be shown as a child score, staff score or blame indicator.

## Anomaly Readiness

Prepared anomaly categories:

- unusual activity
- unusual absence
- unusual occupancy
- unusual movement
- unusual pickup behavior
- unusual audio patterns

Readiness means the system has enough reviewed baseline data to prepare an indicator. It does not mean the system can act automatically.

## Integrated Inputs

The engine is ready to receive reviewed signals from:

- AI camera events
- audio observer events
- pickup events
- watch requests
- safety incidents
- camera health

Every input must come through a human-reviewed outcome or a mock QA event in this phase.

## Privacy Model

Hard boundaries:

- No child profiling.
- No staff scoring.
- No automatic risk labels.
- No biometric inference.
- No automatic parent notification.
- No disciplinary conclusion without human review.
- Learning belongs to the site/kindergarten first.

Future production activation requires consent, clear retention rules and audit logging.

## Future AI Expansion

Future phases may connect real model outputs, but only after:

- consent model is implemented
- retention policy is implemented
- audit logs are enforced
- reviewer workflow is mandatory
- false-positive feedback loop is validated
- model output remains advisory

The safe first production step should use site-level camera health, motion/activity baselines and reviewed anomaly indicators before any identity-sensitive detection.
