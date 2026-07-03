# PILOT FIX 7 - AI Feature Flags / Kill Switches

## Desired Flags

- `enable_ai_observer`
- `enable_ai_shadow_mode`
- `enable_ai_test_inference`
- `enable_ai_real_inference`
- `enable_ai_stream_inference`
- `enable_ai_review_queue`
- `enable_ai_parent_summary`
- `enable_ai_notifications`
- `enable_audio_analytics`
- `enable_face_recognition`
- `enable_digital_observer_ai_live`

## Safe Defaults

- AI observer disabled/readiness unless explicitly enabled.
- Shadow mode allowed only for synthetic/internal validation unless signoff exists.
- Parent summary disabled.
- Parent AI notifications disabled.
- Audio analytics disabled.
- Face recognition disabled.
- Real inference disabled until provider/frame source is validated.
- Digital Observer live AI separated from Gan Batuach.

## Current Status

Environment provider mode defaults to mock/readiness behavior. Formal feature flag persistence and admin kill-switch verification remain required before real AI pilot.

Blocker: `feature_flag_required` for real AI pilot.

