# DIGITAL OBSERVER — PUSH 38 RELIABILITY QUALIFICATION REPORT

Date started: 2026-09-11

## CURRENT STATUS

`NOT DONE — 0.2.90 V8 FAILED/STOPPED; HOST-ISOLATED REQUALIFICATION PENDING`

## 2026-10-07 0.2.90 V8 HOST-INTERFERENCE FAILURE AND QUALIFICATION GUARD

Gateway `0.2.90-p38-health` and Connector `0.2.40-p38-health` entered a new
V8 at `2026-10-07T05:54:58.652Z`. The run was stopped and frozen after
16,536,135 ms / 276 checkpoints. It is failed and none of its duration is
reusable. Checkpoint 264 timed out on both Gateway health and liveness while
the same supervisor/runtime PIDs remained present. The prior checkpoint had
already slowed to 2,282 ms; the next checkpoint recovered without restart to
10/10 DVR progression, while the recorded event-loop maximum increased from
6,371.148 ms to 16,978.543 ms. Playback passed 55/55 probes, AI passed 55/55,
Tapo passed 276/276, and no Gateway/Connector process restart occurred.

Read-only host diagnosis found the shared developer Mac saturated by unrelated
development/UI/VM work: the worst sample had no idle CPU, load near 42 and
very high disk traffic while the Gateway itself used little CPU. Stopping only
the two nonessential Development Next servers and two nonqualification `gbi`
VM profiles was fully reversible and left the Gateway, Connector, HOME_QA
control plane and dedicated `push38t` qualification database running. The next
20 Gateway probes all passed at 10/10 with no relay renewal; maximum health
latency fell to 63 ms and most samples completed in 1–5 ms.

The cause is therefore narrowed to qualification-host CPU/I/O contention with
relay freshness/rescue amplification, not DVR authentication, session rotation,
socket failure or a process crash at the incident. Because the failed monitor
did not yet record host telemetry per checkpoint, the run remains a Product
qualification failure rather than being excused after the fact. The durable
monitor now fails closed before launch when forbidden development workloads,
saturated normalized load or unstable health latency are present, records host
pressure at every checkpoint, and reports host interference separately without
weakening any camera, playback, AI or component-health gate. Its five-sample
live dry-run passed with no forbidden workload, normalized one-minute load
0.8023–0.8287, Gateway health p95 22 ms and Connector p95 8 ms. Machine-readable
evidence is in `DIGITAL_OBSERVER_PUSH_38_V8_HOST_INTERFERENCE_EVIDENCE.json`.
Exact-commit CI, a new canary and a new pre-soak are required before a new V8.
`main` and Production remain unchanged.

## 2026-10-06 0.2.79 CANARY FAILURE AND 0.2.80 SUCCESSOR

The evidence-bound `0.2.79-p38-health` retry completed a fresh 900,079 ms
canary and failed at checkpoint 13. CH6 and CH10 temporarily had no canonical
media owner after fresh recorder input continued but VideoToolbox output
stalled. The first exclusive software response used the generic probation
window before the existing three-second no-advance reopen, exhausting roughly
54–55 seconds of retained HLS. Both channels recovered on libx264 by the next
checkpoint. There was no Gateway or supervisor restart, stale recorder input,
authentication rejection, playback failure, AI failure or Tapo failure.
Camera-sample availability was 148/150, so the run is failed and non-reusable.

Runtime commit `a4bd57769d92e8abba4a9e89d8cc762b8ef83ba6` applies the existing
three-second no-advance bound to that first software response only after
hardware-output failure is proven. Promotion still requires four distinct
advances over six seconds. Immutable Gateway `0.2.80-p38-health` has SHA-256
`d8b7adb3f815b91ae186034a6c3dabb54cebad410c3df796ae1a6f120b1f0d94`
and size 135,875,494 bytes. Release/rollback tooling commit
`e4f1ec749ade6c968f65b87c1e8983f63f09f7e0` uses the canonical manager to
quarantine failed `0.2.79` and restore signed `0.2.77` before the successor is
eligible. Local domain 33/33, security 37/37, focused relay 35/35 and the
release/rollback tests pass. Protected exact-commit CI passed 6/6 in run
`37386032992` for final preparation commit
`c643e188f10b2770693786088c7c864af78382b5`. Protected signing run
`37386419906` issued the exact-device AWS-signed manifest and it verified
against the live installed trust registry.

