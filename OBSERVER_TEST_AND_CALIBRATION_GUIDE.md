# Observer Test And Calibration Guide

This platform is for testing the Digital Observer before production deployment.

Core rules:

- No autonomous decisions.
- No accusations.
- No disciplinary actions.
- Human review is mandatory.
- Shadow mode remains the default.

## Test Workflow

1. Create or select a test group: `home_test`, `kindergarten_test`, `business_test`, or `demo_environment`.
2. Connect test cameras separately from production kindergarten data.
3. Run observer jobs in shadow mode.
4. Collect AI, audio, and correlated events.
5. Review every recommendation manually.
6. Store ground-truth feedback.
7. Update readiness and calibration scores.

## Shadow Mode

In shadow mode:

- The observer analyzes events.
- The observer creates recommendations.
- No real action is triggered.
- No parent notification is sent.
- No disciplinary workflow starts.
- Human reviewers compare recommendations to real outcomes.

## Reviewer Workflow

Reviewers classify each event as:

- Correct detection.
- Missed detection.
- False positive.
- False negative.
- Uncertain.

The reviewer can also replay the event context. Replay is metadata-only unless a secure media gateway is configured; raw media should not be exposed.

## Calibration Workflow

Calibration is tracked per site or test group:

- Confidence threshold.
- Sensitivity.
- Noise tolerance.
- Motion tolerance.
- Audio sensitivity.

Calibration should improve after enough reviewed events are collected. A site should not move toward production until false-positive and false-negative rates are acceptable.

## Readiness Scoring

Readiness score is 0-100 and should consider:

- Reviewed event count.
- Calibration profile maturity.
- Confidence stability.
- False positive rate.
- False negative rate.
- Learning maturity.

Recommended production threshold:

- At least 100 reviewed events per site type.
- Stable calibration profile.
- Low false-positive rate.
- Low false-negative rate.
- Human reviewer approval.
- Gateway, camera, and playback audit logs confirmed.

## Future Model Readiness

Prepared model families:

- YOLO.
- OpenCV.
- TensorFlow.
- Gemini Vision.
- GPT Vision.
- Custom models.

These are readiness targets only. They are not production-active unless a separate activation checklist is completed.

## Production Activation Requirements

Before production:

- Keep shadow mode enabled during pilot.
- Confirm human review staffing.
- Confirm secure camera gateway.
- Confirm event replay is scoped and audited.
- Confirm no raw RTSP, passwords, or model secrets are exposed.
- Confirm parent-facing notifications are disabled until reviewed workflow is approved.
- Confirm legal, privacy, and operational policies.
- Document who can approve escalation from recommendation to action.
