# DIGITAL OBSERVER — HYBRID AI ROUTING ARCHITECTURE

Date: 2026-09-10

## Canonical path

`PUSH 29 preprocessing → PUSH 30 scheduler/candidate → PUSH 31 durable AI job → PUSH 32 eligibility/router → eligible portable worker → canonical inference result → existing Tracking/Observer → Event`

PUSH 32 adds no queue, Event engine or Product semantics. The Journal uses the same durable queue and existing ONNX worker, but obtains a versioned routing decision before the worker claims the specific job.

## Components

- `observer-execution-target-v1` describes safe capability, policy, health, capacity, locality and evidence attributes.
- `observer-ai-routing-decision-v1` records eligibility, rejections, selection, explanation, failover history and policy version.
- `observer-inference-result-v1` now carries execution target ID/class, routing decision ID, policy version and bounded failover history.
- PUSH 31 queue supports target-bound claim and safe failover release while preserving lease, retry, expiry, fairness and one-time result consumption.

## Available environments

- `EDGE_LOCAL`: real existing Gateway/Software Connector ONNX runtime; real-camera routing reference.
- `LOCAL_DEDICATED` backed by `ISOLATED_PROCESS`: deterministic portable second-environment QA.
- `CLOUD_SHARED` / `CLOUD_DEDICATED`: contract and adapter boundary only. No authorized Cloud inference provider is configured, so no real Cloud claim is made.

Future Enterprise Edge, customer-local GPU and region-specific shared/dedicated pools can register through the same target contract without changing Observer Core.

## Failure and observability

Retryable target failure uses the same job for bounded failover. Privacy denial and no-target outcomes fail closed. Router telemetry exposes decision count, jobs by target class, rejection reasons, failovers and no-target outcomes; result timing continues to expose queue and inference latency. No frames, private references or credentials enter routing telemetry.
