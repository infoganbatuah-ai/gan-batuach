# Home registration qualification writer — isolated, not applied

Status: **offline contract qualified; live authority BLOCKED**. The guarded SQL beside this note aborts before DDL if run directly. Its disposable PostgreSQL harness alone strips the guard in memory, creates synthetic fixtures, and removes the container. No existing Development/Production database, migration, route, Guard, Home device, or provider was touched. No historical backfill is proposed.

## Duplication and exact dependency

Checked the current local branch, `codex/home-registration-authority-review-20261026`, the guarded registration proposal `a1089050`, the acceptance writer `a6bd2ba5`, the request-bound owner-session reader `f7141f53`, and `automation-7`. No qualification/renewal writer was found in the inspected sources. The existing acceptance writer and session reader remain separate; this candidate neither copies nor invokes them. `automation-7` is a six-hour summary, not a writer or development executor. A full remote-branch search was unavailable when GitHub DNS failed, so remote duplicate status is not proven.

## Proposed transaction and Model A boundary

The candidate uses one identity lock to serialize version CAS, replay, and synthetic revocation. Version 1 requires expected version 0; renewal n+1 requires expected n. It checks exact Tenant, Site, Source, owner and actor against a *server-held fixture authority*, current scope, and a current owner session. It rejects PlatformAdmin. Same request ID returns the old version only if every immutable scope, fingerprint, actor and mandatory audit field agrees; a conflict raises an error. The audit row, append-only version and pointer CAS are one statement/transaction, so audit insertion failure leaves no version or pointer change. Direct caller writes are denied in the isolated role model. No recipient decision is included or inferred: recipients/settings require the separate policy-version writer and decision-time freeze.

The fixture is **not** a trusted live adapter. Real provenance must come from an independently authorized server process which verifies actual Home ownership and actor/session in the transaction, under compatible locks, not from client UUIDs, mutable `current` rows, `created_by`, `app_metadata`, or a parent/Management role. The request-local session observation from `f7141f53` is useful input but not itself a durable approval or commit-time session lock. No source currently proves historical Home ownership or transfer. The candidate is therefore deliberately non-deployable and confers **zero live readiness**.

`a1089050` defines `registration_identities` and `registration_versions` but no qualification writer. It also lacks a complete revocation fence. This isolated model has a `revoked` gate to exercise rejection, but a real revocation operation, owner-transfer epoch, and acceptance-versus-revocation serialization are still required. A privileged table owner can disable immutability triggers; actual owner/role inheritance, RLS and Data API exposure remain review gates. The synthetic `qa_registration_caller` is not a proposed Supabase application role or grant.

## Isolated result and limits

Run `node review-only/event-risk-authority-source/run-isolated-registration-writer-qa.mjs`. The harness uses the existing PostgreSQL 17.6 image on the verified local `colima-gbi` Docker context, with network disabled, no mounts, read-only root, tmpfs and bounded resources. It exercises the **actual SQL body**: direct guard, missing provenance/session, exact-scope mismatch, PlatformAdmin denial, version 1, identical and conflicting replay, renewal, stale CAS, audit failure rollback, append-only history, caller direct-write denial, synthetic revocation/session denial and two concurrent writers. These results are PostgreSQL behavior for **synthetic fixtures only**, not original LOCAL_SUPABASE, RLS, real owner identity, crash durability, live device or Production proof.

Business need: durable, reviewable Home Source authorization before a new live event may be accepted. Data owner: Digital Observer customer Tenant/Site and security owner. Sensitivity: owner/Source linkage and actor audit, no credentials/media. Expected volume: one version and mandatory audit per approved registration/renewal; lookups by registration/source/request. Retention and legal hold are not approved; no cleanup or deletion is safe to activate. No paid provider or new recurring workload was activated; future storage/traffic cost remains unmeasured.

## Conditional consumer and rollback

Only after a separately reviewed, applied and independently verified qualification writer may the existing `a6bd2ba5` acceptance writer consume the frozen `(registration_id, version, tenant_id, site_id, source_id, owner_profile_id, authority_ref)`. It must serialize on the same identity lock, verify the current version and non-revoked state for *new* events, atomically persist the canonical Signal/acceptance/binding/audit, and keep old accepted events bound to their original version on replay. It is **not connected** in this package. Version renewal must not silently authorize transfer or broaden recipients.

Compatibility-first future rollback means disable new admission, retain identities, versions, audits, Signals and existing event bindings, and let pending work be reconciled. Do not drop tables or rewrite canonical events. Lossless rollback with active claims or historical ambiguity is **not proven** and blocks application.

## Exact blockers before a Development migration or route change

1. Product/security owner must define verifiable Home ownership/transfer provenance for exact Tenant/Site/Source/owner and the authorized actor. Existing current Site/Source rows and `created_by` are insufficient. A qualified server adapter and transaction-bound proof are needed.
2. Define and test real Auth-session lock/revocation behavior at commit, dedicated non-Data-API caller ownership/EXECUTE grants, and immutable mandatory audit integration with the canonical ledger. Neither a caller UUID nor a fixture role is proof.
3. Define and test a revocation/transfer epoch that fences concurrent qualification **and** first acceptance. The present guarded source schema only has an audit action, not a complete fence.
4. Approve retention/legal hold and bounded growth. Rehearse lossless rollback and schema/RLS/ACL compatibility in separately authorized isolated PostgreSQL before any real Development application.

None of these blockers authorizes a substitute identity source. The guarded proposal is **not ready to apply**.
