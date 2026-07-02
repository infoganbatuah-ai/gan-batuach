# PILOT FIX 4 – Feature Flag / Pilot Access Configuration

Date: 2026-07-03

## Required Flags

| Flag | Safe pilot-prep default | Notes |
|---|---|---|
| `enable_parent_registration` | disabled or invite-only | enable only after legal/RLS signoff |
| `enable_parent_enrollment` | disabled or synthetic only | no real child flow before signoff |
| `enable_real_child_profiles` | disabled | critical gate |
| `enable_staff_registration` | enabled for synthetic/pilot staff only | manager approval required |
| `enable_inspector_registration` | enabled for synthetic/pilot inspector only | admin approval required |
| `enable_payments` | disabled/sandbox | no live charges |
| `enable_parent_tuition` | disabled | stream must remain separate |
| `enable_gan_batuach_subscription` | manual/sandbox | no fake live success |
| `enable_notifications` | in-app/mock/test | no production broadcast |
| `enable_camera_module` | readiness/internal only | no raw RTSP |
| `enable_parent_camera_view` | disabled | critical default |
| `enable_ai_observer` | disabled/shadow | human review only |
| `enable_ai_parent_summary` | disabled | no raw/unreviewed AI to parents |
| `enable_digital_observer_live` | disabled/readiness | separate product context |
| `enable_document_uploads` | disabled/restricted | storage policies must be verified |
| `enable_real_pilot_mode` | disabled | only after gates |

## Current Implementation Status

The repository has many provider and product mode environment variables, plus some database readiness structures. A single unified feature-flag system for pilot access was not confirmed in this phase.

## Required Implementation Before Real Pilot

- Decide whether flags live in env, database, or admin config.
- Make safe defaults disabled for high-risk features.
- Ensure server-side checks enforce flags, not only UI hiding.
- Log changes to flags.
- Add admin visibility for current environment and flag state.

## Minimal Rule For PILOT FIX 5

PILOT FIX 5 may proceed with synthetic data using documented/manual flags, but no real parent/child data should enter until a server-enforced flag model is confirmed.

