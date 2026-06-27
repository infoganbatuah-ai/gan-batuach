# STORE QA 1 - Apple Privacy Labels QA Report

Date: 2026-06-27

## Reviewed File

- `MOBILE_2_APPLE_PRIVACY_LABELS_DRAFT.md`

## QA Result

apple_privacy_labels_result = draft_acceptable_needs_legal_review

The draft is conservative and covers:

- Contact Info
- User Content
- Identifiers
- Usage Data
- Diagnostics
- Sensitive Info
- Financial Info
- Location
- Photos/Videos
- Children's Data

## Consistency Findings

- Child-related data is disclosed conservatively.
- Uploaded documents/photos/evidence are included under User Content and Photos/Videos.
- Payment/subscription data is marked provider-dependent rather than live.
- Location is conditional on GPS attendance/inspection enablement.
- Camera/video is conditional and not claimed as live.
- AI/review metadata is included conceptually under user/safety workflow content and requires legal review.

## Required Before Submission

- Confirm whether diagnostics are collected in production.
- Confirm whether analytics/usage tracking exists.
- Confirm whether location is enabled in the packaged app.
- Confirm whether push tokens are collected.
- Confirm payment provider data flows if payments go live.
- Finalize children-related disclosure with legal/privacy counsel.

Status:

- privacy_review_required
- not_ready_for_final_submission
