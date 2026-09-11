# DIGITAL OBSERVER — HIGH AVAILABILITY ARCHITECTURE

Contract: `observer-ha-service-v1`
Scope: Digital Observer Web/API, AI queue/workers, storage access and managed-device control plane. Observer/Event semantics remain unchanged.

## Failure-domain inventory

| Domain | Current topology | Failure mode | Existing recovery | PUSH 37 authority |
|---|---|---|---|---|
| Web/API | Stateless Next.js routes on Vercel/serverless | instance/process loss | hosting replacement | health-aware instance registry; shared auth/session truth; no process-local Product state |
| AI workers | PUSH 36 multi-process portable pool | worker exit/capacity loss | lease recovery | unhealthy removal, lease reclaim and validated rejoin |
| AI queue | SQLite WAL locally; Postgres available to Product | host loss / writer unavailability | SQLite restart recovery | keep SQLite local-only; add `POSTGRES_SHARED_TRANSACTIONAL` RPC/SQL contract for multi-host coordination |
| Database | managed Supabase/Postgres | temporary connection/service outage | provider recovery | operation-specific bounded retry and circuit breaker; fail closed, no cache as competing truth |
| Storage | private Supabase plus scoped local/NAS backend | backend unavailable | PUSH 21 pending upload | policy-authorized alternate only; otherwise truthful `PENDING_UPLOAD` |
| Device control | PUSH 22 idempotent commands | competing control nodes | command expiry/idempotency | shared lease, monotonically increasing epoch and fencing token |
| Gateway/Connector | one stable PUSH 18 device principal each | heartbeat handler loss | reconnect without re-enrollment | ownership handoff preserves device/Site/source identity |
| Observability | PUSH 27 shared telemetry | monitoring instance loss | managed telemetry backend | bounded failover, lease and loss/duplicate/RTO counters |

## Canonical service path

`authenticated instance → health registration → eligible pool → bounded load balance → failure removal → alternate selection → recovery health gate → rejoin`

Health, scope and capability are hard eligibility gates. Selection is deterministic and load-aware. An unhealthy, revoked, stale or flapping instance cannot receive new work. Recovery requires consecutive successful probes and cooldown completion.

## Queue boundary

- `SQLITE_WAL_LOCAL_MULTI_PROCESS` remains the supported single-host Edge/local queue. It is not multi-host HA.
- `POSTGRES_SHARED_TRANSACTIONAL` is the production-ready shared backend contract. The migration supplies durable records, unique job/idempotency/result keys, server-clock leases, `FOR UPDATE SKIP LOCKED`, retry/dead-letter, expiry, per-source ordering, tenant/Site worker scope and service-only RPCs.
- PUSH 37 executes the shared schema/RPC lifecycle on isolated PostgreSQL and proves local transactional behavior. No deployed multi-host or managed-provider failover claim is made; that remains an external environment evidence gap and a PUSH 38 qualification input.

## Dependency and storage behavior

Retry budgets differ for reads, idempotent writes, Evidence writes and device commands. Circuit breakers stop repeated calls to unhealthy dependencies. Storage failover is opt-in by approved backend ID; otherwise work stays pending and Evidence never becomes falsely `AVAILABLE`.

## Evidence levels

Proven: local multi-process, local multi-node, shared transactional contract, split-brain fencing, deterministic fault injection.
Not proven: independent multi-host deployment, availability-zone failover, provider failover, multi-region continuity.
