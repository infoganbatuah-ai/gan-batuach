# Home → Risk → Effect assembly receipt (review-only, 2026-10-27)

This is an engineering source inventory, **not** executable SQL or authorization to migrate. The machine-readable manifest pins 13 source files by SHA-256 and records their proposed ownership, dependency, lock and permission assumptions. The listed order is for a future isolated test, not an apply sequence. No PostgreSQL connection, SQL execution, Colima action, or service activation was performed.

## Concrete assembly conflicts

- The older `claim_schema_sketch` defines candidate claim, Effect Plan and Effect Receipt tables. Its Plan/Receipt definitions overlap the newer dedicated writers. Do not concatenate or apply the whole sketch. `CLAIM-ONLY-SCHEMA-NOT-APPLIED.sql` now isolates the claim table, recovery index and claim-specific RLS/revoke proposal; it is **BLOCKED**, not ready to apply.
- The `old_claim_rpc_sketch` has claim/renew/recover function signatures already present in `claim_writer`. It is reference material, not a second deployable body.
- `home_source` and `frozen_binding` both define `observer_home_review.bind_accepted_event_v1(uuid)`. This is the one explicit replacement: the frozen Incident binding body supersedes the base body in any future isolated assembly. It is not an accidental duplicate.
- `frozen_binding` is the sole review-only owner of `event_bindings.incident_id`. `home_acl_fixture` models synthetic roles and must not be promoted into live privileges.

## Static qualification

Run `node review-only/event-risk-authority-source/run-home-risk-chain-assembly-static-qa.mjs` from this worktree. It verifies all pinned source hashes, abort guards before DDL, no COMMIT, future dependency order, the single `incident_id` DDL owner, the intentional function override and excluded collisions, plus claim columns/status/FKs/recovery index/RLS and key receipt/audit fields. Eleven deliberate negative fixtures check drift, guard loss, duplicate DDL, missing mandatory audit field, reversed order, a missing older-RPC collision, missing claim FK/status/index, and Plan/Receipt or RPC contamination. Existing focused Home/Plan/Receipt static checks provide exact source-anchor and lock-order coverage. None proves PostgreSQL compilation, concurrency, RLS, rollback or live authorization.

The isolated synthetic fixture at `review-only/event-risk-atomic-claim-qualification/isolated-schema.sql` already has a smaller *shape-compatible* claim table. It is not a source of canonical FK or privilege truth: it creates fixture roles, rows and simplified schema. It was not modified or executed here.

Claim contract consumed by the writers: claim acquisition inserts `signal_id`, `risk_engine_version`, `tenant_id`, `observer_site_id`, `incident_id`, `owner_nonce`, `owner_epoch` and `lease_expires_at`; the primary key is the conflict target. Renewal compares nonce, epoch, lease and status before updating the deadline. Recovery reads that same key and delegates reacquisition to the claim writer, which increments the epoch. Risk persistence compares Tenant/Site/Incident/owner and then atomically sets `risk_evaluation_id`, `status=RISK_PERSISTED` and `updated_at`. The four accepted states and nullable evaluation/`completed_at` combinations match the source draft. This is a source-level contract only.

## Four referenced composite keys — source evidence only

`CLAIM-REFERENCED-UNIQUES-SOURCE-MATRIX-20261027.json` records exact columns, base migration file hashes/lines, draft index names/lines and outstanding gates. In 257 locally tracked migration SQL files, the static scan found no exact matching nonpartial `UNIQUE INDEX`, table `UNIQUE` constraint or `ALTER TABLE ... UNIQUE` for these four tuples. The pinned, guarded source draft proposes all four nonpartial indexes at lines 21–22 and 168–174; it was not applied or concatenated. The current local `origin/integration/development` ref (`aea078ce67cf3061be5f0a6c314545dcc533a85d`) also has no occurrence of the four draft index names in its migration/review-only paths. Neither source search proves the installed catalog lacks an equivalent object with another name or proves historic data validity.

| Referenced table | Exact claim FK target | Base source fact | Draft-only proposed index |
| --- | --- | --- | --- |
| `observer_sites` | `(id, digital_observer_organization_id)` | `id` UUID PK; organization UUID added later, nullable | `observer_sites_id_org_draft_uidx` |
| `observer_intelligence_signals` | `(id, observer_site_id)` | `id` UUID PK; Site UUID nullable | `observer_signal_id_site_draft_uidx` |
| `observer_correlated_events` | `(id, observer_site_id)` | `id` UUID PK; Site UUID nullable | `observer_incident_id_site_draft_uidx` |
| `digital_observer_risk_evaluations` | `(id, observer_site_id, triggering_event_id, risk_engine_version)` | `id` UUID PK; Site, event UUID and engine text NOT NULL | `observer_risk_result_scope_draft_uidx` |

The UUID PK on each `id` logically prevents duplicate `(id, ...)` rows, but it does not by itself establish that PostgreSQL accepts the **exact composite FK reference**. The required candidate indexes are nonpartial in the draft, yet uniqueness, referenced-column types, nullable historic Site/Tenant mappings, index-build locks/cost and actual catalog state require a future authorized read-only preflight. A future additive migration would need a reviewed index sequence and rollback preserving all canonical rows; this review does not create such a migration. `node review-only/event-risk-authority-source/run-claim-referenced-uniques-source-static-qa.mjs` pins the sources, checks exact FK/index tuples and scans the 257 tracked migrations; six negative fixtures test hash drift, FK mismatch, draft-column drift, wrong source line, unexpected migration match and partial-index misclassification. It does not connect to PostgreSQL.

## Open gates, with exact next verification

1. **Claim schema dependencies:** the extraction exists, but its composite FKs require verified unique keys on `(observer_sites.id, digital_observer_organization_id)`, `(observer_intelligence_signals.id, observer_site_id)`, `(observer_correlated_events.id, observer_site_id)` and the Risk result's four-column identity. The older sketch proposes auxiliary indexes but this extraction deliberately does not create them. Verify catalog presence, historical row compatibility, existing indexes' lock impact and the exact table/column types before any isolated compilation. Do not infer deployability from the manifest. The polymorphic Signal→Incident link still needs its own authoritative scope verification.
2. **Authoritative ownership:** verify historical Home Tenant/Site and live Gateway/session provenance against authorized evidence before a live Model A relationship or backfill. Missing ownership must fail closed.
3. **Decision-time snapshot:** identify the authoritative recipient/settings/evidence producer and canonical serialization; without it the Effect Plan cannot be a durable decision-time snapshot.
4. **Privilege boundary:** verify real function owner, caller grants, role inheritance, RLS and Data API exposure. Synthetic ACL fixtures are insufficient for a live grant/revocation decision.
5. **Database qualification:** separately authorize and run guarded isolated PostgreSQL compilation, concurrent-owner, stale-owner, crash/recovery and lossless rollback tests. Static PASS is not database PASS.
6. **Retention and cost:** establish bounded retention and cost before any activation; do not delete canonical events, effects or audit to make rollback easy.

Until these gates close, status remains `REVIEW_ONLY_BLOCKED_NOT_EXECUTABLE` and `ENGINEERING_BASELINE_ONLY_NO_ROW_DELETION`.