The canonical late-qualification rollback then passed dry-run and apply:
failed `0.2.79` was quarantined and signed `0.2.77-p38-health` was restored as
CURRENT/KNOWN_GOOD. The exact rollback evidence SHA-256 is
`b7c7e7b6cd78911b374be7be7f9a07376082f6178c29ddeba70b8cee4ddcfc3a`.
The signed `0.2.80` archive subsequently passed a controlled-pause real-DVR
Shadow on CH4 for 480,646 ms / 48 checkpoints: playback failures 0, three
single-owner warm handoffs, handoff failures 0, stale input 0 and continuous
HLS 48/48. The wrapper restored exact signed 0.2.77 and live health returned
to nine source-available DVR streams plus Tapo 1/1. Shadow and isolation
evidence SHA-256 values are
`7fb89d0a0276144867f8ca28f684a09a2d5c9b44759b110f0c4b71b60c3c46c1`
and `c43c5ccb1ce19bfb2197c25598d576ba268c38d3bd45e0bd2426c1996bec0e5b`.

Fresh authenticated R2 inventory measured 89 objects / 12,140,676,521 bytes.
At the recorded Standard rate, the unrounded proportional full-month storage
projection is about $0.03211 before tax and would become about $0.03415 after
retaining the new archive. Cloudflare's current official billing policy rounds
usage up to the next GB-month billing unit, so the safe account-level ceiling
is $0.045/month before tax. This exceeds the previously approved $0.015
ceiling, so no upload was performed pending the owner's sole cost exception. Private-R2 round trip,
exact-device OTA, a new canary and a new pre-soak remain.
`main` and Production remain unchanged.

## 2026-10-05 0.2.77 PRE-SOAK FAILURE AND OWNER-TRANSPORT RELEASE FIX

Gateway `0.2.77-p38-health` and Connector `0.2.37-p38-health` passed a fresh
15-minute canary. The following fresh 60-minute pre-soak completed 60 anchored
checkpoints over 3,600,172 ms but failed and none of its duration is reusable.
Camera-sample availability was 98.3333%. Gateway was unavailable at two
checkpoints and Connector at one, with zero supervisor or runtime restarts.
Playback passed 20/20 samples; AI passed 19/20. The immutable restricted run is
`exports/restricted/push38-connector-0.2.37-pre-soak-20261004T2105Z/`.
`result.json` SHA-256 is
`ef8814d5c314fdf8e80ce621644933e84f3ffb955d86471eab1ee21f217fcd73`
and `checkpoints.ndjson` SHA-256 is
`7e6934a28f68920168c30d307a7007e32313614d057fa603edb87070e71f8cbb`.

The run contains two distinct failures. At checkpoint 3, CH3 lost its canonical
owner for 73.69 seconds after an exclusive session-sweep replacement ended in
`EXCLUSIVE_RESCUE_ACQUISITION_FAILED` / `source_timeout`. The live code aborted
the old DVR response and killed FFmpeg, but opened the replacement before the
input pipe and FFmpeg child had actually closed. The recorder could still count
the old per-channel response and withhold or reject the replacement. The scoped
fix now waits for both closures before acquisition, uses a bounded two-second
deadline, fails closed on timeout, and exposes wait/timeout telemetry.

At checkpoint 19, both component probes were delayed together without a process
restart. macOS recorded critical memory/swap/low-disk pressure while a stale
Codex/CUA worker consumed about 160% CPU and 1.1 GiB RSS. Resetting that stale
worker returned load averages from the hundreds to approximately 6.5/8.7/11.3,
memory free to roughly 62%, and free disk to roughly 19 GiB while both live
component PIDs remained unchanged. This is qualification-host interference, not
a recorder authentication/session or camera-runtime crash. Formal canary,
pre-soak and V8 will run with unrelated heavy development/CUA work excluded.

