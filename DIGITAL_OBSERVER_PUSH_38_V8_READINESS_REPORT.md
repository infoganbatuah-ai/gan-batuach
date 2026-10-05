# PUSH 38 v8 readiness — NOT READY; 0.2.78 V8 FAILED AND SUCCESSOR REQUIRED

2026-10-06 canary update: the one evidence-bound exact-device retry installed
and promoted signed Gateway `0.2.79-p38-health`, but its fresh 900,079 ms canary
correctly failed at checkpoint 13. CH6 and CH10 briefly lost availability while
their recorder inputs were fresh and their VideoToolbox outputs had stalled.
Both hardware owners were correctly quarantined and released; however, the
first exclusive software response still used the generic probation window
before the already-bounded no-advance reopen. The roughly 54–55 second handoffs
exhausted retained HLS, temporarily leaving the two sources without a media
owner. Both recovered on libx264 at the next checkpoint without a Gateway or
supervisor restart, authentication rejection, stale recorder input, playback
failure, Tapo failure, or host resource saturation. The immutable canary passed
30/30 playback samples, 3/3 AI probes and 15/15 Tapo samples, but camera sample
availability was only 98.67%; it remains a failed, non-reusable run. Restricted
result/checkpoint evidence SHA-256 values are
`1f45728786eb022e753ca261dcff60440dd236638b8554dc0d869f6dd1820777` and
`54d43daf62276fd643643e46b498965cf2a14acd59aec1e50053622e486855a6`.

The smallest corrective change applies the existing three-second no-advance
bound to the first software response only after fresh-input hardware-output
failure has been independently proven and the hardware encoder quarantined.
The unchanged promotion gate still requires four distinct advances over six
seconds; freshness, transport/session, quality and rollback contracts are not
relaxed. Focused relay/handoff QA passes 35/35. A new immutable successor,
protected CI, AWS signing, private-R2 round trip, exact-device OTA, fresh canary
and fresh pre-soak are required before any new V8. Main and Production remain
unchanged.

2026-10-05 live-successor update: exact-device Gateway `0.2.79-p38-health`
passed protected CI 6/6 (run `37355404307`), AWS-protected signing, private-R2
round trip, installed-live trust verification and preflight. Its normal OTA
health gate did not observe a continuously running process and automatically
rolled back to signed `0.2.77-p38-health`: `ROLLBACK_REQUIRED` at
`19:30:36.140Z`, `ROLLING_BACK` at `19:30:36.208Z`, and `ROLLED_BACK` at
`19:31:44.123Z`. The failed release is quarantined, its exact rollout is
paused, broad eligibility remains disabled, and no canary/pre-soak/V8 time was
started. The host was simultaneously under extreme unrelated development/UI/VM
pressure; importantly, the restored 0.2.77 known-good also lost liveness and
restarted under that pressure. Resetting one stale automation worker and
stopping only the isolated PUSH 38 QA VM/control-plane workload reduced load
average from about 185 to 31.92 and produced six consecutive HTTP 200 Gateway
liveness/health samples. A subsequent 605,831 ms read-only real-media window
passed all 10 checkpoints: every one of the nine source-available DVR channels
produced an authorized HLS playlist, segment bytes and a decoded current frame;
CH8 remained the one truthful upstream-unavailable source, and six empty slots
remained excluded. Restricted evidence SHA-256 is
`33d1bc4ff42ddb9611246c768279b0f08b23d9d03c05bd08e06932019c9ddce7`.
The exact 0.2.79 release has zero prior retry authorizations, so this evidence
can support at most one exact-device retry through the existing quarantine
contract after the retry tool and its canonical CI gate pass. The current and
known-good runtime remains 0.2.77; main and Production remain unchanged.

2026-10-05 rollback-boundary update: while the signed 0.2.79 successor was
being qualified side-by-side, the installed 0.2.78 watchdog independently
detected another sustained liveness failure and automatically rolled back at
`2026-10-05T16:30:47.090Z`. The exact current and known-good release is now
signed Gateway `0.2.77-p38-health`; 0.2.78 is quarantined with
`EDGE_UPDATE_CRASH_LOOP`. The first 0.2.79 manifest was never activated and is
superseded because it required 0.2.78 as both its only compatible predecessor
and rollback target. The immutable 0.2.79 runtime bytes are unchanged, but a
new release identity must bind compatibility and rollback to the recovered
0.2.77 known-good. Two parallel one-channel Shadows also showed recorder/test
interference: CH3 failed in both live and candidate paths during the same
source window, and the CH4 candidate remained responsive while live 0.2.78
health was unavailable. The next real-DVR proof therefore uses the existing
controlled launchd pause/finally-restore method rather than concurrent recorder
sessions. No corrected release has been activated; canary, pre-soak and V8 have
not restarted.

