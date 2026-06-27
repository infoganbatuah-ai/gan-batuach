# QA 6 - Camera + AI Security, Accuracy & Shadow Mode Validation

Date: 2026-06-27

Status: completed with controlled readiness only.

Production/live status:

- real_camera_live: false
- real_ai_live: false
- real_stream_inference_connected: false
- parent_live_camera_enabled: false by default and still policy-gated
- AI mode: shadow/review readiness only

## Prerequisites

- `PROD_3_REAL_CAMERA_GATEWAY_LIVE_CONNECTION_REPORT.md`: present.
- `PROD_4_REAL_AI_OBSERVER_LIVE_PIPELINE_REPORT.md`: present.
- PROD 3 camera status reviewed: gateway-ready/readiness flow exists, no real camera gateway validation was completed.
- PROD 4 AI status reviewed: event model and shadow workflow exist, no real frame source or real inference flow was connected.
- Build baseline before QA was clean according to PROD 4 report.

## Camera Security Result

Result: pass with remaining real-gateway blockers.

Verified:

- Browser-facing playback must go through `/api/camera-streams/[id]/playback-token`.
- Playback token TTL is bounded to 60-300 seconds.
- Parent playback requires WebRTC, active parent policy, legal/consent readiness, MFA gate, child-to-kindergarten relationship, child checked in, viewing window, and room matching where configured.
- Manager/owner/staff playback is scoped to the user's garden.
- Inspector playback is scoped to assigned kindergartens and requires an access reason where policy requires it.
- Playback token creation writes session/audit records.
- RTSP URLs and private network hosts are rejected before returning a browser playback URL.
- Parent camera list sanitization returns only safe camera summary fields and `playback_source_available`, not raw playback URLs.

Fixes made:

- Sanitized the playback session object returned by `createCameraPlaybackSession` so raw session fields such as token hashes or stored playback URL are not returned.
- Added `sanitizeCameraForPlaybackCard` and used it for staff and inspector camera playback cards, preventing direct playback URLs or gateway identifiers from being serialized into client props.
- Updated parent camera copy to avoid implying always-on live viewing.

Remaining blockers:

- Real camera gateway and real camera stream were not tested.
- Secure credential storage for real RTSP credentials remains an external/gateway setup dependency.
- Parent viewing must remain disabled until real gateway, policy, consent/legal readiness, token audit, and live-denial tests are completed.

## AI / Shadow Mode Result

Result: pass for shadow/readiness, not live AI.

Verified:

- `/api/ai/observe` requires the AI observer secret.
- Gan Batuach Israel Mode blocks restricted event types for `violence_detection` and `cry_detection` in the observer ingestion path.
- Capability policy disables audio recording/analytics, speech recognition, distress sound detection, face recognition, biometric child profile, raw AI parent visibility, automatic accusations, and automatic disciplinary actions for Gan Batuach.
- AI observer event creation tags events as `shadow_mode`, `review_required`, `parent_visible: false`, `no_audio_analysis`, `no_face_recognition`, and `automatic_accusation: false`.
- Human review actions support review, confirm, dismiss, false positive, valid detection, and needs more data.
- Reviewed events are scoped for manager/owner by own garden and inspector by assigned garden.
- Digital Observer and Gan Batuach remain separate product contexts in the existing guardrail/reporting files.

Fixes made:

- Parent AI events page no longer uses the admin client.
- Parent AI events page now uses user-scoped Supabase only and shows only events with explicit `metadata.parent_visible`, `metadata.parent_approved`, non-empty `metadata.parent_summary`, and a reviewed/approved status.
- Parent AI events page no longer renders raw event type, confidence, camera area, screenshot URL, or internal notes.
- AI review UI wording was softened from accusatory category language to human-review candidate language.

Remaining blockers:

- No real frame source was connected.
- No real inference provider/test endpoint was validated.
- False negative tracking exists as readiness/reporting only; it was not validated against real inference data.
- Retention policy for any future raw frame storage still requires legal/privacy review before real child footage is processed.

## Parent Boundary Result

Result: fixed and pass for current readiness mode.

Parents can see:

- Sanitized camera availability states only.
- A tokenized playback action only when all policy checks pass.
- Human-approved AI summaries only after explicit parent approval metadata.

Parents cannot see:

