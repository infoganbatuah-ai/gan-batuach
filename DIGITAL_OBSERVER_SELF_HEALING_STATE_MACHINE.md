# Digital Observer Self-Healing State Machine

## States

`HEALTHY → RECOVERING → HEALTHY`

`RECOVERING → BACKOFF → RECOVERING`

`RECOVERING → NEEDS_ATTENTION`

`PROCESS_CRASH_LOOP → SIGNAL_OTA_HEALTH → NEEDS_ATTENTION`

## Transition rules

- `HEALTHY` requires expected assigned sources to show real progress inside the bounded freshness window.
- Empty/unassigned DVR slots remain outside the recovery machine.
- A new normalized failure emits one sanitized audit event.
- Each recovery action is allow-listed, counted and followed by a health gate.
- Failed recovery advances the ladder only after bounded exponential backoff.
- Exhausted attempts or deterministic auth/config failures become `NEEDS_ATTENTION`.
- A post-update crash loop signals PUSH 19; PUSH 20 never performs a competing rollback.
- Source return reuses the same device identity, Site, camera source and ownership.

## Safety invariants

No arbitrary shell, broad process kill, credential reset, security downgrade, source recreation, duplicate DVR login or duplicate Event is an allowed transition. Audit records redact credentials, tokens, private keys and private stream URLs and retain a bounded history.
