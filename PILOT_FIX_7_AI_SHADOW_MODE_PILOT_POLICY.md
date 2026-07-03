# PILOT FIX 7 - AI Shadow Mode Pilot Policy

Date: 2026-07-04

## Decision

Gan Batuach AI remains disabled/readiness/shadow-only by default for any pilot preparation. It is not approved for production AI, raw parent alerts, automatic accusations, automatic safety decisions, face recognition, audio analytics, biometric identification, or real-child processing without RLS, legal, camera/frame-source, retention, audit, and human-review signoff.

Recommended first pilot mode: `ai_readiness_only`, with optional `ai_shadow_mode_with_synthetic_data` for internal validation.

## Allowed Pilot Modes

- `ai_disabled`: default safe state.
- `ai_readiness_only`: UI and operational readiness only.
- `ai_mock_only`: synthetic/mock events only.
- `ai_shadow_mode_with_synthetic_data`: internal candidate events with no real child data.
- `ai_shadow_mode_with_real_camera_internal_only_after_signoff`: only after camera, RLS, legal, retention, and audit gates pass.
- `ai_shadow_mode_with_human_review_after_legal_rls_signoff`: candidate events remain internal and reviewed.
- `ai_parent_summary_locked`: parent summaries are disabled unless reviewed and approved.
- `ai_production_blocked`: production mode is not approved.

## Mandatory Rules

- Every AI candidate requires human review.
- Parents must not receive raw AI events, raw frames, confidence scores, or internal review queue data.
- AI outputs are candidates/signals only.
- AI cannot create automatic accusations, disciplinary outcomes, legal conclusions, or final safety decisions.
- Gan Batuach Israel Mode disables face recognition, audio analytics, biometric child profiles, persistent identity tracking, raw AI parent alerts, automatic decisions, and automatic accusations.
- Digital Observer capabilities remain product-scoped and must not leak into Gan Batuach defaults.
- False positives and false negatives must be trackable before real pilot learning.
- Retention and privacy decisions must be externally reviewed before real frame/evidence processing.

## Wording Policy

Allowed: suspected, candidate, possible signal, requires human review, internal review only.

Forbidden: abuse detected, violence detected, neglect detected, criminal event, automatic approval, system determined, certainty, proof.