Focused relay QA passes 33/33 plus the existing release regressions. TypeScript,
canonical lint, Production-compatible build, domain 30/30,
security/isolation 37/37, migration health and release contract all pass locally.
Exact-commit protected CI, immutable successor packaging, AWS signature,
private-R2 round trip, exact-device activation, live OTA, a new canary, a new
pre-soak and a new V8 from zero remain. `main` and Production are unchanged.

## 2026-10-04 0.2.75 V8 FINITE-RESPONSE CONTINUITY FAILURE

Gateway `0.2.75-p38-health` passed a fresh 15-minute canary and fresh 60-minute
pre-soak, then started V8 from zero at `2026-10-04T03:13:22.888Z`. V8 was
stopped at `2026-10-04T04:27:32.743Z` after one internal availability failure
and none of its elapsed time is reusable. The immutable failed run contains 75
checkpoints over 4,449,855 ms. At checkpoint 69, nine DVR relay processes and
the Gateway process were alive, but only four DVR sources were progressing and
one had explicit retained-HLS continuity. CH1, CH6, CH7, and CH10 therefore
missed one availability checkpoint. All Product playback and AI probes passed;
there was no Gateway restart, authentication rejection, recorder-session
failure, or host-network outage.

The causal code path is proven. Multiple natural finite DVR responses ended at
nearly the same time and canonical replacements started immediately. The old
relay generation was retained explicitly only for exclusive handoff modes, not
for ordinary finite-response recovery, so four still-fresh HLS generations had
no bounded continuity owner and disappeared from health inputs until their
replacements published. This was a health/media-continuity gap, not a recorder
or process outage.

The scoped correction retains the prior HLS generation for
`FINITE_RESPONSE_RECOVERY` only while the one canonical recovery/replacement is
in flight and only until the existing hard-stale deadline. It also emits an
explicit stalled source row when neither progression nor valid retained
continuity exists. Deterministic coverage includes simultaneous nine-source
finite response ends, hard-stale fail-closed behavior, missing-recovery denial,
and source-health serialization. Focused relay/common-cause QA passes 55/55;
TypeScript, canonical lint, local build, domain 30/30, security/isolation 36/36,
migration health, and release contract also pass locally. Exact-commit protected
CI, immutable successor packaging, cost approval, AWS signature, private-R2
round trip, live OTA, a new canary, a new pre-soak, and a new V8 from zero still
remain. `main` and Production are unchanged.

The restricted evidence pointer is
`exports/restricted/push38-gateway-0.2.75-v8-20261004T0313Z/`.
`result.json` SHA-256 is
`dd46c2f58102ea1fd00828323c38634ac1614b9dfced56895be73759697755ec`,
`checkpoints.ndjson` SHA-256 is
`6e65bae6257f5a15c7ce7108752b755be81c2b2d113afad7ec1a2e91afabfbae`,
and the redacted failure summary SHA-256 is
`d3e4f2d5aa143dd67bc0394b74fd75114e27f80e7bd3f56d1a69f440f0b34a56`.

## 2026-10-04 0.2.74 PRE-SOAK FAILURE AND 0.2.75 SUCCESSOR

Gateway `0.2.74-p38-health` was published to the existing private R2 bucket,
round-trip verified, AWS-signed for the exact Home Gateway, accepted by the
installed public trust, and promoted live through managed OTA. Its new
15-minute canary passed. Its new 60-minute pre-soak did not: one checkpoint
reported only 2/9 source-available DVR channels while the component process,
recorder session, network and host remained live. The failed run is preserved
under restricted run ID `push38-gateway-0.2.74-pre-soak-20261003T215117Z` with
60 checkpoints over 3,600,018 ms, one source-degraded checkpoint, zero
component-unavailable checkpoints, zero process/supervisor restarts, zero
socket/session/authentication failures, 252 relay starts, zero stale-input
events, and zero playback or AI failures. It is not qualifying pre-soak or V8
duration.

