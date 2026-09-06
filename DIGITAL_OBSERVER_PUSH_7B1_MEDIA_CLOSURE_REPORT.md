# DIGITAL OBSERVER — PUSH 7B.1

## FINAL STATUS

**PASS**

## REAL ENTRY EVENT

| Field | Result |
| --- | --- |
| Real event | `person_entered` |
| Signal ID | `e1e5c435-a94a-4660-98aa-dc63c94fde6e` |
| Event/source ID | `a41fe45e-0a51-4a51-a6b2-56f9c041f1e7` |
| Camera/source | `e9f8abf3-5895-494e-b1cf-ea8818602851` — Entrance, DVR channel 11 |
| Site | `cc1673b8-3eb0-4785-a12c-1fb88f425a41` |
| Stream | `dvr_84e4cdf200faab18d9_11` |
| Timestamp | `2026-09-05T22:16:35.687Z` |
| Confidence | `0.929` |
| Provenance | `REAL_CAMERA_AI` |

This was a fresh physical person pass. No mock, seeded event, manual database write, or uploaded test video was used.

## TRACK CONTINUITY

The real `person_detected` observation at `2026-09-05T22:16:12.021Z` and the entry event share Track ID `0e2fcb9e-9c68-4879-a701-e3b7e9c29e5f`. The high-cadence, one-camera diagnostic run provided the three unique directional observations required by the existing entry contract. No confirmation threshold was changed.

## EVIDENCE AUTHORIZATION

**PASS.** The validated critical line crossing was recording-eligible (`recording_required=true`). The Gateway held a bound source-anchor lease and captured the configured bounded window. The ordinary real `person_detected` from the same pass remained `recording_required=false`, `media_status=not_required`.

## LOCAL CLIP

**PASS.** The Gateway captured a valid local MP4 and thumbnail from the real relay before upload. The persisted clip duration is 10 seconds, with the UI showing a 3-second pre-event and 6-second post-event evidence timeline. No raw camera URL or credential was stored or displayed.

## REAL UPLOAD TRACE

`REAL person_entered → recording grant → anchored local capture → authenticated multipart Gateway request → Production cloud-media route → private Storage → clip metadata → authorized UI player`

The gateway’s durable outbox cleared after successful delivery. The media webhook has one processed row; only one Evidence clip row exists for this Event.

## ROOT CAUSE

The initial real upload was correctly suppressed by the Production media route because the Gateway sent `event_type=person_entered` but omitted its typed evidence provenance, `evidence_kind=line_crossing`.

Without that field, media-side validation treated the event as a passive person observation and correctly refused to record it. This was a request-contract gap, not a Storage, bucket, RLS, authorization, source-anchor, or hostname failure.

## CONTRACT DIFF

| Field | Before | After |
| --- | --- | --- |
| `event_type` | Sent | Sent |
| `evidence_kind` | Missing | Sent and schema-required |
| Directional validation | Downgraded to passive | Preserves authenticated `line_crossing` semantics |
| Recording decision | Suppressed | Eligible and persisted |

## FIX APPLIED

- `services/video-gateway/journal-loop.mjs` now forwards the Event’s typed `evidence_kind` in the multipart metadata.
- `app/api/video-gateway/cloud-event-media/route.ts` requires and passes that typed provenance into the existing validation pipeline.
- Focused ingest/media QA proves a real-style critical `person_entered` with `line_crossing` remains recording-eligible and stores exactly one clip plus thumbnail.

The change preserves the existing source/site/camera/stream, authenticated-device, replay, recording-policy and private-bucket controls.

## STORAGE OBJECT

| Field | Result |
| --- | --- |
| Evidence clip ID | `ac44a8a3-e185-49a8-87e0-b6a3022779e0` |
| Bucket | `digital-observer-event-media` (private) |
| Object exists | Yes |
| Type | `video/mp4` |
| Size | 1,845,138 bytes |
| Duration | 10 seconds |
| Created | `2026-09-05T22:16:48.650224Z` |
| Expiry | `2026-09-07T22:16:35.687Z` |

