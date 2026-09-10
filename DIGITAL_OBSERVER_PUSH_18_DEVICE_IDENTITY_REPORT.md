# DIGITAL OBSERVER — PUSH 18 DEVICE IDENTITY REPORT

Date: 2026-09-08
Repository base: `670cf701e4e4b52ebdfcc41bdf45caaa7e2a22cf` (`main` at start)
Production code revision verified: `da1cb691d6e915ca31496625e9df8678f9d6d4fb`

## FINAL STATUS

`PASS`

PUSH 18's managed-device identity lifecycle passes deterministic and isolated PostgreSQL security QA. PUSH 18B also restored and proved the existing Physical Gateway without creating another Site, Gateway, Connector, or durable camera source. The current real topology is 10/10 progressing DVR cameras plus 1/1 progressing Tapo camera: 11/11 expected physical cameras progressing. Six additional DVR channel slots are explicitly `CHANNEL_EMPTY`, not failures.

## SCOPE AND ZERO-INSTALL BOUNDARY

PUSH 18 applies only to `SOFTWARE_CONNECTOR`, `PHYSICAL_GATEWAY`, and future `ENTERPRISE_EDGE`. True vendor-cloud/account-link/P2P/direct zero-install sources receive no managed-device principal merely because PUSH 18 exists. PUSH 17's hierarchy remains executable and its closure suite passes:

`ZERO-INSTALL FIRST → MOBILE-ASSISTED → SOFTWARE CONNECTOR EXCEPTION → PHYSICAL GATEWAY LAST RESORT`

## CANONICAL DEVICE PRINCIPAL

The canonical enrollment stores immutable gateway/device ID, tenant, Site, server-selected deployment profile, identity scheme, credential/config/runtime versions, lifecycle, last-seen/runtime-session evidence, clone signal, and revocation/hardening timestamps. A Device ID is only a lookup key and cannot authenticate.

## CRYPTOGRAPHIC AUTHENTICATION

Implemented mechanism: device-generated Ed25519 key pair. The private PKCS8 key remains in the protected local credential store; only the SPKI public key is enrolled. Each request signs an exact canonical envelope containing method, path, body SHA-256, device and credential version, timestamp, nonce, runtime instance, and sequence. This is verified application-layer request signing, not an mTLS, X.509, hardware-attestation, or hardware-backed-key claim.

## ENROLLMENT

PUSH 17's one-time installation handoff generates identity locally and sends only the public key. Approval atomically activates credential version 1 and binds the original authorized tenant/Site/profile. Bootstrap proof is short-lived, single-use, hashed, replay-protected, and erased after claim; it never becomes the permanent device credential.

## HEARTBEAT / CONFIG / COMMAND AUTH

Heartbeat, configuration, discovery, Event ingestion, media upload, playback grant, and rotation validate a short-lived scoped session derived only after Ed25519 proof. Managed-Site discovery cannot fall back to the shared legacy signature. Profile is loaded from the database rather than trusted from a request. Software Connector lacks privileged command-poll scope; Physical Gateway and Enterprise Edge receive it. Command execution remains allow-listed with no remote shell.

## ROTATION

Two-phase rotation is implemented and tested. The old key signs preparation; the new key proves a short-lived challenge; one database transaction activates the new version, retires the old, consumes the challenge, and resets runtime-session state. The edge persists pending rotation and switches its durable key only after confirmation. Site, sources, history, and rules remain unchanged.

## REVOCATION

Authorized `REVOKED`, `LOST`, `REPLACED`, and `RETIRED` transitions revoke pending/active credentials, remove legacy refresh material, deny subsequent privileged operations, and mark dependent sources `ACTION_REQUIRED` rather than leaving false active monitoring.

## REBIND / REPLACEMENT

Same-Site replacement requires Product manager authorization, atomically transfers source bindings, retires the old principal, and writes audit evidence. Cross-tenant rebind never transfers credentials: revoke the old principal, clear old tenant configuration locally, and perform a new authorized destination enrollment. Camera re-onboarding is not required.

## ANTI-CLONING FOUNDATION

Nonce reuse is rejected. Same-runtime sequence rollback is denied. Concurrent use by a different runtime instance within the live two-minute window persists `clone_suspected_at` and is denied; a later new instance is classified as restart. IP alone is not clone proof.

