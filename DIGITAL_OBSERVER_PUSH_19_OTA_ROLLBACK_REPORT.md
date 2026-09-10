# DIGITAL OBSERVER — PUSH 19 OTA + ROLLBACK REPORT

Date: 2026-09-09

## FINAL STATUS

`PASS`

Canonical PUSH 19: `DONE`. PUSH 20 was not started.

## EXECUTIVE RESULT

Digital Observer-managed edge components now share one signed OTA contract, rollout control plane, atomic version-slot installer, post-restart camera-aware health gate, automatic known-good rollback and failed-canary containment. Destructive proof used isolated managed components only; neither live home component was updated.

## CANONICAL OTA MODEL

The shared `observer-edge-update-v1` implementation serves Software Connector, Physical Gateway and future Enterprise Edge by profile. It reports version/build/platform/architecture/profile/config/update state/known-good and keeps identity/config/camera state outside version slots.

## RELEASE SIGNING / ARTIFACT VERIFICATION

Ed25519 signs deterministic manifest JSON; SHA-256 plus exact byte length authenticates the referenced artifact. HTTPS is mandatory. Public keys are selected by bounded key ID; signing private keys never reside on customer devices or in the Product UI. Tampered manifest, tampered artifact, untrusted key, wrong platform/profile and revoked device were rejected before installation.

## STAGED ROLLOUT / CANARY

Implemented INTERNAL/CANARY/STABLE channels and internal-QA → canary → small → broader → general stages. Targeting uses profile/platform/architecture/current version and deterministic device cohorts. A canary failure threshold pauses rollout and prevents normal broader propagation. Release actions require server-side platform-admin authorization and immutable audit logging.

## SAFE INSTALLATION / KNOWN GOOD

Partial files and staging directories are separate from the active slot. Atomic rename/pointer updates prevent undefined partial state. Identity, Site binding, credentials, camera mappings and configuration are not replaced. Known-good promotion occurs only after the full health gate.

## HEALTH GATE

Requires process, device authentication, heartbeat, authorized config, cloud reachability, absence of immediate crash loop, and all expected physical cameras progressing with zero stalled streams. Six unassigned DVR slots are ignored correctly.

## AUTOMATIC ROLLBACK PROOF

Isolated Software Connector proof:

`1.0.0 GOOD → signed 1.1.0 → download/verify/install/restart → HEALTHY → promote 1.1.0`

Controlled bad release proof:

`1.1.0 GOOD → signed 1.2.0 bad health fixture → install/restart → camera progression failure → automatic rollback → 1.1.0 restored → recovery HEALTHY → 1.2.0 quarantined`

No database-state edit or manual rollback substituted for this execution.

## INTERRUPTION / DOWNGRADE / REPLAY

Interrupted staging left 1.0.0 active and produced a defined `UPDATE_FAILED` state. Unrestricted old-version replay/downgrade was rejected. Automatic rollback accepts only a recorded trusted known-good target at/above the signed security floor.

## SOFTWARE CONNECTOR / PHYSICAL GATEWAY

Both installers package the common agent, manifest verifier and rollback manager. The isolated Connector performed successful update and rollback. The isolated Physical Gateway promoted through the same manager with 10/10 expected physical channels and six empty slots excluded.

## DEVICE IDENTITY / ZERO-INSTALL

PUSH 18 operation-scoped device sessions now include `UPDATE_READ` and `UPDATE_STATUS`; active enrollment, profile and credential version must match. Identity fixture remained byte-identical through update and rollback. Revoked eligibility failed. PUSH 17 Zero-Install First is unchanged: no managed runtime is introduced for true zero-install customers.

## DATABASE / RELEASE BOUNDARY

Migration `20260909010000_edge_ota_rollout.sql` defines service-role-only, RLS-enabled release/rollout/device-state tables and immutable published release fields. It was not applied to Production in this task. Edge OTA never executes cloud migrations; backend compatibility is an eligibility prerequisite.

## REAL HOME SAFETY

No OTA was attempted on either live component. Read-only localhost health on 2026-09-09 reported Physical Gateway `streamCount=10`, `progressingRelays=10`, `stalledRelays=0`, 10 assigned and six unassigned DVR slots; Software Connector reported `streamCount=1`, `progressingRelays=1`, `stalledRelays=0`. Both reported healthy device authorization and playback readiness counters. The last authorized browser proof remains 11/11 real Product playback. No Site/device/source was created or rebound.

## SECURITY / REGRESSION

Focused OTA supply-chain QA passed. PUSH 17/18/24/25/27 and camera/live-home gates are listed in the final execution record. The deferred HIGH billing-role RLS finding remains explicitly open; PUSH 19 neither claims nor implements its permanent fix.

## NORTH-STAR / ROADMAP

The OTA and Rollback rows move from `NOT STARTED` to `DONE + REAL PROOF` based on isolated executable update/rollback evidence. Total capabilities remain 190 with zero missing canonical owners. PUSH 20 remains next and not started.

## EXTERNAL / OPERATIONAL GAPS

- Production release public keys and protected signing-key custody must be configured by release operations before Production rollout.
- Apple public distribution notarization and real Windows package execution retain their prior external validation boundaries.
- Live customer canary rollout was intentionally not performed; isolated destructive evidence satisfies PUSH 19 while protecting both real home components.

## GIT COMPLETION

The scoped commit and push SHA are recorded in the final PUSH 19 handoff; unrelated dirty user work is excluded.
