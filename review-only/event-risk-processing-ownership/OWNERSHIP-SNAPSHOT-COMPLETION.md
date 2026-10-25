# Event-time ownership, decision snapshot and completion — offline only

Status: **LOCAL CONTRACT IMPLEMENTED; PERSISTENCE AND RPC APPLICATION BLOCKED**.
No SQL, database, service or active ingest route was run or changed.

## Authoritative Model A ownership

`validateAuthoritativeEventRiskOwnership` reuses `resolveModelAChain` and
requires a trusted `authoritativeTenantForEvent(site_id,event_id)` read. Its
evidence must bind exact Tenant, Site and Event, be verified for that Event,
explicitly exclude historical ambiguity, and carry a nonempty audit reference.
The resolver independently checks Site→Source→Event→Incident→Risk Decision,
principal Tenant/Site and garden exclusion. Any client Tenant/Site override
is rejected, even if it happens to match. The Development candidate
`observer_sites.digital_observer_organization_id` does **not** itself satisfy
event-time historical authority; no deployed reader for this evidence is
asserted. Missing/ambiguous Home mapping fails closed. One Tenant may own
multiple verified Sites.

## Decision-time recipient/settings snapshot

`createDecisionTimeRecipientSnapshot` canonicalizes and deeply freezes one
schema-v1 value: exact canonical scope and Risk Decision, decision code,
severity, settings/policy versions, UTC capture time, protected recipient
references, per-recipient channel enablement and severity settings. It sorts
sets, rejects duplicates and bounds recipient/settings size. SHA-256 covers
the complete canonical content; `assertDecisionTimeSnapshot` detects changed
content, and `preserveDecisionTimeSnapshot` forbids replacing a persisted
snapshot with later mutable settings. The legacy in-app recipient digest is
separately checked against the plan. No recipient address or private data is
logged by these functions or tests.

The guarded proposed plan table has one row per Signal/engine version and now
names schema version, capture time, policy version, decision code and content
fingerprint in addition to the existing recipient digest. That table is
**absent** in Development. A CHECK on a 64-character hash does not verify its
contents. A future reviewed writer must establish trusted recipient
selection, immutable first-write semantics and one canonical serialization
shared by Node and PostgreSQL; `JSON.stringify` and jsonb rendering are not
assumed equivalent. No snapshot persistence is claimed.

## Atomic completion preconditions

`qualifyAtomicCompletionPlan` requires verified ownership scope, a live
nonce/epoch/lease/write-generation fence, persisted Risk, frozen plan,
unchanged decision snapshot, matching in-app recipient digest, current
Incident risk and verification generations, semantically equivalent decision
intent, mandatory audit evidence, all mandatory effect rows and receipts,
and matching projection references. It delegates the final local transition
to `completeFencedRisk`. A missing receipt, stale projection, changed
settings or conflicting intent fails closed. The local result distinguishes
Risk persisted, mandatory durable effects completed and external action
acknowledged. The last is always false here; if an external acknowledgment
is required, `fullCompletion` is false. Guard eligibility is not dispatch,
and a notification/outbox intent is not provider delivery.

A future `complete_event_risk_v1` must lock claim, plan, Risk, Incident and
required effects in one transaction; compare nonce, epoch, lease, exact
Tenant/Site/Event/Incident/Risk and both Incident generations; verify the
immutable snapshot and each underlying durable row; then update claim status
atomically. A receipt alone must not attest to an unfenced writer. On any
missing/conflicting row or mandatory audit failure, abort without marking
COMPLETED and retain retry eligibility. No such RPC body is proposed yet:
deployed effect writers remain separate Data API calls, new schema is absent,
and historical Home ownership is not adjudicated.

Local synthetic tests exercise multi-Site acceptance and fail-closed
historical ambiguity, snapshot canonicalization/replay, fencing, missing
effects, generation CAS, mandatory audit and external-action separation.
They do **not** prove PostgreSQL isolation, RLS, crash durability or external
delivery. Forward/rollback gates in `FORWARD-AND-ROLLBACK.md` remain unchanged.
