# DIGITAL OBSERVER — OTA ARCHITECTURE

Date: 2026-09-09
Protocol: `observer-edge-update-v1`

## Scope and boundary

This architecture applies only to Digital Observer-managed local components: `SOFTWARE_CONNECTOR`, `PHYSICAL_GATEWAY`, and future `ENTERPRISE_EDGE`. True zero-install camera paths have no local Digital Observer runtime and receive no OTA identity or package. The permanent ordering remains Zero-Install → mobile-assisted persistent setup → Software Connector exception → Physical Gateway last resort.

## Shared architecture

Both current profiles use the same strict manifest contract, Ed25519 verifier, artifact verifier, eligibility rules, state machine, atomic slot manager, health gate, rollback engine and outbound update agent. Platform installers package these shared modules; platform-specific adapters perform only install/service restart operations.

The component reports runtime version, build SHA, platform, architecture, profile, configuration version, update state and known-good version. Update/configuration versions remain separate.

## Lifecycle

1. An authorized platform administrator publishes a pre-signed manifest. The control plane verifies it against configured public keys; no signing private key enters Product UI or a customer device.
2. An audited staged rollout targets profile/platform/architecture/channel and a deterministic cohort.
3. An active, non-revoked PUSH 18 device requests eligibility using an operation-scoped session.
4. The component downloads over HTTPS to a partial file, validates exact size and SHA-256, then verifies the signed manifest with Ed25519 before staging.
5. Installation occurs in a new version slot. The current pointer changes only after staging/install succeeds.
6. Restart is followed by managed-device auth, heartbeat, config, cloud, crash-loop and physical-camera progression checks. Empty/unassigned DVR slots are explicitly excluded.
7. A healthy version is promoted to known-good. A failed version triggers automatic rollback, recovery verification and per-device quarantine.

## Atomicity and recovery

Partial downloads use a distinct temporary file. Staging uses a distinct directory and atomic rename. Interrupted download/staging cannot move the current pointer. Identity, Site binding, camera mapping, credentials, history and configuration live outside version slots. A switched but unhealthy slot is replaced by the authorized prior known-good pointer and restarted automatically.

## Rollout containment

Channels are `INTERNAL`, `CANARY`, and `STABLE`; rollout stages are internal QA, canary, small cohort, broader cohort and general. Cohort assignment is deterministic and auditable. A canary reaching its configured failure threshold pauses rollout; broader stages cannot be advanced through the normal control path while the canary gate is failed.

## Security invariants

- Device ID alone never grants update access; PUSH 18 session scope, credential version, profile and active lifecycle must match the enrollment.
- Signed release identity, platform, architecture, profile, runtime/config compatibility, cohort and security floor are checked.
- Download-host compromise cannot substitute an artifact because digest and Ed25519 signature remain required.
- Downgrade is rejected except automatic rollback to an already trusted known-good version at or above the security floor.
- Revocation is checked before eligibility and survives update/rollback.
- Local OTA never runs cloud/database migrations.
- The remote command allow-list gains no shell or arbitrary installer command.

## Boundaries

PUSH 19 implements update-specific restart, health verification and rollback only. Generic watchdog/self-healing remains PUSH 20; offline buffering PUSH 21; full fleet management PUSH 22.
