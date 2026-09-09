# DIGITAL OBSERVER — PUSH 28 QUALITY BENCHMARK REPORT

## FINAL STATUS

`PASS`

## IMPLEMENTED PROGRAM

PUSH 28 adds one canonical `observer-quality-benchmark-v1` engine over PUSH 11 reviewed Ground Truth. It supports immutable dataset versions, deterministic run IDs, dataset-kind isolation, precision with denominator and Wilson interval, explicit FN representation, truthful recall availability, stage latency distributions, confidence bins/ECE, offline threshold analysis, same-dataset model comparison, human-gated quality gates and Markdown export.

The authorized Admin API/UI exposes only scoped structured metrics and uses `NOT YET MEASURABLE` for unsupported results. Benchmark work remains outside customer request paths.

## FIRST REAL BENCHMARK

Authorized read-only Production verification of the existing PUSH 11 Incident on 2026-09-10 returned:

| Field | Result |
|---|---|
| Dataset | `reviewed-real-product` / `do-feedback-dataset-v1` |
| Source | Production `REAL_CAMERA_AI`, reviewed Ground Truth |
| Reviewed samples | 1 |
| Coverage | 1 Site, 1 camera/source, `person_entered` |
| Model | `ssd_mobilenet_v1_10` / `onnxruntime-node` (existing immutable sample evidence) |
| Ground Truth | 1 `TRUE_EXPECTED_ACTIVITY` |
| Precision | 100% (`1/1`) over reviewed detected Incidents only |
| Recall | `NOT MEASURABLE` — no comprehensive missed-event/FN Ground Truth |
| False positives | 0 in this one reviewed sample |
| False negatives | `NOT MEASURABLE` |
| Latency | `NOT MEASURED` — the immutable sample lacks complete stage timestamps |
| Confidence calibration | Insufficient sample (`n=1`) |
| Uncertainty | Wilson 95% interval is deliberately broad; this is not a Product-wide accuracy claim |

The current QA account could read this Incident through the authorized Product contract but could not directly enumerate the Home Site tables. No broader tenant query was attempted.

## LEARNING TRUTHFULNESS

The rules/learning UI now labels elapsed days as collection-window coverage, labels `confidence_level` as baseline sample maturity, documents the per-camera `min(0.98, samples/288)` formula and the Site-level minimum across sampled camera baselines, exposes sampled/expected physical camera coverage, excludes empty slots and renders unimplemented categories as not measurable. Latest supplied Home state is `1/11` sampled; exact current cycle/sample totals were not measurable under the available Site scope.

## SECURITY AND PRIVACY

Reviewed Ground Truth remains canonical and history-preserving. Dataset kinds cannot mix. The additive migration makes sealed datasets and published runs immutable, enables RLS, revokes direct authenticated writes and grants only server-side service-role persistence. Raw media is not copied by default. Threshold/model changes remain human-approved and versioned.

## QUALITY QA

Focused QA proves precision/recall rules, FN support, median/p95, Wilson intervals, deterministic run identity, synthetic contamination rejection, model comparison on one dataset, no automatic threshold promotion, truthful `1/11` learning coverage and empty-slot exclusion. PUSH 11 Ground Truth, PUSH 17–23 representative domain suites, PUSH 25 security, PUSH 27 observability, typecheck, canonical lint, migration/release checks and the supported Webpack Production build pass. The default Turbopack runner did not complete in this constrained local execution environment because detached duplicate build workers stalled; no compiler or application error was observed, and the supported Webpack build completed all build stages.

## REAL HOME

PUSH 28 changes no camera ingestion, relay, playback, Gateway or Connector runtime. The two existing persistent LaunchAgents were not loaded at the start of validation; they were safely bootstrapped/kickstarted without changing identity, Site, source or camera configuration. After warm-up, the Physical Gateway reported 16 slots = 10 assigned + 6 unassigned, 10 active/progressing relays and zero failed/stalled. The Software Connector reported one connected Tapo, one active/progressing relay, zero failed/stalled and `object_detection_ready`. Total current processing state: 11/11 expected physical cameras progressing, six empty slots excluded. The focused playback contract regression passes; the latest authorized real Product UI proof remains the prior DVR+Tapo Live View evidence rather than a newly claimed visual session.

## NORTH-STAR

Precision, Recall, false-positive rate and confidence calibration move from `FOUNDATION` to `IMPLEMENTED — NEEDS REAL PROOF`. False-negative analysis moves from `NOT STARTED` to `FOUNDATION`. Representative multi-camera/pilot data remains required. Final counts: 24 DONE + REAL PROOF, 25 implemented-needs-proof, 66 foundation, 16 partial, 58 not started, one external; total 190, zero without owner.

## PUSH 29 READINESS

`YES`. All PUSH 28 completion gates recorded above pass. PUSH 29 remains not started and requires a separate instruction.
