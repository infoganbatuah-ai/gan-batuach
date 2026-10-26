# Home registration revocation / first acceptance fence — review only

Status: **isolated PostgreSQL behavior qualified; NOT READY TO APPLY**. The SQL file begins with an aborting guard and ends with `ROLLBACK`. The runner removes those wrappers only in memory inside a new network-disabled, mountless, read-only-root PostgreSQL container. No original Development/Production database, canonical route, Home service, Guard, provider, migration or ACL was touched.

## Scope and non-duplication

Inspected `a1089050` guarded Home registration proposal, `a6bd2ba5` conditional Signal/acceptance writer, `f7141f53` request-bound session reader, local `296aa990` registration writer, the authority-review branch, open PR #255–257 and `automation-7`. The existing acceptance writer locks `registration_identities FOR UPDATE` and tests version 1, but has no revoked-state or owner-epoch fence. The registration proposal has a `REVOKED` audit action but no atomic revocation state. The new `synthetic_accept_first_v1` is **only an isolated acceptance checkpoint fixture**, not a duplicate Signal/Incident/acceptance writer, and is not wired to the existing code. `automation-7` is a status reporter, not an executor. GitHub DNS prevented exhaustive remote-history search; no remote duplicate claim is made.

## Transactional fence contract

The previous isolated qualification writer, this acceptance checkpoint, and revocation all acquire the **same identity row `FOR UPDATE` first**. Revocation requires a current synthetic HomeOwner session, exact current Tenant/Site/Source/owner and a separately verified fixture authority. It atomically increments `owner_epoch`, sets `revoked=true` (irreversible in the candidate), and appends mandatory immutable audit. The acceptance checkpoint verifies a current qualified version, exact scope, session and authority, then writes an immutable receipt plus mandatory audit in one transaction. New events after revocation or with a stale epoch fail closed. An already accepted event can return only from the original receipt with exact scope, epoch, owner, actor, observation fingerprint and matching audit; no new authority or changed/current registration version is used for replay. A revoked or expired **session** still denies replay. Tenant ownership and notification recipients remain independent; this fence neither resolves nor expands recipient policy.

The two isolated concurrency orders use separate PostgreSQL connections: acceptance commits before revocation, leaving one immutable receipt; and revocation commits before first acceptance, leaving no receipt. The loser waits on the identity row and sees the committed state. Mandatory audit failure rolls back the receipt or revocation epoch, respectively. Tests also cover direct-write denial, PlatformAdmin denial, changed owner, stale epoch/session, exact Tenant/Site/Source mismatch, conflicting replay, post-revocation new-event rejection, append-only history and preserved old replay.

Run `node review-only/event-risk-authority-source/run-isolated-registration-fence-qa.mjs` to reproduce the measured assertion count. This is **synthetic PostgreSQL behavior**, not actual Home ownership, deployed RLS/ACL, real Supabase session revocation, canonical Signal writer behavior, crash durability, or physical exactly-once acceptance. The synthetic authority, session and observation fingerprint fixtures are not independent attestation. A caller-supplied UUID or digest is never sufficient live authority.

## Integration and rollback boundary

The existing `a6bd2ba5` writer could consume this fence only after separately reviewed changes: it must acquire the same identity lock before canonical Signal insert, reject `revoked=true` and stale epoch for a **new** event, persist Signal/Incident/acceptance/binding/audit atomically, and return historical accepted replay only after full immutable receipt comparison. Simply adding a revoked check outside that transaction is insufficient. It remains disconnected here. Owner/Source transfer is explicitly **denied**; neither a new epoch nor current mutable Site rows establish transfer authority. No historical backfill.

Lossless rollback is compatibility-first: disable new admission, retain registration identities, epochs, versions, receipts, canonical events, incidents and audit. Do not unset `revoked`, delete receipts, or drop tables with pending work. Active acceptance and transfer rollback require future authorized rehearsal; this package proves no live rollback.

## Remaining exact live blockers

1. An independent, server-verifiable Home ownership and authorized-actor provenance record for exact Model A Tenant/Site/Source/owner, including transfer and revocation authority. Existing current/created_by/app_metadata fields do not establish it.
2. A transaction-bound active Supabase session check and dedicated non-Data-API caller with reviewed owner, grants, inheritance, RLS and canonical mandatory audit semantics. The request-local reader from `f7141f53` does not lock Auth state at commit.
3. The real `a6bd2ba5` Signal/acceptance writer lacks this fence; its current version-1 check alone is not enough. Review complete canonical event/receipt semantics and protected role access before any future adapter wiring.
4. Approved retention/legal hold, bounded volume/cost, original Development schema compatibility and an isolated lossless rollback rehearsal. No live migration or activation is authorized by these tests.

Data owner: Digital Observer Home customer and security owner. Sensitivity: customer/source identity and security audit, no media or secrets. Proposed volume: one receipt+audit per accepted event and one audit per revocation, indexed by event and registration. Retention is unresolved; no deletion job is proposed. The disposable local test adds no paid provider or fixed monthly cost. No unit-economics claim is made.
