# Digital Observer Managed-Device Identity Migration

Date: 2026-09-08

## Policy

Existing home Connector/Gateway identities are not migrated destructively during PUSH 18. The production path remains intact until a controlled rollout window. Camera sources, mappings, Events, Incidents, Evidence, rules, and Site identity do not need recreation.

## Controlled lifecycle

`LEGACY AUTH → USER-AUTHORIZED MIGRATION PREPARE → LOCAL ED25519 KEY GENERATION → NEW-KEY CHALLENGE PROOF → MARK HARDENED → RETIRE LEGACY CREDENTIAL`

1. Confirm the component is an active `LEGACY_HMAC` enrollment in the intended Site.
2. An authorized owner/admin prepares migration for that exact device and Site.
3. The local component creates a new Ed25519 key in protected platform storage and supplies only its public key.
4. The server creates credential version 1 in `PENDING` state and a five-minute one-time challenge.
5. The component proves possession of the new private key.
6. One database transaction activates Ed25519, clears legacy refresh material, consumes the challenge, and resets runtime-session evidence.
7. Verify authenticated heartbeat/config and truthful camera health.
8. Mark the rollout verified. On failure before confirmation, the old credential remains authoritative; the edge keeps the pending key for bounded retry.

Cross-tenant rebind is not a migration shortcut. Revoke/retire the old principal, remove old tenant configuration/secrets locally, and perform a new authorized enrollment in the destination.

## Production rollout gates

- Apply and verify migration `20260908010000_managed_device_identity_hardening.sql` before deploying dependent application/edge code.
- Revalidate the earlier PUSH 25 and PUSH 17 migration ledger and keep the deferred billing-role RLS finding explicit.
- Use one isolated/pilot identity first; verify enroll/auth/heartbeat/config/rotate/old-key denial/revoke denial.
- Roll out one managed component at a time with rollback and current source-health observation.
- Never re-onboard cameras to migrate the local component.
- Do not count six empty DVR channel slots as failed cameras.

## Current real-home status

Database/application readiness is complete: migrations `20260907020000_connector_install_intents.sql` and `20260908010000_managed_device_identity_hardening.sql` were applied in order before the dependent Production application revision. The existing Physical Gateway and Software Connector are still explicitly `LEGACY_HMAC` and their credential migration status is `DEFERRED FOR CONTROLLED ROLLOUT`.

PUSH 18B proved the live topology after deployment without rotating, rebinding, or recreating either device. The existing Site and all 17 durable source rows remain stable: 10 assigned DVR cameras, 6 `CHANNEL_EMPTY` slots, and one Tapo. A future controlled rollout must migrate one managed component at a time, verify hardened heartbeat/config and live camera progression, and only then retire its legacy credential.
