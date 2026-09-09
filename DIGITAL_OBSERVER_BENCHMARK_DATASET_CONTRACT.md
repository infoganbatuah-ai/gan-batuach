# DIGITAL OBSERVER — BENCHMARK DATASET CONTRACT

Contract: `observer-quality-benchmark-v1`
Owner: canonical PUSH 28

## Dataset identity and immutability

Every published dataset has an immutable dataset key/version, type, provenance, inclusion/exclusion policy, covered Sites/cameras/scenes/event types/time window, reviewed sample count, Ground Truth state, model/runtime versions, creator and review/seal timestamps. A sealed version cannot be edited or deleted; corrections create a new version. Benchmark runs are append-only and have a deterministic run key derived from dataset version, model, filters, threshold configuration and sorted sample IDs.

## Dataset types

| Type | Meaning | May support Product quality claims? |
|---|---|---|
| `DETERMINISTIC_QA` | Stable regression fixtures | No; regression behavior only |
| `REVIEWED_REAL_PRODUCT` | Authorized Production `REAL_CAMERA_AI` records promoted through PUSH 11 Ground Truth | Yes, only within disclosed coverage and sample limits |
| `PILOT` | Authorized external-site study | Only after its review/purpose/retention gates pass |
| `SYNTHETIC` | Generated engineering inputs | No |

Kinds cannot be mixed inside a run. `mock`, `local_shadow`, unreviewed feedback and superseded Ground Truth are excluded from reviewed Product metrics.

## Ground Truth and missed-event opportunities

PUSH 11 `observer_ground_truth_reviews` remains canonical. Raw user feedback is not Ground Truth. Reviewed/corrected history is retained; superseded revisions do not enter current results. Recall requires a review design that explicitly enumerates expected opportunities, including events the system did not emit. Without that coverage, the result is `RECALL NOT MEASURABLE`.

## Privacy and access

Datasets default to structured metadata and authorized evidence references; raw video is not copied automatically. Customer-derived media requires tenant authorization, purpose limitation, retention, access control and audit. The Product API is Digital Observer-admin authorized, private/no-store and never exposes credentials, private stream URLs or cross-tenant raw Ground Truth.

## Reproducibility

A run records dataset ID/version, model version, benchmark configuration, run ID, metric numerators/denominators, coverage, confidence interval, limitations and timestamps. Production thresholds are never changed by a benchmark run.
