# DIGITAL OBSERVER — MODEL QUALITY GATES

## Purpose

Candidate models and thresholds are compared on the same sealed dataset version. Results may recommend; they cannot mutate Production.

## Human-approved gate contract

Configurable gates may bound critical-event recall regression, precision/false-positive regression, latency regression, calibration degradation and coverage requirements. Every gate records dataset/model versions, approved tolerance, result and approver. No commercial tolerances are invented in PUSH 28.

## Promotion

`BENCHMARK → COMPARE → REVIEW LIMITATIONS → HUMAN APPROVAL → VERSIONED RELEASE PROCESS`

Automatic model or threshold promotion is prohibited. Synthetic/deterministic results cannot authorize Product-quality claims. A candidate is rejected or held when Ground Truth, coverage or sample size is insufficient.

## Drift

The same versioned metric projections can compare time windows, cameras, Sites and model versions. A material change creates a drift signal for review; autonomous remediation is out of scope.
