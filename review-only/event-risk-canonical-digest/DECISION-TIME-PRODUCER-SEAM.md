# Decision-time recipient/settings producer seam — review-only, not active

This unit adds a disconnected Node contract in `decision-time-producer-seam-v1.mjs`. It cannot be used as proof that an authoritative producer exists or that a plan is durably frozen. It performs no database operation, network request, route invocation, or notification delivery. All test readers are synthetic.

## Evidence and source boundary

- `codex/event-ingest-replay-identity-20261025:lib/domain/digital-observer/event-risk-ownership-snapshot.ts` defines `validatePrePersistEventOwnership`, `bindPostReadRiskOwnership`, and `createDecisionTimeRecipientSnapshot`. Its `AuthoritativeEventOwnershipReader` comment says no deployed adapter implements the trusted read. Source references found for `createDecisionTimeRecipientSnapshot` are its definition, not a live decision-time producer.
- `lib/domain/digital-observer/notification-orchestration.ts` defines `RecipientAuthorization`, `assertRecipientAuthorization`, and `createDeliveryPlan`. Those are eligibility/plan contracts, not an atomic read of tenant-scoped recipients, settings version, policy version, and persisted Risk at one decision time.
- PR #259's guarded `observer_event_risk_plan_authority` table and `start_event_risk_effects_v1` require a future independently authorized producer. Its SQL explicitly says none exists and requires `pg-jsonb-text-v1`. PR #260's guarded receipt writer requires the same authority/algorithm. Neither proposal is installed by this unit.
- The previous `canonical-v1` fixture passed 58 Node/PostgreSQL checks in a disposable, network-disabled PostgreSQL instance. This unit reuses its Node validator; it does not alter its SQL or claim live PostgreSQL behavior for the producer.

## Candidate contract and effects

The sole request consists of the exact Model A Tenant/Site/Source/Event/Incident/Risk IDs plus engine version. It cannot carry recipients, settings, expected hash, or a client authority flag. The injected **server-owned** decision reader must perform a consistent read of canonical ownership, a persisted Risk decision with evaluation time, and selected recipient/settings facts. The seam rejects missing, stale (>30 seconds), inconsistent, cross-Tenant, cross-Site, unverified, duplicate, or noncanonical facts and returns a deeply frozen `canonical-v1` candidate with both ownership and settings evidence references. The 30-second rule is a review candidate, not an approved operating threshold. A caller-controlled reader can fabricate flags and references; only a separately reviewed adapter, credentials, transaction/isolation, RLS/ACL checks, and audit can establish real authority.

The injected frozen reader is checked **before** current settings are consulted. A matching immutable `canonical-v1` record replays the originally saved content and recomputes both hashes; changed current recipients/policy are ignored. Forged or mismatched digests fail. Without an atomically persisted row, two calls can produce different candidates; the test proves this explicitly. Returned candidates are labelled `CANDIDATE_NOT_PERSISTED` and `requiresAtomicInsert: true`, never `READY` or `AUTHORIZED`.

Version compatibility is fail-closed: `canonical-v1` is recomputed only with its own typed-value grammar; `pg-jsonb-text-v1` is never rehashed or upgraded by Node and instead requires the original PostgreSQL-side versioned verifier. Unknown versions fail. Existing frozen records must preserve their algorithm, bytes, recipient scope and provenance. Adding `canonical-v1` to PR #259/#260 would require a separately reviewed, coordinated versioned schema/reader/producer change; this seam does **not** replace their current constraints. Raw duplicate JSON object keys are still a pre-parser rejection dependency, as documented in `QUALIFICATION.md`.

## Exact remaining implementation gates

1. Identify and verify canonical server-side ownership and recipient/settings stores, including historical Model A authority and versioned recipient eligibility. Existing model functions and proposed tables do not prove such a source. Never derive it from client Tenant/Site or mutable parent profile settings.
2. Implement one trusted, transactionally consistent, decision-time read and independently validate Risk/ownership evidence and recipient authorization. A synthetic callback is not that adapter.
3. Define a single-writer, atomic insert-if-absent of immutable authority/snapshot with uniqueness on canonical event and engine version, fenced against replacement and with mandatory audit. No such write or migration is authorized here; absent it, replay cannot be guaranteed.
4. Coordinate any new algorithm with PR #259/#260 and prove legacy handling against an authorized isolated Development schema and PostgreSQL semantics. Do not silently rewrite `pg-jsonb-text-v1` records or infer PostgreSQL behavior from the Node test alone.
5. Reject duplicate raw object keys before JSONB/`JSON.parse`; both otherwise collapse them. Verify privileges, Data API exposure, retention and rollback before any future activation.

Local validation: `node --test review-only/event-risk-canonical-digest/decision-time-producer-seam-v1.test.mjs`. Tests exercise the implementation seam, not a live database, recipient source, durable persistence or Guard. The [Supabase Data API change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) is relevant only to a future migration/exposure review; this unit adds no table or grant.
