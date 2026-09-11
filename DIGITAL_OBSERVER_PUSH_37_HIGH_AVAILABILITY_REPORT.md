# DIGITAL OBSERVER — PUSH 37 HIGH AVAILABILITY REPORT

Date: 2026-09-11

## FINAL STATUS

`PASS ON VERIFIED PR MERGE`

PUSH 37 hardens the existing queue, worker, storage, health and device-control contracts. It does not create another Observer/Event pipeline and does not begin PUSH 38.

## HA DOMAIN MAP / IMPLEMENTATION

- Added health-aware, scope/capability-aware instance registration and load balancing with stale removal, recovery health gates and flapping cooldown.
- Added operation-specific retry budgets and circuit breaking; device commands have no blind retry.
- Added durable fenced device-control ownership with monotonically increasing epochs and one-time command/OTA/resync effects.
- Added `POSTGRES_SHARED_TRANSACTIONAL` queue adapter plus service-only Postgres schema/RPCs preserving `observer-ai-job-v1`, `FOR UPDATE SKIP LOCKED`, server-clock lease, ordering, expiry, retry/dead-letter and worker tenant/Site scope. The migration and RPC lifecycle execute successfully on an isolated PostgreSQL engine.
- Preserved `SQLITE_WAL_LOCAL_MULTI_PROCESS` strictly as single-host/local. No multi-host SQLite claim exists.
- Added policy-gated storage failover: unauthorized movement remains `PENDING_UPLOAD`; approved alternate write is explicit and measured.

## FAILURE QA

Recorded deterministic closure: three stateless API nodes served 120 requests. Initial 90-request distribution was api-a 24, api-b 34, api-c 32; after api-b failure all 30 additional requests avoided it. Latest local removal/failover RTO was 0.225 ms; rejoin required two successful probes. Tenant leakage was zero.

Two competing device-control owners produced epoch 1 then epoch 2 after expiry. The old owner was fenced; command, OTA, resync and heartbeat effects were one-time. Latest ownership takeover RTO was 0.135 ms after the configured expiry boundary, with zero re-enrollments or duplicate identities. Isolated PostgreSQL execution additionally proved first-owner exclusion, tenant/Site scope immutability, row-locked effects and duplicate ACK/effect idempotency.

Forty durable AI jobs survived queue reopen and one claimed-worker loss. Capacity dropped to one worker with 32 jobs remaining, then a second healthy worker joined; all 40 completed, one result per job, zero dead letters/loss/duplicates. Backlog recovery completed in 204.869 ms in the latest recorded local QA run.

DB dependency QA passed bounded retry, circuit-open, cooldown probe and recovery with zero corruption. Storage QA preserved pending state without an authorized alternate and used `approved-nas` only when explicitly allowed; no false `AVAILABLE` state and no lost last copy.

## RTO / RPO

- API local failover: 0.225 ms.
- Device-control ownership takeover: 0.135 ms after the configured lease expiry boundary.
- Worker capacity loss plus backlog recovery: 204.869 ms for 40 jobs in local QA.
- Acknowledged canonical records lost: 0.
- Duplicate Product effects: 0.

These are local observations, not SLA, zone or provider claims.

## QUEUE / DATABASE / STORAGE EVIDENCE

Queue HA path: implemented production-ready Postgres shared transactional contract and executed it on isolated PostgreSQL; deployment/multi-host provider proof is not available in this environment. SQLite remains local-only. Database outage behavior is isolated dependency/circuit QA, not a managed Supabase failover drill. Storage failover is local contract QA across the existing approved storage abstractions, not provider-zone proof.

## SECURITY / CONTINUITY

PUSH 18 identity and tenant/Site scope remain mandatory. Service-only queue/ownership RPCs are not public. Fencing prevents split brain, stable effect IDs prevent duplicate command/OTA/resync work, and recovery does not create a Device, Site or Camera Source. No signing/device private key is distributed for HA.

Canonical security QA passed 7/7, including tenant/privacy and mock isolation. `npm audit --audit-level=high` reported zero HIGH and zero CRITICAL findings; six pre-existing MODERATE transitive findings remain in the Firebase/Google request dependency chain. The separately tracked PUSH 25 billing-role RLS HIGH finding remains open and was neither changed nor hidden by PUSH 37.

The completion run also exposed and closed a clean-checkout release-preflight dependency on ignored `.vercel/project.json`. The preflight now accepts a tracked, non-secret deployment identity contract or explicit Vercel environment identity while still preferring and validating a local Vercel link when present. Contract QA proves a clean checkout without hidden Vercel state passes, and wrong-project, dirty-tree and secret-shaped snapshots remain rejected.

## REAL HOME

Read-only validation verified all 10 populated DVR channels by obtaining their canonical authorized local playback manifest and decoding one current frame from each. Gateway health then reported 10/10 progressing, zero failed and zero stalled relays. The independent Tapo Connector remained 1/1 progressing with zero stalled relays, and one real Tapo sample traversed the canonical two-worker contract with one accepted result and zero duplicates. Six DVR slots remained `CHANNEL_EMPTY / UNASSIGNED` and emitted zero jobs. Total expected/progressing physical cameras were 11/11. No source configuration, Site, Device or Camera Source was created or changed. Destructive HA tests used isolated fixtures.

The initial audit found DVR channels 1 and 2 absent from the active relay set while eight other channels progressed. A normal canonical playback request safely reopened those existing sources; no Gateway-wide restart, re-enrollment or configuration mutation was used. The legacy read-only inspection helper was corrected to include the configured stream namespace in canonical stream IDs, preventing false `source_unavailable` results.

## EVIDENCE CLASSIFICATION

Achieved: `LOCAL_MULTI_PROCESS`, `LOCAL_MULTI_NODE`, `PRODUCTION_READY_POSTGRES_CONTRACT`, split-brain/fault-injection QA.
Not claimed: `MULTI_HOST`, `MULTI_ZONE`, `MULTI_PROVIDER`, managed-provider failover or final soak/chaos qualification.

## CANONICAL STATUS

PUSH 37 becomes `DONE` only after required checks pass, the dedicated PR merges, and `origin/main` is verified. PUSH 38 remains not started.
