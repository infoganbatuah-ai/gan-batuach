# DIGITAL OBSERVER — PUSH 7

## FINAL STATUS

**FAIL — MEDIA PERSISTENCE**

The real-camera path through a recording-eligible `person_entered` Event is proven. A real clip has not yet persisted to private storage, so authorized production playback cannot be claimed.

## CURRENT EVIDENCE ARCHITECTURE

`Validated real Event → bounded recording grant → source-anchor lease → 3 s pre / 5 s post HLS window → local MP4 + thumbnail → authenticated cloud-media upload → private Supabase Storage → event-clip record → signed access → Incident/UI`.

## CANONICAL EVIDENCE CONTRACT

Evidence is bound to its Event, site, Gateway, camera, stream, relay generation, HLS sequence/discontinuity, observed time, and segment SHA-256. Incidents reference Event evidence rather than copying media.

## TEST POLICY

Channel 11's verified `person_entered` line crossing is recording-eligible. `person_detected` and `person_exited` stay no-recording events. Capture target: 3 seconds before and 5 seconds after, bounded to a 30-second clip.

## REAL EVENT / INCIDENT

- Signal ID: `4259cfe1-8380-446c-8bef-1f953d575d74`
- Type: `person_entered`
- Camera/source: `e9f8abf3-5895-494e-b1cf-ea8818602851` (DVR channel 11)
- Stream: `dvr_84e4cdf200faab18d9_11`
- Track: `a8b3294c-c65b-4486-b8c3-85b36c0141bf`
- Timestamp: `2026-09-05T21:08:03.637Z`
- Confidence: `0.820`
- Provenance: `REAL_CAMERA_AI`
- Recording required: `true`
- Result: persisted Event; media truthfully marked missing after capture/upload failure.

No mock, synthetic frame, uploaded video, or manually inserted Event was used.

## SOURCE ANCHOR

PASS for contract/QA. The Gateway validates exact site, Gateway, camera, stream, relay generation, source sequence, time and segment hash. Wrong-camera, wrong-stream, stale, future, and mismatched-anchor cases are rejected.

## PRE / EVENT / POST WINDOW

The initial real test exposed `postbuffer_gap`: five HLS segments were insufficient for the 3 s + 5 s policy window. The bounded list was increased to 12 one-second segments. A later real entry reached cloud-media upload, proving that specific window gap was repaired. A final successful clip is still pending.

## CROSS-CAMERA SAFETY

PASS by automated coverage and code review. Cloud ingestion verifies enrolled Gateway, site, camera-to-stream binding, validated Event identity, source anchor and replay nonce before media storage.

## MEDIA PERSISTENCE

FAIL. The latest real recording-eligible Event reached local capture and attempted cloud-media delivery but did not create a `digital_observer_event_clips` record or private storage object. The Event remained intact and reports `media_status=missing`.

## SIGNED ACCESS

Contract PASS: authenticated tenant-scoped access and a 60-second signed URL cap. End-to-end real signed access is **not verified** because no fresh clip persisted.

## PRODUCTION PLAYBACK

NOT VERIFIED. The hostname/playback issue remains open until a real stored clip can be opened by an authorized production user.

## NO-RECORDING POLICY

PASS. Real `person_detected` Events persisted as `recording_required=false` and `media_status=not_required`; no media was created contrary to policy.

## STORAGE ABSTRACTION

**PARTIAL / SUPABASE COUPLED.** Event and anchor contracts are provider-neutral; upload, signing and deletion currently call Supabase Storage directly.

## RETENTION / DELETION

Contract PASS. The authenticated retention job deletes clip and thumbnail objects, marks media expired, disables download and retains `retention_expired`. No real pilot evidence was deleted for this test.

## FAILURE BEHAVIOR

PASS. A capture/persistence failure does not delete or corrupt the Event/Incident. It opens a truthful media fault and never claims a playable clip.

## INTEGRITY

PASS by implementation/QA. Clip and thumbnail SHA-256 values are calculated before persistence; source-anchor and validated Event binding prevent cross-Event substitution.

## INCIDENT UI

The canonical Event/Incident path remains available. Successful evidence rendering is not verified because no fresh clip exists.

## MEDIA COST OBSERVATION

Policy cap: 30-second MP4, 8 MiB maximum clip, 512 KiB thumbnail, with a 3 s/5 s capture window. Actual stored-media size and upload latency remain unavailable.

## PRIVACY / SECURITY

PASS for inspected controls: private bucket, no raw camera URL or credential in browser/cloud-media payloads, device authentication, tenant/site checks, short-lived signed access, bounded RAM leases and temporary capture workspace deletion.

## TEST MATRIX

| Test | Result | Evidence |
|---|---|---|
| Event-media QA | PASS | `node scripts/qa/check-digital-observer-event-media.mjs` |
| Journal / ingest / outbox / inference QA | PASS | `npm run qa:event-journal` |
| Real `person_detected` | PASS | Fresh production signals |
| Real `person_entered` | PASS | Signal `4259cfe1-8380-446c-8bef-1f953d575d74` |
| Source-anchor capture window | PARTIAL PASS | `postbuffer_gap` repaired; upload reached |
| Private media persistence | FAIL | No clip record/object |
| Authorized production playback | BLOCKED | No stored real clip |
| Normal Gateway restoration | PASS | 10 active, progressing relays; device auth ready |

## REMAINING KNOWN ISSUES

1. Cloud-media upload returns a non-successful persistence outcome after local capture. The Gateway now records only safe bounded HTTP/lifecycle categories; the next repair must isolate the cloud route/storage response without exposing payloads or secrets.
2. Production browser playback across hostnames remains unverified until a real clip persists.
3. Existing database migration-history drift remains outside PUSH 7.

## PUSH 8 READINESS

**ARE WE READY FOR PUSH 8 — CONTEXT + BEHAVIORAL BASELINE HARDENING? NO.**

PUSH 7 requires one successful fresh real clip: persistence, tenant-authorized signed access, and production playback.
