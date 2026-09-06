# DIGITAL OBSERVER — PUSH 2 BASELINE REPORT

## 1. EXECUTIVE RESULT

**PUSH 2 STATUS: PASS WITH EXTERNAL BLOCKERS**

The local Web and Video Gateway runtimes are running, the two audited code blockers were fixed, encryption key separation is enforced, the critical application QA passes, and the database baseline is understood. Real-camera end-to-end proof is not claimed: the configured DVR records are `gateway_test`/readiness records without a secret reference, and the local Gateway currently has zero active relays.

No future AI roadmap feature or new Observer architecture was implemented.

## 2. RUNTIME STATUS

| Component | Status | Evidence |
|---|---|---|
| Web App | RUNNING | Next.js 16.3.2; `http://127.0.0.1:3000/api/health` returned HTTP 200; dashboard returned HTTP 200. |
| Video Gateway | RUNNING | `http://127.0.0.1:8080/health` returned HTTP 200 and `status: healthy`. |
| Database | CONNECTED | Read-only Supabase probes succeeded against the configured project; all 12 critical tables were queryable. |
| Real Camera Reachability | PARTIAL | 16 DVR channel records exist in Supabase; 11 are marked connected and 5 offline, but all are gateway-test/readiness records and no real source credential was available to this run. |

Baseline: branch `codex/ci-typecheck-deployment-repair-20260831`, revision `22f3a53`, Node `v24.16.0`, npm `11.13.0`, Next.js `16.3.2`, TypeScript `6.0.3`, Supabase JS `2.106.1`, FFmpeg/ffprobe `9.0.1`. Docker CLI was unavailable. One pre-existing untracked file was preserved: `DIGITAL_OBSERVER_MASTER_AUDIT.md`. No tracked environment/secret file was found.

## 3. FIXES APPLIED

### Shared DVR session isolation

- Problem: QA detected that relay session identity was not enforced.
- Root cause: relay state stored a session token but did not validate it against the current shared recorder session.
- Files changed: `services/video-gateway/server.mjs`.
- Exact fix: added an exact `relay.sessionToken` to current-session binding check; stale relays are rejected/stopped after shared-session replacement, including live-relay reuse checks.
- Tests: `npm run qa:dvr-shared-session`.
- Result: PASS.

### Persistent Gateway installer disclosure

- Problem: static QA detected a configuration read path that could be interpreted as printing cloud configuration.
- Root cause: configuration-file reading was adjacent to the installer output path and failed the disclosure guard.
- Files changed: `scripts/install-persistent-home-gateway.mjs`.
- Exact fix: isolated keychain-service extraction in a dedicated function; installer output remains a fixed, non-sensitive status line; copied config remains mode `0600`.
- Tests: `node scripts/qa/check-persistent-home-gateway.mjs`.
- Result: PASS. No installer execution was performed because that would mutate the user LaunchAgent installation.

### Dedicated encryption key

- Problem: `lib/security/encryption.ts` could fall back to `SUPABASE_SERVICE_ROLE_KEY`.
- Root cause: shared fallback in the legacy encryption helper; device hash caller had the same fallback.
- Files changed: `lib/security/encryption.ts`, `app/api/digital-observer/access-settings/route.ts`, `scripts/validate-environment-safety.mjs`, `scripts/qa/check-encryption-key-separation.mjs`, `package.json`.
- Exact fix: only `FIELD_ENCRYPTION_KEY_CURRENT` or dedicated `FIELD_ENCRYPTION_KEY` is accepted; production configuration fails closed when absent; protected lookup hashing no longer uses Service Role.
- Tests: `npm run qa:encryption-key-separation`; dedicated-key round-trip; service-role-only fail-closed check; production configuration validation.
- Result: PASS. Existing ciphertext was not rotated or rewritten.

### Truthful camera status

- Problem: the DVR QA contract required explicit inactive/event-only status language.
- Files changed: `components/digital-observer/observer-camera-controls.tsx`, `components/digital-observer/observer-camera-presence.tsx`.
- Exact fix: UI explicitly distinguishes video connection from verified analysis and displays `תצפיתן כבוי` for inactive sources; physical controls are marked event-only and policy-gated.
- Result: PASS; no claim of active AI monitoring is made from camera-record existence alone.

