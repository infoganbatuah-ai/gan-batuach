# DIGITAL OBSERVER — PUSH 9D

# ENTRY GEOMETRY + TRACK-STATE ROOT CAUSE CLOSURE

## FINAL STATUS

`PASS`

PUSH 9D verified the channel 11 spatial contract frame by frame and produced a fresh, automatic, real `person_entered` event. The event created a new canonical Incident, Risk Evaluation and Decision in the Production database. No threshold, Risk weight, Risk band, Decision threshold, manual Event, mock signal or synthetic frame was used.

Repository baseline used for this verification:

- Branch: `codex/ci-typecheck-deployment-repair-20260831`
- Base revision: `22f3a53a8f4b782b750f3951f7b70fb1a15fa22b`
- Production Supabase project reference: `kuaywzvucllxjsxarogb`
- Site: `cc1673b8-3eb0-4785-a12c-1fb88f425a41`
- Camera/source: `e9f8abf3-5895-494e-b1cf-ea8818602851`
- Stream: `dvr_84e4cdf200faab18d9_11`

The worktree already contained the earlier approved PUSH changes. They were preserved; this PUSH did not overwrite or revert unrelated work.

## CURRENT LINE CONFIGURATION

| Property | Verified value |
|---|---|
| Camera label | כניסה לבית — ערוץ 11 |
| Zone type | `ENTRANCE` |
| Line axis | `y` — horizontal line |
| Line position | `0.50` — 50% from the top |
| Inside side | `positive` — below the line / closer to the camera |
| Outside side | `negative` — above the line / door and stair-head side |
| Crossing point | normalized bounding-box centroid |
| Dead-band epsilon | `0.04` on each side of the line |
| Side confirmation | 3 unique observations on a side |
| Person-presence confirmation | 2 unique observations |
| Track distance association | `< 0.22` normalized distance |
| Maximum track gap | 60 seconds |
| Directional cooldown | 30 seconds |
| Entry semantics | confirmed OUTSIDE → dead-band/crossing → 3 confirmed INSIDE observations |
| Exit semantics | confirmed INSIDE → dead-band/crossing → 3 confirmed OUTSIDE observations |

The Production UI configuration and the Journal manifest agree: the upper/far corridor is OUTSIDE and the lower/near-camera corridor is INSIDE.

## COORDINATE SYSTEM

The source frame is 1280×720. The anchored decoder selects a real keyframe and converts it through:

`MPEG-TS keyframe → FFmpeg decode → scale=300:300 → RGB24 → uint8 NHWC [1,300,300,3] → SSD MobileNet ONNX`

ONNX boxes use normalized `[ymin, xmin, ymax, xmax]` coordinates. `JournalTracker` derives a normalized centroid:

`x = (xmin + xmax) / 2`

`y = (ymin + ymax) / 2`

The crossing line also uses normalized coordinates. Although the current decoder stretches 1280×720 to 300×300, direct scaling preserves normalized x/y location: `(x / 1280, y / 720)` is equal to `(scaledX / 300, scaledY / 300)`. Automated QA verifies this invariant.

No horizontal mirror, vertical mirror, rotation, crop or letterbox transform is configured in the real channel 11 path. The UI view and Journal therefore use the same orientation. Mirrored/rotated mapping is not currently enabled and was not falsely claimed as tested.

Result: `PASS` — no source-pixel vs detector-pixel mismatch and no orientation mismatch were found.

## FRAME-BY-FRAME REAL TRACK TRACE

The diagnostic trace contained metadata only. No image was retained or uploaded. Every row below is a unique real source sequence from one stable Track ID: `7bea3075-f74f-49b6-bd07-802814fbfee8`.

State abbreviations: `U` = UNKNOWN, `O` = confirmed OUTSIDE, `I` = confirmed INSIDE. Bounding boxes are normalized `[ymin,xmin,ymax,xmax]`.

