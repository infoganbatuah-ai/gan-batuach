# PILOT FIX 7 - False Positive / False Negative Tracking Validation

## Current Status

Tracking is model-ready but requires real-environment verification.

## Evidence

- `ai_camera_events` review flow supports `false_positive`, `valid_detection`, and `needs_more_data`.
- `observer_ground_truth_reviews` migration supports `false_positive`, `false_negative`, and `missed_detection`.
- Calibration tables include false positive and false negative counts/rates.
- Admin observer pilot and calibration dashboards surface FP/FN statistics.

## Required Before Real AI Pilot

- Reviewer identity captured for all outcomes.
- Model version and event type retained.
- Reviewer note required for false positives/false negatives.
- Missed event intake process verified.
- Calibration review process owned by admin/operator.

Blocker level: medium for synthetic shadow validation; high before real AI pilot.

