# DIGITAL OBSERVER RELIABILITY RESULT SCHEMA

Contract: `observer-reliability-qualification-v1`

Every qualification result records the exact build/runtime, evidence labels, start/end timestamps, elapsed milliseconds, checkpoint count, expected-camera denominator, component/process state, frame progression, playback probes, AI probes, learning coverage, resources, queues, fault outcomes, loss, duplicates, tenant leakage and manual intervention.

Allowed evidence labels are `REAL_PHYSICAL_CAMERA`, `REAL_HOME`, `LOCAL_MULTI_PROCESS`, `LOCAL_MULTI_NODE`, `ISOLATED_POSTGRES`, `SYNTHETIC_LOAD`, `MULTI_HOST`, `EXTERNAL_PILOT`, and `PRODUCTION`. Labels describe evidence; they are not interchangeable.

`PASS` is structurally invalid before `86,400,000` real elapsed milliseconds. A short or interrupted run remains `NOT_DONE` with `SOAK_EVIDENCE_INCOMPLETE`; test code cannot override this by changing a displayed status. Availability uses eleven expected physical cameras, never sixteen DVR slots plus Tapo.

Checkpoint records use `observer-reliability-checkpoint-v1` and are append-only NDJSON. The runner writes state and final JSON atomically with mode `0600`. Credentials, private playback URLs and raw frames are never written.

Machine evidence lives under `qa-evidence/push-38/`. Final evidence contains the completed run result and an integrity-preserving checkpoint ledger; preliminary data is explicitly labelled.
