# Digital Guard Engine — Acceptance & Runbook

Last updated: 2026-08-31

This is the live execution checklist. A stage is not complete until its evidence is recorded.

| # | Stage | Status | Evidence | Blocker | Next action |
|---|---|---|---|---|---|
| 1 | Build / typecheck | BLOCKED_UNVERIFIED | `./node_modules/.bin/tsc --noEmit --pretty false` passed with exit code 0 after restoring lockfile dependencies; `event-journal-service.ts` row typing fixed | `npm run build` stalls after ~90s at `Creating an optimized production build...` with no compiler output | isolate Next build stall and obtain a completed exit code |
| 2 | Camera adapters / dynamic capabilities | IN_PROGRESS | `guard-engine.ts`, capability API and action policy exist; metadata-only capabilities cannot authorize hardware | real Gateway probe and command adapter/ACK unavailable | connect verified Gateway adapter |
| 3 | SpatialMap + learning + events | PENDING | `camera-zone-mapper.ts`, `event-validation-pipeline.ts`, `event-journal-service.ts` exist | live frame/event source not connected | run persisted event and baseline E2E |
| 4 | Guard Chat | PENDING | conversation route returns normalized `event_log` | production E2E unavailable | verify scoped retrieval and commands against live data |
| 5 | Biometric / LPR consent | PENDING | Standard engine contracts and known-people routes exist | approved biometric/LPR provider and consent evidence unavailable | configure provider, consent, revoke and deletion tests |
| 6 | Fire / intrusion / pool / alerts | PENDING | event types and alert journal contracts exist | live vision provider unavailable | execute alert E2E with evidence media |
| 7 | Gateway ACK + physical controls | BLOCKED_EXTERNAL | API deliberately refuses fake execution and requires Gateway evidence | no real command adapter/ACK | connect adapter; keep human confirmation and audit |
| 8 | Commit / push / deploy / E2E | IN_PROGRESS | commit `eeb919c`; remote branch verified | deploy credentials and production E2E unavailable | deploy after environment access, rerun all gates |

## Execution order

1. Do not advance while the current stage has a failing check.
2. Do not claim a physical action without provider evidence and ACK.
3. Do not use demo providers or fake ACKs as acceptance evidence.
4. Record the command, result, file, blocker, and next action after every run.