## SECRET HYGIENE

Private keys, camera/vendor passwords, bootstrap/permanent tokens, authorization headers, sensitive configuration, private stream URLs, and signed media URLs are excluded or redacted from responses, diagnostics, learning data, logs, and this report. Repository secret and release guards pass.

## LEGACY MIGRATION

Implemented safe path:

`LEGACY_HMAC → authorized migration prepare → local Ed25519 key → new-key challenge proof → ED25519_V1 → legacy refresh erased`

Production migrations `20260907020000_connector_install_intents.sql` and `20260908010000_managed_device_identity_hardening.sql` were applied in order before the dependent application revision. The live Physical Gateway and Software Connector remain explicitly `LEGACY_HMAC`; real-device credential migration is `DEFERRED FOR CONTROLLED ROLLOUT`. No camera, mapping, history, or rule needs recreation.

## ISOLATED FULL LIFECYCLE

The deterministic and isolated PostgreSQL suites prove valid enrollment, expired/reused/wrong-Site denial, Device-ID-only denial, authenticated operation scopes, profile-spoof denial, replay/stale-session/clone denial, rotation and old-key rejection, legacy-to-hardened migration, revocation/replacement, and secret-safe diagnostics.

- Managed-device identity: 17 passed, 0 failed.
- Isolated PostgreSQL lifecycle: 1 passed, 0 failed.
- PUSH 18B runtime contracts: 6 passed, 0 failed.

## SECURITY REGRESSION

| Gate | Result |
|---|---|
| PUSH 17D closure | 8 passed / 0 failed |
| Universal connectivity | 20 passed / 0 failed |
| Connector commercial security | 13 passed / 0 failed |
| Camera connection layer | 15 passed / 0 failed |
| Camera onboarding | 7 passed / 0 failed |
| Software Connector | 17 passed / 0 failed |
| PUSH 25 security/privacy | 14 checks passed / 0 failed; 13 RLS tables |
| PUSH 27 observability | 21 checks passed / 0 failed |
| Migration safety | PASS; 193 migrations, 0 duplicate timestamps, 0 unreviewed destructive migrations |
| Static/build/domain/security/release CI | all 7 GitHub checks PASS at `da1cb691` |
| Typecheck | PASS |
| Canonical lint | PASS; 0 canonical errors/warnings, 0 regressions; full measured repository baseline 5,350 errors / 213 warnings |
| Production build | PASS |

The existing deferred HIGH billing-role RLS finding remains explicit and unresolved. PUSH 18 does not silently close it.

## DVR EMPTY-SLOT CORRECTION

The runtime preserves all 16 recorder slots. Channels 1–8, 10, and 11 are `ASSIGNED` with a physical camera. Channels 9 and 12–16 are `CHANNEL_EMPTY`, `physical_camera_attached=false`, `status=disabled`, and `health=unknown`. Empty slots are excluded from physical-camera count, availability failures, alerts, and SLO degradation.

The Product read model now derives `ONLINE`, `RECOVERING`, `OFFLINE`, or `CHANNEL_EMPTY` from current assignment and activity. Connected rows without current evidence cannot remain healthy indefinitely: activity at most 45 minutes old is `ONLINE`, 45–90 minutes is `RECOVERING`, and older or missing activity is `OFFLINE`.

## PUSH 18B — PHYSICAL GATEWAY REGRESSION CLOSURE

### ROOT CAUSE

The Gateway child runtime had terminated because Node 24.16.0's bundled Undici 7.25.0 could synchronously throw macOS socket `setTypeOfService EINVAL` outside the request promise. This is the upstream Undici advisory Type-of-Service failure addressed by upstream issue 5544 and pull request 5547. The edge entry points now install maintained direct dependency Undici 8.10.2 before network use. This is a narrow runtime correction; there is no global uncaught-exception filter and unrelated socket failures remain visible.

### CLOUD 401 RESULT

The 401 stream was a second, independent failure. Production application code expected the PUSH 18 identity schema while Production lacked `video_gateway_device_enrollments.identity_scheme`; PostgreSQL 42703 was being flattened into invalid-auth 401. Required migrations were applied before the dependent deployment, and the enrollment API now distinguishes schema/database unavailability from invalid authentication. After recovery the Gateway completed discovery and heartbeat with zero new 401 or 422 responses. Authentication was not weakened.