## 4. SECURITY RESULT

| Control | Result |
|---|---|
| Dedicated Encryption Key | PASS |
| Installer Secret Sanitization | PASS |
| Shared DVR Session Isolation | PASS |
| Known Active Secret Exposure | NO known exposure in reviewed/modified paths |

Focused repository review found no tracked `.env`, private-key, or obvious hard-coded Service Role value. Environment values were not printed. `.env.local` and `.env.video-gateway.local` exist locally and were treated as sensitive.

## 5. TEST MATRIX

| Test | Result | Evidence | Notes |
|---|---|---|---|
| `npm run typecheck` | PASS | exit 0 | TypeScript 6.0.3. |
| `npm run qa:dvr-shared-session` | PASS | `DVR shared session, offline status and local AI policy PASS` | Implementation-based safeguard. |
| Persistent Gateway QA | PASS | `Persistent home gateway safety PASS` | Installer not executed; static safety QA passed. |
| Encryption key separation QA | PASS | dedicated-key round-trip and service-role-only fail-closed | No plaintext emitted. |
| `npm run qa:digital-observer-product` | PASS | `SUMMARY | 68/68` | Authenticated against configured Supabase QA data; no roadmap behavior added. |
| Event journal QA | PASS | event journal checks passed | Existing critical QA retained. |
| Event outbox QA | PASS | Gateway outbox checks passed | Existing critical QA retained. |
| Event evidence/media QA | PASS | event media checks passed | Existing critical QA retained. |
| Event clip-window QA | PASS | planning checks passed | No capture/live integration performed. |
| Storage policy QA | PASS | `6 PASS, 0 FAIL` | Remote policy verification remains required after migration apply. |
| Observer-engine separation QA | PASS | checks passed | Existing critical QA retained. |
| Web health | PASS | HTTP 200, `{"ok":true,"status":"ok"}` | Local runtime. |
| Gateway health | PASS | HTTP 200, `status: healthy`, `streamCount: 0` | Runtime active; no active real stream. |
| Authenticated event backend probe | PASS | site/camera/signals all OK, no errors | Read-only site probe. |
| Full repository lint | FAIL / known debt | `5,409 errors, 215 warnings` | Not mass-rewritten in this phase. |

## 6. LINT DEBT SUMMARY

- Total remaining findings: **5,624** — **5,409 errors**, **215 warnings**.
- Top rules: `@typescript-eslint/no-explicit-any` 5,261; `@typescript-eslint/no-unused-vars` 161; `@next/next/no-img-element` 44; remaining smaller rule groups.
- Top affected areas in the lint output: `app/dashboard`, `app/api`, `lib/domain`, `app/digital-observer`, `components/digital-observer`, and a small Gateway subset.
- Production-critical findings remaining: broad pre-existing `no-explicit-any` debt, including legacy dashboard/API code. All modified production files in this PUSH pass targeted ESLint.
- Recommended future remediation: baseline by rule/domain, fix security/runtime modules first, add typed Supabase table interfaces, then handle app/dashboard and legacy UI in bounded batches. Do not mass-disable rules or rewrite unrelated code.

## 7. CAMERA BASELINE

The database contains 53 source rows: 37 synthetic/demo rows and 16 DVR rows. The 16 DVR rows are mapped to site `cc1673b8-3eb0-4785-a12c-1fb88f425a41`, Gateway `62df97e2-3c0b-427f-9108-bde029bc10e7`, provider `video_gateway`, and have no `secret_reference`. They are therefore readiness/test configuration, not production-real-camera proof.