- Raw AI events.
- Raw confidence values.
- Internal investigation notes.
- Raw camera playback URLs in camera lists.
- Camera gateway secrets, RTSP URLs, or local camera credentials.

## Role Access Result

Parent:

- Camera playback is blocked unless policy, child presence, MFA and camera scope all pass.
- AI is limited to approved summaries only.

Manager/owner:

- Camera access is scoped to own kindergarten.
- AI event review is scoped to own kindergarten.

Staff:

- Candidate/unassigned staff see no camera access.
- Assigned staff camera playback props are now sanitized before client rendering.

Inspector:

- Camera access is scoped to assigned kindergartens and policy.
- AI event actions are scoped to assigned kindergartens.
- Inspector playback props are now sanitized before client rendering.

Admin:

- Admin can see operational readiness/status, but UI must not expose secrets.

## Digital Observer Separation

Result: pass for current code-level readiness.

- Product separation remains documented by PROD 4.
- Gan Batuach Israel Mode restrictions remain separate from broader Digital Observer readiness.
- No change was made that mixes Digital Observer site events with kindergarten camera events.

## Accuracy Readiness

Result: partial / not production-ready.

Ready:

- Human review queue workflow.
- False-positive marking.
- Review outcomes and audit readiness.
- Shadow-mode metadata.

Not ready:

- Real model calibration.
- Real false-negative measurement.
- Live accuracy metrics.
- Real frame-source validation.
- External legal review for any child footage retention or parent-safe summaries.

## Security Scan Notes

Searches did not find committed secret values. Matches were expected server-side environment variable names, gateway helper references, admin setup fields, and RTSP construction templates used server-side for gateway registration/testing.

Known sensitive setup surfaces:

- Camera setup accepts RTSP/username/password input from authorized manager/admin flows.
- The API removes raw password and manual RTSP from the public payload path and stores password fields encrypted where configured.
- Real production use still requires a secure gateway and secret-management review.

## Files Changed

- `app/dashboard/parent/ai-events/page.tsx`
- `app/dashboard/parent/cameras/page.tsx`
- `app/dashboard/staff/cameras/page.tsx`
- `app/dashboard/inspector/cameras/page.tsx`
- `components/ai-camera-events-review.tsx`
- `lib/domain/camera-diagnostics.ts`
- `lib/domain/video-streaming.ts`
- `QA_6_CAMERA_AI_SECURITY_ACCURACY_SHADOW_MODE_VALIDATION_REPORT.md`

## Final Verification

- `npm run typecheck`: passed.
- `npm run build`: passed. Next.js compiled successfully and generated 437 static pages.
- `git diff --check`: passed before report creation; should be rerun after this report.
- Dedicated camera/AI automated tests: not found in package scripts. Existing scripts include build/typecheck and seed utilities only.

## Findings

fixed:

- Parent AI route used admin client and exposed raw AI-style fields. Reworked to user-scoped, approved-summary-only rendering.
- Playback session response returned raw session object. Reworked to return a sanitized session summary.
- Staff/inspector playback cards could receive direct playback URLs as client props. Reworked to pass sanitized playback-card summaries.
- Parent camera page implied live viewing too broadly. Copy now states viewing is conditional.
- AI review category wording included accusatory language. Reworded to candidate/review language.

blocking:

- Real camera gateway/camera not connected or validated.
- Real AI frame source and inference not connected or validated.

high:

- Parent live viewing must remain disabled until real gateway, legal/consent readiness, child-presence tests and token audit tests are completed.
- Any raw frame storage/retention requires legal/privacy approval before real pilot usage.

medium:

- No dedicated automated camera/AI security regression tests are present.
- False-negative tracking remains readiness-only without real model data.

provider_required:

- Camera gateway provider and test camera.
- AI inference provider or local inference service.

manual_visual_review_required:

- Final role-specific camera/AI screens should be visually checked after provider setup.

## Recommendation

Do not enable parent camera viewing or live AI for real users yet.

The system is safe to continue only as:

- camera gateway readiness / no real camera live
- AI shadow/event-model readiness / no real inference live
- internal review and admin/manager readiness validation

Proceed to the next phase only if it keeps camera and AI in controlled test/shadow mode, or after real gateway/inference credentials and legal/security gates are available.
