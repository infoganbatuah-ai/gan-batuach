# PUSH 38 v8 readiness — NOT READY

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
