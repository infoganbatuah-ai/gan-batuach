# Decision-time snapshot persistence compatibility — local review only

Decision: **NONE of the existing canonical stores is compatible** with the
schema-v1 `DecisionTimeRecipientSnapshot` plus durable recovery requirements.
No encoder/decoder is justified. This is a source/catalog-evidence decision,
not a fresh database query or a PostgreSQL durability test.

Evidence basis: the previously saved Development catalog qualification in
`OBJECT-INVENTORY.json` confirms the relevant Risk, verification, decision,
Incident and audit tables, and their proposed claim/plan/receipt tables are
absent. Exact source definitions come from the migrations cited below.
`digital_observer_action_intents` is source-defined by PUSH 39 but was **not**
among the previously catalog-qualified objects; its deployed presence and
effective ACL are not newly asserted. Later migration declarations are not
silently treated as observed deployed state.

| Candidate and source contract | Keys, scope and writer/consumer | Compatibility failure |
| --- | --- | --- |
| `digital_observer_risk_evaluations` — `20260906010000_digital_observer_risk_decision_engine.sql`, `20260906011000_digital_observer_risk_event_idempotency.sql`: `observer_site_id`, `incident_id`, `triggering_event_id`, `risk_engine_version` NOT NULL; `metadata jsonb NOT NULL`; PK `id`; unique `(incident_id,triggering_event_id,risk_engine_version)`. | Site/Incident/Event FKs are individual, not a Tenant composite. `risk-decision-service.ts` inserts one Risk then ID-only rereads after 23505; later watch/Incident writes are separate Data API requests. Site-scoped read policy; effective writer ACL was not qualified for a new snapshot. | `metadata` is fixed current Risk metadata, not a versioned recipient/settings contract. No Tenant, snapshot schema/fingerprint, protected recipient set, policy version, evidence-reference or immutable first-write guard. Existing unique key is for Risk computation, not snapshot content. Cascade FKs do not guarantee retention through recovery. |
| `digital_observer_decision_intents` — same base migration: `observer_site_id`, `incident_id`, `risk_evaluation_id` NOT NULL; `dedupe_key` NOT NULL; `metadata jsonb NOT NULL`; unique `(observer_site_id,dedupe_key)`; PK `id`. | Site/Incident/Risk FKs are individual; no Event or Tenant column. `incident-verification-service.ts` inserts after verification and treats 23505 as success without rereading semantic content. Site-scoped read policy; writer uses a separate Data API request. | Closest decision record, but `metadata` has a defined verification/final-decision consumer shape, not a full snapshot contract. No canonical recipient/settings fingerprint, schema version, event-time Tenant, evidence-reference set, immutable duplicate comparison or transaction with Risk/claim/plan. Dedupe key does not prove snapshot equivalence. Retention remains unverified. |
| `digital_observer_action_intents` (notification Outbox) — source `20261018010000_digital_observer_push39_orchestration.sql`: Site NOT NULL; Incident/decision-intent/Signal nullable; `policy_snapshot jsonb NOT NULL`, `proposed_action jsonb NOT NULL`, `idempotency_key` NOT NULL; unique `(observer_site_id,idempotency_key)`; mutable `intent_status`. | PUSH 39 action authorization/dispatch boundary; `notification-delivery-service.ts` reads `policy_snapshot` for lawful-use approval and current recipient/provider authorization. Source declares RLS and scoped read, revokes anon/authenticated writes. Deployed catalog and effective ACL not rechecked. | A notification intent may not exist for every Risk decision; nullable links and mutable status cannot bind one canonical Event/engine snapshot. `policy_snapshot` is consumed as action policy, not the recipient/settings set or its canonical hash. No required evidence refs or same-transaction Risk checkpoint. Source comment delegates retention to Site policy without a measured recovery window. |
| `digital_observer_notification_deliveries` — `20260820010000_digital_observer_product_runtime.sql` plus PUSH 39 migration: Site NOT NULL; Signal/recipient nullable; `authorization_snapshot jsonb`, `policy_snapshot jsonb`, `metadata jsonb` NOT NULL by later source; Site/dedupe unique in PUSH 39 source, stable delivery ID unique when non-null; mutable status/attempts. | Per-recipient/channel journal and delivery queue. `notifications.ts` inserts in a loop; `notification-delivery-service.ts` upserts and rereads by `(observer_site_id,dedupe_key)`, then rechecks current recipient authorization on dispatch. Site-scoped read; later source revokes authenticated writes. | No single immutable decision-wide row. Recipient and Signal FKs can become NULL on deletion; no Tenant/Incident/Risk/engine binding. Per-delivery snapshots and dedupe do not preserve the original complete recipient set or prove a conflicting duplicate absent. Mutable delivery lifecycle and separate writes cannot atomically checkpoint Risk effects. Retention unverified. |
| `digital_observer_incident_verifications` — `20260906020000_digital_observer_incident_verification.sql`: Site/Incident/Risk NOT NULL, `metadata jsonb NOT NULL`, unique `(incident_id,risk_evaluation_id,verification_version)`, PK `id`. | `incident-verification-service.ts` inserts and ID-only rereads after 23505, then separately writes decision intent and Incident projection. Site-scoped read policy. | Verification content is not a recipient/settings snapshot. No Tenant/Event, fingerprint/schema/policy version, recipient set or atomic plan relationship. Its uniqueness has a different semantic key; retention unverified. |
| `observer_correlated_events` Incident projection — `20260606003000_multi_camera_correlation_engine.sql` and later Risk/verification migrations: PK `id`, `observer_site_id` nullable, `metadata jsonb NOT NULL`, nullable latest Risk/verification references; projection-generation columns exist **only in guarded draft**. | Mutable Incident-wide projection, updated by separate Risk and verification Data API calls. Site/Incident relationships are not an immutable Event/version snapshot key. | Cannot preserve one decision-time snapshot per Event/engine version, cannot enforce first-write immutability or recipient-set uniqueness, and lacks deployed generation CAS. Tenant is absent; retention unverified. |
| `immutable_audit_events` — `20260612015400_immutable_audit_trail_evidence_logs_worm_readiness.sql`: PK `id`, `metadata jsonb NOT NULL`, nullable `incident_id` and `request_id`, no explicit Tenant/Site/Event/engine key. | Append-only audit; `audit-log-service.ts` catches insertion errors. No canonical snapshot recovery reader or unique request constraint was found in inspected source. | Audit is evidence, not the processing state owner. It cannot guarantee one retrievable snapshot, scoped authorization, idempotent first-write or atomic coupling; a swallowed audit failure may leave no row. Retention and recovery lookup are unverified. |

