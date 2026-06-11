# Camera And Digital Observer Infrastructure

PHASE 128 turns the existing Gan Batuach camera stack into one infrastructure platform. It extends the current `camera_streams`, playback session, gateway, health and observer models. It does not introduce a duplicate camera model.

## Camera Architecture

Primary camera records remain in `camera_streams`.

The model now supports:

- garden cameras
- DVR/NVR sources
- RTSP direct sources
- ONVIF cameras
- IP cameras
- manual external streams
- demo and home-test cameras
- zone/area assignment
- operating and viewing hours
- parent, staff and inspector visibility rules
- observer enablement and confidence threshold

Camera secrets stay server-side. RTSP URLs, camera usernames, passwords and gateway keys are not sent to the browser.

## Gateway Architecture

`camera_gateway_registry` tracks gateway readiness for:

- MediaMTX
- go2rtc
- custom gateway
- future WebRTC gateway
- RTSP-to-HLS gateway
- RTSP-to-WebRTC gateway

Tracked fields include:

- provider
- base URL reference
- deployment scope
- health status
- last heartbeat
- active streams
- failed streams
- garden-specific or shared mode

The registry stores configuration readiness only. It does not store real gateway secrets.

## Streaming Token Model

Playback goes through `/api/camera-streams/[id]/playback-token`.

Rules:

- short-lived token
- camera permission check
- garden permission check
- parent-child/kindergarten relationship check for parents
- staff viewing must be explicitly enabled
- inspector access requires assigned garden and access reason
- viewing hours are enforced
- token creation is audited

Every view is written to playback/audit logs.

## Parent Access Model

Parents see only:

- cameras in their child’s garden
- cameras explicitly opened for parent viewing
- cameras with valid availability
- safe status and blocked reason

Parent blocked messages include:

- הגן לא פתח צפייה להורים
- המצלמה לא זמינה כרגע
- מחוץ לשעות הצפייה
- נדרשת הרשאה מהגן

Parents do not see RTSP, gateway identifiers, camera credentials or raw observer events.

## Manager Setup Model

Managers can configure:

- camera type
- camera name
- area/zone
- DVR/NVR/IP/RTSP/ONVIF details
- channel number
- gateway preference
- stream quality
- viewing hours
- parent visibility
- staff visibility
- inspector visibility
- observer binding

The setup flow explains DVR/NVR, IP address, channel number, RTSP, ONVIF and why a gateway is required.

## Inspector And Admin Access

Inspectors can view cameras only when:

- assigned to the garden
- camera policy allows inspector viewing
- an access reason is provided
- the access is logged

Admins can monitor:

- all cameras
- all gateways
- failed streams
- pending setup
- parent exposure
- observer queue
- audit events

## Observer Binding Model

Observer settings live on each camera:

- observer enabled
- zone mapping
- safety indicator categories
- confidence threshold
- review-required mode
- parent visibility disabled by default

`observer_processing_queue` stores camera signals for human review.

Lifecycle:

detected -> pending_review -> dismissed / confirmed / needs_followup -> task or inspection request -> closed

No automatic conclusions are made.

## Parent-Safe Summaries

`parent_safe_camera_summaries` stores reviewed summaries only.

Rules:

- no raw AI claims before review
- no child profiling
- no biometric identity claims
- no panic language
- summary must be approved
- visible only to the relevant parent when linked to a child

## Privacy Restrictions

The platform enforces:

- parent viewing only when explicitly enabled
- no access to other gardens
- no access to other parents’ children
- no unrestricted replay
- no raw AI exposure
- every view logged
- credentials and RTSP server-only

## Remaining Production Gaps

- Connect real MediaMTX/go2rtc health polling to `camera_gateway_registry`.
- Add a scheduled camera health worker.
- Add real stream testing beyond gateway placeholder mode.
- Add manager UI for editing visibility after creation.
- Add production signing/verification for playback tokens at the gateway edge.
- Add observer review action buttons connected to `observer_processing_queue`.
