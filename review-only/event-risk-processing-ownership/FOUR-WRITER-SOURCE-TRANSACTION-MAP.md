# Four downstream writers: source-to-transaction map — NOT APPLIED

Baseline `17e7e2cdd0c9afc6c179b75a7e9bd7f0b1971283`. This increment uses
local source declarations and the dated Development catalog in
`OBJECT-INVENTORY.json`; it makes **no current deployed-schema assertion**.
`event-risk-source-row-map.ts` is disconnected local comparison code, not a
writer or proof of a committed row. No SQL/RPC was executed, no adapter wired.

## persist_event_risk_v1 — source-mapped; SQL BLOCKED

**Exact key and fields.** The source migration
`supabase/migrations/20260906010000_digital_observer_risk_decision_engine.sql:28-59`
defines `digital_observer_risk_evaluations.id uuid PK DEFAULT gen_random_uuid()`,
`observer_site_id uuid NOT NULL`, `incident_id uuid NOT NULL`,
`triggering_event_id uuid NOT NULL` (each a separate FK),
`risk_score integer NOT NULL`, `peak_risk_score integer NOT NULL`,
`risk_band text NOT NULL`, `evaluation_confidence numeric(5,4) NOT NULL`,
`contributing_factors jsonb NOT NULL`, `mitigating_factors jsonb NOT NULL`,
`matched_rules jsonb NOT NULL`, `baseline_context jsonb NOT NULL`,
`explanation jsonb NOT NULL`, `recommended_decision text NOT NULL`,
`action_intents text[] NOT NULL`, `risk_engine_version text NOT NULL`,
`factor_version text NOT NULL`, `decision_version text NOT NULL`,
`input_fingerprint text NOT NULL`, `previous_evaluation_id uuid NULL` self-FK,
`evaluated_at timestamptz NOT NULL`, and `metadata jsonb NOT NULL`. The
later source index at `20260906011000_digital_observer_risk_event_idempotency.sql:5-6`
uniquely constrains `(incident_id, triggering_event_id, risk_engine_version)`.
It does **not** enforce Tenant or composite Site equality.

`risk-decision-service.ts:280-317` maps all those payload fields from
`RiskEvaluation` (`risk-decision-engine.ts:88-116`) and the Incident row,
then on 23505 rereads only `id`. The `previous_evaluation_id` authority is
the canonical Incident's `latest_risk_evaluation_id`; the other scope fields
must be checked against a verified event-time chain, not an HTTP claim. The
new pure `compareSuppliedRiskRowForReview` compares a supplied full source-
shaped row with every write field, exact Event/Incident/Site/engine/reference,
the prior projection, and local nonce/epoch/lease contract. Missing or
different content fails closed. This prevents an **offline** ID-only
equivalence claim; it cannot prove the caller supplied a real committed row,
the Tenant of that row, or PostgreSQL numeric/jsonb/timestamp normalization.

**Future transaction boundary.** Lock the claim and canonical Event/Incident,
verify nonce, strictly current epoch, unexpired lease and authoritative
Tenant→Site→Source→Event→Incident chain; insert or fully compare Risk row;
atomically set `observer_event_risk_claims.risk_evaluation_id` and
`status='RISK_PERSISTED'` with mandatory audit. The claim table is guarded
proposal only (`DRAFT-NOT-APPLIED.sql:27-76`), and active service calls are
separate Data API requests. A pre-write local fence is not database fencing.

**Local identity-contract correction.** `validatePrePersistEventOwnership`
now checks the canonical Tenant→Site→Source→Event→Incident chain and event-time
attestation without a Risk ID, Risk lookup or fabricated UUID. Its distinct
`PRE_PERSIST_EVENT_CHAIN_VALIDATED` result cannot qualify a recipient snapshot
or completion. After a trusted Risk-row read, `bindPostReadRiskOwnership`
rechecks the chain and unchanged authority evidence, verifies the exact
Risk→Site/Event/Incident row, and returns a distinct
`POST_READ_RISK_SCOPE_BOUND` result. The existing strict post-persist API is a
compatibility wrapper. These functions are disconnected contracts; a caller-
supplied fake reader is not an authoritative historical source. The deployed
reader, atomic insert/read/fence and database-generated-ID transaction remain
unimplemented. `CanonicalRiskDecision` does not carry engine version, so a
post-read engine-version binding needs a reviewed reader/schema contract.

