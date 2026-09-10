# DIGITAL OBSERVER — PORTABLE INFERENCE WORKER CONTRACT

Date: 2026-09-10
Contract: `observer-inference-worker-v1`

## Interface

A worker advertises an authenticated identity, environment, runtime, capacity class, supported capabilities and model classes. It claims one authorized job, resolves only its scoped input reference, performs inference, and returns `observer-inference-result-v1`. It does not know Product UI, Event or Incident tables.

Eligibility requires all of:

- authenticated and non-revoked PUSH 18 managed-component identity where applicable;
- trusted runtime registration through a process-local, non-serializable admission capability; forged serialized worker registration is denied;
- tenant and Site scope;
- requested capability match;
- requested model-class match;
- unexpired lease/job;
- valid input-reference kind.

Failure is normalized as retryable or non-retryable. No arbitrary shell or broad storage credential is part of the contract.

## Proven environments

The same contract passed in:

1. `EDGE_LOCAL` — the existing local Gateway/Connector inference callback and ONNX runtime.
2. `ISOLATED_PROCESS` — a separate Node process receiving the same validated job and returning the same result shape.

This is portability proof, not Cloud Production or horizontal-scale proof. Container/cloud routing remains PUSH 32/35/36.

## Tracking

Observation and candidate timestamps, source ordering and model/worker provenance survive the worker boundary. Results return to the existing per-camera JournalTracker, so unrelated cameras are not globally serialized and canonical Event semantics do not move into workers.
