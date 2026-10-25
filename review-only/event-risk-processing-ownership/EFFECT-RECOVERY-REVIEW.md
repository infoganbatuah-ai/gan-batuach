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

## Home scope — BLOCKED

The route authenticates a Gateway enrollment to `observer_site_id`, constrains
the camera source to that Site/Gateway, and rejects kindergarten/garden Sites.
The Observer access model uses Site ownership/membership, with optional
`digital_observer_organization_id`. Home Sites can lack an organization, so
neither organization ID, owner profile, nor the commercial `do-site:` account
key is proven to be a universal canonical Tenant key. The claim draft stores
the canonical Site, but does **not** invent a Tenant field or permit cross-Site
aggregation. Before migration approval, the domain owner must define the
Tenant mapping and validate existing Home rows, historical ownership changes,
Gateway enrollment and authorization semantics. A missing/ambiguous mapping
must fail closed. Gan Batuach garden roles are not a substitute.
