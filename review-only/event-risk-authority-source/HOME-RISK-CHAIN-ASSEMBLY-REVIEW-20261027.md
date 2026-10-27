# Home → Risk → Effect assembly receipt (review-only, 2026-10-27)

This is an engineering source inventory, **not** executable SQL or authorization to migrate. The machine-readable manifest pins 13 source files by SHA-256 and records their proposed ownership, dependency, lock and permission assumptions. The listed order is for a future isolated test, not an apply sequence. No PostgreSQL connection, SQL execution, Colima action, or service activation was performed.

## Concrete assembly conflicts

- The older `claim_schema_sketch` defines candidate claim, Effect Plan and Effect Receipt tables. Its Plan/Receipt definitions overlap the newer dedicated writers. Do not concatenate or apply the whole sketch; a separately reviewed claim-only extraction is required.
- The `old_claim_rpc_sketch` has claim/renew/recover function signatures already present in `claim_writer`. It is reference material, not a second deployable body.
- `home_source` and `frozen_binding` both define `observer_home_review.bind_accepted_event_v1(uuid)`. This is the one explicit replacement: the frozen Incident binding body supersedes the base body in any future isolated assembly. It is not an accidental duplicate.
- `frozen_binding` is the sole review-only owner of `event_bindings.incident_id`. `home_acl_fixture` models synthetic roles and must not be promoted into live privileges.

## Static qualification

Run `node review-only/event-risk-authority-source/run-home-risk-chain-assembly-static-qa.mjs` from this worktree. It verifies all pinned source hashes, abort guards before DDL, no COMMIT, future dependency order, the single `incident_id` DDL owner, the intentional function override and excluded collisions, plus key receipt/audit fields. Six deliberate negative fixtures check drift, guard loss, duplicate DDL, missing mandatory audit field, reversed order and a missing older-RPC collision. Existing focused Home/Plan/Receipt static checks provide exact source-anchor and lock-order coverage. None proves PostgreSQL compilation, concurrency, RLS, rollback or live authorization.

## Open gates, with exact next verification

1. **Claim schema ownership:** extract only reviewed claim objects from the older sketch and reconcile dependencies with the dedicated Plan/Receipt definitions in a future isolated test. Do not infer deployability from the manifest.
2. **Authoritative ownership:** verify historical Home Tenant/Site and live Gateway/session provenance against authorized evidence before a live Model A relationship or backfill. Missing ownership must fail closed.
3. **Decision-time snapshot:** identify the authoritative recipient/settings/evidence producer and canonical serialization; without it the Effect Plan cannot be a durable decision-time snapshot.
4. **Privilege boundary:** verify real function owner, caller grants, role inheritance, RLS and Data API exposure. Synthetic ACL fixtures are insufficient for a live grant/revocation decision.
5. **Database qualification:** separately authorize and run guarded isolated PostgreSQL compilation, concurrent-owner, stale-owner, crash/recovery and lossless rollback tests. Static PASS is not database PASS.
6. **Retention and cost:** establish bounded retention and cost before any activation; do not delete canonical events, effects or audit to make rollback easy.

Until these gates close, status remains `REVIEW_ONLY_BLOCKED_NOT_EXECUTABLE` and `ENGINEERING_BASELINE_ONLY_NO_ROW_DELETION`.
