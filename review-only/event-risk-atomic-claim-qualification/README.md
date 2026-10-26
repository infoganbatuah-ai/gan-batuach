# Event-risk atomic claim: isolated PostgreSQL qualification, NOT APPLIED

Base: `origin/integration/development@91653fafb3aa124c92f3a0b1c2416324e42da493`.
The already-existing candidate SQL comes from the separate, preserved
`codex/event-ingest-replay-identity-20261025@341ff2bfb6ae0a297cbecce47a8cacac57c51a37`
review package. At the initial 2026-10-26 qualification,
`RPC-BODIES-SOURCE-NOT-APPLIED.sql` was a byte-for-byte copy
(then SHA-256 `39fe43792c181571a3ff729485924c9d2e1c368a45dbcc63a525390b0841dcdf`).
The later claim-time Home authority gate below makes this a **local review
amendment**, not a byte-identical copy or an approved replacement. Its aborting
guard remains intact. The runner
extracts the three function definitions **in memory for its disposable database
only**. Never run the copied file as a migration. The other four proposed RPC
bodies remain blocked in the source package; this branch does not invent them.

The synthetic fixture is separately guarded: direct SQL execution aborts
before creating roles or tables. The runner removes that guard in memory only
after confirming the `colima-gbi` local Unix-socket Docker context.

## 2026-10-27 local Home acceptance gate amendment

The previous claim body trusted a Signal's `REAL_CAMERA_AI` / `validated_event`
metadata and current Site/Source mapping. A syntactically valid orphan Signal
could therefore acquire a claim. PR #255 diagnoses Home event-time ownership;
PR #258 qualifies a different Risk writer. Neither supplies this claim gate.

The guarded candidate now requires an exact immutable Home acceptance,
qualified registration version, current non-revoked registration identity and
owner epoch, exact binding, exactly one matching ACCEPTED audit and the BOUND
audit, all before claim/lease/audit insertion. It compares the **complete
server-owned observation projection** with the canonical Signal fields and
metadata, holds the registration lock against revocation, and compares current
Model A Tenant/Site/Source/owner with frozen receipt scope. It rejects the
unqualified `person_exited` path before the old `NOT_APPLICABLE` shortcut.
The candidate additionally requires an immutable Incident ID in the binding
and compares it with the canonical correlated link and Incident. This is a
**BLOCKED additive dependency**: the existing Home binding proposal lacks
that column and its writer does not populate it atomically. No historical
Incident is inferred or backfilled.

The disposable PostgreSQL fixture supplies synthetic Home identity, version,
acceptance, binding and audit rows; these are not independently verified owner,
Gateway or Supabase sessions. In the fixture only, `service_role` receives
`UPDATE(owner_epoch)` so that `SELECT ... FOR SHARE` can lock the identity row.
That privilege would let the role modify the epoch and is **not an acceptable
live ACL**. A dedicated caller/lock strategy with proven owner, invoker grants,
RLS and Data API exposure is still required. The current Development database
has none of these Home objects; no live user rows or SQL writes were used.

Focused result: 77 isolated PostgreSQL checks PASS, including an orphan with
apparently valid metadata, missing/duplicate receipt or audit, binding and
Incident mismatch, full Signal-payload tampering, current Site/Source transfer,
revocation and epoch changes, a concurrent revocation race, caller denial,
and replay. Every negative candidate left zero claim rows and claim audit rows.
The disposable fixture has no Risk-effect writer, so this is **not** proof of
durable effect absence in a real deployment. Original claim/recovery tests
also remain covered. The proposal is **not ready to apply or activate**.

`run-isolated-postgres-qa.mjs` launches the already-cached PostgreSQL 17.6
image as an unprivileged, read-only, resource-limited, `--network none` container, with `/tmp`
as its only writable filesystem. It has no host mount, no host port, no link
to LOCAL_SUPABASE, and is stopped and removed in `finally`. The synthetic
schema uses the field shapes needed by the three copied functions; it is
**not** a clone or proof of deployed catalog/RLS compatibility.

Local result (2026-10-26): 18 isolated PostgreSQL assertions PASS, including
direct-execution guards leaving no roles or functions. Two real
database sessions contending for one Signal produced one OWNED and one BUSY,
one claim row and one mandatory audit. Expiry permitted one higher-epoch
takeover; the old owner could not renew. Recovery kept a synthetic persisted
Risk reference. Wrong camera-link Site, missing Tenant mapping, and changed
Tenant were denied. An audit insertion failure rolled claim creation back.
An `anon` function call and a wrong-nonce renewal were denied. Audit metadata
did not contain the owner nonce. This verifies these three candidate bodies
against the fixture, not accepted-event completion, RLS, or crash durability.

The active `cloud-events` route is unchanged. Its concurrent identical replay
still may perform two Risk evaluations before one durable result, as the
prior route test showed; no claim/Risk receipt is installed or invoked. A
claim alone cannot protect the current separate Data API Risk, watch-rule,
verification, intent, journal, audit, and Guard-eligibility writes. A future
adapter must acquire ownership before compute and must atomically fence the
actual persisted Risk and mandatory effects. It must reuse a valid result on
recovery, compare semantic duplicates, and keep Event/Incident/recipient
scopes separate. No exactly-once CPU or external action claim is made.

Remaining gate: verify authoritative Model A event-time Tenant/Site ownership,
complete the four blocked fenced writers and immutable recipient snapshot,
and qualify exact deployed schema/ACL and crash-recovery behavior in a
separately reviewed Development migration. Until then, fail closed for the
new ownership adapter and do not activate it. Historical Home ownership must
not be inferred from current nullable Site organization membership.

Data/cost classification: the proposed claim would be one bounded metadata
row per accepted Signal and engine version, plus audit on acquisition and
takeover; owner is Digital Observer; sensitivity is operational security
metadata (no media or recipient payload). Retention and legal holds are not
approved, so no TTL or deletion is proposed. Current test adds no provider
or fixed recurring charge. Before any deployment, measure Event volume,
table/index/audit growth and restore needs, and compare the all-in forecast
against the project's ₪15-per-paying-user ceiling. No financial compliance
claim follows from this synthetic test.

Rollback: no live state exists to roll back from this branch. A future live
rollback must preserve accepted Events, claims, epochs, Risk results, effect
plans/receipts and mandatory audit; never drop in-flight rows or reinterpret
COMPLETED as physical Guard acknowledgment.
