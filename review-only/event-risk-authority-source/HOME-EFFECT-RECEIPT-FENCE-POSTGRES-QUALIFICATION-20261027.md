# Home Effect Receipt fence — isolated PostgreSQL qualification

**2026-10-27 19:42 UTC.** Review-only qualification of the five-anchor adapter in `adapt-home-effect-receipt-fence.mjs` against its pinned guarded SQL source. **38 isolated PostgreSQL checks PASS. NOT APPLIED. NOT READY TO APPLY.** This adds behavior evidence to the earlier static receipt, not live Development/Production evidence.

## Execution boundary

`node review-only/event-risk-authority-source/run-isolated-home-effect-receipt-fence-qa.mjs` started the already-cached PostgreSQL 17.6 image in a new disposable container with `--network none`, `--read-only`, `--tmpfs /tmp`, no mounts, bounded memory/CPU/PIDs, and Unix-socket-only PostgreSQL. The runner verifies the exact local Docker context and socket, checks that both source SQL files abort before DDL when run as-is, then strips their guards **in memory only for this isolated fixture**. All fixture identities and rows are synthetic. The runner stops the container in `finally`; `--rm` removes it. No existing PostgreSQL/Supabase connection, volume, schema, role, or user row was used.

## Behavioral checks

- Valid fresh receipt: one canonical `EVENT_INCIDENT_LINK` receipt plus one mandatory audit. Later historical replay did not create another pair; concurrent same-key writers remain untested.
- Home registration lock order: the receipt writer held the identity row while a concurrent simulated revoker waited; receipt-first committed its one pair, then revocation advanced the owner epoch. Revocation-first denied a new receipt for a different accepted event with zero effect audit/receipt rows.
- Historical replay after revocation, using a newly fenced claim epoch, returned `reused=true` and preserved the original receipt/audit count. This is **not** a claim that every historical replay remains available regardless of claim state.
- A synthetic receipt-insert failure after the mandatory-audit INSERT rolled back both rows. Missing or conflicting acceptance, registration version, binding, ACCEPTED/BOUND audit, Signal, Incident, claim, Risk result, plan, Tenant, Site, binding Incident and accepted Signal metadata each failed closed with zero new effect rows.
- `anon` could not call the proposed function in this fixture. This does **not** close the known direct-table-write ACL gap for a broad `service_role` invoker.

## Validation and limitations

`node --check` and `git diff --check` passed. The existing pinned static QA passed its eight negative fixtures. The final isolated PostgreSQL run passed 38 checks after two fixture corrections: synthetic mutations now execute as disposable DBA before invoking as `service_role`, and the synthetic Risk table grants the row-lock privilege required by `FOR SHARE`. No production code, migration, active function, ACL, RLS or Guard dispatcher changed.

The revoker in this test is a synthetic `UPDATE` of the isolated registration identity, **not** the live Home revocation service. The result proves row-lock serialization and the proposed function's branch behavior in this fixture only. It does not prove deployed schema compatibility, real caller ACL/Data API safety, mutable-target immutability, historical ownership, lossless rollback, live provider behavior, or physical exactly-once work. The pre-existing direct-write privilege gap, Model A historical authority resolution, Development backup/restore gate, and actual migration authorization remain blocking facts. No remote push, PR update, Production change or external effect was performed.

Data owner: Digital Observer Home customer/security owner. Test data: synthetic only, ephemeral; no retained fixture volume. Expected future live volume: at most one receipt plus mandatory audit per eligible event/engine version, subject to future retention/cost approval. Rollback of this test: container stopped/removed; no active-state rollback needed. The proposed writer remains guarded and review-only.
