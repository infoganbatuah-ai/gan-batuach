# PILOT BLOCKER QA 1 - Camera / AI Exposure QA

Date: 2026-07-12

Reviewed: `PILOT_BLOCKER_FIX_1_CAMERA_AI_EXPOSURE_CLOSURE_REVIEW.md`

## Camera QA

| Requirement | Status | QA decision |
|---|---|---|
| Parent camera viewing disabled | documented / must remain disabled | REDUCED_NOT_CLOSED |
| No RTSP exposed | requires deployed env verification | MANUAL_REQUIRED |
| No credentials exposed | requires deployed env verification | MANUAL_REQUIRED |
| Token/audit required before live viewing | documented | PASS_FOR_LOCKDOWN |
| Camera legal notice exists | yes, draft | EXTERNAL_REVIEW_REQUIRED |

## AI QA

| Requirement | Status | QA decision |
|---|---|---|
| Raw AI blocked from parents | documented / requires A/B verification | MANUAL_REQUIRED |
| Human review required | documented | PASS_FOR_SHADOW_ONLY |
| No automatic accusations | documented | PASS_FOR_SHADOW_ONLY |
| No face recognition/audio in Gan Batuach Israel Mode | documented / requires deployed config verification | MANUAL_REQUIRED |
| AI notice exists | yes, draft | EXTERNAL_REVIEW_REQUIRED |
| AI parent summary disabled unless approved | documented | PASS_FOR_LOCKDOWN |

## QA Decision

Camera status: **camera_readiness_only / parent_view_blocked**.

AI status: **AI_SHADOW_SYNTHETIC_ONLY**.

No new critical exposure was proven, but real camera/AI use remains blocked until manual/legal/security evidence exists.