The causal sequence is explicit in checkpoints 29–31. All nine exclusive
session-sweep replacements had been promoted after their first playlist write
with `last_handoff_output_advances = 0`. Seven of those owners stopped together;
the two channels that entered the existing output-rescue path proved five
advances and remained healthy. Seven clean source ends and recovery starts then
restored 9/9. This narrows the defect to weak session-sweep promotion proof, not
authentication, the shared login, socket failure, process crash, or CPU
saturation.

Source commit `0a41a628a79b6a9ef3f43b031bf802371f9913ed` applies the existing
four-distinct-advances over six seconds confirmation contract to ordinary and
exclusive session sweeps. Focused handoff/common-cause QA passes 54/54. The
immutable successor package is `0.2.75-p38-health`, 135,864,532 bytes, SHA-256
`20d96603a9334ef85adb8e134fc81fce753b8bf5d76d15534666ce64b8372f80`,
with signed `0.2.74` as the exact rollback predecessor. Release preparation is
preserved at commit `5cea1599db2a868ec813661d4ee58ea4a09a19f9`; exact-commit CI is in
progress. No 0.2.75 signature, R2 upload, HOME_QA activation, or live runtime
write is claimed at this checkpoint. V8 remains not started.

## 2026-10-03 V8 HARDWARE-OUTPUT STALL AND 0.2.74 SUCCESSOR

Gateway `0.2.73-p38-health` passed a fresh 15-minute canary and fresh 60-minute
pre-soak, then began V8 from zero at `2026-10-03T18:28:42.714Z`. V8 did not
qualify. At checkpoint 47, CH3 disappeared for one checkpoint while the Gateway
process, DVR input/session and host resources remained available; the same
source was present immediately before and after. The immutable failed V8 result
contains 55 checkpoints over 3,295,641 ms, one source-degraded checkpoint, zero
component-unavailable checkpoints, zero process restarts, zero socket/session/
authentication failures, and zero playback or AI probe failures. V8 was stopped
and is not reused as qualifying duration.

Commit `d6403447eded40e341f01b2067ccacf8d564a657` adds the evidence-gated
VideoToolbox output-stall rescue and isolates HLS namespaces by service port.
Deterministic relay tests, TypeScript and canonical lint passed locally. Release
preparation commit `66964698f7cba0f72331c8bde0bb5ff1d36d2aba` passed all six
Digital Observer CI gates. The exact immutable package is
`0.2.74-p38-health`, 135,864,508 bytes, SHA-256
`f43358023c15d975003fa86a41cdd53ced8f2f70294f65ff4b9ddb98f01e06b4`.
Protected GitHub run `37149507888` issued the exact-device AWS KMS-signed
manifest; the live installed trust registry accepted it and the local archive
matched its signed size/hash.

The archive was subsequently approved, uploaded to private R2, round-trip
verified, exact-device activated, and promoted through managed OTA. A fresh
canary passed; the later failed pre-soak and its 0.2.75 successor are recorded
in the newer section above. `main` and Production remain unchanged.

## 2026-10-03 RELAY/SESSION REMEDIATION UPDATE

The failed 60-minute pre-soak remains immutable evidence. Three controlled
single-channel real-DVR Shadow runs isolated the failure sequence without
changing Product identity or camera configuration. Removing FFmpeg's artificial
`-readrate 1` from the already-live DVR response eliminated one source of
15–30-second input/HLS freezes, but a finite recorder response still produced a
renewal gap. The final candidate moves the evidence-gated shared-session renewal
to the measured two-minute boundary, serializes one exclusive per-channel epoch
sweep through the existing handoff machinery, keeps one relay owner, drains and
logs out retired sessions, and preserves the existing retry/backoff contract.

