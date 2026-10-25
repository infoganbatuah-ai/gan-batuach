# Proposed Development-only sequence and lossless rollback

This is an ordering contract, not authorization to run changes. Bounded
read-only Development catalog and aggregate SELECTs were executed on
2026-10-25; no write SQL or application RPC was run. The guarded SQL is
**not** an ordered migration and cannot
become one by removing its guard.

## Forward prerequisites and order

1. Pin exact Development database identity and repository SHA. Verify a recent
   independently restorable database/Auth backup, Storage objects separately,
   and a bounded restore rehearsal. Do not use a sparse VM disk as the sole
   database backup.
2. Run the separately approved restricted, read-only Home/Site/risk preflight;
   classify missing references, Site mismatch, cross-Tenant candidate and
   valid rows. Obtain an owner decision for ambiguous organization/customer
   ownership. No automatic backfill or destructive correction.
3. Inventory actual roles, schema exposure, table/function ACL, default
   privileges, RLS policies and dependent legitimate callers on the exact
   isolated Development database. The catalog/ACL inventory is now in
   PERMISSIONS-AND-RPCS.md; legitimate-caller, external Data API and
   row-boundary probes remain open. The watch-rule SECURITY DEFINER function
   has explicit anon/authenticated EXECUTE despite a service-role body guard.
   Review an exact-function REVOKE and caller compatibility separately; this
   package does not apply broad revocations.
4. Prove existing Home/business creation and Gateway enrollment can populate
   the approved Tenant relationship before a new-write constraint is added.
   Stage historical mapping through individually reviewed, reversible records.
5. In an isolated clone, create only the reviewed additive Site/Tenant index,
   claim/plan/receipt tables and Incident generation fields. Measure locks,
   index build time, row counts and next-month/peak storage and query cost.
6. Add NOT VALID constraints for *new* writes only after the live writers are
   compatible. Validate historical constraints in dependency order only when
   every exception has a reviewed treatment: Site/Tenant → enrollment and
   source → Signal/link/Incident → Risk/effects. A nullable composite FK does
   not establish presence; separate non-null gates are required.
7. Review the three offline bodies and complete the four blocked downstream
   bodies. Install transactionally fenced RPCs and *exact* function
   grants in a future separately authorized migration. Verify `PUBLIC` default
   EXECUTE is absent, Data API exposure, role inheritance, and failure audit.
8. Run isolated PostgreSQL races, process-crash/restart, lease takeover,
   semantic 23505, recipient-change, audit-failure, cross-Site/Tenant, RLS and
   stale Incident projection tests. Reconcile migration history and actual
   schema. No synthetic-only result qualifies this step.
9. Only after all gates, separately authorize a disabled-by-default runtime
   adapter and bounded Development activation. Reconcile every in-flight Event
   before any Gateway ACK behavior changes. No Production activation is part
   of this package.

## Rollback dependency states

| State | Lossless action | Prohibited shortcut |
| --- | --- | --- |
| Before any runtime activation | Disable/omit new code; retain additive tables and mapping evidence until restore and dependency review; revert only a reviewed compatible migration if genuinely empty | Drop Site mapping or audit rows merely because no new route is active. |
| Pending claim or RISK_PERSISTED | Stop new claims, preserve claim key/epoch/deadline, Risk row, plan and receipts; wait for lease expiry or perform fenced forward recovery in isolated Development | Drop claim table, clear status, reuse old owner nonce or return a false Gateway success. |
| EFFECTS_PENDING | Reconcile expected fingerprint/recipient snapshot with actual watch, verification, intent, journal and audit rows; finish or quarantine unresolved effects | Rerun with mutable recipient settings or treat 23505 as equivalent. |
| COMPLETED Risk/Incident effects | Preserve result, receipts, Incident generation and audit. Roll application code back only to a version that reads new schema and does not duplicate downstream effects | Re-enable the old unfenced duplicate-computation route as a silent fallback. |
| External Guard action ever dispatched | Keep physical command idempotency, receipt and owner evidence outside Risk rollback; separate hardware recovery authorization | Treat Risk completion or DB rollback as cancellation of a physical action. |

Dropping schema is **not** the default rollback. The safe path is stop-new-work
plus forward reconciliation with originals retained. Whether old application
code can safely coexist with pending claims is unproven; thus **ROLLBACK
BLOCKED** until an isolated compatibility/restore rehearsal and an exact
in-flight inventory. Never delete canonical Events, Incidents, Risk,
verification, intent, notification, audit or historical ownership evidence.
