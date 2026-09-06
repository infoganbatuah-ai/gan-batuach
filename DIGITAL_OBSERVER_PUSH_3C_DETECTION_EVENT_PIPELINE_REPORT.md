# DIGITAL OBSERVER — PUSH 3C DETECTION → EVENT PIPELINE REPORT

## 1. FINAL STATUS

**BLOCKED — REAL PERSON NOT PRESENT**

The repair and its automated contract/regression coverage passed. The required final real-world proof could not be completed because the 120-second synchronized window received 30 fresh real channel-11 frames and zero `person` detections. No event, evidence, database row, or UI state was manufactured.

## 2. ROOT CAUSE

PUSH 3B.1 captured two real, correctly anchored ONNX `person` detections at `2026-09-04T21:37:31.665Z` (0.933) and `2026-09-04T21:37:33.265Z` (0.975). The existing `JournalTracker` required **three** correlated samples before it emitted `person_detected`. Therefore neither observation qualified and no outbox row was created. This was qualification behavior, not a cloud validation, database, evidence, or UI rejection.

The restart required for this repair also exposed a configuration compatibility issue: the enrolled Gateway identity and DVR profile references can be in different Keychain namespaces. The persistent installer now selects the namespace containing the required reference types without reading, writing, logging, or placing secret values in the LaunchAgent.

## 3. CONTRACT BEFORE FIX

| Contract field | Real ONNX/Gateway output | Journal before fix | Result |
|---|---|---|---|
| Class | `person` | `person` or supported vehicle label | Match |
| Class ID | Not emitted | Not consumed | Provenance gap |
| Confidence | 0.933 / 0.975 | 0.65 minimum | Match |
| Box | Normalized `[ymin,xmin,ymax,xmax]` | Valid normalized box and track association | Match |
| Source binding | Camera, site, stream, generation, sequence, offset, timestamp | Exact anchor/camera/stream match | Match |
| Model provenance | Worker-internal only | Not propagated | Provenance gap |
| Person qualification | Two real correlated observations | Three confirmations | **Contract break** |

## 4. FIX APPLIED

### Files changed

- `services/video-gateway/journal-tracker.mjs`
- `services/video-gateway/journal-loop.mjs`
- `services/video-gateway/onnx-object-worker.mjs`
- `services/video-gateway/server.mjs`
- `lib/domain/event-engine/event-evidence-compatibility.ts`
- `app/api/video-gateway/cloud-events/route.ts`
- `app/api/video-gateway/event-manifest/route.ts`
- `scripts/run-persistent-home-gateway.mjs`
- `scripts/install-persistent-home-gateway.mjs`
- `scripts/qa/check-real-detection-event-bridge.mjs`
- `package.json`

### Logic

- The persistent home Gateway now requires two correlated real person observations, rather than three, before emitting passive `person_detected`. A single box remains insufficient; tracking distance, confidence threshold, source anchor, consent/policy, dedupe, outbox, cloud validation, and tenant/camera binding remain enforced.
- The generic `JournalTracker` and existing callers retain their three-confirmation default. Only the existing persistent home Gateway config opts into two confirmations.
- ONNX output now carries COCO `class_id`; the Gateway carries bounded model provenance (`model`, runtime, CPU provider, checksum reference); the normalized event persists that provenance.
- `demo`, `mock`, and `local_shadow` sources are rejected from the real Journal and cloud ingest path.
- The installer/runner safely supports separately stored DVR and device-identity Keychain references. No secret is emitted in output, logs, plist, or this report.

## 5. TEST RESULTS

| Test | Result | Evidence |
|---|---|---|
| Real-style detection bridge | PASS | Two correlated person frames qualify; wrong anchor, stale anchor, low confidence, duplicate, and local-shadow cases reject. |
| Event journal regression suite | PASS | Tracker, cloud ingest, durable outbox, ONNX client, and event-media checks passed. |
| Persistent Gateway safety | PASS | Installer secret-sanitization QA passed. |
| Typecheck | PASS | `npm run typecheck` completed with exit code 0. |
| Relevant lint | PASS with existing warnings | No lint errors; pre-existing warnings remain in Gateway runner/server files. |

## 6. REAL PERSON TEST

| Field | Result |
|---|---|
| Source | `e9f8abf3-5895-494e-b1cf-ea8818602851` / channel 11 / `dvr_84e4cdf200faab18d9_11` |
| Site | `cc1673b8-3eb0-4785-a12c-1fb88f425a41` |
| Window start | `2026-09-04T22:04:16.802Z` |
| Window end | `2026-09-04T22:06:16.835Z` |
| Duration | 120 seconds |
| Real frames analyzed | 30 |
| Unavailable requests | 0 |
| `person` detections | 0 |
| Model | `ssd_mobilenet_v1_10` / `onnxruntime-node` CPU |
| Mock/synthetic/manual input | No |

Channel 11 remained `sampled` in the Journal and the relay was progressing. The absence of `person` output means physical-person presence was not established in this active window; a real event cannot honestly be claimed.

## 7. REAL EVENT

**NOT CREATED.** No event ID, persistence record, confidence, source anchor, or provenance can be reported because no real person detection occurred during the post-fix window.

## 8. EVIDENCE

**NOT APPLICABLE.** The evidence engine was not invoked because its recording grant is issued only after a validated, persisted event. No media was fabricated or substituted.

## 9. UI

**NOT APPLICABLE.** There was no persisted real event for the normal product event path to display.

## 10. LATENCY

| Step | Result |
|---|---|
| T0–T1 inference | No person frame detected in the post-fix real window. |
| T2 Journal qualification | Not reached. |
| T3 Event/database | Not reached. |
| T4 Evidence | Not reached. |
| T5 UI | Not reached. |
| T6 total | Not measurable without a real detection. |

## 11. MOCK ISOLATION

The real Gateway/ONNX path is independent of the product `mock` / `local_shadow` worker. The repaired real path rejects `demo`, `mock`, and `local_shadow` source modes before event creation; authenticated Gateway source mapping and the recorded model provenance identify real-origin events. The separate mock product Observer remains unchanged and was not used.

## 12. PUSH 4 READINESS

**ARE WE READY FOR PUSH 4 — REPLACE/WIRE THE PRODUCT MOCK OBSERVER TO THE PROVEN REAL AI PIPELINE? NO.**

The detection-to-event bridge is repaired and tested, but its final real-camera proof remains incomplete. The minimum next action is one new controlled 90–120 second physical pass through channel 11 while the restored Gateway/Journal is running, followed by verification of the automatically created event, database row, evidence policy result, and UI visibility. No PUSH 4 work was started.