| Camera/Source ID | Site | Connection Type | Reachability | Gateway Status | Frame/Probe Result | Notes |
|---|---|---|---|---|---|---|
| `6fddc732-13df-4268-9f32-3357262ea997` | DVR pilot site | DVR / gateway_test | REACHABLE (DB status) | mapped | no local frame probe | test record; no credential |
| `1de04a0a-d616-4072-ab53-a93d6d0366e2` | DVR pilot site | DVR / gateway_test | REACHABLE (DB status) | mapped | no local frame probe | test record; no credential |
| `eaa9a466-a896-4b14-8237-6bdeb1940d5a` | DVR pilot site | DVR / gateway_test | REACHABLE (DB status) | mapped | no local frame probe | test record; no credential |
| `f08bfe0f-8c1f-4824-8f40-00b967e5912f` | DVR pilot site | DVR / gateway_test | REACHABLE (DB status) | mapped | no local frame probe | test record; no credential |
| `c0c08d1d-7bee-48cb-bc5b-be26b4d4c6ac` | DVR pilot site | DVR / gateway_test | REACHABLE (DB status) | mapped | no local frame probe | test record; no credential |
| `3cf274ef-7b90-40c4-8cf9-b425ca04e035` | DVR pilot site | DVR / gateway_test | REACHABLE (DB status) | mapped | no local frame probe | test record; no credential |
| `8473dd7c-964c-4e72-88fb-4060e0a3ede2` | DVR pilot site | DVR / gateway_test | REACHABLE (DB status) | mapped | no local frame probe | test record; no credential |
| `d260f549-a14d-47f6-a8a2-969c0fff92fe` | DVR pilot site | DVR / gateway_test | REACHABLE (DB status) | mapped | no local frame probe | test record; no credential |
| `c9ff016c-5d5e-4fa9-8606-a25304c47f71` | DVR pilot site | DVR / gateway_test | REACHABLE (DB status) | mapped | no local frame probe | test record; no credential |
| `e9f8abf3-5895-494e-b1cf-ea8818602851` | DVR pilot site | DVR / gateway_test | REACHABLE (DB status) | mapped | no local frame probe | test record; no credential |
| `3bfea837-97b9-4e53-be40-a4ec451f6f05` | DVR pilot site | DVR / readiness | UNREACHABLE (DB status) | mapped | no local frame probe | test record; no credential |
| `1dd5eeff-1dab-4b80-af35-54d0a0fd9211` | DVR pilot site | DVR / readiness | UNREACHABLE (DB status) | mapped | no local frame probe | test record; no credential |
| `ef1dc7be-6ada-4609-a7ba-81768aa95137` | DVR pilot site | DVR / readiness | UNREACHABLE (DB status) | mapped | no local frame probe | test record; no credential |
| `16496d0a-5f4a-42cd-a178-aafe75945325` | DVR pilot site | DVR / readiness | UNREACHABLE (DB status) | mapped | no local frame probe | test record; no credential |
| `35a01ea8-9d0d-45b9-83d3-ada4bd7300fb` | DVR pilot site | DVR / readiness | UNREACHABLE (DB status) | mapped | no local frame probe | test record; no credential |
| `a1b66f4e-3eeb-4834-90da-b8d2b76360a8` | DVR pilot site | DVR / readiness | UNREACHABLE (DB status) | mapped | no local frame probe | test record; no credential |

The local Gateway health reported `activeRelays: 0`, `progressingRelays: 0`, and device authorization `unknown`. No real frame freshness or RTSP/FFmpeg probe was claimed.

## 8. PUSH 3 READINESS

**ARE WE READY FOR REAL CAMERA END-TO-END PROOF? NO — external blockers remain.**

1. A real camera/DVR credential and approved pilot source are not available to the local Gateway run — requires configuration and authorized hardware/network access.
2. The local Gateway has no active relay and therefore no verified fresh frame — requires real Gateway-to-camera connectivity and a non-destructive probe.
3. Gateway device authorization/enrollment is `unknown` in local health — requires valid enrollment/keychain material and cloud device access.
4. Remote migration history/drift was not independently verified because no Supabase CLI was available; table connectivity and expected table existence passed — requires normal Supabase migration-history access.
5. Full lint remains degraded outside the modified runtime/security files — requires a separate cleanup phase.

PUSH 2 stops here. No real-camera E2E AI claim is made.
