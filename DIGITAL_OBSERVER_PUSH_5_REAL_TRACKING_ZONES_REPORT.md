# DIGITAL OBSERVER — PUSH 5: REAL TRACKING + ZONES VERIFICATION

## FINAL STATUS

**FAIL — ZONE ENTRY/EXIT**

The existing system automatically produced and persisted one real `person_entered`
event for channel 11 after the single-Journal ownership correction.  A real
`person_exited` event could not be reproduced: the controlled return passes did
not provide the three consecutive qualifying observations on each side of the
line required by the existing directional contract.  No threshold or tracking
semantics were weakened to turn this into a pass.

## CURRENT TRACKING ARCHITECTURE

The existing `JournalTracker` in `services/video-gateway/journal-tracker.mjs`
owns single-camera tracking.  It associates real person detections by normalized
box-centroid distance (< 0.22), rejects ambiguous associations, retains a track
for up to 60 seconds, and assigns a UUID Track ID.  It requires two observations
for generic `person_detected`, and three stable observations per side for a
directional line transition.  Frame disappearance is explicitly not treated as
an exit.

Tracking is local to a camera; it does not perform cross-camera Re-ID.

## ZONE CONFIGURATION

Channel 11 (`e9f8abf3-5895-494e-b1cf-ea8818602851`) has no polygon zone record.
Its supported spatial mechanism is a configured, normalized crossing line:

```text
Pilot label: ENTRANCE_CORRIDOR_CENTER
Stream: dvr_84e4cdf200faab18d9_11
Axis: y
Position: 0.50
Inside side: positive
Supported events: person_detected, person_entered, person_exited
```

This is a corridor line-crossing pilot, not a physical-door mapping.  In
particular, it does not assert which of the two visible doors is the user's
home door.

## COORDINATE MAPPING

Temporary local-only diagnostics confirmed that natural motion in the channel
11 corridor is vertical in the decoded frame.  The initial horizontal (`x`)
line was therefore corrected to `y = 0.50`.  The Gateway manifest subsequently
returned that exact line and the enabled directional event types.  No diagnostic
image was retained.

## REAL PERSON TRACK

The successful pass created:

| Item | Value |
| --- | --- |
| Real source | Channel 11 / `dvr_84e4cdf200faab18d9_11` |
| Person presence event | `e397cc85-fb49-4d6f-80c8-a3922fc92e2b` |
| Entry event | `47c57dca-0472-4426-bc30-88a0fa2d9437` |
| Entry time | 2026-09-05 18:53:02.912 UTC |
| Track ID | `1b6a0f42-01d4-4c17-96e6-b981be305347` |
| Event type | `person_entered` |
| Stream attribution | Correct channel-11 stream |
| Model | `ssd_mobilenet_v1_10` |
| Origin | Real Gateway/ONNX/Journal; no mock or manual event |

The same Track ID was present on the preceding real `person_detected` event and
the automatically created entry event.

## TRACK STABILITY

Track continuity was demonstrated across the qualifying entry observation and
its preceding person-presence observation.  It was not demonstrated through a
full entry-and-return cycle: later controlled passes produced too few qualifying
detections for the tracker to retain and confirm a directional state change.

## ZONE ENTRY

**PASS (real, automatic).**  The line crossing generated one `person_entered`
event, delivered through the normal Journal/outbox/backend path.  After the
single-owner correction, this controlled pass produced one entry rather than
duplicate competing entries.

## DWELL/PRESENCE

**NOT APPLICABLE.**  The present spatial implementation has a crossing line and
person presence, but no polygon occupancy/dwell engine.  A person standing near
the line does not create repeated entry events.

## ZONE EXIT

**FAIL TO VERIFY.**  The current implementation supports `person_exited`, but
no real exit event was produced.  The controlled return windows either suffered
an intentional diagnostic-resource contention (discarded as invalid) or did
not yield the three stable, qualifying detector observations required for a
same-track reverse crossing.  This report does not infer an exit from frame
disappearance.

## LINE CROSSING

The positive-direction line crossing was verified by the real `person_entered`
event above.  Reverse-direction crossing remains unverified.

## SPATIAL EVENT

**PARTIAL PASS.**  The normalized real `person_entered` event was created
automatically, validated and delivered with correct site/camera/stream/track
binding.  Its evidence kind was `line_crossing`; provenance was the canonical
real camera AI path.  A reverse `person_exited` event is the outstanding gap.

## DATABASE RESULT

**PASS for entry.**  The persisted `observer_intelligence_signals` row is scoped
to site `cc1673b8-3eb0-4785-a12c-1fb88f425a41`, channel-11 source and stream,
and includes the generated Track ID and model metadata.  The Gateway outbox was
subsequently empty with zero delivery failures.

## PRODUCT UI RESULT

**NOT VERIFIED IN THIS PUSH.**  The authorized Chrome session remained open,
but the available browser-automation surface timed out twice before it could
read the authenticated UI.  This is an automation limitation, not evidence of
a UI failure.  Direct backend persistence is not counted as UI proof.

## DEDUPE RESULT

**PASS.**  Investigation found multiple Journal owners as the source of earlier
duplicate spatial events.  A durable owner lock now permits one active Journal
runner, recovers safely from stale locks, and releases on shutdown.  The
post-correction real entry produced one entry event.  `check-journal-owner-lock`
passes.

## OCCLUSION RESULT

**NOT TESTED.**  No deliberate occlusion was introduced after the entry test;
the current failed return windows are detector-observation insufficiency, not a
validated occlusion tolerance result.

## MULTIPLE-PERSON RESULT

**NOT TESTED.**  This is non-blocking for the single-person pilot verification.

## TRACKING METRICS

| Metric | Result |
| --- | --- |
| Confirmed entry events in clean post-lock pass | 1 |
| Confirmed exit events | 0 |
| Duplicate entry events in clean pass | 0 |
| Same-track presence → entry linkage | Yes |
| Directional sample requirement | 3 stable observations per side |
| Track retention bound | 60 seconds |

## RULE ENGINE COMPATIBILITY

The normalized `person_entered` event uses the existing event contract and is
eligible for structured rule consumption.  No camera-specific observer rule was
configured for channel 11, so no new rule or alert was created in this PUSH.

## SECURITY/TENANT BOUNDARY

The Journal validates camera/source/stream/source-anchor binding before event
creation.  Backend ingestion validates device, site, Gateway and camera stream
ownership.  The real bridge QA covers wrong source binding, stale anchors,
dedupe and mock/local-shadow rejection.  Track state is per camera.

## TEST MATRIX

| Test | Result |
| --- | --- |
| Journal owner lock | PASS |
| Event Journal QA | PASS |
| Event outbox QA | PASS |
| Event ingest QA | PASS |
| Tracker configuration QA | PASS |
| Temporal coverage QA | PASS (diagnostic scope) |
| Real detection → event bridge QA | PASS |
| Product Observer real-source / mock isolation QA | PASS |
| Shared DVR-session safety QA | PASS |
| Typecheck | PASS |
| Focused lint for PUSH 5 files | PASS |
| Real line entry | PASS |
| Real line exit | FAIL TO VERIFY |
| Authorized UI spatial-event proof | NOT VERIFIED (automation unavailable) |

## PUSH 6 READINESS

**ARE WE READY FOR PUSH 6 — UNIFIED EVENT → INCIDENT ARCHITECTURE? NO.**

Before advancing, complete a repeatable real reverse crossing that produces
`person_exited` from the same track and verify the resulting spatial event in
the authorized product UI.  The tracking/zone contract should not be relaxed to
obtain that proof.
