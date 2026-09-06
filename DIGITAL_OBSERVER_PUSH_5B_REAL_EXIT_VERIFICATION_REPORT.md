# DIGITAL OBSERVER — PUSH 5B: DIRECTIONAL EXIT CONSISTENCY & REAL ZONE EXIT PROOF

## FINAL STATUS

**PASS**

No tracking confirmation threshold was reduced.  A controlled real person
movement on channel 11 produced an automatic normalized `person_exited` event,
was delivered through the existing outbox/backend, persisted in Supabase, and
was visible in the authorized product UI.

## EXIT CONTRACT

The existing `JournalTracker` contract is unchanged:

```text
same real camera and continuous track
  → confidence >= 0.65
  → unique, monotonically newer source frame
  → three stable observations on the current side of y = 0.50
  → prior confirmed opposite side
  → no 30-second directional-event cooldown
  → person_exited when the new side is outside (negative)
```

The tracker associates person boxes by normalized centroid distance below 0.22,
expires a track after 60 seconds, rejects ambiguous associations, and resets
directional evidence inside the ±0.04 line dead-band.  Replayed/stale source
frames are rejected before they can count toward a confirmation.

## FAILED TRACE ANALYSIS

The failed PUSH 5 return passes were not evidence of an invalid exit rule:

- One run used a diagnostic sampler concurrently with the Journal; the Journal
  received a temporary 503.  That run was discarded rather than counted.
- Other return windows produced fewer than three qualifying Journal detections
  after a new track had been created on the upper side.  They could not form a
  valid reverse transition.
- A normal human crossing is therefore valid only when the person pauses long
  enough on each side for the real detector and the serial Journal sampler to
  gather its confirmations.

The successful controlled pass used 20 seconds inside, a slow central crossing,
and 30 seconds outside.  It satisfied the unchanged contract.

## TEMPORAL COVERAGE

A local, empty-corridor diagnostic took 15 authenticated samples over 6.902 s
and observed 7 distinct source sequences: **0.87 distinct source frames/s**
(median request latency 97 ms).  Three unique source observations therefore
need at least about 3.5 seconds in ideal conditions; real detector misses and
the serial multi-camera Journal make a deliberately slow crossing necessary.

The successful test held the subject much longer than that bound.  This is a
pilot coverage observation, not a production latency/SLA claim.

## LINE/ZONE GEOMETRY

The real source is channel 11:

| Field | Value |
| --- | --- |
| Camera/source | `e9f8abf3-5895-494e-b1cf-ea8818602851` |
| Site | `cc1673b8-3eb0-4785-a12c-1fb88f425a41` |
| Stream | `dvr_84e4cdf200faab18d9_11` |
| Spatial mechanism | Normalized line crossing (not polygon dwell) |
| Line | `y = 0.50` |
| Inside | positive / below the line |
| Pilot label | `ENTRANCE_CORRIDOR_CENTER` |

The vertical frame axis was selected after temporary local inspection of the
live corridor geometry.  The Gateway manifest confirms this same `y` line and
supports both `person_entered` and `person_exited`.

## TRACK CONTINUITY

The successful exit was preceded by a real presence event on the **same track**:

| Event | Event ID | Time (UTC) | Track ID | Confidence |
| --- | --- | --- | --- | --- |
| person_detected | `326a2e09-3da3-4bd7-b100-b0997af16c4e` | 19:07:57.369 | `1f295738-17ce-4f61-b449-be9202c40f6c` | 0.724 |
| person_exited | `36a50b3c-647c-47b5-88e0-3f287332d7b0` | 19:08:35.001 | `1f295738-17ce-4f61-b449-be9202c40f6c` | 0.802 |

The reverse transition occurred 37.632 seconds after the presence event —
within the 60-second track lifetime.

## CONTROLLED EXIT TEST

The real person followed this verified sequence:

1. Remained visibly inside/below the line for 20 seconds.
2. Crossed slowly through the centre of the corridor.
3. Remained visibly outside/above the line for 30 seconds.

