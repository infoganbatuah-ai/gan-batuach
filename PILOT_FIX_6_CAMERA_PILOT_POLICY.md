# PILOT FIX 6 - Camera Pilot Policy

Date: 2026-07-03

## First Pilot Policy

Camera functionality is disabled or readiness-only unless explicitly enabled for a confirmed staging/pilot environment.

Recommended first pilot camera mode: **gateway_configured_no_parent_view**.

Fallback acceptable mode: **manager_internal_view_only**, only after gateway, token and audit checks pass and legal/policy signoff exists.

## Allowed Pilot Modes

| Mode | Meaning | Parent viewing |
|---|---|---|
| `camera_disabled` | camera module hidden or unavailable | disabled |
| `camera_readiness_only` | metadata/readiness only | disabled |
| `gateway_configured_no_parent_view` | gateway status can be tested internally | disabled |
| `manager_internal_view_only` | manager may request token for own kindergarten only after signoff | disabled |
| `inspector_policy_view_only` | inspector may view assigned garden only for approved purpose | disabled |
| `parent_view_locked` | parent camera screens show unavailable/locked state | disabled |
| `limited_parent_view_after_policy_signoff` | future state after every gate passes | conditional |

## Mandatory Rules

- Parent live viewing is disabled by default.
- Manager viewing is limited to own kindergarten.
- Inspector viewing is limited to assigned kindergarten and approved inspection/compliance purpose.
- Staff viewing is disabled unless explicitly authorized.
- Admin sees operational health without secrets.
- All live viewing must be tokenized.
- All live viewing must be audited.
- Browser/app must never receive RTSP, local IP credentials, camera usernames/passwords or gateway secrets.
- No hidden surveillance wording.
- No automatic parent access.
- No recording/playback claim unless implemented and approved.
- No real camera use before camera notice, consent/policy, RLS and environment gates pass.

## Current Recommendation

**CAMERA_GATEWAY_READY_NO_PARENT_VIEW / READINESS_ONLY**

Parent viewing remains locked.
