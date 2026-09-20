# Digital Observer required CI queue-completion race repair

## Failure

GB-M34 approval PR #82 was blocked by the required `horizontal-ai-scale` domain check: two CI runs reported 122 successful worker completions for 120 logical jobs while the database snapshot had 120 `COMPLETED` rows. This is a separate Digital Observer reliability repair, not a Staff-time change. The canonical repair base is `origin/integration/development` at `9fe30d6a82c8111542bf16002910aa77a14bb914`.

## Reproduction

The unchanged required scenario was run five times locally before edits: 5/5 passed at 120/120; the two CI failures establish timing-dependent reproduction under different process scheduling. The test submits 120 unique job IDs, runs four independent Node workers against one SQLite WAL queue, and counts each worker's `COMPLETED` response. It does not create 122 logical jobs. The queue's `ai_jobs` primary key and `ai_results.job_id` unique constraint limit persisted jobs/results, but the pre-fix acknowledgement response could incorrectly tell more than one worker that it had newly completed a job.

## Root Cause

`acknowledge()` read `ai_jobs.state`, `lease_owner`, and `lease_expires_at` **before** `BEGIN IMMEDIATE`. A lease recovery or competing acknowledgement could commit between that read and the later unconditional `UPDATE ai_jobs SET state='COMPLETED' WHERE job_id=?`. `INSERT OR IGNORE` on the unique result hid a duplicate result insert, while the function still returned `{ acknowledged: true, duplicate: false }` and appended another `JOB_ACKNOWLEDGED` audit record. The portable worker counts that response as a successful logical completion. The same pre-lock read and unconditional update pattern existed in `fail()` and `releaseForFailover()`, permitting stale retry/terminal transitions. Atomic claim already uses a conditional state update; the failure was in terminal transition fencing.

## Logical Job Identity

`job_id` is the logical identity, unique in `ai_jobs`. `attempts` and `lease_owner` describe executions of that job. `ai_results.job_id` is unique. Attempt count may exceed job count after lease recovery; only one attempt may win a canonical terminal transition.

## Claim / Lease Semantics

Claim conditionally moves `PENDING`/`RETRY_WAIT` to `CLAIMED`, records the current worker and lease expiry, and increments attempts. Expired claims return to `PENDING` for another worker. The repair checks current state, owner and unexpired lease under a write transaction before accepting completion/failure/failover. An old worker cannot overwrite a replacement's claim or a terminal state.

## Terminal State

`acknowledge()` now begins a SQLite `IMMEDIATE` transaction before reading the job. The sole successful state transition and unique result insertion commit together. A later ACK observes `COMPLETED` under the lock and returns `duplicate: true`; the worker does not increment its processed count or emit usage. A stale lease returns `ai_queue_lease_invalid`. An expired job has no result. `fail()` and `releaseForFailover()` use the same serialized current-lease check.

## Retry / Timeout

Synthetic tests cover expired lease with replacement claim, stale worker ACK/fail/failover denial, success followed by retry/fail denial, timeout during inference, and a restarted queue reclaiming an abandoned lease. No timeout extension or expected-count relaxation was made.

## Outbox

`ai_results` is the one-result persistence boundary (`UNIQUE(job_id)`); the consumer's `result(..., {consume:true})` is independently idempotent. The repair removes the false successful acknowledgement that could cause duplicate downstream usage/callback behavior. No new outbox schema or replay mechanism was introduced.

## Metrics

`lease_claim_count` counts attempts and may exceed logical jobs. `states.COMPLETED` counts logical completed jobs. `JOB_ACKNOWLEDGED` audit count and worker `COMPLETED` responses must match the unique logical completions; duplicate ACK responses must not count. The 120/500/1,000 synthetic tests compare all four measures.

## Fix

Only the Digital Observer queue, its focused QA, its CI registration and this report are changed. The write lock spans read, current-lease validation, conditional terminal update and result insertion. `GB-M34 MANAGEMENT DIFF FROM FIX: 0`; Management source and migration are untouched.

## Concurrency Tests

`scripts/qa/check-digital-observer-queue-terminal-race.mjs` uses separate SQLite connections and eight independent workers. A successful run measured 120/120 unique results (125 claims), 500/500 (551 claims), 1,000/1,000 (1,058 claims), with exactly one `JOB_ACKNOWLEDGED` per job. These are synthetic local queue tests, not multi-host Production proof.

## Restart Tests

The focused test closes and reopens the durable queue after an unacknowledged claim, advances past the lease, lets a replacement complete, then replays the old acknowledgement. One terminal job and one result remain.

## Repeated Runs

The unchanged `check-digital-observer-horizontal-scale.mjs` scenario passed 10/10 consecutive local runs after the repair, each with 120/120 logical multi-process completions. Exact-head PR CI remains required before merge.

## Regression

Focused queue, routing, horizontal scaling, high availability, cost/failure isolation and gateway outbox checks passed locally. After restoring tracked documentation omitted by the isolated worktree's sparse settings, the full required domain gate passed 30/30 suites, including the new terminal-race suite and unchanged horizontal-scale suite. The other required CI gates must pass on the repair PR's exact head. This report is not a claim that PR or cumulative GB-M34 validation has passed.

## Scale

The lock is per SQLite writer transaction and adds a short transaction around existing writes. No new table, provider, queue infrastructure, polling or media storage is introduced. Multi-host production readiness remains a separate unproven contract.

## Cost

`MONTHLY COST DELTA: ₪0` new fixed commitment. Existing queue writes are serialized during terminal transitions; there is no new billable service. Variable CPU/SQLite lock time may rise slightly under contention; no live billing measurement is claimed.

## Remaining Risk

The local baseline did not reproduce the CI failure, so exact-head CI and repeated runs are essential. Any outstanding false-completion path in another queue backend requires separate evidence. GB-M34 PR #82 remains blocked until the repair merges, its own checks pass, and isolated Development migration and cumulative QA complete. Production is untouched.