| Seq | UTC timestamp | Confidence | Bounding box | Centroid (x,y) | Signed Δy | Frame side | State before → after | Counted? | Event |
|---:|---|---:|---|---|---:|---|---|---|---|
| 86021 | 11:51:55.936 | 0.818 | `[.0112,.1775,.7080,.3815]` | `(.2795,.3596)` | -0.1404 | OUTSIDE | U → U; candidate O 1/3 | yes | — |
| 86022 | 11:51:57.256 | 0.803 | `[0,.2638,.5655,.4270]` | `(.3454,.2828)` | -0.2173 | OUTSIDE | U → U; candidate O 2/3 | yes | `person_detected` |
| 86026 | 11:52:01.742 | 0.882 | `[.0165,.1396,.6695,.3333]` | `(.2365,.3430)` | -0.1570 | OUTSIDE | U → O; confirmed 3/3 | yes | — |
| 86027 | 11:52:03.061 | 0.858 | `[.0235,.1462,.6742,.3492]` | `(.2477,.3489)` | -0.1512 | OUTSIDE | O → O; 4 | yes | — |
| 86028 | 11:52:04.361 | 0.896 | `[.0182,.1376,.6747,.3415]` | `(.2396,.3465)` | -0.1536 | OUTSIDE | O → O; 5 | yes | — |
| 86029 | 11:52:05.601 | 0.881 | `[.0167,.1384,.6726,.3392]` | `(.2388,.3447)` | -0.1554 | OUTSIDE | O → O; 6 | yes | — |
| 86030 | 11:52:06.845 | 0.903 | `[.0214,.1427,.6743,.3383]` | `(.2405,.3479)` | -0.1522 | OUTSIDE | O → O; 7 | yes | — |
| 86031 | 11:52:08.113 | 0.894 | `[.0225,.1473,.6783,.3464]` | `(.2469,.3504)` | -0.1496 | OUTSIDE | O → O; 8 | yes | — |
| 86032 | 11:52:09.364 | 0.867 | `[.0338,.1456,.7143,.3496]` | `(.2476,.3741)` | -0.1260 | OUTSIDE | O → O; 9 | yes | — |
| 86033 | 11:52:10.678 | 0.810 | `[.0410,.1050,.6916,.3231]` | `(.2141,.3663)` | -0.1337 | OUTSIDE | O → O; 10 | yes | — |
| 86034 | 11:52:11.927 | 0.762 | `[.0187,.1098,.6637,.3239]` | `(.2169,.3412)` | -0.1588 | OUTSIDE | O → O; 11 | yes | — |
| 86035 | 11:52:13.118 | 0.819 | `[.0296,.1088,.6974,.3200]` | `(.2144,.3635)` | -0.1365 | OUTSIDE | O → O; 12 | yes | — |
| 86037 | 11:52:14.731 | 0.846 | `[.0718,.1241,.7397,.3690]` | `(.2466,.4058)` | -0.0943 | OUTSIDE | O → O; 13 | yes | — |
| 86038 | 11:52:15.940 | 0.869 | `[.0796,.1840,.8468,.3960]` | `(.2900,.4632)` | -0.0368 | ON LINE | O → O; candidate cleared | no | — |
| 86039 | 11:52:17.255 | 0.932 | `[.1982,.2171,.8870,.4530]` | `(.3351,.5426)` | +0.0426 | INSIDE | O → O; candidate I 1/3 | yes | — |
| 86040 | 11:52:18.449 | 0.906 | `[.2692,.2620,.9665,.4964]` | `(.3792,.6179)` | +0.1179 | INSIDE | O → O; candidate I 2/3 | yes | — |
| 86041 | 11:52:19.631 | 0.759 | `[.2956,.2749,.9871,.5319]` | `(.4034,.6414)` | +0.1413 | INSIDE | O → I; confirmed 3/3 | yes | `person_entered` |

