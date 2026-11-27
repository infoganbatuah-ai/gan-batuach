# Risk writer qualification and activation blockers

Status: **isolated PostgreSQL PASS; live migration BLOCKED**. The guarded file is not installed or callable by any live role. No adapter uses it.

## Source and synthetic boundaries

- Canonical source Risk columns and checks: `supabase/migrations/20260906010000_digital_observer_risk_decision_engine.sql`; event/version uniqueness: `20260906011000_digital_observer_risk_event_idempotency.sql`. The test runner extracts the Risk table definition from source, then applies the source unique index to a disposable fixture.
- Claim key/epoch/lease and three existing guarded bodies: `review-only/event-risk-atomic-claim-qualification/` at integration base `b305491c7e63eea4dcd3c9620bb32fd1f2e13c56`.
- Seven-RPC inventory and four-writer map: preserved separate source branch `codex/event-ingest-replay-identity-20261025@341ff2bfb6ae0a297cbecce47a8cacac57c51a37`. The new body preserves exact signature and does not substitute for the other three blocked writers.
- The isolated fixture has synthetic Tenant, Site, Source, Signal and Incident rows. It does not prove historical Home Tenant authority, deployed schema/RLS compatibility, or actual accepted-event processing.

## Transaction and return contract

`persist_event_risk_v1(uuid,text,uuid,bigint,jsonb) RETURNS uuid` is `SECURITY INVOKER`, with `pg_catalog,pg_temp` search path, and rejects any current SQL role other than `service_role`. The proposed SQL grants no caller EXECUTE. An eventual migration must approve exact-function ACL and Data API exposure separately. `service_role`'s BYPASSRLS is **not** Tenant authorization.

The caller supplies exact source RiskEvaluation fields plus expected Incident generation and previous Risk reference. Identity, scope, metadata and Risk ID are server-derived. Extra/missing fields and JSON nulls fail. Canonical row locks follow Signal→Site→organization→link→Incident→claim, matching the existing acquisition path. Current owner nonce, epoch and live lease are rechecked **after** waiting. A first insert requires the expected Incident-wide generation and previous Risk reference; it atomically inserts one canonical Risk row, one mandatory audit, one proposed receipt referencing both, and marks the claim `RISK_PERSISTED`. Any failure rolls back all four writes. An identical retry compares every source-defined semantic Risk field and the receipt's generation/previous reference, returning the same UUID without another audit. A conflicting result, missing receipt, stale owner, changed scope or audit failure is denied.

This only establishes one valid committed Risk result under the fixture. It does not promise exactly-once CPU computation across crashes; it does not write or complete effects, acknowledge external Guard, or route active ingestion.

## Local evidence

The network-disabled disposable PostgreSQL 17.6 runner performs 21 assertions: direct guard rejection with no object created; anon denial; source Risk row+claim+audit+receipt atomicity; exact replay; conflicting replay; wrong nonce/epoch; expected Incident generation/reference mismatch; caller Site injection; cross-Site link and cross-Tenant change; audit-trigger failure with complete rollback; concurrent identical persistence; expired-lease owner takeover and stale-owner rejection; two competing owners with one winner. This is real local PostgreSQL execution against synthetic data, not a clone or a real Development write.

## Remaining exact blocking facts

1. **Historical Model A authority**: source Site organization membership and the synthetic fixture do not prove the Tenant of every Home event at event time. The exact authoritative historical relationship and backfill disposition must be verified before any live migration or adapter activation. Missing or ambiguous ownership must fail closed.
2. **Deployed catalog / migration compatibility**: the claim table and Incident generation are still guarded proposals; receipt is new here. A future authorized Development-only migration must compare actual catalog, RLS, roles, indexes and migration order before installation. The source Risk row has only separate FKs, not a composite Tenant/Site chain.
3. **Immutable source row/audit**: the source calls Risk history immutable, but the isolated fixture does not prove all real SQL roles cannot UPDATE/DELETE it. The live migration must review exact grants, Risk immutability, audit trigger/hash behavior and receipt protection without broad ACL changes. The fixture uses a minimal UUID audit shape, not the deployed hash chain.
4. **Remaining writers**: frozen recipient/settings plan, fenced effect row+receipt, Incident-wide projection CAS and completion are absent. The active route still uses separate Data API writes, including a 23505 ID-only Risk reread. Do not call `persist_event_risk_v1` live or activate a claim-only adapter.
5. **Retention, recovery and finance**: receipt/audit retention and legal holds need approval; no TTL or deletion is proposed. Before activation, measure actual event volume, table/index/audit growth, backup/restore and all-in ₪15-per-paying-user economics. No provider cost is incurred by this local fixture.

## Lossless rollback boundary

Before any future adapter activation, a failed migration can leave the additive objects unused. After writes exist, do not drop claim/Risk/audit/receipt tables or erase incomplete work; disable the adapter and preserve rows for reconciliation. No lossless live rollback or crash-restore rehearsal is claimed here.