The final real-DVR Shadow ran for 901,263 ms across 60 checkpoints. It completed
seven session rotations and seven handoffs with zero playback failures, zero
handoff failures, zero stale input/playlist events, zero socket errors, zero
recovery starts, zero retired-session backlog, and zero measured HLS stagnation.
The exact signed live release was restored after the isolated run. The candidate
also fixes the separately observed undefined-owner cleanup crash that caused the
signed 0.2.67 successor to enter the OTA crash guard.

All six local CI gates pass on the current candidate: TypeScript, canonical
lint, Production-compatible build, domain 30/30, security/isolation 34/34,
migration health, and release contract. High/Critical dependency findings are
zero; the upstream `braces` depth-limit fix is pinned as a reviewed local
backport with deterministic QA while no patched registry release is available.
The machine-readable evidence index is
`DIGITAL_OBSERVER_PUSH_38_RELAY_HANDOFF_REMEDIATION_EVIDENCE.json`.

This is not yet a live reliability PASS. The next gate is an exact-device
AWS-signed successor containing the complete fix, followed by a new 15-minute
canary and a new 60-minute pre-soak. V8 remains not started.

## 2026-10-02 RELAY/HANDOFF CLOSURE UPDATE

The completed 60-minute pre-soak remains immutable failed evidence: 60 checkpoints,
98.33% overall availability, 11 Gateway-unavailable checkpoints across seven
windows, 437 relay starts, 224 stale-input events, and one CH3 playback failure.
The run had zero process restarts, zero socket errors, zero DVR session failures,
and zero authentication rejections. This narrows that failure away from process,
socket, shared-login, and authentication collapse and toward relay renewal,
handoff, and freshness behavior.

The first post-fix live canary (`push38-exclusive-reuse-canary-20261002T0139Z`)
also remains failed evidence. It ran for 900,019 ms with 15/15 checkpoints. The
Gateway process, playback probes, Tapo, and AI were available throughout, but DVR
camera-sample availability was 145/150 (96.6667%). CH4, CH5, CH7, and CH11 each
missed at least one checkpoint. The canary recorded 102 DVR relay starts, 81
successful handoffs, 16 failed handoffs, five recovery/unattributed starts, and
four stale-input events. Pre-soak and V8 were not started.

Chronological evidence showed that this DVR may accept a second HTTP media
request while withholding its response body until the old per-channel response
closes. The 0.2.58 policy required first output from the candidate before it
could release a hard-stale owner. That condition was circular for the observed
recorder behavior: the body-blocked candidate timed out, was discarded, the
stale owner was then stopped, and a third request introduced an ownerless media
gap visible at minute checkpoints.

Commit `d1c3cecb` applies the smallest supported correction. Once the existing
owner is hard stale, the already-acquired, still-running candidate is retained
through the bounded remaining grace, the stale owner alone is released, and the
same candidate must still satisfy the unchanged four-distinct-advances over six
seconds confirmation before promotion. The canonical rollback and recovery
machinery is unchanged. A separate cold-takeover metric makes this path visible.
The static HOME_QA certificate fixture was also made clock-deterministic while
live callers continue to reject expired or near-expiry certificates.

Validation on the exact candidate passed TypeScript, canonical lint, Production-
compatible build, all 30 domain suites, all 33 security/isolation suites,
migration health, release contract, tracked-source secret scans, and the focused
relay/handoff tests (34/34). `npm audit --audit-level=high` reported zero High or
Critical findings and two Moderate findings. The commit is remotely preserved on
`origin/codex/push-38t-qualification`. A new signed Gateway artifact, bounded
real-DVR shadow proof, fresh live canary, and fresh 60-minute pre-soak are still
required before V8 may start.

PUSH 38N classified the prior shared 0/10 DVR window as a **known legacy pre-remediation reliability failure**, not a new deployment blocker. A fresh 600.013-second, 11-check read-only window was 10/10 DVR and 1/1 Tapo throughout, and exact live baseline hashes still matched. **No live write followed:** the protected release trust root is absent and requires authenticated macOS administration; QA release manifests use non-deployable placeholder URLs rather than a verified canonical live rollout. Connector/Gateway remain unmanaged legacy; no canary, pre-soak or v8 began. See `DIGITAL_OBSERVER_PUSH_38N_DEPLOYMENT_GATE_REPORT.md`.