## Minimum future contract — not an applied migration

The existing **proposed**, absent `observer_event_risk_effect_plans` table in
`DRAFT-NOT-APPLIED.sql` is the narrowest suitable home, rather than adding a
parallel subsystem. Required before any real use:

1. One immutable row per `(signal_id uuid, risk_engine_version text)` (existing
   proposed PK/idempotency key), with `tenant_id uuid`, `observer_site_id uuid`,
   `incident_id uuid`, `risk_evaluation_id uuid`, exact Event/engine and
   authoritative event-time Tenant evidence reference. Existing proposed
   fields include `recipient_snapshot jsonb`, `recipient_snapshot_schema_version
   integer`, `recipient_snapshot_fingerprint text`,
   `recipient_snapshot_digest text`, `recipient_settings_version text`,
   `recipient_policy_version text`, `decision_code text`, and
   `recipient_snapshot_captured_at timestamptz`.
2. The guarded draft now *proposes* `required_evidence_references jsonb NOT
   NULL` as an array, plus `camera_source_id` and
   `ownership_evidence_ref`. Shape is not proof of bounded, canonical or
   authoritative content. The current snapshot type does not carry the
   evidence set, so its final versioned payload and existing
   `CanonicalDecisionIntent.requiredEvidenceReferences` must be reconciled
   before a writer is defined. Do not silently omit it.
3. Strengthen the proposed plan→claim reference from only `(signal_id,
   risk_engine_version)` to the exact composite Tenant/Site/Incident/Risk
   scope, backed by a unique claim key and canonical Site→Tenant,
   Signal→Site, Incident→Site and Risk→Event/Site constraints after historical
   ownership adjudication. A standalone FK to Site is insufficient.
4. Retention must cover every retry/recovery/audit window and legal hold;
   the exact minimum duration and deletion rule are **UNKNOWN**, so no
   retention timestamp or cleanup job is fabricated. Source comments about
   Site security policy are not a verified retention schedule.
5. Service-only, least-privilege writer and recovery reader; deny
   `anon`/`authenticated` and PUBLIC table writes/privileged RPC EXECUTE,
   verify Data API exposure and effective ACL, and preserve RLS as defense in
   depth. The draft RLS/REVOKEs are proposals, not deployed protection.
6. In one reviewed PostgreSQL transaction, validate current nonce, epoch,
   live lease and authoritative scope; insert the first frozen snapshot with
   Risk/plan checkpoint, or reread and semantically compare the complete
   existing payload on retry. An unchanged 23505 is not enough. The same
   transaction must establish the recovery reader's key and audit linkage;
   effect receipts may follow only with their own fenced transactions.
7. Choose and test one canonical cross-language serialization. The local
   SHA-256 of sorted JSON content cannot be presumed equal to PostgreSQL
   `jsonb::text`; a 64-hex CHECK checks shape, not authenticity. Qualify
   Node↔PostgreSQL round-trip, migration compatibility, duplicate conflicts,
   crash windows and retention in an authorized isolated clone before apply.

The proposed table, composite constraints, authoritative reader, recipient
provenance, bounded evidence validation, hash verification, retention policy and atomic writer are all
**BLOCKED**. No existing consumer can safely read an encoded snapshot today.
Therefore this gate is **CLOSED WITH NO COMPATIBLE EXISTING CANDIDATE**, not
"PostgreSQL persistence PASS" or "ready to apply".