2026-10-05 failure update: the V8 run started at
`2026-10-05T09:53:54.087Z` and was stopped at `2026-10-05T13:40:58.708Z`
after 228 checkpoints and 13,624,621 ms. None of that duration is reusable.
The Gateway health endpoint timed out, the child disappeared after the
sustained-down watchdog window, and launchd restarted the signed 0.2.78
service. Playback passed 40/40 samples and AI passed 4/4, but V8 failed its
component/process and camera-availability gates.

The failure is causally narrowed to synchronous recursive removal of retired
HLS generation directories on the Node event loop. Two failed rescue/handoff
paths scheduled their cleanup at the same 30-second boundary immediately before
the liveness loss. The live code then used recursive `rmSync`; CPU, RSS, open
handles, recorder authentication/session state, sockets and macOS sleep do not
explain the outage. The successor uses a serialized asynchronous cleanup queue,
rechecks active ownership before each removal, remains bounded to the HLS root,
contains removal failures, and leaves startup crash scavenging unchanged.

Focused relay QA passes 35/35, liveness/common-cause/OTA health tests pass, and
all six local Digital Observer CI gates pass. This is not live success yet. The
fix commit `cf279d83d3ebc1f685da8bf7d82c0fb13fb89d13` passed all six protected
GitHub CI gates in run `37334623617`. Immutable Gateway `0.2.79-p38-health`
was built at 135,873,321 bytes with SHA-256
`83aaf23ce84efa3c66c9d306592cd010839a7c0d8e3c5d9bc9642d68d72908cd`.
It still requires AWS signing, private-R2 round-trip verification,
exact-device OTA, a fresh canary, a fresh pre-soak, and a completely new V8
from zero. Machine-readable
evidence is in `DIGITAL_OBSERVER_PUSH_38_V8_LIVENESS_FAILURE_EVIDENCE.json`;
restricted raw evidence remains outside Git under run ID
`push38-v8-0.2.78-20261005T0953Z`.

2026-10-05 final start-gate update: Gateway `0.2.78-p38-health` is signed,
installed, and promoted to CURRENT + KNOWN_GOOD; Connector
`0.2.37-p38-health` remains signed CURRENT + KNOWN_GOOD. The new canary passed
15/15 checkpoints over 903,346 ms and the new pre-soak passed 60/60
checkpoints over 3,600,029 ms. Both runs recorded 100% availability for the
nine source-available DVR cameras plus Tapo, zero component/source-unavailable
checkpoints, zero stale-input events, zero process restarts, successful
playback and AI probes, zero acknowledged data loss, zero duplicate Product
effects, zero cross-tenant leakage, and zero manual intervention. CH8 remains
truthfully excluded only as the independently verified upstream-unavailable
DVR source; six slots remain empty. The 35-row V8 qualification matrix is
refrozen against the exact live releases and immutable prerequisite hashes.
The next permitted action is a new V8 run from zero for at least 86,400,000 ms.

2026-10-05 update: Gateway `0.2.77-p38-health` and Connector
`0.2.37-p38-health` passed a fresh canary, but the next fresh 60-minute
pre-soak failed at CH3 during an exclusive owner replacement and at one
host-wide checkpoint under critical development-host pressure. The immutable
run completed 60 checkpoints over 3,600,172 ms and is not reusable. The scoped
Gateway correction waits for both the old DVR input pipe and FFmpeg process to
close before requesting the replacement response; it fails closed after a
bounded deadline and exposes release-wait telemetry. All six local gates and
focused deterministic QA pass. A signed exact-device successor, live proof, a
new canary and a new pre-soak are still required. V8 remains not started.

