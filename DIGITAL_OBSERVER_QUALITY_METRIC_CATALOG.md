# DIGITAL OBSERVER — QUALITY METRIC CATALOG

## Semantic separation

| Concept | Meaning |
|---|---|
| Model confidence | Model output for one inference; not observed accuracy |
| Verification confidence | Confidence in verification outcome |
| Risk score | Policy/context risk assessment |
| Baseline maturity | Sufficiency of context samples/time coverage |
| Learning coverage | Camera/time/scene/Ground-Truth coverage |
| Measured quality | Benchmark result against reviewed versioned Ground Truth |

## Metrics

- Precision: `TP / (TP + detector FP)`, always with numerator, denominator, dataset, event/model scope and Wilson 95% interval when defined.
- Recall: `TP / (TP + FN)` only when expected-positive/false-negative Ground Truth is complete; otherwise `NOT MEASURABLE`.
- False positives: categorized as detector, duplicate Event, wrong type/direction, false Incident or future false identity candidate. Detector and Incident quality remain separate.
- False negatives: explicit expected-but-missing records; absence of an Event row is representable and is never silently treated as a true negative.
- Latency: separate observation→detection→Event→Incident→Risk→Verification→Decision→action stages; report median, p95 and sample size.
- Calibration: confidence bins and expected calibration error only when sample size supports interpretation. A `0.95` score is not asserted to mean 95% accuracy.
- Coverage: cameras, Sites, scenes, time/day-night, event types, reviewed samples and dataset type/version.
- Review coverage: eligible, reviewed, reviewed Ground Truth, unreviewed, corrected/disputed. Unknown eligible population is `NOT MEASURED`, not zero.

Rates never appear without denominators. Unsupported metrics display `NOT YET MEASURABLE`, never fake `0%`.
