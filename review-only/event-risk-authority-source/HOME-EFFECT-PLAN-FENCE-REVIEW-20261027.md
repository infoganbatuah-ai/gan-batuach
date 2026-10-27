# Home Effect Plan revocation fence — review only

Status: **static source contract PASS; PostgreSQL behavior NOT TESTED for this change; NOT READY TO APPLY**. No Development or Production database, Colima profile, service, migration, route, Guard, supplier or ACL was changed.

## Exact reviewed input and change

The adapter pins PR #259's guarded `start_event_risk_effects_v1` source at `784731da46aad974acfaa813e9efe948aab65204`, SHA-256 `b15ed3e668716ecfdba9affb43fe9c1779d0813dace29ab9feec385c80b013c4`. It changes five exact anchors in memory, preserving the original aborting `DRAFT_NOT_APPLIED` guard. It proposes no replacement public RPC or direct deployment SQL. The existing guarded source is not a deployed object.

The added fence reads the accepted event, locks its registration identity `FOR SHARE` before the canonical Signal/Site/Organization/link/Incident/claim chain, then re-reads the acceptance. It requires a non-revoked identity, matching Home owner epoch and Tenant/Site/Source/owner; exact registration version, immutable binding and accepted/bound audit references; a `person_entered` observation snapshot; canonical Signal and frozen Incident scope; and the mandatory Risk persistence receipt with a matching audit reference and epoch. A revoker using the identity row lock must serialize before or after the planner. No post-revocation replay is treated as newly authorized planning.

The extended isolated runner prepares test events through the actual guarded qualification, full Home acceptance, Risk claim and Risk persistence bodies. Only the recipient/effect authority is a disconnected synthetic fixture. It specifies plan-before-revocation, revocation-before-plan, missing/wrong Risk receipt, wrong audit, changed epoch, identical replay, conflicting authority and no-partial-write assertions. **Those new PostgreSQL cases have not run.** The runner's earlier 92-assertion execution only proved the pre-extension chain and guarded Plan body installation, not the new plan behavior. Do not transfer that PASS to this change.

`node review-only/event-risk-authority-source/run-home-effect-plan-fence-static-qa.mjs` passed the pinned-source hash, five single-use anchors, ordering and presence checks. `node --check` passed for the adapter, static check and extended runner. This is text/JavaScript validation, not SQL compilation, row-lock, concurrency, RLS, crash durability, or live authorization proof.

## Gate that prevented execution

The attempted disposable PostgreSQL run was rejected by the active tool authorization because the standing task forbids **executing SQL or starting a service**, even in an isolated container. It was not retried or routed through another execution path. The affected command is `node review-only/event-risk-authority-source/run-isolated-home-qualification-chain-qa.mjs`; the test harness would create a network-disabled, mountless, read-only-root disposable database. The exact missing permission is a new explicit exception for **synthetic isolated PostgreSQL execution**, not access to `gbi`, Development or Production. Until authorized and passing, the new fence is unqualified.

## Live dependencies and rollback

The Home ownership, accepted-event, Gateway session and recipient authority in the fixture are synthetic. Live Home ownership/transfer provenance, real recipient/settings snapshot producer, canonical caller grants and Data API/RLS exposure, retention, backup, migration compatibility and external writer lock order remain unverified. The original Plan proposal requires privileged direct table writes for a `SECURITY INVOKER` caller; no live ACL change is justified here. A safe future rollout must first qualify these facts, then install additive guarded changes in a reviewed Development migration and rehearse rollback without dropping accepted events, risk rows, claims, plans, audits or incomplete effect receipts. No `supabase/migrations` file was added.

Data owner: Digital Observer Home customer/security owner. Sensitivity: owner/source and risk/audit metadata; no media or credentials. Proposed volume: at most one durable plan and mandatory audit per canonical event/engine version in the intended contract; actual retention and unit cost remain unresolved. No paid provider was activated.
