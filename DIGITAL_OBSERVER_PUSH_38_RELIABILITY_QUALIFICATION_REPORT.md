# DIGITAL OBSERVER — PUSH 38 RELIABILITY QUALIFICATION REPORT

Date started: 2026-09-11

## CURRENT STATUS

`NOT DONE — SOAK EVIDENCE INCOMPLETE`

The qualification architecture, deterministic scale/chaos harness and real-Home monitor are implemented. Canonical completion remains intentionally blocked until at least 24 actual elapsed hours are recorded, all final gates pass, the dedicated PR merges and `origin/main` is verified. PUSH 39 has not started.

## PRELIMINARY REAL HOME PROOF

A one-minute smoke produced six checkpoints at 100% camera-sample availability: DVR 10/10 and Tapo 1/1 progressing, six empty slots excluded, zero component restarts, one deep playback checkpoint decoding all 11 authorized streams, and one real AI inference in 692 ms. Status remained `NOT_DONE` because elapsed time was only 60,003 ms. This is proof that the harness works, not 24/7 proof.

The baseline exposed large historical relay lifecycle counters. PUSH 38 records only run-relative deltas so old churn cannot be hidden or misattributed. Gateway/Connector memory, process IDs, session counters, relay starts/staleness/errors and log bytes are measured at every checkpoint.

## PRELIMINARY LOAD / CHAOS

The full preliminary synthetic workload completed 200/1,000/4,000 jobs for the 10/100/1,000-camera profiles. Loss, duplicates, dead letters and residual backlog were zero. The five canonical owning QA suites passed and cover 12/12 required fault classes; worker/capacity/queue faults run under active workload. Evidence is local and synthetic/isolated, not multi-host or provider proof.

The capacity curve identifies local SQLite coordination as the current saturation bottleneck. Exact numbers and limitations are in `DIGITAL_OBSERVER_CAPACITY_QUALIFICATION.md` and the tracked JSON result.

## OPEN GATES

- Complete the uninterrupted qualifying 24-hour real-Home interval.
- Evaluate memory/log/relay/session/recovery deltas and flapping from the final ledger.
- Re-check persisted Product learning coverage; local activity sampling alone does not prove Site persistence.
- Perform authorized Product Live View checkpoints at start/end in addition to automated local playback decoding.
- Run final CI/security/regression gates, update evidence ledger, merge PR and verify `origin/main`.

North-Star counts remain 24 `DONE + REAL PROOF`, 36 `IMPLEMENTED — NEEDS REAL PROOF`, 64 `FOUNDATION`, 18 `PARTIAL`, 47 `NOT STARTED`, and 1 `EXTERNAL COVERAGE GAP` until final evidence supports explicit row transitions. Multi-host proof remains not verified. The deferred PUSH 25 billing-role RLS finding remains open and unchanged.
