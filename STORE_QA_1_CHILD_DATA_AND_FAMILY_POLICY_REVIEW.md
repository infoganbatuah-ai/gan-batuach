# STORE QA 1 - Child Data And Family Policy Review

Date: 2026-06-27

## Result

child_data_policy_result = needs_legal_review

The app is adult-facing but processes child-related data. This distinction must be handled carefully in App Store and Google Play forms.

## Findings

- Users are adults: parents/guardians, managers, staff, inspectors, admins.
- The app is not positioned as child entertainment.
- Child profiles, documents, pickup permissions, medical/allergy notes, attendance, reports, and messages may be present.
- Screenshots and reviewer data must use synthetic children only.
- Public store copy must not imply guaranteed child safety.
- Camera/AI copy must remain cautious and policy-bound.

## Blockers Before Public Submission

- privacy policy must explicitly cover child-related data.
- account/data deletion path must be published.
- data retention policy must be reviewed.
- store target audience/family policy answers require legal review.
- screenshots must be checked for synthetic-only data.

Classification:

- acceptable_for_internal_demo = true
- needs legal review = true
- blocking_for_public_store_submission = true
