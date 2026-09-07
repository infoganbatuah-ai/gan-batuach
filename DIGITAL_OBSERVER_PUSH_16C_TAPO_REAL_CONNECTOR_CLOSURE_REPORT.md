# DIGITAL OBSERVER — PUSH 16C TAPO REAL CONNECTOR CLOSURE REPORT

## FINAL RESULT

`PASS`

PUSH 16C completed the required real Product chain:

`EXISTING HOME → DASHBOARD ADD CAMERA → TAPO C211 → SECURE CREDENTIAL FLOW → SOFTWARE_CONNECTOR → REAL RTSP FRAME → ONNX AI → REAL_CAMERA_AI EVENT → PRODUCTION BACKEND → PRODUCT UI`

No mock, synthetic media, uploaded file, manually created Event, manually created camera row, or second Home/Site was used.

## PRODUCTION / DASHBOARD BASELINE

- Existing Home/Site preserved: `cc1673b8-3eb0-4785-a12c-1fb88f425a41`.
- Existing Physical Gateway was not stopped, rebound, reconfigured, or used for the Tapo path.
- Physical Gateway baseline and final state: healthy, 10 active relays, 10 progressing relays, 0 stalled relays.
- The pre-existing unavailable DVR channels remained a known degraded condition; no new DVR regression was introduced.
- Product now reports 11 active cameras in the existing Home: the existing 10 sources plus the new Tapo camera.

## PRODUCT ADD CAMERA FLOW

The camera was added through the normal authorized Product flow:

`Existing Home → Cameras → Add Camera → IP Camera → TP-Link/Tapo → Software Connector → secure camera credentials → test → activation`

The user was not required to create a Site, enter a raw RTSP URL, edit a configuration file, know a device ID, or use developer tooling. The form was corrected to use the device's normal keyboard and expose ordinary username/password fields.

## SOFTWARE CONNECTOR IDENTITY

- Device ID: `db267b52-6282-4944-bcee-5d4857698fb0`.
- Device type: `SOFTWARE_CONNECTOR`.
- Connector transport: `software_connector`.
- Enrollment status: delivered.
- Health: `HEALTHY`.
- Reported camera count: 1.
- Reported streaming count: 1.
- Runtime version: `push16c`.
- The Connector has an independent installation identity, credentials, data directory, Journal ownership, stream namespace, heartbeat, and loopback port.
- The Physical Gateway identity and source ownership were not reused.

## SECURE CREDENTIAL FLOW

- Camera-account credentials were submitted only through the Digital Observer Product form.
- Credentials are represented by the canonical encrypted server/device-side secret reference.
- The browser does not receive stored username, password, embedded RTSP URL, or secret reference.
- Logs, QA output, Product output, and this report contain no camera password or reusable device credential.
- The user does not need to enter the credentials again for this activation.

## REAL CAMERA / PROTOCOL RESULT

- Physical device: TP-Link Tapo C211.
- Camera/source ID: `7465c0f2-ba57-4299-b22e-f20cedb91c23`.
- Connection method: `SOFTWARE_CONNECTOR`.
- Adapter: `rtsp_gateway`.
- Source mode: `live`.
- Source state: connected.
- Software Connector verification flag: true.
- Real RTSP stream: PASS.
- Fresh frame progression: PASS.
- ONVIF endpoint presence: verified at reachability/service level; full ONVIF event/runtime validation remains separate from the proven RTSP path.

No private LAN address or credential-bearing stream URI is retained in this report.

## MINIMUM RUNTIME FIXES

Three bounded runtime defects were proven and corrected without changing detector thresholds, camera ownership, Risk logic, or the Physical Gateway configuration:

1. The Software Connector can now use the already-installed verified ONNX worker through `VIDEO_GATEWAY_OBJECT_WORKER_PATH`, while retaining the package-local default.
2. Direct RTSP health reporting no longer dereferences a nonexistent relay stdin stream.
3. Evidence preparation retains the current segment plus the required three-second prebuffer rather than the full HLS playback history; the per-stream bound was raised to 16 MiB so a high-bitrate real camera can reach inference without unbounded media retention.

The third fix was required because the Tapo's bounded playback history was approximately 30.7 MiB while the prior evidence preparation attempted to copy the entire history into a 4 MiB stream budget. The new logic remains bounded and covered by a high-bitrate regression test.