2026-10-02 update: the completed post-remediation 60-minute pre-soak failed and
is preserved as failed evidence. A subsequent 900,019 ms canary for Gateway
0.2.58 also failed the DVR camera-sample gate at 145/150 despite 100% Gateway
process, playback-probe, Tapo, and AI availability. The narrowed cause is a
body-blocked replacement request on a recorder that permits only one productive
HTTP media response per channel: the previous policy waited for candidate bytes
that could not arrive until the hard-stale owner released the recorder slot.
Commit `d1c3cecb` reuses the acquired candidate after the bounded hard-stale
owner release and preserves the unchanged sustained-output promotion gate. The
exact candidate passes all six local CI gates plus focused deterministic tests
and is remotely preserved. V8 remains blocked pending a newly signed Gateway
artifact, bounded real-DVR proof, a fresh passing 15-minute canary, a fresh
passing 60-minute pre-soak, and a frozen V8 qualification matrix.

PUSH 38N: 10-minute read-only current-state gate PASS (600.013 seconds, 11/11 checks, DVR 10/10, Tapo 1/1); Gateway and Connector exact live baselines MATCH. The prior 0/10 event remains a known unresolved legacy reliability failure. The protected QA trust root is absent and needs authenticated local administration, and the QA artifact URLs are not deployable through the live canonical OTA path. **No live transition, remediation, 15-minute canary, 60-minute pre-soak or v8 started.** See `DIGITAL_OBSERVER_PUSH_38N_DEPLOYMENT_GATE_REPORT.md`; PR #28 remains draft/unmerged.

PUSH 38M pre-write gate **failed before any live change**: both exact baselines matched, but the Gateway reported 0/10 DVR relays progressing and 10 stalled on the first health read; Tapo remained 1/1. A later 10/10 recovery does not qualify the unhealthy baseline. No live transition, bootstrap, remediation, 60-minute gate or V8 started. See `DIGITAL_OBSERVER_PUSH_38M_PREWRITE_GATE_REPORT.md`.

PUSH 38L has an isolated QA-only one-time Connector legacy transition with a strict-valid signed managed KNOWN_GOOD and a separate exact legacy recovery-only path. Both isolated service-manager paths and the zero-write live compatibility planner passed. This is **READY FOR A LATER CONTROLLED LIVE TRANSITION**, not V8 readiness: no live bootstrap/remediation, 60-minute pre-soak or V8 has run. See `DIGITAL_OBSERVER_PUSH_38L_TRANSITION_REPORT.md`; PR #28 remains draft/unmerged.

PUSH 38K: pre-write signed-baseline matching and point-in-time 11/11 camera health passed, but the exact Connector legacy rollback artifact is not strict-valid under macOS code-signature verification. The existing strict-valid re-signed QA package differs from the exact live baseline and cannot be silently substituted. Mandatory rollback readiness therefore **FAILED**, with one internal HIGH release-safety blocker. No live write, bootstrap, remediation, pre-soak or v8 occurred. PR #28 remains draft/unmerged. See `DIGITAL_OBSERVER_PUSH_38K_DEPLOYMENT_GATE_REPORT.md`.

PUSH 38J follow-up: the Gateway delta is traced to an authorized, audited out-of-band Supabase-egress hotfix. A new exact live QA-signed Gateway baseline passed isolated automatic managed rollback and the zero-write live planner matches both components. Gateway was 10/10 with six empty slots and zero stalled. Connector initially timed out on bounded health probes, then recovered without intervention to healthy 1/1 Tapo, zero stalled; this intermittent response remains a later qualification concern, not a claim of stability. **Controlled QA/pilot live bootstrap is technically READY subject to immediate hash/health recheck; v8 is NOT READY.** See `DIGITAL_OBSERVER_PUSH_38J_BASELINE_RECONCILIATION_REPORT.md`. Live bootstrap, pre-soak and v8 remain NOT STARTED; PR #28 stays draft/unmerged.

PUSH 38I isolated installed OTA-agent and crash-loop rollback QA passes on final exact-commit signed QA artifacts for both profiles. A fresh **read-only** live comparison found the Gateway installation now differs by one runtime file from its signed legacy baseline (Connector still matches). Therefore live known-good registration/bootstrap is blocked pending exact-current-runtime reconciliation and reauthorization. The protected live trust root was not installed, and there have been no live writes, pre-soak minutes, or v8 minutes. See `DIGITAL_OBSERVER_PUSH_38I_INSTALLED_OTA_REPORT.md`.