PUSH 38M controlled pre-write check **stopped before all live writes**: exact Gateway and Connector baselines still matched, but the first Home health read showed a shared 0/10 DVR relay stall (Tapo 1/1). The DVR relays recovered on later reads; this does not satisfy the required healthy pre-write gate or prove the common cause resolved. No bootstrap, remediation, 60-minute pre-soak or V8 began. See `DIGITAL_OBSERVER_PUSH_38M_PREWRITE_GATE_REPORT.md`; PR #28 stays draft/unmerged.

PUSH 38L closes the exact Connector seal-transition policy **in isolated QA only**: a signed derivation record proves identical non-signing payload, the exact invalid-seal legacy capture is recovery-only, a distinct strict-valid signed transition release becomes the first managed KNOWN_GOOD, and actual isolated LaunchAgent/installed OTA drills prove transition, remediation discovery, signed-target crash rollback, and bounded first-migration legacy recovery. A zero-write live planner matches the current capture and the device-bound QA record. **No live transition, pre-soak or v8 occurred.** See `DIGITAL_OBSERVER_PUSH_38L_TRANSITION_REPORT.md`; PR #28 remains draft/unmerged.

PUSH 38K pre-write gates matched both signed baseline archives and found Home healthy at one read-only instant, but the **exact live Connector rollback archive fails strict macOS code-signature verification** because sealed bundle contents changed after signing. The installed-slot adapter would reject it. The strict-valid re-signed QA archive has a different hash and was not silently substituted for exact KNOWN_GOOD. Deployment stopped before the first live write; neither device was bootstrapped or updated, and no pre-soak/v8 began. See `DIGITAL_OBSERVER_PUSH_38K_DEPLOYMENT_GATE_REPORT.md`.

PUSH 38J follow-up identified the exact authorized Supabase-egress hotfix that changed the live Gateway `journal-loop.mjs` (+98 bytes). The release boundary correctly includes it. A new exact-current-runtime QA baseline was captured, signed, and restored through isolated automatic managed rollback to its exact artifact SHA. The final zero-write planner matched Gateway 491/491 and Connector 250/250 members. Gateway was 10/10 with six empty slots; Connector initially timed out on bounded health probes but subsequently returned healthy 1/1 Tapo, zero stalled, without intervention. The transient is retained for the later reliability qualification. Controlled QA/pilot bootstrap is technically ready subject to immediate recheck; no live bootstrap, pre-soak, or v8 occurred. See `DIGITAL_OBSERVER_PUSH_38J_BASELINE_RECONCILIATION_REPORT.md`; PUSH 38 remains NOT DONE.

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

- Complete exact-commit CI, protected signing and approved private-R2 publication for 0.2.75.
- Register and activate the exact-device HOME_QA successor, retaining signed 0.2.74 as automatic rollback.
- Run a new 15-minute canary and new 60-minute pre-soak, then start V8 from zero for at least 24 actual hours.
- Complete the bounded HTTPS remote-phone DVR and Tapo playback proof with no client-side Edge installation.
- Evaluate final memory/log/relay/session/recovery, AI, learning, integrity, isolation and Product truthfulness rows against the frozen V8 matrix.
- Preserve final branch/ledger evidence and reconcile the completed PUSH 38 unit into `integration/development`; `main` and Production remain owner-controlled and unchanged.

North-Star counts remain 24 `DONE + REAL PROOF`, 36 `IMPLEMENTED — NEEDS REAL PROOF`, 64 `FOUNDATION`, 18 `PARTIAL`, 47 `NOT STARTED`, and 1 `EXTERNAL COVERAGE GAP` until final evidence supports explicit row transitions. Multi-host proof remains not verified. The deferred PUSH 25 billing-role RLS finding remains open and unchanged.