The main Track remained continuous for 23.695 seconds and 17 distinct analyzed source frames. The state was retained across the 4.486-second detector gap between sequences 86022 and 86026. No duplicate source sequence was counted.

## SIDE-OF-LINE RESULTS

- Clearly outside samples produced a negative signed delta.
- The sample at sequence 86038 fell inside the ±0.04 dead band and correctly did not count toward a direction change.
- Three subsequent, unique positive-side observations were required.
- Sequence 86041 was the third positive confirmation and emitted exactly one `person_entered`.
- Entry and exit remain directional opposites; confirmations were not reduced.

Result: `PASS`.

## INITIAL TRACK STATE

A new Track starts as UNKNOWN. It does not infer a prior physical side.

During this run, a separate first observation at sequence 86020 was already on the INSIDE side (`y=0.63625`) and had only one hit. It remained UNKNOWN and emitted no entry. That behavior is intentionally safe: UNKNOWN → INSIDE cannot fabricate a crossing.

The successful Track began at sequence 86021 on the OUTSIDE side and accumulated three unique OUTSIDE observations before any crossing was considered.

Result: `PASS` — no stale side was inherited and no entry was fabricated from insufficient prior-side evidence.

## TEMPORAL STATE

The trace proves that `last side`, `candidate side`, `side confirmation count`, `last source sequence`, Track ID and timestamp persisted across Journal sampling iterations. The real sequence progressed:

`UNKNOWN → candidate OUTSIDE 1/3 → candidate OUTSIDE 2/3 → confirmed OUTSIDE → ON_LINE → candidate INSIDE 1/3 → candidate INSIDE 2/3 → confirmed INSIDE`

Cloud manifest refresh is bounded and a last-known-good manifest is used, so slow cloud refresh no longer owns the local sampling cadence. Journal ownership locking remained active. The diagnostic state was reset once before the controlled pass and was not reset during it.

## TRACK CONTINUITY

- Successful Track ID: `7bea3075-f74f-49b6-bd07-802814fbfee8`
- Unique qualifying frames: 17
- First source sequence: 86021
- Last source sequence: 86041
- Fragmentation during the qualifying path: 0
- Crossing bridge used: no; ordinary distance association was sufficient
- Track-side state loss: none

Result: `PASS`.

## ROOT CAUSE

The repeated earlier `person_detected`-without-`person_entered` outcomes were not caused by a coordinate transform bug, reversed line, mirror, rotation, wrong crossing point or broken side-of-line math.

The exact failure condition was insufficient prior-side establishment: the person was first detected near the line or already on the INSIDE side, so the Track began UNKNOWN and never obtained three unique OUTSIDE observations before moving inside. The safety contract correctly refused to infer a crossing that it had not observed. Short/ambiguous passes compounded this by providing detections only around the line or after the crossing.

The fresh controlled trace removes that ambiguity. Once the person remained visibly on the far/upper OUTSIDE side long enough to establish the state, the existing centroid geometry and three-confirmation state machine generated entry without any semantic relaxation.

Classification of the real replay: physical path DID cross the configured geometry, and the implementation succeeded when the complete required observation sequence was present.

## FIX APPLIED

The minimum safe correction was observability and controlled state initialization, not weaker crossing semantics:

1. Added an opt-in, metadata-only spatial trace to `JournalTracker`.
2. The trace records source sequence, timestamp, normalized box/centroid, signed line delta, side, Track ID, association reason, state before/after, whether the frame counted and emitted event types.
3. Bounded the in-memory diagnostic trace to 240 entries in Journal status.
4. Added explicit installer/runtime propagation for `GAN_BATUACH_GATEWAY_SPATIAL_TRACE=1` only when requested.
5. Reset only ephemeral tracking state before the controlled pass; no Production Events or Incidents were deleted.
6. Added deterministic spatial regression QA.
7. Removed the one-camera filter and diagnostic trace after the test, restoring normal all-camera operation.

