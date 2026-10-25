# DRAFT — synthetic qualification and recovery gates

Nothing in this file authorizes a database write or service activation. The
following are **future** acceptance cases after owner approval, migration
review, an isolated snapshot and a safe restore destination. A passing source
or in-memory model test will not substitute for PostgreSQL concurrency proof.

| Case | Required evidence | Current state |
| --- | --- | --- |
| Two simultaneous identical deliveries | One active claim and one accepted risk result; the non-owner never starts calculation | NOT RUN for draft |
| Crash after claim, before risk commit | No `COMPLETED` marker and no result; new owner recovers after lease expiry | NOT RUN |
| Crash during risk persistence | Result and `RISK_PERSISTED` appear together or neither does | NOT RUN |
| Stale owner after lease takeover | Old epoch cannot persist risk or any downstream effect | NOT RUN |
| Crash after risk, before outbox | Retry reads stored result, resumes missing idempotent effects without recalculation or loss | NOT RUN; transactional design open |
| Replay after complete | Returns stored outcome without recalculation or duplicate outbox | NOT RUN |
| New Event or engine version | Legitimate risk escalation still occurs | NOT RUN |
| Wrong Tenant/Site/Incident | Claim and completion reject; no new mismatched row | NOT RUN; Home tenant mapping open |
| Existing mismatched rows | Count and restricted references reviewed; no silent repair | PREFLIGHT NOT RUN |
| Scope and privileges | `anon`/`authenticated` cannot call claim or write claims; no client secret | NOT RUN |
| Rollback | Claims/results retained, unfinished events reconciled, no data loss | NOT RUN |

The prior local PostgreSQL checks established only existing uniqueness and a
high-privilege Site-integrity gap. They did not exercise this proposed claim
contract. Do not mark these cases PASS from that older evidence.

## Before any future application

1. Pin the exact Development branch and database identity. Verify a current,
   independently restorable snapshot of Development database/Auth and Storage.
2. Run `SITE-PREFLIGHT-READ-ONLY.sql` in a restricted channel; if mismatches
   exist, stop for a separate data decision. Do not delete or auto-correct.
3. Review the Home tenant mapping, SQL function permissions, RLS, index lock
   time, historical row count, claim cardinality and retention. Record the
   next-month and peak usage/cost impact.
4. Replace this guarded sketch with an ordered canonical migration only after
   explicit owner approval. Test it first in an isolated clone with synthetic
   IDs; prove real PostgreSQL transactions, worker restart and rollback.
5. Keep the runtime claim flag OFF until risk, Incident, verification, decision
   and notification recovery are all qualified. Do not acknowledge a Gateway
   event while only an in-progress claim exists.

## Forward recovery and rollback — proposed, not executed

Before activation, removal of review files changes no data. After a future
activation, **do not drop active claims or the original Events**. Stop new
processing intake in a controlled way, record in-flight claim keys and epochs,
preserve the claim/result/outbox rows and backup, and reconcile each unfinished
stage. Resume only from the last durable stage. Reject stale owners using the
stored epoch. Roll application code back only to a version compatible with the
persisted schema and pending stages; otherwise keep the new path disabled and
complete forward recovery. Remove schema objects only after a separately
approved retention/legal review and an isolated restore/rollback rehearsal.

The previous route's duplicate calculation remains if code alone is reverted.
That is an explicit rollback risk, not an acceptable silent fallback.
