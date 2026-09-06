# DIGITAL OBSERVER — PUSH 9B REAL RISK CLOSURE REPORT

## FINAL STATUS

`BLOCKED — NO QUALIFYING REAL ENTRY`

The Production baseline was healthy and the 180-second real observation window ran to completion. One fresh `REAL_CAMERA_AI` `person_detected` event was persisted, but no qualifying `person_entered` event was created. Therefore no fresh Incident, Risk Evaluation, or Decision could be verified without fabricating data.

## PRODUCTION BASELINE

- Production health: PASS (`https://ganbatuach.com/api/health` returned HTTP 200).
- Current Production deployment: READY, deployment `dpl_FWsbAkytgRQKgsKPCrFtxRLyLLzW`, alias `https://ganbatuach.com`.
- Gateway service: RUNNING, launchd state `running`, exit code `0`.
- Gateway health: `healthy`.
- Active relays: `10`; progressing relays: `10`; stalled relays: `0`.
- Channel 11: active/progressing; HEVC input; fresh relay telemetry.
- Device authorization: `ready`.
- ONNX/object-detection capability: available in the healthy Gateway runtime.
- Canonical source: `e9f8abf3-5895-494e-b1cf-ea8818602851`.
- Site: `cc1673b8-3eb0-4785-a12c-1fb88f425a41`.
- Stream: `dvr_84e4cdf200faab18d9_11`.
- Baseline: `LEARNING`, version `v1_real_camera_event_context`, real event count `318`.
- Site timezone: `Asia/Jerusalem`.
- Schedule mode: `event_only`; no temporary PUSH 9 risk rule remained enabled.

No code, threshold, tracking configuration, risk weight, decision threshold, or temporary rule was changed during this PUSH.

## REAL ENTRY EVENT

### Controlled window

- Start: `2026-09-06T00:42:03.162Z`
- End: `2026-09-06T00:45:06.341Z`
- Duration: 180 seconds configured; process completed after the final polling interval.
- Source: real home DVR channel 11 through the persistent Gateway.
- Synthetic/mock/manual data: none.

### Observed result

One fresh real detection was persisted:

- Event ID: `aba74028-b33a-4379-a584-b191c0633955`
- Event type: `person_detected`
- Provenance: `REAL_CAMERA_AI`
- Confidence: `0.909`
- Track ID: `f7f233e5-b6a3-4b62-9eef-0547f8f27801`
- Created: `2026-09-06T00:43:50.034Z`
- Camera/source: `e9f8abf3-5895-494e-b1cf-ea8818602851`
- Stream: `dvr_84e4cdf200faab18d9_11`

No `person_entered` event was persisted during the window.

## INCIDENT

No new canonical Incident was created from the controlled window because the required qualifying `person_entered` event did not occur.

- Fresh Incident ID: not applicable.
- Event relationship: no qualifying entry relationship.
- Automatic creation: not reached.

This is an honest verification block, not an Incident creation failure.

## RISK EVALUATION

Not reached for the fresh test window. No new Risk Evaluation was found with `evaluated_at` inside the window.

The already-deployed Risk Engine remains present and previously verified against existing real Incidents, including:

- `15 / LOW → LOG_ONLY`
- `27 / GUARDED → VERIFY`

Those existing evaluations do not satisfy the fresh physical-event criterion of PUSH 9B and were not reused as a substitute.

## DECISION

Not reached for the fresh test window. No new Decision Intent was created because no fresh Incident and Risk Evaluation existed.

## FACTORS / MITIGATORS

Not applicable to the fresh window. No risk factors, mitigators, rule matches, or decision explanation were generated for the observed `person_detected` event.

The Production baseline remains immature (`LEARNING`), so the system correctly must not infer a strong risk conclusion from the single detection.

## BASELINE MATURITY

- Maturity: `LEARNING`
- Version: `v1_real_camera_event_context`
- Real event count: `318`
- Confidence level: `0.34`

The baseline guardrail remained active. No insufficient-data condition was upgraded into a strong anomaly or risk claim.

## CONFIDENCE VS RISK

The fresh event contained detector confidence `0.909`, but no risk score was produced because no qualifying entry/Incident existed. This preserves the required separation between detector confidence and Risk.

## PRODUCT UI/API

- Fresh Incident visible: `NO — no fresh Incident existed`.
- Fresh Risk visible: `NO — no fresh Risk Evaluation existed`.
- Fresh Decision visible: `NO — no fresh Decision existed`.
- Fresh explanation inspectable: `NO — evaluation was not reached`.
- Correct source/camera/stream for the observed event: `YES`.
- Existing authorized Risk API/UI verification from PUSH 9 remains intact for previously persisted real Incidents; it is not evidence of fresh PUSH 9B closure.

## IDEMPOTENCY

No replay or mutation was performed to manufacture a result. The window produced one distinct persisted detection, with no duplicate fresh Incident, Risk Evaluation, or Decision. Existing idempotency and dedupe safeguards were left unchanged.

## OPTIONAL EXIT / DE-ESCALATION

Not performed. PUSH 9B does not require an exit after a successful fresh entry, and no fresh entry was generated.

## PUSH 9 FINAL CLOSURE

PUSH 9 remains **NOT PASS** because its only remaining acceptance criterion—fresh physical `person_entered` automatically producing a new Incident, Risk Evaluation, and Decision—was not reached.

The exact minimum next action is one additional controlled physical entry on channel 11 that satisfies the existing entry geometry and tracking contract. No code change or threshold change is indicated by this run.

### Safety statement

- No Event was manually created.
- No Incident was manually created.
- No Risk data was seeded.
- No mock, local-shadow, synthetic, or uploaded media path was used.
- No production logic was modified.

`PUSH 9 FINAL STATUS: NOT PASS`

`ARE WE READY FOR PUSH 10 — INCIDENT VERIFICATION + FALSE-ALARM REDUCTION? NO`
