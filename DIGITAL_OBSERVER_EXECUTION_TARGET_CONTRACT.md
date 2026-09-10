# DIGITAL OBSERVER — EXECUTION TARGET CONTRACT

Date: 2026-09-10
Contract: `observer-execution-target-v1`

## Purpose

An execution target is an authorized place where an existing `observer-ai-job-v1` may run. It is compute metadata, not Product truth. Adding a target never changes Event, Incident, Risk, Verification or Decision semantics.

## Target fields

The immutable versioned contract records target ID/class, worker environment, provider and region; supported capabilities, model classes and input kinds; health and availability; bounded concurrency, current load and queue depth; tenant eligibility; privacy eligibility; input locality/source scope; expected latency; measured-quality and reliability evidence; and a non-authoritative cost-accounting hook.

Supported classes are `EDGE_LOCAL`, `LOCAL_DEDICATED`, `CLOUD_SHARED` and `CLOUD_DEDICATED`. A class being representable does not mean a provider is configured or verified.

## Trust boundary

Target strings do not authorize a worker. PUSH 18 device identity and PUSH 31 trusted runtime registration remain mandatory. The queue independently checks worker identity, tenant/Site scope, runtime registration capability and requested capability/model class before lease or ACK.

Targets contain no credentials, private media references, signed URLs or signing material. Secret-shaped metadata is rejected. Input accessibility is explicit and scoped; a local-only reference cannot be routed to a target that cannot resolve it.

## Evidence semantics

Latency, quality and reliability include sample counts. Quality affects preference only when explicitly marked measured with a sufficient sample. Detector confidence is never treated as measured quality. Cost metadata exists only as a hook; PUSH 32 never optimizes from unmeasured prices.
