# DIGITAL OBSERVER — BACKUP AND RESTORE RUNBOOK

Canonical data contract: `observer-portable-backup-v1`.

## Backup scope

- Supabase Postgres and Auth through provider-native encrypted backup/PITR.
- Site, Camera Source, Event, Incident, Evidence metadata and canonical IDs.
- approved Digital Observer-owned Evidence objects through `observer-storage-v1`.
- storage references, configuration versions and Fleet/device relationships.
- durable queue state where its owning PUSH requires continuity.
- deployment configuration inventory and public verification/signing keys.

Do not put database passwords, camera credentials, device private keys, provider tokens, encryption keys or release-signing private keys inside a portable data bundle. Those are recovered separately from the approved secret manager. Customer DVR/NVR/VMS recordings are references, not Digital Observer backups, unless an explicit storage policy copied them.

## Before backup

1. Confirm tenant and environment scope.
2. Record Product version, Git SHA and migration-chain digest.
3. Confirm provider-native DB/Auth backup status.
4. Export canonical records and approved storage objects to a new encrypted operator-controlled destination.
5. Verify bundle and object hashes before marking the backup usable.
6. Audit the operation without recording payloads or credentials.

## Restore order

1. Create a clean isolated environment; do not restore Production data to an unsecured laptop.
2. Inject secrets from the approved secret manager.
3. Apply `supabase/migrations` in timestamp order using the canonical provider migration workflow.
4. Restore DB/Auth snapshot at a compatible point, then apply compatible forward migrations.
5. Restore records in dependency order: tenant → Site → source/device/Fleet/config → Event → Incident → Evidence/reference → queue state.
6. Restore approved media to the selected PUSH 34 backend and verify SHA-256 before switching canonical references.
7. Start Web/workers; verify health, tenant scope, signed media, Fleet and queues.
8. Permit Connector/Gateway reconnection only after device identity, revocation state and Site binding are confirmed.

Restore is idempotent. Stable IDs are upserted, not regenerated. A storage restore never deletes the last valid copy before target verification. A tenant mismatch, secret-shaped payload or checksum mismatch stops the restore.

## Device continuity

Cloud recovery preserves device IDs, credential versions, Site/source mappings and revocation state. Device private keys remain local and are not copied into cloud backups. Existing managed components should reconnect with their current identity if the restored cloud trust/configuration records remain valid. Replacement/rebind uses PUSH 18 authorization; no manual DB insertion or duplicate Site/device/source is permitted.

## Failure recovery

| Failure | Required response |
|---|---|
| Web deployment failed | keep prior deployment active; inspect protected deployment checks; rollback provider release |
| DB unavailable | stop unsafe writes; use Supabase status/PITR; verify RLS and migrations after recovery |
| Migration failed | do not edit an applied migration; restore pre-migration point or deploy compatible forward repair |
| Storage unavailable | retain `PENDING_UPLOAD`; use alternate backend only when policy authorizes it |
| Worker failed | PUSH 20 supervision and PUSH 31 lease recovery; do not create Product truth from a job |
| Gateway/Connector lost | revoke/replace through PUSH 18; preserve Site/source IDs; enroll replacement normally |
| Backup checksum failed | quarantine bundle; do not partially restore or bypass integrity |

## Verification checklist

- `/api/health` succeeds and PUSH 27 telemetry appears.
- migration inventory has unique ordered timestamps.
- representative IDs, timestamps and tenant/Site ownership match the backup.
- Evidence reference and object hash match; signed access remains authorized.
- Fleet shows existing components without duplicates.
- revoked devices remain revoked; queues resume idempotently.
- role/RLS/security gates pass.

PUSH 35 isolated QA restores 11 representative canonical records and one Evidence object twice with one Product effect. Full provider PITR/Auth restore and Production media deletion remain continuing operational drills, not fabricated proof.