Files changed for PUSH 9D:

- `services/video-gateway/journal-tracker.mjs`
- `services/video-gateway/journal-loop.mjs`
- `scripts/run-persistent-home-gateway.mjs`
- `scripts/install-persistent-home-gateway.mjs`
- `scripts/qa/check-spatial-entry-geometry.mjs`
- `DIGITAL_OBSERVER_PUSH_9D_ENTRY_GEOMETRY_ROOT_CAUSE_REPORT.md`

No Risk weights, bands, Decision thresholds, crossing confirmation count, confidence threshold, line position or crossing-point semantics were changed.

## AUTOMATED SPATIAL QA

New focused QA covers:

- OUTSIDE → line → INSIDE creates exactly one entry.
- INSIDE → line → OUTSIDE creates exactly one exit.
- Approach without a confirmed crossing creates no event.
- Dead-band jitter creates no directional event.
- Source 1280×720 → detector 300×300 normalized transform is invariant.
- UNKNOWN → INSIDE cannot fabricate entry.
- Track state persists across iterations.
- Track reset cannot inherit stale side state.
- Duplicate source frame cannot count twice.
- Entry/exit remain directional opposites.
- Mirror/rotation case: not applicable because no such transform is supported/configured on channel 11.

## FRESH REAL ENTRY

| Field | Result |
|---|---|
| Event ID | `b7062b4d-dd11-43dd-8160-ff41a3431a89` |
| Event type | `person_entered` |
| Timestamp | `2026-09-06T11:52:19.631Z` |
| Provenance | `REAL_CAMERA_AI` |
| Track ID | `7bea3075-f74f-49b6-bd07-802814fbfee8` |
| Confidence | 0.759 |
| Camera/source | `e9f8abf3-5895-494e-b1cf-ea8818602851` |
| Stream | `dvr_84e4cdf200faab18d9_11` |
| Site | `cc1673b8-3eb0-4785-a12c-1fb88f425a41` |
| Creation | automatic through Journal/outbox |
| Mock/manual/synthetic | no |
| Production persistence | PASS |

## INCIDENT

- Incident ID: `41e0286b-d3a2-42cb-a25a-273578d60976`
- Opened at: `2026-09-06T11:52:19.631Z`
- Status: `open`
- Related Event: `b7062b4d-dd11-43dd-8160-ff41a3431a89`
- Involved Track: `7bea3075-f74f-49b6-bd07-802814fbfee8`
- Camera/site attribution: correct
- Provenance through authorized product API: `REAL_CAMERA_AI`
- Automatic creation: PASS

## RISK

- Risk Evaluation ID: `7d3b6f0e-664e-4008-b677-b0e55e249205`
- Triggering Event ID: `b7062b4d-dd11-43dd-8160-ff41a3431a89`
- Evaluated at: `2026-09-06T11:52:23.274Z`
- Risk score: 15
- Risk band: `LOW`
- Evaluation confidence: 0.5357
- Risk engine: `do-risk-v1`
- Factor version: `do-risk-factors-v1`
- Baseline maturity: `LEARNING`
- Baseline version: `v1_real_camera_event_context`
- Detection confidence remained separate from Risk score.
- Risk latency after Event/Incident: 3.643 seconds.

Explainability was persisted. The factual contributing factor was a real meaningful entry. Baseline influence was limited because maturity is still LEARNING; missing schedule/evidence context reduced evaluation confidence rather than manufacturing high certainty.

## DECISION

- Canonical recommended Decision: `LOG_ONLY`
- Decision version: `do-decision-v1`
- Decision intent ID: `6928e566-2d96-47ba-b341-549a3820a746`
- Evidence-preservation proposal ID: `117d57ee-c1a1-41c6-b866-ce6647265678`
- External execution enabled: false
- Human review required for evidence preservation: true
- First canonical Decision persisted 4.072 seconds after the Event.

