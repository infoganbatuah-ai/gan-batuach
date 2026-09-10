# DIGITAL OBSERVER — AI WORK REDUCTION METRICS

Date: 2026-09-10

## Required counters

The preprocessing runtime reports frames available, frames cheaply evaluated, native signals, candidates, duplicate/coalesced candidates, expensive AI jobs requested/avoided, fallback events, canonical Events, errors and preprocessing latency.

`AI work reduction = jobs avoided / (jobs requested + jobs avoided)`.

The denominator is mandatory. A detector request still counts as AI work when the model returns unavailable. Empty DVR slots are outside the workload denominator and must produce zero jobs.

## Quality comparison

PUSH 28 dataset/run contracts compare fixed baseline and preprocessing-enabled results on the same dataset/model version. Precision, recall, FP/FN, latency and Event count remain separate from compute. Recall is `NOT MEASURABLE` without false-negative Ground Truth. A result never mutates Production thresholds automatically.

## Bounded real-input result

Read-only run on 2026-09-10:

- duration: 6,016 ms
- sources: 10 populated DVR channels + 1 Tapo
- requested/successful cheap samples: 22/22 over two rounds
- successful detector results during baseline requests: 20/22
- fixed baseline AI requests: 22
- preprocessing-enabled AI requests: 11
- AI requests avoided: 11/22 (50%)
- candidate-triggered jobs: 0 in this quiet window
- never-blind fallback jobs: 11
- six empty DVR slots: 0 AI jobs

This is a short Home measurement, not representative Product-wide savings. No natural qualifying Event occurred, recall is not measurable, and broad Production enablement remains human-gated.
