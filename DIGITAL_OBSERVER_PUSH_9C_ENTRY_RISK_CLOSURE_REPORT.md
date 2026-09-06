# DIGITAL OBSERVER — PUSH 9C ENTRY/RISK CLOSURE REPORT

## FINAL STATUS

`BLOCKED — ENTRY GEOMETRY NOT SATISFIED`

The real runtime was diagnosed and the minimum proven tracking/sampling fixes were applied. The final clean verification window did not contain a visible person, so no fresh `person_entered` event was created. Incident → Risk → Decision was therefore not reached and was not fabricated.

Follow-up verification on 2026-09-06 used the real Journal only, without a competing diagnostic sampler. It produced fresh `REAL_CAMERA_AI` `person_detected` events, but still did not produce a new `person_entered`; therefore this report remains NOT PASS.

## ENTRY CONFIGURATION

- Site: `cc1673b8-3eb0-4785-a12c-1fb88f425a41`
- Camera/source: `e9f8abf3-5895-494e-b1cf-ea8818602851`
- Camera: `כניסה לבית — ערוץ 11`
- Stream: `dvr_84e4cdf200faab18d9_11`
- Zone: `ENTRANCE`
- Camera/health: `connected` / `healthy`
- Crossing line: normalized `y = 0.50`
- OUTSIDE: upper half of the image, `y < 0.50`
- INSIDE: lower half of the image, `y > 0.50`
- Required path: `OUTSIDE → CROSSING → INSIDE`
- Existing directional contract: three unique, consistent observations on the side being established.
- Production Risk/Decision rules and thresholds: unchanged.

## ROOT CAUSE AND FIX

### Root cause 1 — effective diagnostic sampling coverage

The persistent Gateway was sampling all 16 configured cameras through one shared ONNX worker. During the controlled diagnostic, channel 11 received only approximately five unique source sequences in 120 seconds. That was insufficient to establish three OUTSIDE observations before the person crossed.

The existing supported one-camera diagnostic filter was enabled temporarily for channel 11. It reduced the Journal scope to `attempted=1`, `sampled=1`, `coverage_scope=single_camera_diagnostic`. All 10 relays remained active and progressing. After verification, the filter was removed and normal all-camera sampling was restored.

### Root cause 2 — safe Track continuity across a rapid line transition

The tracker used a centroid association limit of `< 0.22`. A confirmed track could be split when a real person moved from one side of the line to the other between two analyzed frames, even when the movement was temporally close and horizontally aligned. A direct y-line contract reproduction demonstrated that the old implementation created a new Track instead of qualifying entry.

Minimum fix applied:

- retain the existing three directional confirmations;
- allow a bounded crossing bridge only when the Track was already confirmed on one side;
- require the opposite side to be reached within `1.5s`;
- require horizontal alignment within `0.16`;
- require the normalized crossing jump to remain below `0.42`;
- preserve the existing ambiguity rejection when competing candidates exist.

This is not a threshold reduction and does not manufacture an Event.

### Diagnostic lease correction

The temporary diagnostic reader was corrected to release an Evidence lease immediately when its sample did not create an Event. Production Journal already contains the corresponding `releaseUnusedEvidence` behavior. No media policy or authorization was weakened.

### Root cause 3 — cloud manifest refresh could pause local sampling

The Journal refreshed the cloud event manifest synchronously at the beginning of every cycle. A slow or rejected refresh could delay the next real-camera sample long enough to fragment a physical crossing. The minimum fix was to bound manifest refresh to 2.5 seconds and continue local sampling with the last accepted manifest when one exists. The production delivery contract remains unchanged; only the local sampling loop is decoupled from a slow refresh.

## PHYSICAL CROSSING TRACE

The final clean window was:

- Start: `2026-09-06T10:51:44.144Z`
- End: `2026-09-06T10:53:44.824Z`
- Distinct source sequences: `101`
- Person-positive frames: `0`
- Production cloud records from the window: `0`

Earlier diagnostic observations confirmed the coordinate interpretation and demonstrated both sides of the line:

- OUTSIDE: `y=0.425`
- INSIDE: `y=0.650`
- Additional INSIDE samples: approximately `y=0.588–0.608`

Those observations were diagnostic only and did not produce a valid Production entry because the required prior OUTSIDE confirmation sequence was not completed in the same continuous Track.

### Follow-up real Journal windows

