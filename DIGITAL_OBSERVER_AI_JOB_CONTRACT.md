# DIGITAL OBSERVER — AI JOB CONTRACT

Date: 2026-09-10
Contracts: `observer-ai-job-v1`, `observer-inference-result-v1`

## Boundary

An AI Job is durable internal work. It is never an Event, Incident or Evidence. Only the existing Tracker/Observer path may turn a verified inference result into a canonical Product Event.

## Job

Every job has a stable job ID and idempotency key; tenant, Site and source binding; original candidate/observation time; candidate provenance; CRITICAL/HIGH/NORMAL/LOW/LEARNING priority; purpose; requested capability and model class; a local scoped input reference; deadline/expiry; bounded retry policy; privacy constraints; scheduler reason/version; and per-source ordering key. `canonical_event` is always false.

Input references identify an ephemeral source sample inside the authorized managed component. They contain no password, token, signed URL, camera URL or raw frame. The persisted database is owner-only (`0600`). Temporary inference media remains under the existing Gateway frame/evidence lifecycle and is not retained by the queue.

Realtime jobs expire. Expired jobs are never leased or acknowledged and cannot create fresh activity. The actual sampled-frame time is retained separately from the candidate time in the result.

## Result

Each result binds job/idempotency/source scope and records model/version, runtime, worker/environment, detector output, sampled observation time, candidate observation time, queue wait, inference time and safe source anchor. Detector confidence remains model confidence—not Risk, Verification or measured accuracy. Results are consumed once by the canonical Tracker.

## Security

Worker identity must be authenticated, non-revoked and explicitly scoped to the job tenant and Site. Queue admission also requires a process-local, non-serializable registration capability supplied by the trusted runtime; a worker cannot authorize itself by submitting identity booleans or capability strings. Capability and model-class matching are mandatory. Secret-shaped fields are rejected. Device ID alone grants nothing. Production cloud authorization remains PUSH 18 Ed25519 device authentication; the local queue cannot bypass it.

## Compatibility

Schema version 1 is immutable. A future version requires an explicit reader/migration. PUSH 21 cloud-delivery records and PUSH 31 AI Jobs are deliberately different contracts and tables.
