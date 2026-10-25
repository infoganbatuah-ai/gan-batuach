# DRAFT — downstream effect and acknowledgement review

Source inspection only. No database inspection or SQL execution was performed
for this review. The existing route makes separate Data API calls; a unique
row or successful HTTP call is not an atomic end-to-end completion receipt.

| Effect | Current durability / replay anchor | Missing completion guarantee |
| --- | --- | --- |
| Signal and Incident link | Signal source key is Site-scoped; the Incident correlation trigger runs with signal insertion; one signal timeline link is unique. | An unmatched exit has no Incident. The claim must derive and validate the canonical link, not invent one. |
| Risk evaluation | Unique `(incident_id, triggering_event_id, risk_engine_version)`; duplicate insert rereads. | No owner is chosen before calculation; risk row and proposed claim checkpoint are not one transaction. Conflicting duplicate contents require explicit rejection. |
| Watch-rule evaluations | Existing RPC is called per matched rule after risk insert. | The expected rule set, idempotency, and fenced completion after partial failure need review. |
| Incident risk projection | Separate update to `observer_correlated_events`. | A stale owner can overwrite a newer projection; no atomic checkpoint with risk insert. |
| Verification | Unique `(incident_id, risk_evaluation_id, verification_version)` with duplicate reread. | Separate request; a row alone does not prove decision intent or Incident verification projection. |
| Decision intent | Unique `(observer_site_id, dedupe_key)`; external execution is constrained off. | Current 23505 handling does not verify that the existing intent matches the expected risk/verification/result. |
| Incident verification projection | Separate Incident update after intent insertion. | No fenced proof that projection points to the accepted verification/version. |
| In-app notification journal | `digital_observer_notification_deliveries` has unique `(observer_site_id, dedupe_key)` for non-null keys; each recipient is inserted separately. | Recipient/settings snapshot is not durable. A mid-loop failure or recipient change makes later completeness ambiguous. Backfill intentionally skips this stage; non-notify decisions may also have no rows. Provider delivery is separate and not implied. |
| Media-fault metadata and audit | Signal metadata update is separate; `writeAuditEvent` catches and logs insertion errors rather than failing the request. | The immutable audit row is not a durable prerequisite for route success. Replayed fault updates and audit transitions need a separately reviewed identity/checkpoint if audit is mandatory. |
| Digital Guard action dispatch | Separate policy/capability reads and command requests after notifications. | May have physical effects; it is not covered by a Risk claim. Do not replay, suppress or mark it complete from a Risk status without its own existing command idempotency and ownership review. |

## Completion boundary — BLOCKED

`COMPLETED` may mean only the reviewed Risk/Incident pipeline, never full
Gateway-route success. A future completion operation must verify an explicit
expected effect set for this Event/version: stored risk fingerprint and Site,
required watch-rule records, current Incident projections, verification,
decision intent, and applicable in-app journal recipients. It must validate
backfill and no-notification decisions as explicit *not-required* cases, not
infer completion from zero rows. Stale epochs must be unable to write any of
those effects. Current code does not provide that transaction or proof.

Separately, the existing Gateway response follows media-fault handling,
notification insertion and Digital Guard dispatch. Whether the route may ACK
when audit insertion fails is an unresolved product/security decision; the
current helper deliberately swallows audit errors. Do not turn a Risk
`COMPLETED` receipt into a blanket ACK or omit those route-level effects.

## Proposed durable recovery matrix — not implemented

Each listed receipt is conditional on the exact Event/version and canonical
Tenant/Site. The guarded plan/receipt tables store evidence but do not create
the transactional verifier or repair existing effect writers. `owner_epoch`
fences the Event claim; Incident projections additionally require an
Incident-wide generation compare-and-swap under the same database lock.