### GATEWAY PROCESS STATE

The existing `com.ganbatuach.video-gateway` LaunchAgent was restarted in place. Final bounded observation showed one stable child PID, no additional restart, exit code 0, local health `healthy`, Undici 8.10.2 active, and the Type-of-Service crash guard reported by the runtime.

### TEN DVR PHYSICAL CAMERAS

Discovery found 16 channel slots, 10 assigned and connected, and 6 unassigned. All 10 assigned relays were active and progressing with 0 failed and 0 stalled. During the 45-second stability sample every channel increased both byte and chunk counters; per-channel byte increases ranged from 5,888,769 to 10,085,177. Runtime lifecycle during the sample: 10 starts, 0 upstream-ended, 0 upstream-failed, 0 stale input/playlist, and 0 socket/abort/other input errors.

### SIX EMPTY SLOTS

Production now records channels 9 and 12–16 as `CHANNEL_EMPTY`/unassigned. They are not offline cameras and do not reduce the 11-camera physical-health result.

### TAPO STATE

The independent Tapo C211 remained bound to the separate `SOFTWARE_CONNECTOR`. Its HLS media sequence advanced by 6 during a 12-second sample, the HLS playlist and last segment advanced, the ONNX worker remained active, and a new `REAL_CAMERA_AI` signal reached Production at 2026-09-08T00:23:55Z. Tapo is 1/1 progressing.

### STABILITY AND ERROR OBSERVATION

Across the bounded post-restart observation, all expected DVR streams progressed and the Gateway PID remained stable. New-log counts after the restart boundary were: cloud 401 = 0, cloud 422 = 0, `setTypeOfService` = 0, and `EINVAL` = 0.

### DUPLICATE-SOURCE CORRECTION

The first post-migration rediscovery exposed a stable-identity defect: upsert used only transient `gateway_stream_id`, creating 16 duplicate source rows. The upsert now reuses the unique existing source by Site + Gateway + DVR channel and fails closed if that stable identity is ambiguous. After explicit user approval, exactly those 16 accidental rows were backed up to a private `0600` file and removed. Reference checks were zero before deletion; no Event, Evidence, Incident, Site, device, history, or real camera source was deleted. Final Production count is exactly 17 sources, and another Gateway rediscovery kept it at 17.

## EXISTING HOME REGRESSION

Final read-only Production and local-runtime evidence:

- target Home/Site: one unchanged Site; no Site created during PUSH 18B;
- durable camera-source rows: 17 total — 16 DVR slots and 1 Tapo;
- DVR physical cameras: 10 expected, 10 connected/healthy/progressing;
- empty DVR slots: 6 `CHANNEL_EMPTY`;
- Tapo physical cameras: 1 expected, 1 progressing through its separate Software Connector;
- total physical cameras: 11 expected, 11 progressing;
- expected-camera failures: 0;
- stuck active streams: 0;
- active managed components: one Physical Gateway and one Software Connector, both existing identities;
- duplicate Site/device/source state: none in final state.

## PRODUCTION / DEPLOYMENT

The two required migrations were applied before dependent application code. Application revisions `9ddb0add`, `41b20c35`, and final lint-safe correction `da1cb691` were pushed to `origin/main`; Vercel deployed the final revision successfully. No customer camera path was destructively migrated, no parallel DVR session was opened, and no live identity was rotated or rebound.

## GIT

Scoped implementation commits on `origin/main`:

- `9ddb0add8dd6355cec8b4872ecf7321900c0f379` — managed identity and Gateway runtime repair;
- `41b20c35d1035ee99ac81cfea9a475846f8ba02f` — stable rediscovery identity and duplicate prevention;
- `da1cb691d6e915ca31496625e9df8678f9d6d4fb` — lint-safe finalization.

The closure documentation commit containing this report is recorded in the final handoff. Unrelated PUSH 25/27 and user work remain unstaged and preserved.

## CANONICAL PUSH 18 STATUS

`DONE`

## PUSH 19 READINESS

`YES`

PUSH 19 was not started.
