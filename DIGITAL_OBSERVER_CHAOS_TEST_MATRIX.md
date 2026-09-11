# DIGITAL OBSERVER CHAOS TEST MATRIX

PUSH 38 reuses canonical fault mechanisms and does not expose arbitrary destructive Product commands.

| Fault | Evidence harness | Expected invariant |
|---|---|---|
| Worker process crash | PUSH 37 HA under active synthetic load | Lease recovers; one result |
| Worker capacity loss/return | PUSH 37 HA under load | Backlog truthful; healthy rejoin |
| Queue consumer crash | PUSH 36 multi-process load | Durable pending work survives |
| API/service instance failure | PUSH 37 health-aware pool | Failed node removed; tenant scope retained |
| Temporary DB unavailability | PUSH 37 retry/circuit QA | Bounded failure and recovery; no corruption |
| Storage unavailable | PUSH 34 provider QA | Evidence not falsely AVAILABLE |
| Cloud interruption | PUSH 21 offline/resync QA | Durable ordered idempotent backfill |
| Gateway relay failure | PUSH 20 supervision QA | Bounded relay recovery |
| Stale stream | PUSH 20 supervision QA | Progress failure detected despite process |
| Connector restart | PUSH 20 supervision QA | Same identity/source returns |
| DVR session interruption | PUSH 20 supervision QA | Session recovers without duplication |

The repeatable qualification harness executes the five owning suites and records SHA-256 digests of their outputs. The four worker/queue capacity cases execute while synthetic work is active. Destructive provider, multi-host and full-Home failures are not claimed.
