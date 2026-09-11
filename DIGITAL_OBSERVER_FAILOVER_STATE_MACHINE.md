# DIGITAL OBSERVER — FAILOVER STATE MACHINE

Contract: `observer-ha-service-v1`

## Service instance

`HEALTHY → DEGRADED/UNHEALTHY → REMOVED FROM ROTATION → FAILOVER → RECOVERING → HEALTH GATE → HEALTHY`

- Stale heartbeat or failed probe removes an instance from eligibility.
- Work is retried only within its operation-specific budget and only when idempotency permits.
- Flapping opens a cooldown; successful probes during cooldown do not immediately reintroduce the instance.
- Capacity loss raises queue age truthfully; priority and tenant/camera fairness remain active.

## Exclusive control ownership

`UNOWNED/EXPIRED → LEASE ACQUIRED(epoch N) → AUTHORITATIVE → RENEWED | EXPIRED → NEW OWNER(epoch N+1)`

Every authoritative device command, OTA transition, resync commit or heartbeat ownership transition carries the current owner and epoch. A stale owner receives `ha_fencing_token_rejected`. Stable effect keys prevent a takeover from repeating an accepted effect.

## Dependency failure

`CLOSED → FAILURE BUDGET → OPEN → COOLDOWN → HALF-OPEN PROBE → CLOSED | OPEN`

Security-sensitive authorization fails closed. Device commands are not blindly replayed. Evidence writes remain pending unless a policy-approved alternate storage backend succeeds.