Only the production Journal sampled the path; no mock, manual event, seeded
record, or competing diagnostic sampler participated.

## THREE-OBSERVATION PROOF

The emitted event is proof that the running Journal accepted three stable,
unique source-frame observations on each required directional state: its code
does not call `person_exited` otherwise.  Source anchors are intentionally kept
only in the local, ephemeral evidence path and stripped before cloud event
persistence; delivered non-recording events do not retain raw frame sequence
numbers.  This is a privacy/security boundary, not a missing data insertion.

Automated regression coverage explicitly verifies:

- three stable outward observations emit exactly one exit;
- two outward observations do not emit an exit;
- approach/jitter without a completed crossing emits no exit;
- stale/duplicate source frames cannot qualify as new observations.

## REAL EXIT EVENT

| Field | Value |
| --- | --- |
| Event ID | `36a50b3c-647c-47b5-88e0-3f287332d7b0` |
| Event type | `person_exited` |
| Provenance | `REAL_CAMERA_AI` |
| Evidence kind | `line_crossing` |
| Camera/site/stream | Correct channel-11 binding above |
| Model | `ssd_mobilenet_v1_10` |
| Confidence | 0.802 |
| Persistence | Stored through normal Gateway outbox/backend path |
| Media | `not_required` by current policy |

## ENTRY/EXIT PAIR

The existing real entry path remains unchanged, including its earlier verified
`person_entered` event (`47c57dca-0472-4426-bc30-88a0fa2d9437`).  The successful
exit test established its own real inside state and preserved one Track ID from
presence through exit.  The tracker cannot emit an exit merely from a
disappearance, and it emitted exactly one exit in this controlled cycle.

## NEGATIVE DIRECTION TEST

Automated fixture coverage passed: two observations, line approach without a
complete outward transition, and dead-band jitter produce **no** exit.  This
exercises the negative direction without creating synthetic product events.

## FAST-CROSSING ASSESSMENT

**UNCERTAIN.**  The observed source cadence is approximately 0.87 fps and the
detector can miss frames.  A fast crossing may not produce three stable
observations on each side.  Future hardening should measure production coverage
over longer real samples before changing the safe directional contract.

## DB/UI RESULT

**Database: PASS.**  The outbox was empty with zero delivery failures after the
event.  The persisted row has the correct source, site, stream, provenance,
confidence and model metadata.

**Authorized UI: PASS.**  The authenticated Chrome product UI displayed the
new event as **“אדם יצא”** for **“כניסה לבית — ערוץ 11”**, timestamped 22:08,
with the description **“זוהתה יציאה מהאזור המצולם”**.  It was also shown as the
latest event in the camera view.  The UI correctly labels it informational;
current policy does not require recording for this non-critical exit.

## TEST MATRIX

| Test | Result |
| --- | --- |
| Existing real entry path | PASS (unchanged) |
| Controlled real exit | PASS |
| Same-track presence → exit | PASS |
| Outbox delivery | PASS — pending 0, failures 0 |
| Supabase persistence | PASS |
| Authorized product UI | PASS |
| Three-observation exit regression | PASS |
| Two-observation negative regression | PASS |
| Approach/no-cross negative regression | PASS |
| Tracker configuration QA | PASS |
| Temporal coverage QA | PASS (diagnostic scope) |
| Event Journal QA | PASS |
| Event outbox QA | PASS |
| Event ingest QA | PASS |
| Real detection/event bridge QA | PASS |
| Product real-source/mock-isolation QA | PASS |
| Journal owner-lock QA | PASS |
| Gateway safety / shared DVR-session QA | PASS |
| Typecheck and focused lint | PASS |

## PUSH 6 READINESS

**ARE WE READY FOR PUSH 6 — UNIFIED EVENT → INCIDENT ARCHITECTURE? YES.**

PUSH 5B closes the missing directional-exit proof without weakening the
existing tracking safety contract.  Fast-crossing coverage remains a later
hardening topic, not a blocker for the verified pilot path.