## REAL LIVE FRAME

- Real physical Tapo frames were received through the separate Software Connector.
- The Product camera page rendered the live camera surface through the authorized adapter path.
- No replayed file, synthetic frame, uploaded image, or Physical Gateway relay was used.

## REAL AI

- Runtime: `onnxruntime-node`.
- Model: `ssd_mobilenet_v1_10`.
- Model readiness: ready.
- A diagnostic inference over the live Tapo frame detected a real person with confidence `0.903`.
- The canonical Journal subsequently sampled the real stream and produced the persisted Event automatically with confidence `0.941`.
- Detector confidence remains detection certainty only; it is not a Risk score.

## REAL EVENT / BACKEND

- Event ID: `341d384e-ba8f-42e5-9c74-64d98e57d07a`.
- Event type: `person_detected`.
- Observation provenance: `REAL_CAMERA_AI`.
- Confidence: `0.941`.
- Track ID: `97a45aae-d956-44fa-851a-add5f77d1be0`.
- Source anchor verified: true.
- Validated Event: true.
- Production persistence time: `2026-09-07T17:48:39.034Z` (`20:48` Asia/Jerusalem).
- Media status: `not_required` under the applicable policy.
- Journal after delivery: running; configured 1, enabled 1, attempted 1, sampled 1, unavailable 0, pending outbox 0, delivery failures 0.

The Event reached the normal authenticated device endpoint and Supabase-backed canonical Event contract. No direct database insert was used.

## PRODUCT UI

Authorized Product verification passed on the Tapo camera page:

- Existing Home shows `11 מצלמות פעילות`.
- Camera is shown as connected.
- Connection details state `RTSP דרך חיבור מחבר תוכנה` with adapter `rtsp_gateway`.
- Recent Events displays `זוהה אדם` at `20:48` for Event `341d384e-ba8f-42e5-9c74-64d98e57d07a`.
- The camera context panel also identifies the same latest person event and timestamp.
- The Product uses truthful privacy language and does not claim an identity for the detected person.

The separate alert-detail route returned a generic load error during this verification. This does not invalidate camera-page Event visibility or backend persistence, but it remains a bounded Product follow-up outside the Connector acceptance chain.

## CONNECTOR PROVENANCE

Production records preserve the required provenance chain:

`Tapo C211 physical source → camera/source 7465c0f2-ba57-4299-b22e-f20cedb91c23 → SOFTWARE_CONNECTOR db267b52-6282-4944-bcee-5d4857698fb0 → rtsp_gateway → ONNX model → REAL_CAMERA_AI Event 341d384e-ba8f-42e5-9c74-64d98e57d07a`

This chain is distinct from the existing Physical Gateway path.

## EXISTING GATEWAY REGRESSION

- Physical Gateway health: healthy.
- Active relays: 10.
- Progressing relays: 10.
- Stalled relays: 0.
- Device authentication: ready.
- Object detection: ready.
- Source ownership collision: none.
- Session-token collision: none observed.
- Existing Gateway restart or rebind: none.

## QA / BUILD RESULT

- Typecheck: PASS.
- Production build: PASS, exit status 0.
- Object inference QA: PASS.
- Camera connection QA: 15/15 PASS.
- Camera onboarding QA: 7/7 PASS.
- Software Connector QA: 17/17 PASS in an environment permitted to bind the isolated loopback test port.
- High-bitrate evidence-window regression: PASS.
- Existing event delivery: pending 0, delivery failures 0.

The build emitted only the existing Sentry v11 import deprecation warning; compilation, TypeScript validation, static generation, and security cleanup completed successfully.

## BOUNDED FOLLOW-UP

The optional cloud-learning refresh still receives HTTP 401 because that endpoint uses the legacy Gateway-signature contract while this Connector presents its scoped device token. This did not block authenticated configuration refresh, heartbeat, stream processing, Journal sampling, Event delivery, Production persistence, or Product visibility. It should be unified with the Software Connector device-auth contract in PUSH 17; it is not part of the required PUSH 16C camera-to-Event chain.

## PUSH 16 FINAL STATUS

PASS

ARE WE READY FOR PUSH 17?

YES
