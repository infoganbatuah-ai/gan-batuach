# Digital Observer Managed-Device Identity Threat Model

Date: 2026-09-08

## Assets and trust boundaries

Protected assets are the local private key, camera credentials, tenant/Site binding, source ownership, configuration, commands, Event/media ingestion authority, and monitoring truth. The main boundary is between a DO-managed local component and Product APIs. True zero-install vendor/direct connections remain outside this managed-device identity lifecycle.

## Threats and controls

| Threat | Control | Residual boundary |
|---|---|---|
| Device-ID impersonation | Device ID alone is rejected; exact request requires Ed25519 proof | Local private-key compromise remains material |
| Bootstrap theft/replay | Short TTL, one use, hashed proof, fixed actor/Site, erase bearer after claim | Protect browser/installer handoff during its short lifetime |
| Cross-tenant/Site use | Principal, key and short session are server-bound to tenant/Site; resource IDs are checked | Service-role compromise is outside device protocol |
| Profile spoofing | Profile is loaded from enrollment; permissions are server-selected | Profile changes require an authorized lifecycle operation |
| Request replay | Timestamp window, random nonce uniqueness, monotonic runtime sequence | Clock must remain within the allowed skew |
| Credential clone | Runtime-instance/sequence evidence and concurrent-use signal; IP is not decisive | Foundation is detection/denial, not hardware attestation |
| Old key reuse | Atomic two-phase rotation retires old credential version | Controlled recovery is required if confirmation response is lost; edge persists pending key |
| Lost/revoked device reconnect | Lifecycle and credential state checked for every proof/session and sensitive operation | Legacy devices remain on transitional auth until migrated |
| Event/source spoofing | Device session Site/gateway binding and camera-source ownership checks | Adapter-level content authenticity is not remote attestation |
| Command injection | Profile scope plus strict task allow-list; no shell command | PUSH 22 may add fleet UI, not arbitrary execution |
| Secret leakage | Public-key-only enrollment, platform store, bounded audit/diagnostic redaction | Host administrator can access local host resources |
| Insecure compatibility fallback | Legacy HMAC accepted only for rows explicitly marked `LEGACY_HMAC`; managed-Site discovery requires scoped device auth | Remove legacy after controlled rollout |
| Database privilege escalation | Identity tables use RLS, deny client roles, grant service role only, fixed RPC search paths | Existing deferred billing RLS finding is tracked separately and is not closed here |

## Fail-closed behavior

Missing tenant binding, invalid lifecycle, wrong credential version, unknown profile, unsupported operation, stale proof, reused nonce, clone signal, invalid rotation proof, wrong Site, or revoked authorization all deny the operation. Telemetry/audit failure does not grant access.

## Explicit non-claims

PUSH 18 does not claim mTLS, X.509 client certificates, TPM/Secure Enclave-backed keys, remote attestation, OTA signing, watchdog recovery, offline resynchronization, or fleet management. Those capabilities require separate evidence and later canonical pushes.