The private object reference/path is intentionally omitted.

## DB METADATA

**PASS.** The Evidence row points to the real Event signal, correct site, camera/source and private storage object. `clip_status=available` and `media_status=available`; `media_missing_reason` is null.

## RETRY/IDEMPOTENCY

**PASS.** The cloud media webhook recorded one processed row and the Event has exactly one Evidence row. Delivery retries caused by the separate notification workflow did not re-capture or duplicate media. The outbox subsequently cleared.

## SIGNED ACCESS

**PASS.** The authorized product route produced usable media access in the Production UI. An unauthenticated request to the same clip endpoint was denied with HTTP 401. Tenant-scoped authorization and a signed-URL maximum of 60 seconds remain covered by the focused media QA.

## PRODUCTION PLAYBACK

**PASS.** In the authorized Production Chrome session, the event page showed:

- `אדם נכנס` / critical real event;
- Entrance camera, channel 11;
- 93% confidence;
- the evidence timeline; and
- an active browser media player.

The player loaded from the Production event page without a localhost URL, private-host dependency, CORS/CSP error, or credential exposure. The hostname/playback issue is therefore **Production Verified** for this real Evidence path.

## HOSTNAME/ORIGIN RESULT

**PASS.** The browser accessed the Production UI and its authenticated media route. The private storage URL was not exposed as a permanent public URL, and playback did not depend on `localhost` or `127.0.0.1`.

## NO-RECORDING REGRESSION

**PASS.** A real `person_detected` from the same track remained visible as an Event but had no media, as policy requires. The product did not display a broken player or create hidden media.

## FAILURE BEHAVIOR

**PASS (existing QA and preserved lifecycle).** Bounded media persistence failures return safe categories, never mark media available, and preserve the Event/Incident with a truthful media-fault state. The earlier real failed capture remains correctly marked missing; it was neither overwritten nor represented as playable.

## RETENTION

**PASS.** The real clip received the active 48-hour retention policy and expiry timestamp above. Existing authenticated retention QA verifies removal of private objects, `retention_expired` state, disabled download, and truthful UI behavior. The fresh real clip was deliberately retained and was not deleted for this verification.

## SECURITY/CROSS-CAMERA TESTS

**PASS.** Focused QA covers invalid media shape, missing validated Event, stale capture time, camera/stream binding, replay rejection, private bucket policy, tenant-scoped signed access, no-recording behavior, and no credential/RTSP disclosure. Gateway evidence capture continues to require its exact local source-anchor lease before a clip can be made.

## TEST MATRIX

| Test | Result |
| --- | --- |
| Fresh real stable-track `person_entered` | PASS |
| Evidence authorization and local capture | PASS |
| Real Storage persistence | PASS |
| DB Evidence metadata | PASS |
| Private object verification | PASS |
| Authorized Production playback | PASS |
| Unauthenticated media access | PASS — HTTP 401 |
| Event/media idempotency | PASS |
| No-recording real-event policy | PASS |
| `npm run qa:event-journal` | PASS |
| `node scripts/qa/check-event-evidence-compatibility.mjs` | PASS |
| `node scripts/qa/check-event-tracker-configuration.mjs` | PASS |
| `node scripts/qa/check-event-temporal-coverage.mjs` | PASS (diagnostic scope) |
| `npm run typecheck` | PASS |
| Focused lint on modified Evidence/Journal/QA files | PASS |

## PUSH 8 READINESS

**ARE WE READY FOR PUSH 8 — CONTEXT + BEHAVIORAL BASELINE HARDENING? YES.**

The real bounded-evidence pipeline is now Production Verified end-to-end. Storage remains Supabase-coupled; alternate-storage abstraction and broader cost analysis remain later work, not blockers for PUSH 8.
