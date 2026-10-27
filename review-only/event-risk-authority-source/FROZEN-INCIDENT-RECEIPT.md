# Frozen Incident receipt — offline review only

This unit closes a specific *proposed* writer/claim mismatch. The guarded Risk
claim in `../event-risk-atomic-claim-qualification/RPC-BODIES-SOURCE-NOT-APPLIED.sql`
requires `event_bindings.incident_id`, while the pinned Home acceptance writer
from `a6bd2ba5` and binding writer from `a1089050` do not populate it. No
deployed schema or runtime is changed by this unit.

## Proposed transaction

The pinned Home acceptance writer locks the registration identity first, then
validates epoch, current Source/Site/Tenant and Gateway fixture authority. Its
Signal INSERT invokes the isolated correlation trigger, creating the canonical
Incident and link. In the same SQL call and transaction, it writes acceptance,
ACCEPTED audit, binding (including the *server-derived* Incident ID), and BOUND
audit. The proposed binding body requires a unique canonical Signal link,
locks the link and Incident, validates Site/Source/event association, and
rejects an existing binding whose frozen Incident differs. The pinned replay
path now invokes the binding verifier before returning the original Signal ID.
The existing registration row lock serializes acceptance and revocation.

The source migration `20260905010000_digital_observer_canonical_incidents.sql`
defines `observer_incident_signal_one_timeline_idx`, a unique index on
`(source_type,source_id)` for canonical Signal links. Presence and current
definition in a live database are **not verified** here. The new `NOT VALID`
check rejects new NULL Incident bindings without claiming older receipts have
been backfilled. The local review-chain copy of the Risk claim package now
references this file as its sole `incident_id` definition and no longer repeats
the `ADD COLUMN`. The separate source PR branches were not changed; a future
migration author must take the consolidated review-chain version, not combine
stale draft DDL from separate PRs.

## Isolated proof and boundaries

`node review-only/event-risk-authority-source/run-isolated-home-qualification-chain-qa.mjs`
runs a disposable, network-disabled PostgreSQL 17 container, no host mounts.
Its synthetic correlation trigger is not proof of the deployed trigger. The
runner tests new acceptance and same-ID replay; a changed correlated link
fails rather than silently rebinding the frozen Incident. It installs the
actual guarded Risk claim body in that disposable schema and claims an event
whose binding and Incident were created by the acceptance writer, not a
manually seeded Risk fixture. Injected Incident, link, binding and BOUND-audit
failures each leave no partial Signal/Incident/acceptance/binding/audit rows.
It checks revocation-before-acceptance and acceptance-before-revocation lock
orders. After revocation, a new acceptance fails; an identical historical
replay may still return its immutable prior receipt, but the guarded Risk claim
rejects revoked authority. There is no live source, owner, Auth or Gateway
attestation in this test.

## Blocking facts before any live use

- The current Development/Production catalog, migration history, legacy
  binding rows and actual correlation trigger have not been verified by this
  unit. An authorized, bounded catalog review and non-ambiguous legacy-row
  reconciliation are required before any additive migration or validation.
- `qa_owner_authority_fixture`, `qa_owner_session_fixture`, and
  `qa_gateway_session_fixture` are synthetic substitutes. Live Home owner,
  Auth-session and Gateway provenance/caller grants are absent. No ingestion
  route may call the proposed writer until independently established.
- `registration_audit` is a review-only mandatory receipt, not yet proven
  equivalent to the deployed immutable audit contract. Live audit ownership,
  write privileges, retention and failure semantics require review.
- These SQL bodies are not in `supabase/migrations`, are not applied, and have
  no approved Data API exposure. No Risk adapter, Guard effect, `person_exited`
  acceptance, historical backfill, or Production/Home activation is provided.

Rollback remains compatibility-first: before activation, leave additive
objects unused; after any future write, retain Signal, Incident, link,
acceptance, binding and audit history. Do not drop or rewrite accepted rows to
undo the proposal. This is **not** a proven lossless live rollback.
