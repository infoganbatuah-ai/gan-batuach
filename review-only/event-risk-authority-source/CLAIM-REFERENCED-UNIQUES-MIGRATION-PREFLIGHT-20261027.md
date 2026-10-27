# Claim referenced keys: Development migration preflight (review only)

Status: **NOT APPLIED; NOT READY TO APPLY**. This package changes no database, runtime, ACL, RLS, provider, or migration history. It is limited to the four exact composite references of `CLAIM-ONLY-SCHEMA-NOT-APPLIED.sql` and must not be merged into a deployable migration by copying the broader historical draft.

## Installed versus proposed

The coordinator's bounded, catalog-only `BEGIN READ ONLY` receipt is `Digital-Observer-Installed-Catalog-ReadOnly-20261027.md` in the spec-3 output directory. It identifies original local Development/Integration PostgreSQL 17.6, container `supabase_db_gan-batuach-integration` in `colima-gbi`, and reports all four exact, valid, nonpartial composite keys **absent**, as well as the claim table and its four composite FKs **absent**. This is installed-catalog evidence, not historical-row, effective-ACL, or RLS-behavior proof. A separate metadata-only read found `development_metadata.migrations`; its 30 receipts have now been reconciled to source in `CLAIM-DEVELOPMENT-MIGRATION-SOURCE-RECONCILIATION-20261027.md`. The older source matrix deliberately retains its earlier `UNVERIFIED` snapshot; it is not an installed-state report.

The four proposed unique indexes are, in dependency order before the claim table:

| Referenced table | Exact columns, in order | Candidate name | Claim FK |
|---|---|---|---|
| `public.observer_sites` | `id, digital_observer_organization_id` | `observer_sites_id_org_draft_uidx` | `observer_event_risk_claim_site_tenant_fk` |
| `public.observer_intelligence_signals` | `id, observer_site_id` | `observer_signal_id_site_draft_uidx` | `observer_event_risk_claim_signal_site_fk` |
| `public.observer_correlated_events` | `id, observer_site_id` | `observer_incident_id_site_draft_uidx` | `observer_event_risk_claim_incident_site_fk` |
| `public.digital_observer_risk_evaluations` | `id, observer_site_id, triggering_event_id, risk_engine_version` | `observer_risk_result_scope_draft_uidx` | `observer_event_risk_claim_result_scope_fk` |

The `id` columns are already primary keys in source definitions. Composite uniqueness should therefore not repair ambiguous scope: it only supplies an exact FK target. The first three scope columns remain nullable in the inspected definitions. A row with unknown Site/Tenant must not be inferred, backfilled, or processed. Claim columns are non-null, so a claim referencing a historical row with null scope should fail its composite FK, but the future adapter must also reject missing authoritative ownership before any accepted work. Source definitions and catalog existence do not establish whether historical rows are compatible.

## Future authorized Development-only sequence

1. Pin exact target identity, schema version, table owners, existing index names/definitions, migration history, current backup/restore proof, and actual row/index sizes. Resolve any mismatch before writing. Measure historical null-scope and inconsistent-reference counts by separately authorized bounded aggregate queries; do not read or expose user rows here. Resolve Model A Home/business Tenant provenance independently; do not derive it from nullable organization fields.
2. Decide the migration runner's transaction behavior. `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block; use separately ordered, idempotence-checked migration units or an explicitly reviewed maintenance alternative. No `IF NOT EXISTS` shortcut: an existing same-named but invalid/wrong index is a collision, not success. Check disk headroom, write rate, active locks, timeout and cancellation behavior before each build. Check validity after each build and account for a failed concurrent build that leaves an invalid index.
3. Install exactly the four nonpartial unique B-tree indexes, one at a time, using the commented candidate definitions in the companion SQL file only after a separately approved Development write. No table, role, policy, default privilege, or provider mutation is authorized by this document.
4. Recheck exact index columns/order, uniqueness, validity and nonpartiality. Review claim table/FK DDL and its own future migration as a **later** dependency; on a new empty claim table the four FKs can be installed during creation without validating historical claim rows. Do not weaken or omit scope FKs for convenience. Verify the source tables' RLS and effective caller grants; RLS being enabled is not proof of denial, especially for bypassing roles. Keep writer RPCs, Data API exposure and all EXECUTE grants blocked until independently qualified.
5. Only after all dependency gates, use isolated synthetic PostgreSQL concurrency/authorization tests, then a separately authorized Development installation and rollback rehearsal. The adapter and Guard remain OFF. Record actual migration-history and post-install evidence; a file alone is not application proof.

## Lock, cost, and recovery

Concurrent index builds reduce write blocking but still consume scans, CPU, I/O, temporary/durable disk and write amplification; duration and headroom are **unmeasured**. Each future FK installation/validation can lock referenced and referencing tables; schedule and test against measured workload. The application-side request ceiling is not a provider financial cap. Calculate added index storage/backup/restore cost and all-in next-month/peak ₪15-per-paying-user headroom before activation; no cost number is justified by current evidence.

Before claim activation, a failed candidate build must be diagnosed; remove **only** a task-created invalid index after independently verifying its exact identity and no dependents, with recovery copy intact. Valid additive indexes may safely remain if activation is cancelled. After claims or effects exist, disable the adapter first, preserve every canonical event, claim, result, receipt, intent, Outbox and audit record, reconcile incomplete work, and leave FK-supporting indexes in place. Never drop claim tables/keys or delete records merely to roll back application code. Lossless rollback is **not proven** until an authorized isolated rehearsal.

## Exact blocking facts

| Missing fact | Evidence inspected | Consequence / future verification |
|---|---|---|
| Historical nullable scope and Tenant provenance | Source matrix and catalog-only receipt; no user-row query | Cannot assert old Home/Site records are Model A compatible. Obtain separately authorized bounded aggregate checks plus authority evidence. |
| Fresh live schema fingerprint and exact deployed DDL details | `development_metadata.migrations` has 30 source-matched receipts; no fresh live fingerprint or full DDL comparison in this unit | Source/receipt consistency does not prove current RLS, FK, index or application behavior. Recompute and compare under a separately scoped verification. |
| Lock, storage and financial headroom | No relation-size/workload or supplier-usage measurement in receipt | Cannot choose an installation window or claim cost compliance. Measure before any write. |
| Effective ACL, RLS and Data API behavior | Only RLS flags/broad catalog ACL, no role-boundary probe | Cannot safely expose claim writers or activate adapter. Run authorized role-boundary qualification. |
| Recovery under real claims | Claim table absent; only source-level contracts | Cannot assert lossless rollback or live exactly-once behavior. Rehearse in isolated PostgreSQL before activation. |

No Production, Home, Guard or external action is part of this package.
