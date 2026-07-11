# PILOT BLOCKER FIX 1 - Camera / AI Exposure Closure Review

Date: 2026-07-12

## Camera Review

| Check | Status | Evidence / action |
|---|---|---|
| Parent camera viewing disabled | reduced / must remain disabled | PILOT FIX 6 keeps parent view blocked. |
| No RTSP exposed | manual_required for deployed env | Static prior audit found no approved exposure; verify real env/API responses. |
| No credentials exposed | manual_required for deployed env | Verify UI/API/admin diagnostics do not show credentials. |
| Token required before live viewing | required before any live view | Parent viewing blocked until tokenization proof. |
| Audit required before live viewing | required before any live view | Live viewing blocked until audit proof. |
| Camera legal notice exists | ready_for_review | `PILOT_FIX_3_CAMERA_NOTICE_DRAFT_HE.md`. |

Camera recommendation: **camera_readiness_only / no_parent_view**.

## AI Review

| Check | Status | Evidence / action |
|---|---|---|
| Raw AI blocked from parents | reduced / manual_required | PILOT FIX 7 policy blocks raw AI; verify with A/B tests. |
| Human review required | reduced / manual_required | Keep AI shadow/readiness only. |
| No automatic accusations | reduced | Policy and wording package prohibit certainty claims. |
| No face recognition/audio in Gan Batuach Israel Mode | reduced / manual_required | Verify flags/config in deployed env. |
| AI notice exists | ready_for_review | `PILOT_FIX_3_AI_DIGITAL_OBSERVER_NOTICE_DRAFT_HE.md`. |
| AI parent summary disabled unless approved | required | Keep disabled until RLS/legal/human review gates pass. |

AI recommendation: **AI_SHADOW_SYNTHETIC_ONLY**.

## Closure Rule

If camera or AI is included with real child data, real pilot remains blocked until RLS, legal, retention, audit and policy gates are complete.