V7 failed. Do **not** start v8, merge draft PR #28, or start PUSH 39. The 24-hour v8 clock has not started.

## Completed

- Separate read-only local v7 copy, SHA-256 manifest, and generated full failed-checkpoint timeline. This is not WORM storage.
- Failure windows, overlap, bounded durations, progression/response rates, resource counters, monitor gaps and evidence limits analyzed.
- Targeted internal relay backoff/stable-reset fix and monitor cadence/per-camera/classification hardening in the PUSH 38 branch. No security or health threshold was weakened.
- Deterministic policy/monitor QA and existing synthetic reliability suite passed locally.

## Blocking start gates

1. R2 DVR common-cause transport/session loss, R3 Tapo source/network loss, and R4 Connector unusable health checks have **not** been precisely attributed or shown fixed; no external camera/Wi-Fi attribution is justified.
2. The amended runtime/monitor has **not** been safely deployed and observed on the real Home. Read-only current local endpoints report Gateway 10/10, Connector 1/1 and healthy responses, but this is a point-in-time relay check, not Product playback/AI proof.
3. The required **at least 60-minute** pre-soak stability gate has **not** run. Do not substitute short smoke or historical v7 time.
4. V8 qualification must independently run at least 86,400,000 continuous elapsed ms with full per-camera, component, AI, playback and monitor evidence. Its clock starts at zero only after gates 1–3 pass.
5. PR #28 remains draft/open and must not merge before successful v8 evidence plus required checks. North-Star status does not advance.

Required next safe work: instrument and isolate R2–R4, reproduce/fix each internal cause, validate bounded recovery without duplicate sessions/identity/source changes, then run the 60m pre-soak. Only then decide whether to start v8.

## PUSH 38C update

Session churn amplification and health-endpoint side effects were fixed in the branch, and per-source/session/probe instrumentation added. Local deterministic QA passes; see `DIGITAL_OBSERVER_PUSH_38C_PRE_SOAK_CLOSURE.md`. The deployed Home runtimes have **not** received these changes through the trusted release path, and a post-fix real 60-minute gate has **not** run. R2–R4 remain HIGH unresolved for qualification and R5 is unqualified over 60 minutes. **V8 START = NO**; there is no v8 timestamp. GitHub reports PR #28 open, draft and unmerged.

## PUSH 38D deployment gate

Read-only inspection found both live runtimes report software `development`, build SHA `unknown`, old health contract, and no installed OTA agent/current/known-good/update-state record. Historical manual backups do not establish a verified current known-good rollback slot. Per the explicit do-not-deploy-without-rollback requirement, no runtime was modified and the post-fix 60-minute monitor was not started. See `DIGITAL_OBSERVER_PUSH_38D_DEPLOYMENT_GATE_REPORT.md`. **V8 START = NO**.

## PUSH 38E bootstrap gate

Cryptographically identified but **unsigned/unregistered** legacy runtime candidates were captured and briefly started in isolated QA. That did not prove managed rollback, real identity/config compatibility, or trusted release status. The original Connector app fails strict macOS code-signature verification, and the generic OTA `initializeKnownGood()` path cannot safely label an empty slot as the live legacy runtime. No live OTA agent was installed; no remediation package was deployed; no post-fix 60-minute run occurred. See `DIGITAL_OBSERVER_PUSH_38_OTA_BOOTSTRAP_REPORT.md`. **V8 START = NO**.

## PUSH 38H isolated lifecycle update

Signed QA baseline and final remediation releases now pass actual-profile supervisor start/restart, three controlled crash recoveries each, unchanged-PID installed-slot bootstrap, journal interruption/resume, idempotency, abort, signed bad-update rollback to exact known-good, final remediation health, trust negatives and strict Connector signing. The read-only live planner still matches the captured Gateway/Connector files and LaunchAgent paths. These are **local isolated QA proofs**, not live OTA enrollment or Home reliability proof. The installed unattended OTA-agent entrypoint and persistent crash-loop escalation are INTERNAL HIGH open; root pin is not installed on the live host. Intermittent stalled relays appeared in read-only live snapshots even though the final snapshot was 10/10 DVR and 1/1 Tapo. No real deployment, post-fix 60-minute pre-soak, or v8 has started. See `DIGITAL_OBSERVER_PUSH_38H_SUPERVISOR_BOOTSTRAP_REPORT.md`. **V8 START = NO**.
