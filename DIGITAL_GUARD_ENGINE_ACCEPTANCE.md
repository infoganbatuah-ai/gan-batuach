# Digital Guard Engine — Acceptance & Runbook

Last updated: 2026-08-31

This is the live execution checklist. A stage is not complete until its evidence is recorded.

| # | Stage | Status | Evidence | Blocker | Next action |
|---|---|---|---|---|---|
| 1 | Build / typecheck | TYPECHECK_PASS_BUILD_BLOCKED | `./node_modules/.bin/tsc --noEmit --pretty false` passed with exit code 0; `event-journal-service.ts` row typing fixed; Webpack and Turbopack builds both stall at `Creating an optimized production build...` | production build has no completed exit code after repeated ~90–120s runs | isolate Next build stall and obtain a completed exit code |
| 2 | Camera adapters / dynamic capabilities | IN_PROGRESS | `guard-engine.ts`, capability API and action policy exist; metadata-only capabilities cannot authorize hardware | real Gateway probe and command adapter/ACK unavailable | connect verified Gateway adapter |
| 3 | SpatialMap + learning + events | PENDING | `camera-zone-mapper.ts`, `event-validation-pipeline.ts`, `event-journal-service.ts` exist | live frame/event source not connected | run persisted event and baseline E2E |
| 4 | Guard Chat | PENDING | conversation route returns normalized `event_log` | production E2E unavailable | verify scoped retrieval and commands against live data |
| 5 | Biometric / LPR consent | PENDING | Standard engine contracts and known-people routes exist | approved biometric/LPR provider and consent evidence unavailable | configure provider, consent, revoke and deletion tests |
| 6 | Fire / intrusion / pool / alerts | PENDING | event types and alert journal contracts exist | live vision provider unavailable | execute alert E2E with evidence media |
| 7 | Gateway ACK + physical controls | BLOCKED_EXTERNAL | API deliberately refuses fake execution and requires Gateway evidence | no real command adapter/ACK | connect adapter; keep human confirmation and audit |
| 8 | Commit / push / deploy / E2E | IN_PROGRESS | commits `eeb919c`, `bc27483`; remote branch verified | deploy credentials and production E2E unavailable | commit/push build fix, deploy after environment access, rerun all gates |

## Execution order

1. Do not advance while the current stage has a failing check.
2. Do not claim a physical action without provider evidence and ACK.
3. Do not use demo providers or fake ACKs as acceptance evidence.
4. Record the command, result, file, blocker, and next action after every run.

## Latest local evidence

- `npm run qa:observer-engine-separation` — PASS.
- `npm run qa:digital-observer-event-media` — PASS.
- `npm run qa:dvr-shared-session` — PASS after the retryable 502/503/504 recovery fix in `observer-live-player.tsx`.
- `npm run qa:digital-observer-product` — BLOCKED by DNS resolution of the configured Supabase host (`ENOTFOUND`), before login/E2E.
