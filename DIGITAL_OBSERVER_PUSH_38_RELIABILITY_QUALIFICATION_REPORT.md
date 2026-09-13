# DIGITAL OBSERVER — PUSH 38 RELIABILITY QUALIFICATION REPORT

Date started: 2026-09-11

## CURRENT STATUS

`NOT DONE — V7 24H SOAK FAILED; V8 NOT READY`

PUSH 38J read-only investigation confirms that the sole Gateway baseline mismatch is a 98-byte runtime-code edit in `journal-loop.mjs`, written immediately before the current Gateway process started. The edit's code behavior is identifiable, but its authorizing/deployment provenance is not. Per the integrity stop gate, no new baseline was captured or signed, and no live bootstrap occurred. Connector still matches its signed baseline. See `DIGITAL_OBSERVER_PUSH_38J_BASELINE_RECONCILIATION_REPORT.md`; PUSH 38 remains NOT DONE.

PUSH 38I now passes isolated installed OTA-agent discovery/update and persistent crash-loop auto-rollback for both Gateway and Connector, including exact signed known-good restoration. The read-only live dry-run, however, detected one Gateway runtime file changed relative to the authorized legacy baseline. That candidate cannot be treated as an exact live known-good rollback target until reconciled. See `DIGITAL_OBSERVER_PUSH_38I_INSTALLED_OTA_REPORT.md`. No live bootstrap/remediation, real 60-minute pre-soak, or v8 has started; PR #28 remains draft/unmerged.

PUSH 38C remediation is documented in `DIGITAL_OBSERVER_PUSH_38C_PRE_SOAK_CLOSURE.md`. The code fixes and diagnostics do not supersede v7 evidence or satisfy the required real 60-minute pre-soak. V8 has not started.

PUSH 38D's trusted-deployment preflight failed before any live modification: the installed Gateway and Connector lack verified OTA known-good state and still report `development`/`unknown` with the old health contract. The required real pre-soak remains at zero minutes; see `DIGITAL_OBSERVER_PUSH_38D_DEPLOYMENT_GATE_REPORT.md`.

PUSH 38E captured unsigned cryptographic baseline candidates and proved limited isolated runtime restoration without copying live identity/config. This does not establish a trusted known-good or managed rollback; Connector macOS code signing is invalid and the live OTA bootstrap remains unattempted. See `DIGITAL_OBSERVER_PUSH_38_OTA_BOOTSTRAP_REPORT.md`. No live update, pre-soak, or v8 run has started.

PUSH 38F added QA-only signed manifests for the exact legacy candidates and hardened the OTA installed-bootstrap trust path. This is not live known-good, Production signer custody, full legacy-artifact rollback or a deployed remediation release. The original Connector app remains invalidly code-signed. **PUSH 38 remains NOT DONE; PR #28 remains draft/unmerged; the 60-minute pre-soak and v8 have not started.**

PUSH 38G subsequently produced exact-commit QA-signed Gateway/Connector remediation archives, a strict-valid *derived* QA Connector rollback archive, and isolated launchd-managed baseline→bad update→rollback→remediation tests for both profiles. Signed trust-root rotation/revocation and release negative QA passed. This does **not** change live Home and does **not** qualify complete profile supervisor or live bootstrap. See `DIGITAL_OBSERVER_PUSH_38G_MANAGED_RELEASE_REPORT.md`; live readiness is still **NO** and the real 60-minute gate remains **NOT STARTED**.

PUSH 38H now exercises the actual Gateway/Connector supervisor scripts under isolated launchd, journals an installed-slot bootstrap that preserves the original running PID, and builds new QA-signed remediation artifacts from the final hardened source. The live file/service dry-run is read-only. The new QA tests do **not** deploy to Home or start a qualification clock. The lack of a wired installed OTA-agent polling/enrollment entrypoint, and the unqualified real macOS login/crash-loop escalation boundary, remain explicitly open in `DIGITAL_OBSERVER_PUSH_38H_SUPERVISOR_BOOTSTRAP_REPORT.md`. Read-only live health also showed intermittent stalled relays; no 11/11 stability claim is made. PR #28 remains draft/unmerged; v8 and PUSH 39 have not started.

