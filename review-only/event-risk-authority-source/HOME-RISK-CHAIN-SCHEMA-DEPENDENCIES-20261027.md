# Home → Risk chain schema dependencies — offline review only

Status: **static contract aligned; PostgreSQL behavior NOT TESTED for this consolidation; NOT READY TO APPLY**. The two edited SQL files remain guarded and outside `supabase/migrations`. No SQL, Docker, Colima, database, route, Guard or external provider was run or changed in this unit.

## One DDL owner

`FROZEN-INCIDENT-BINDING-NOT-APPLIED.sql` is the sole local review-chain definition of `observer_home_review.event_bindings.incident_id`: nullable UUID reference to the canonical Incident, plus a `NOT VALID` check that requires a value for newly written bindings. The local `../event-risk-atomic-claim-qualification/RPC-BODIES-SOURCE-NOT-APPLIED.sql` now **consumes** that column and no longer adds it. Both retain abort-before-DDL guards. The separate Draft PR #255, #258 and #259 source histories were inspected but not rewritten; copies outside this local review chain may still contain stale DDL and must not be stacked blindly.

| Stage | Static dependency, not deployment proof |
| --- | --- |
| Home acceptance + correlation | Exact registration version/epoch, Model A Tenant/Site/Source/owner, canonical Signal→Incident link, ACCEPTED audit, then frozen binding and BOUND audit in the same transaction. The acceptance adapter must populate `incident_id` from the server-derived Incident, never client input. |
| Risk claim | Requires that frozen `incident_id`, acceptance/binding/audit columns and identity lock before Signal. A missing or changed binding fails closed. |
| Risk persistence | Requires the claim lease/epoch, same accepted Home authority and binding, a canonical Risk result and mandatory immutable Risk audit plus receipt. |
| Effect Plan | Requires the fenced claim and Risk receipt (`risk_evaluation_id`, `owner_epoch`, `audit_event_id`), verifies audit scope, then freezes the decision-time recipient/settings authority and effect plan. Recipient identity is a separate policy decision, not implied by Home registration. |

The static checker `run-home-chain-schema-static-qa.mjs` pins the reviewed local and PR source bytes, checks one `incident_id` DDL owner, binding/receipt/audit references, identity-before-Signal lock order for claim/persist/plan and abort-before-DDL guards. Seven deliberately broken text fixtures prove it catches duplicate and missing column definitions, missing audit references, reversed lock order, unguarded SQL and source-hash drift. These checks **cannot** establish SQL syntax, PostgreSQL row-lock behavior, real RLS/ACL/Data API exposure, existing catalog compatibility or crash recovery. The added Effect Plan PostgreSQL cases remain unrun because the active execution boundary rejected SQL/service startup; the earlier 92 assertions do not cover them.

## Required future migration and lossless rollback

Before any Development migration: verify the actual catalog and applied migration history; resolve historical ambiguous Home Tenant/Site/Source ownership without guessing; inspect all existing binding rows and correlation uniqueness; establish independently attested Home owner and Gateway session provenance; validate real audit/recipient producer and caller privilege model; then design one ordered additive migration with the single column definition, binding writer, claim, persistence and plan dependencies. Run authorized isolated PostgreSQL compilation/concurrency/RLS/ACL tests and a rollback rehearsal before activation. The live write route, Guard and Production remain separate approval gates.

Rollback must first stop new ingestion/executor calls while retaining canonical Signals, Incidents, links, registration versions, acceptances, bindings, Risk claims/results, receipts, plans and all mandatory audits. Never drop a data-bearing table, clear an incomplete receipt or infer a historical `incident_id` to make rollback look clean. Whether existing rows can satisfy the `NOT VALID` check and whether a later validation is safe remain unknown. No lossless live rollback has been proven.

Data owner: Digital Observer Home customer and security owner. Sensitivity: Tenant/Site/Source identity, risk decisions and audit metadata; no raw video or secrets. Expected volume/retention and all-in cost are unresolved pending the real producer and retention policy. No paid resource was activated. This local-only review commit is **not remotely preserved or integrated**.
