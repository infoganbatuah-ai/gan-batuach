# Digital Observer Calibration And Training Guide

This guide defines how to measure, calibrate and prepare the Digital Observer for pilot and production readiness.

The Digital Observer must remain review-first:

- No autonomous actions
- No automatic accusations
- No disciplinary decisions
- No automatic parent contact
- No automatic authority contact
- Human validation is mandatory

## Calibration Process

Calibration is the process of tuning observer behavior per site.

Tracked profile fields:

- Motion sensitivity
- Audio sensitivity
- Crowd sensitivity
- Zone sensitivity
- Confidence threshold
- Alert threshold
- Observer model
- Training status
- Calibration status

Recommended process:

1. Start in shadow mode.
2. Collect observer events.
3. Human reviewer labels events through ground truth review.
4. Measure false positives, false negatives, uncertainty and confidence stability.
5. Adjust sensitivity and thresholds per site.
6. Re-test with replay and new events.
7. Move to pilot candidate only after stable metrics.

## Ground Truth Review Workflow

Ground truth creates measurable accuracy.

Allowed outcomes:

- `correct_detection`
- `missed_detection`
- `false_positive`
- `false_negative`
- `uncertain`

Workflow:

```text
event
-> observer recommendation
-> human review
-> classification
-> feedback
-> calibration update
```

Every review must keep:

- Reviewer identity
- Event source
- Event id
- Review outcome
- Confidence at review
- Reviewer note if needed
- `no_action_taken = true`
- `production_action_blocked = true`

## Accuracy Measurement

The accuracy engine calculates:

- Precision
- Recall
- False positive rate
- False negative rate
- Confidence average
- Confidence stability
- Reviewed event count
- Maturity score
- Readiness score

Precision:

```text
correct_detection / (correct_detection + false_positive)
```

Recall:

```text
correct_detection / (correct_detection + false_negative + missed_detection)
```

False positive rate:

```text
false_positive / reviewed_events
```

False negative rate:

```text
false_negative / reviewed_events
```

## Readiness Scoring

Readiness score is 0-100.

Factors:

- Reviewed events
- Precision
- Recall
- Confidence stability
- Confidence average
- Calibration quality
- False positive rate
- False negative rate

Production pilot rule:

- Do not use unresolved critical safety issues.
- Do not activate autonomous behavior.
- Do not expose raw media to unauthorized roles.
- Do not present observer output as accusation.
- Do not contact parents or authorities automatically.

Suggested readiness bands:

- `0-54`: not ready
- `55-79`: calibration in progress
- `80-100`: pilot candidate, still human-reviewed

## Replay Workflow

Replay is used to understand why the observer reacted.

Replay can include:

- AI camera events
- Audio observer events
- Correlated events
- Observer summaries

Replay must not expose:

- Raw camera credentials
- RTSP URLs
- Gateway secrets
- Unauthorized raw media
- Personal data across sites

Replay process:

```text
select event
-> inspect recommendation
-> inspect confidence factors
-> compare with human review
-> classify ground truth
-> update calibration metrics
```

## Training Dataset Readiness

This phase does not create real ML datasets.

It tracks readiness only:

- Reviewed events
- Accepted events
- Rejected events
- Uncertain events
- Dataset readiness score
- Site-specific learning readiness
- Global learning readiness

Rules:

- No cross-site personal data sharing
- Global learning may use aggregate patterns only in a future privacy-approved implementation
- Site-specific learning should remain scoped to that site
- Human review remains required

## Multi-Site Learning Readiness

Future architecture supports:

- Site-specific learning
- Global aggregate learning
- Shared improvements

Current restriction:

```text
personal_data_shared = false
cross_site_learning_allowed = false
```

Any future cross-site learning must be privacy-reviewed and aggregate-only.

## Future Model Readiness

Prepared model catalog:

- YOLO
- OpenCV
- TensorFlow
- Gemini Vision
- GPT Vision
- Custom models

These are architecture-only in this phase. They are not activated by migrations or UI.

## Production Activation Requirements

Before real pilot production:

- At least one calibrated site profile
- Enough reviewed events to trust metrics
- False positive rate within accepted range
- False negative rate within accepted range
- Confidence stability proven over time
- Replay workflow tested
- Human review staffing defined
- Audit logs verified
- Privacy review completed
- Parent/staff/child profiling explicitly prevented
- No autonomous decisions enabled

## Admin Screens

Calibration Center:

```text
/dashboard/admin/observer-calibration
```

Shows:

- Readiness score
- Maturity score
- Confidence stability
- Reviewed events
- Calibration status
- Training status
- Future model readiness

Replay Center:

```text
/dashboard/admin/observer-replay
```

Shows:

- AI events
- Audio events
- Correlated events
- Observer summaries
- Replay logs
- Ground truth review actions