V7 completed 86,400,104 ms but failed camera availability, component health, AI progress and checkpoint coverage gates. See `DIGITAL_OBSERVER_PUSH_38_V7_FAILURE_ANALYSIS.md`, `DIGITAL_OBSERVER_PUSH_38_ROOT_CAUSE_REGISTER.md`, and `DIGITAL_OBSERVER_PUSH_38_V8_READINESS_REPORT.md`. The previous text below describes pre-v7 expectations and is historical, not current qualification status. No 60-minute post-remediation stability gate or v8 run has begun. PR #28 must remain draft/open; PUSH 39 has not started.

The qualification architecture, deterministic scale/chaos harness and real-Home monitor are implemented. Canonical completion remains intentionally blocked until at least 24 actual elapsed hours are recorded, all final gates pass, the dedicated PR merges and `origin/main` is verified. PUSH 39 has not started.

## PRELIMINARY REAL HOME PROOF

A strengthened one-minute smoke produced seven checkpoints at 100% camera-sample availability: DVR 10/10 and Tapo 1/1 progressing, six empty slots excluded, zero supervisor/runtime restarts, one deep playback checkpoint decoding all 11 authorized streams, one real AI inference in 792 ms and learning/activity samples from 11/11 sources. Status remained `NOT_DONE` because elapsed time was only 61,056 ms. This is proof that the harness works, not 24/7 proof.

The baseline exposed large historical relay lifecycle counters. PUSH 38 records only run-relative deltas so old churn cannot be hidden or misattributed. Gateway/Connector supervisor and runtime PIDs, combined CPU/RSS, DVR session counters, relay starts/staleness/errors, health flapping, outage duration, checkpoint gaps, log bytes, cloud 401s, `setTypeOfService EINVAL`, and fatal/uncaught log signals are measured explicitly.

The v7 run (which ultimately failed) began at `2026-09-11T21:08:41.574Z` and completed after `2026-09-12T21:08:41.574Z`. Its first checkpoint proved 10/10 DVR plus 1/1 Tapo progression, per-camera frame-input evidence, 11/11 authorized playback decodes, real inference on 10/10 AI-eligible sources, 11/11 learning/activity sampling, both supervisors and both child runtimes, queue depth zero, and zero manual interventions. DVR channel 2 is explicitly excluded only from visual-event inference because its current parking policy has no configured crossing line and therefore advertises no supported visual Event type; it remains included in source, playback, freshness and learning reliability. Earlier v1-v6 attempts are non-qualifying evidence and will not be merged as PASS.

Authorized Production Product UI verification at the start checkpoint showed the Live View inventory as eleven transmitting sources, with no empty DVR slots presented as failed cameras. DVR channel 1 and the independent Tapo camera each progressed from `connecting` to `LIVE` in the Product player. This supplements, rather than replaces, the automated eleven-camera playback decode.

## PRELIMINARY LOAD / CHAOS

The full preliminary synthetic workload completed 200/1,000/4,000 jobs for the 10/100/1,000-camera profiles. Loss, duplicates, dead letters and residual backlog were zero. The five canonical owning QA suites passed and cover 12/12 required fault classes; worker/capacity/queue faults run under active workload. Evidence is local and synthetic/isolated, not multi-host or provider proof.

The capacity curve identifies local SQLite coordination as the current saturation bottleneck. Exact numbers and limitations are in `DIGITAL_OBSERVER_CAPACITY_QUALIFICATION.md` and the tracked JSON result.

## OPEN GATES

- Complete root-cause closure and the 60-minute pre-soak gate, then begin a new uninterrupted qualifying v8 interval of at least 24 hours.
- Evaluate memory/log/relay/session/recovery deltas and flapping from the final ledger.
- Re-check persisted Product learning coverage; local activity sampling alone does not prove Site persistence.
- Repeat the authorized Product Live View checkpoint at the end in addition to automated local playback decoding.
- Run final CI/security/regression gates, update evidence ledger, merge PR and verify `origin/main`.

North-Star counts remain 24 `DONE + REAL PROOF`, 36 `IMPLEMENTED — NEEDS REAL PROOF`, 64 `FOUNDATION`, 18 `PARTIAL`, 47 `NOT STARTED`, and 1 `EXTERNAL COVERAGE GAP` until final evidence supports explicit row transitions. Multi-host proof remains not verified. The deferred PUSH 25 billing-role RLS finding remains open and unchanged.