**Blocking facts.** The event-time ownership reader is not deployed; exact
immutable Risk-result semantic serialization and composite Tenant/Site
relationships are unqualified. No SQL body is emitted.

## start_event_risk_effects_v1 — source-mapped; SQL BLOCKED

The proposed `observer_event_risk_effect_plans` at
`DRAFT-NOT-APPLIED.sql:89-127` has PK `(signal_id uuid, risk_engine_version
text)` and FK to the proposed claim key. It proposes NOT NULL `tenant_id`,
`observer_site_id`, `incident_id`, `risk_evaluation_id`, `camera_source_id`,
`ownership_evidence_ref`, `recipient_settings_version`,
`recipient_policy_version`, `decision_code`,
`recipient_snapshot_schema_version integer`,
`recipient_snapshot_captured_at timestamptz`, `recipient_snapshot jsonb`,
`recipient_snapshot_fingerprint text`, `recipient_snapshot_digest text`,
`required_evidence_references jsonb`, `expected_fingerprints jsonb`,
`media_fault_audit_required boolean`; this is **proposed, not deployed**.
`event-risk-ownership-snapshot.ts:55-131` defines the local immutable
recipient content, but does not carry required evidence references; those
appear in `CanonicalDecisionIntent` at `event-risk-recovery.ts:249-260`.
`notifications.ts:3-29` currently rereads mutable recipients/settings and
inserts per-recipient journal rows. No existing table is a full plan store,
per `SNAPSHOT-PERSISTENCE-COMPATIBILITY.md`.

**Input authority.** Exact claim/Risk and canonical Tenant/Site/Source/Incident
come from locked rows and event-time attestation; recipient authorization,
policy/settings version and evidence references require an independently
reviewed decision-time producer. Caller JSON is untrusted. The source
`requiredEffectKeys` in `event-risk-recovery.ts:171-177` defines expected
effect identities. First write freezes all semantic content; identical retry
must compare it all; a changed plan is conflict, never overwrite. A 64-hex
CHECK or 23505 is insufficient.

**Future transaction boundary.** Under the current claim fence, insert exactly
one plan or compare the complete immutable existing row and checkpoint
`EFFECTS_PENDING`, with mandatory audit, in one transaction before any effect.
No authoritative producer, cross-language canonical serializer, composite
scope FK, retention decision or immutable database writer exists. This SQL
body remains BLOCKED; no TTL or cleanup is proposed.

## record_event_risk_effect_v1 — source-mapped; SQL BLOCKED

The proposed receipt table at `DRAFT-NOT-APPLIED.sql:142-163` has PK
`(signal_id uuid, risk_engine_version text, effect_key text)` and proposed
FK to the plan; `tenant_id uuid`, `observer_site_id uuid`,
`risk_evaluation_id uuid`, `owner_epoch bigint`, `effect_fingerprint text`
are NOT NULL and `recipient_snapshot_digest text` is nullable. This proposal
alone cannot certify a target row. Existing targets and source writers:

| Required effect | Existing source-defined row/key and writer | Missing atomic proof |
| --- | --- | --- |
| Event–Incident link | `observer_correlated_event_links.id uuid PK`, `correlated_event_id uuid NOT NULL`, `source_type text NOT NULL`, `source_id uuid NOT NULL`; correlation migration `20260606003000:39-66`, canonical-link migration referenced in inventory | Polymorphic source FK and composite Site equality are not enforced. |
| Risk and watch | Risk PK/unique above; watch table `id uuid PK`, `rule_id uuid`, `rule_version integer`, `event_id uuid`, unique triple; `20260906040000:57-77`, service `risk-decision-service.ts:319-334` | Existing watch RPC is not claim-fenced; 23505 requires full semantic reread. |
| Incident risk projection | `observer_correlated_events.id uuid PK`, nullable `latest_risk_evaluation_id uuid`; risk migration `20260906010000:81-82`, writer `risk-decision-service.ts:336-355` | `risk_projection_generation` exists only in guarded draft; no deployed CAS. |
| Verification, intent and projection | Verification PK/unique and separate FKs, `20260906020000:33-72`; decision intent PK, unique `(observer_site_id,dedupe_key)`, `20260906010000:61-79`; writers `incident-verification-service.ts:160-246` | ID-only verification retry, ignored intent 23505, and no Incident-wide generation CAS. |
| In-app journal | Delivery PK, nullable Signal/recipient FK, status/metadata; `20260820010000:250-275`, writer `notifications.ts:21-29` | Recipient list is refetched and each row written separately; `sent` in sandbox is not external delivery. |
| Mandatory audit | `immutable_audit_events.id uuid PK`, `event_type text`, nullable `request_id`, `metadata jsonb`; `20260612015400:5-33`; helper `audit-log-service.ts:89-117` | Helper swallows write errors, no unique processing-key link, no committed-audit receipt. |
| Guard eligibility | Local `requiredEffectKeys`; Guard route at `cloud-events/route.ts:142-154` | Eligibility is not command dispatch, acknowledgment or idempotent physical execution. Guard OFF. |

**Future transaction boundary.** Lock and fence claim+plan, compare exact
Tenant/Site/Event/Risk/effect key and semantic fingerprint, write or verify
the actual target row, mandatory audit and one receipt in the same reviewed
transaction. Incident projections additionally CAS the current generation
and previous reference across *all* Events. The existing service uses multiple
independent Data API calls, so no source-grounded SQL body can certify them.
An identical receipt retry is locally idempotent only after full row/effect
comparison; an unknown external delivery outcome remains unknown.

## complete_event_risk_v1 — source-mapped; SQL BLOCKED

Proposed claim fields at `DRAFT-NOT-APPLIED.sql:27-76` include PK
`(signal_id,risk_engine_version)`, `status text NOT NULL`, `owner_nonce uuid
NOT NULL`, `owner_epoch bigint NOT NULL`, `lease_expires_at timestamptz NOT
NULL`, nullable `risk_evaluation_id uuid` and `completed_at timestamptz`.
`event-risk-recovery.ts:171-177,201-219` defines the full mandatory effect
set and local completion check; `event-risk-fenced-writes.ts:169-186` checks
supplied evidence and projections. The route at
`cloud-events/route.ts:113-172` subsequently writes media metadata/audit,
notifications and Guard before ACK; Risk completion is **not** route ACK.

**Future transaction boundary.** Under claim nonce/epoch/live-lease and exact
Tenant/Site/Event/Incident/Risk lock, verify the immutable plan, every target
row and receipt, mandatory audit, current Incident-wide Risk/verification
generations and references. Only then change status and completed timestamp
atomically. Pending provider delivery, unknown external result or Guard
eligibility cannot be promoted to physical acknowledgment. The SQL body is
BLOCKED by absent target-row/receipt coupling, generation CAS, immutable
plan writer and mandatory-audit transaction. Do not drop accepted Events or
resume an old unfenced writer as rollback.

## Shared security, retention and qualification gate

All four signatures are in `OBJECT-INVENTORY.json`; no privileged functions
are installed. A future implementation must qualify caller roles, RLS, Data
API exposure, `PUBLIC`/inherited EXECUTE and exact-function ACLs, without a
SECURITY DEFINER workaround. `service_role` BYPASSRLS does not prove Tenant
authorization. The proposed snapshot/claim/receipt retention and legal-hold
periods are unresolved; invent no TTL, cleanup or indefinite policy.
PostgreSQL concurrency, canonical JSON/numeric round-trip, crash durability,
row-boundary/RLS, audit failure, restore and lossless rollback all require a
separately authorized isolated clone. This source map is not those tests.