The two stored intents are different, policy-valid intents (`LOG_ONLY` and `PRESERVE_EVIDENCE`), not duplicate Decision spam.

## PRODUCT UI/API

Authorized Production verification against `https://ganbatuach.com/api/digital-observer/incidents` passed through the normal authenticated product contract:

- Fresh Incident returned: YES
- Correct provenance: YES
- Risk visible: 15 / LOW
- Decision visible: `LOG_ONLY`
- Explanation inspectable: YES
- Correct camera/site/time/Event: YES
- Baseline maturity visible: `LEARNING`
- External execution disabled: YES

The installed Product UI was also verified as authenticated and connected to the correct site/camera. Direct browser navigation raced with the live PWA's continuously changing media state, so the report does not overclaim a screenshot of the selected latest Incident card; the authorized product API used by that UI returned and validated the exact new Incident/Risk/Decision.

Idempotency verification before and after a repeated authorized retrieval remained unchanged:

- Incidents containing the Event: 1
- Risk Evaluations triggered by the Event: 1
- Decision intents: 2
- Unique Decision dedupe keys: 2
- Duplicate Incident/Risk/Decision: 0

## TEST MATRIX

| Test | Result | Evidence / note |
|---|---|---|
| Real frame-by-frame crossing trace | PASS | 17 unique frames, stable Track, OUTSIDE → ON_LINE → INSIDE |
| Fresh real entry persistence | PASS | Event `b7062b4d-dd11-43dd-8160-ff41a3431a89` |
| Fresh Incident/Risk/Decision | PASS | Incident `41e0286b-d3a2-42cb-a25a-273578d60976` |
| Authorized Production product API | PASS | REAL_CAMERA_AI, Risk 15/LOW, LOG_ONLY, explanation present |
| Retrieval idempotency | PASS | counts unchanged at 1 Incident, 1 Risk, 2 unique intents |
| `check-spatial-entry-geometry.mjs` | PASS | transform, side math, UNKNOWN, entry/exit, jitter, reset, replay |
| `check-event-journal.mjs` | PASS | spatial/event semantics and camera/site isolation |
| `check-event-tracker-configuration.mjs` | PASS | remap reset, stationary/no duplicate behavior |
| `check-event-temporal-coverage.mjs` | PASS | safe sparse-sampling semantics; real coverage proven separately above |
| `check-real-detection-event-bridge.mjs` | PASS | source-anchor, threshold, dedupe and mock rejection |
| `check-digital-observer-incidents.mjs` | PASS | correlation, state, evidence and tenant/camera/track boundaries |
| `check-digital-observer-risk-decision.mjs` | PASS | confidence separation, maturity, rules, de-escalation, idempotency |
| `check-event-ingest.mjs` | PASS | auth/scope/consent/idempotency and spatial evidence |
| `check-event-outbox.mjs` | PASS | durable retry, stable IDs and failure isolation |
| `check-product-observer-real-source.mjs` | PASS | mock/simulation/shadow isolated |
| `check-persistent-home-gateway.mjs` | PASS | persistent Gateway safety |
| Environment safety | PASS | demo validation; no live activation requested by the test |
| TypeScript typecheck | PASS | `tsc --noEmit` |
| Focused lint | PASS | all PUSH 9D production/QA files |
| Normal Gateway restored | PASS | trace/filter removed; 10 active and 10 progressing relays |

## PUSH 9 FINAL STATUS

`PASS`

The final missing real-world acceptance criterion is closed:

`REAL PERSON → REAL TRACK → person_entered → INCIDENT → RISK → DECISION → AUTHORIZED PRODUCT API`

## ARE WE READY FOR PUSH 10?

`YES`

PUSH 9 is now complete. The real entry geometry is proven, the safe UNKNOWN-state behavior is understood, the full Incident → Risk → Decision path is automatic and auditable, and the Gateway has been restored to normal ten-relay operation. PUSH 10 was not started.