- `2026-09-06T11:19:32.685Z` onward: Journal-only window after the manifest-refresh fix. A real `person_detected` was observed with Track ID `702c303d-5fc9-4591-a9b0-7eef2db8febe`; no entry.
- `2026-09-06T11:21:49.162Z` onward: clean Journal-only window after ephemeral tracker reset. A stale Track from the preceding test produced one real `person_exited` at `2026-09-06T11:22:01.288Z`; it was excluded because it was not a fresh entry, and the Gateway was restarted to clear ephemeral state.
- `2026-09-06T11:25:09.971Z` onward: final clean Journal-only window after tracker reset. Fresh `person_detected` event `917c133b-977a-4f80-be65-ca8b3023ceaf`, Track ID `652b6c9c-e490-4ba9-bc6b-b0a87e471880`, confidence `0.884`, source sequence `84827`; no `person_entered`.

The last two windows showed the Journal sampling the filtered camera approximately once per second, but the person was not observed as a complete, continuously qualified OUTSIDE → INSIDE crossing. No Incident/Risk/Decision was fabricated.

## TRACK CONTINUITY

### Before fix

The code-level contract reproduction using a y-axis line and a direct outside-to-inside jump split the Track and emitted no `person_entered`.

### After fix

The focused regression test passed with the same y-axis geometry and a rapid but bounded crossing jump:

`OUTSIDE × 3 → INSIDE × 3 → one person_entered`

The regression preserved one Track ID and retained the three-observation directional contract.

### Live result

The final clean physical window contained no person-positive frames, so live Track continuity through the complete physical crossing remains unproven.

## PERSON_ENTERED

No fresh `person_entered` event was created in the final clean window.

- Fresh entry Event ID: not applicable.
- Provenance: not applicable.
- Track ID: not applicable.
- Source anchor: not applicable.

## INCIDENT

No new canonical Incident was created because no fresh `person_entered` existed.

- Incident ID: not applicable.
- Automatic creation: not reached.
- Manual creation: none.

## RISK

No fresh Risk Evaluation was produced in the final window.

- Risk Evaluation ID: not applicable.
- Score/band: not applicable.
- Baseline state remains `LEARNING`.
- Risk weights and bands were not changed.

Existing Production Risk evaluations were not reused as a substitute for a fresh physical entry.

## DECISION

No fresh Decision was produced because the Incident and Risk stages were not reached.

- Decision: not applicable.
- Decision reference: not applicable.
- Manual trigger: none.

## PRODUCT UI/API

- Fresh Incident visible: `NO — no fresh Incident existed`.
- Fresh Risk visible: `NO — no fresh Risk Evaluation existed`.
- Fresh Decision visible: `NO — no fresh Decision existed`.
- Fresh explanation inspectable: `NO — evaluation was not reached`.
- Source/camera mapping for the diagnostic frames: `YES`.
- Duplicate fresh Incident: `NO`.

## IDEMPOTENCY

No Event, Incident, Risk, or Decision was inserted manually. No replay was used to force a result. No duplicate fresh Incident or Decision was observed.

## TEST MATRIX

| Test | Result | Evidence |
|---|---|---|
| Channel 11 manifest/source mapping | PASS | Correct source, stream, site, zone and line loaded in live Gateway manifest |
| Gateway health after fix | PASS | Healthy; 10 active/progressing relays; 0 stalled |
| Normal camera activity restored | PASS | Diagnostic filter removed after test; all-camera mode restored |
| Tracker y-line jump regression | PASS | `check-event-journal.mjs` passed; bounded bridge preserves one Track and entry |
| Existing Journal regression | PASS | Event-journal QA passed |
| Temporal coverage QA | PASS | Existing temporal coverage QA passed |
| Typecheck | PASS | `npm run typecheck` passed |
| Final real physical OUTSIDE → INSIDE | BLOCKED | Fresh person detection occurred, but no complete qualifying entry transition |
| Fresh Incident → Risk → Decision | NOT REACHED | No fresh `person_entered` |
| Product UI/API fresh result | NOT REACHED | No fresh Incident/Risk/Decision |
| Cloud-refresh sampling isolation | PASS | Manifest refresh bounded; local sampling continues from last accepted manifest |

## PUSH 9 FINAL STATUS

PUSH 9 remains **NOT PASS**. The software-side sampling, Track-continuity, and cloud-refresh blockers found during this run were addressed and regression-tested. The final clean real window produced a real person detection but not a qualifying fresh `person_entered`. A future run must begin with the operator visibly in the upper half and complete the continuous OUTSIDE → INSIDE crossing without leaving the detector view.

No PUSH 10 work was started.

`PUSH 9 FINAL STATUS: NOT PASS`

`ARE WE READY FOR PUSH 10? NO`
