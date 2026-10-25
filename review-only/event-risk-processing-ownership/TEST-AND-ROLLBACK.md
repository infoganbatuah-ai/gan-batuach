# DRAFT — synthetic qualification and recovery gates

Nothing in this file authorizes a database write or service activation. The
following are **future** acceptance cases after owner approval, migration
review, an isolated snapshot and a safe restore destination. A passing source
or in-memory model test will not substitute for PostgreSQL concurrency proof.

## Offline results on this branch (synthetic only)

`node --test scripts/qa/check-event-risk-model-a-local.mjs` passed 5/5 test
groups on the final local diff. The groups exercise the actual disabled
`event-risk-recovery.ts` and `model-a-ownership.ts` transitions, not a database.
`validate-review-package.mjs` passed the abort-guard, exact-signature, ACL
scope and no-adapter-activation checks. These are *local contract* results,
not PostgreSQL behavior:

| Required case | Offline result |
| --- | --- |
| Two workers compete; one active owner | PASS in synchronous synthetic store; DB concurrency NOT RUN. |
| Lease expiry and higher takeover epoch | PASS in transition code. |
| Stale owner cannot persist or complete | PASS in transition code. |
| Crash before Risk persistence | PASS modeled by absent Risk and expiry recovery; process crash NOT RUN. |
| Crash after Risk persistence; reuse result | PASS modeled by retained checkpoint and `calculateRisk=false`. |
| Partial effect persistence and replay | PASS modeled by retained receipt, idempotent reread and completion only after remaining keys. |
| Equivalent/conflicting decision intent | PASS for expanded semantic fields; actual DB 23505 NOT RUN. |
| Missing recipient snapshot; changed settings | PASS fail-closed in local plan contract. |
| Stale Incident generation/reference | PASS in local CAS assertion; DB CAS NOT RUN. |
| Missing mandatory media-fault audit | PASS blocks local completion; real audit-write failure NOT RUN. |
| Cross-Tenant, cross-Site, missing Home mapping | PASS fail-closed in Model A resolver/claim scope. |
| Unauthorized RPC role | Static guard check PASS for each proposed body; simulated SQL role behavior NOT RUN. |
| Guard dispatch inactive | PASS: adapter flag false and no external command path called. |

The requested scenarios are grouped above; the untested database/role/crash
facets remain explicit future gates, never implicit PASS.

| Case | Required evidence | Current state |
| --- | --- | --- |
| Two simultaneous identical deliveries | One active claim and one accepted risk result; the non-owner never starts calculation | NOT RUN for draft |
| Crash after claim, before risk commit | No `COMPLETED` marker and no result; new owner recovers after lease expiry | NOT RUN |
| Crash during risk persistence | Result and `RISK_PERSISTED` appear together or neither does | NOT RUN |
| Stale owner after lease takeover | Old epoch cannot persist risk or any downstream effect | NOT RUN |
| Different Event updates same Incident | Incident-wide generation/CAS rejects a stale projection even if the other Event's claim epoch is lower | NOT RUN; schema/transaction open |
| Crash after risk, before outbox | Retry reads stored result, resumes missing idempotent effects without recalculation or loss | NOT RUN; transactional design open |
| Crash between each Risk downstream write | Expected watch-rule, Incident risk projection, verification, intent and Incident verification projection are each recovered or atomically absent; stale epoch writes denied | NOT RUN; completion boundary open |
| Recipient set changes during replay | A durable expected-recipient snapshot or reviewed equivalent proves in-app journal completeness without duplicate delivery | NOT RUN; recipient snapshot open |
| Audit write fails | Gateway ACK policy is explicit; no false claim of immutable-audit completeness | NOT RUN; current helper swallows failure |
| Digital Guard dispatch after Risk completion | Existing command idempotency prevents duplicate physical action; Risk completion neither suppresses nor replays it implicitly | NOT RUN; separate effect review open |
| Replay after complete | Returns stored outcome without recalculation or duplicate outbox | NOT RUN |
| New Event or engine version | Legitimate risk escalation still occurs | NOT RUN |
| Wrong Tenant/Site/Incident | Claim and completion reject; no new mismatched row | NOT RUN; Home tenant mapping open; Site alone is not Tenant proof |
| Existing mismatched rows | Count and restricted references reviewed; no silent repair | PREFLIGHT NOT RUN |
| Scope and privileges | `anon`/`authenticated` cannot call claim or write claims; no client secret | NOT RUN |
| Rollback | Claims/results retained, unfinished events reconciled, no data loss | NOT RUN |

The prior local PostgreSQL checks established only existing uniqueness and a
high-privilege Site-integrity gap. They did not exercise this proposed claim
contract. Do not mark these cases PASS from that older evidence.

The local TypeScript transition tests exercise a non-durable deterministic
double. They do not satisfy any `NOT RUN` PostgreSQL row above.

## Before any future application

1. Pin the exact Development branch and database identity. Verify a current,
   independently restorable snapshot of Development database/Auth and Storage.
2. Run `SITE-PREFLIGHT-READ-ONLY.sql` in a restricted channel; if mismatches
   exist, stop for a separate data decision. Do not delete or auto-correct.
3. Review the Home tenant mapping, effect/ACK ledger, SQL function
   permissions, RLS, index lock time, historical row count, claim cardinality
   and retention. Record the
   next-month and peak usage/cost impact.
4. Replace this guarded sketch with an ordered canonical migration only after
   explicit owner approval. Test it first in an isolated clone with synthetic
   IDs; prove real PostgreSQL transactions, worker restart and rollback.
5. Keep the runtime claim flag OFF until risk, Incident, verification, decision,
   in-app journal and independent route-level effects are qualified. Do not
   acknowledge a Gateway event while only an in-progress claim exists.

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