| Effect | Persistence owner / current idempotency | Required durable payload and completion test | Crash/retry and fencing |
| --- | --- | --- | --- |
| Event/Incident association | Signal insert trigger; unique signal timeline link | Exact Signal, link, Incident, Site and candidate Tenant match; unmatched exit explicitly NOT_APPLICABLE | Re-read canonical rows; never synthesize Incident; stale claim cannot accept mismatched link. |
| Risk Decision | `digital_observer_risk_evaluations`; `(incident_id,triggering_event_id,risk_engine_version)` unique | Exact evaluation ID, Site, Incident, Event, version, input fingerprint and decision fields; claim RISK_PERSISTED in same transaction | On 23505 compare full immutable result; retry never recomputes once checkpoint is committed. |
| Watch-rule decision | `record_digital_observer_watch_rule_evaluation` RPC; unique `(rule_id,rule_version,event_id)` | Frozen expected rule/version set, matched state and canonical input fingerprints for each rule | Recover only absent/matching rows. Existing RPC is not epoch-fenced, so activation is BLOCKED. |
| Incident risk projection | Separate update on `observer_correlated_events` | Latest evaluation and projected score/band/decision plus risk projection generation | CAS against Incident-wide generation and expected predecessor; a per-Event epoch is insufficient. Current writer lacks CAS. |
| Verification result | `digital_observer_incident_verifications`; unique `(incident_id,risk_evaluation_id,verification_version)` | Exact verification ID, version, fingerprint, Site and decision | 23505 requires content comparison; new owner resumes without duplicate result. |
| Decision intent | `digital_observer_decision_intents`; `(observer_site_id,dedupe_key)` unique | Compare Site, Incident, Risk, verification ID/version, decision, cooldown, human-review and external-execution fields; exact final-decision metadata | A duplicate error alone is not completion. Conflicting row blocks; external execution remains false. |
| Incident verification projection | Separate update on `observer_correlated_events` | Latest verification and projected status/classification/decision plus verification generation | Incident-wide CAS; stale Event/version cannot overwrite newer projection. |
| In-app journal | Per-recipient `digital_observer_notification_deliveries` with Site/dedupe unique | Frozen decision-time recipient IDs/settings version/digest, exact one matching row per required recipient, or explicit no-notification/backfill decision | Partial loop resumes only missing rows; later preference changes cannot silently rewrite the frozen recipient set. Provider delivery is not implied. |
| Media-fault/audit | Signal metadata update; `immutable_audit_events` append-only; helper currently swallows errors | Fault transition identity and matching immutable audit row if mandatory; receipt only after audit acceptance | Audit failure blocks mandatory completion; current route ACK policy is unresolved and must change before activation. |
| Guard eligibility | `digital_observer_camera_action_requests` has unique idempotency key, but physical dispatch is separate | Durable policy/capability/eligibility decision only, bound to Event/Source/Site; no physical action in Risk transaction | Do not dispatch from recovery receipt or assume a prior command is safe to replay. Physical dispatch has its own owner/idempotency review. |

The local `event-risk-recovery.ts` enforces expected keys/fingerprints,
snapshot stability and stale-owner rejection in deterministic tests. Its
in-memory behavior is **not** a durable database implementation. In
particular, the existing watch-rule RPC and Incident updates are not yet
fenced, so the completion boundary remains BLOCKED.

## Home scope — BLOCKED

The route authenticates a Gateway enrollment to `observer_site_id`, constrains
the camera source to that Site/Gateway, and rejects kindergarten/garden Sites.
The Observer access model uses Site ownership/membership, with optional
`digital_observer_organization_id`. Home Sites can lack an organization, so
the proposed existing organization ID is not yet proven to be a universal
canonical Tenant key; owner profile and the commercial `do-site:` account key
are not substitutes. The guarded claim draft includes a Tenant column only
for rows whose canonical Site mapping has been verified; it does not assign
historical Tenant values or permit cross-Site aggregation. Before migration
approval, the domain owner must validate existing Home rows, historical ownership changes,
Gateway enrollment and authorization semantics. A missing/ambiguous mapping
must fail closed. Gan Batuach garden roles are not a substitute.
