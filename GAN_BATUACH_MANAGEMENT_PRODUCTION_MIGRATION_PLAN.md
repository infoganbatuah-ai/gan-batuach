# Gan Batuach Management Production Migration Plan

Date: 2026-09-23
Production baseline: `8113d0607e4282dc8778540aa58c1502367f4221`
Development candidate baseline: `285f3400eb1402a83fea606a5bb2e49525e6eed4`
Production migration head observed read-only: `20260913194000`

## Reconciliation

The linked Production project reports 38 applied migration versions and no Production-only version. The repository contains 205 older local-only history/baseline entries; they are **not** a replay queue. Several are known to be invalid on fresh replay. Release tooling must start from the observed Production ledger and apply only the 16 later versions below, in order. Presence of a SQL file is not application evidence.

## Ordered sequence

| # | Version | Domain / purpose | Destructive or data risk | Lock / backfill | Recovery |
|---:|---|---|---|---|---|
| 1 | `20260913210000` | Canonical participant-scoped messaging | Additive/constraint and RPC replacement | Brief DDL; no bulk backfill found | Transaction retry; forward fix after commit |
| 2 | `20260913211000` | Messaging RLS and idempotency hardening | Policy/function replacement | Brief catalog locks | Transaction retry / forward fix |
| 3 | `20260913212000` | Private message attachments | Additive table/index/functions | Brief DDL | Transaction rollback before commit |
| 4 | `20260919170000` | Classroom scope trigger repair | Function replacement only | No data rewrite | Reapply prior function or forward fix |
| 5 | `20260919180000` | Canonical notification pipeline | Additive columns, constraints, indexes | Inspect live communication tables before window | Transaction retry; forward fix |
| 6 | `20260920110000` | Email-first account verification | Function replacement | No backfill | Reapply prior function / forward fix |
| 7 | `20260920120000` | External-delivery intents and leases | Additive columns/indexes/function replacements | Inspect communication log volume | Transaction retry; forward fix |
| 8 | `20260920130000` | Private canonical documents | Adds fields and replaces FK behavior | Catalog locks; no inferred URL rewrite | Transaction retry; forward fix |
| 9 | `20260920140000` | Child attendance and pickup | Adds fields/constraints/functions | Fails closed on ambiguous duplicate days | Stop on precondition; repair data explicitly |
| 10 | `20260920150000` | Staff time ledger | Additive fields/functions/indexes | Inspect staff shift volume | Transaction retry; forward fix |
| 11 | `20260920160000` | Tuition audit-role repair | RPC replacement only | No customer balance rewrite | Reapply prior RPC / forward fix |
| 12 | `20260920170000` | Erase plaintext temporary credentials | **Irreversible secret-column drop** | Brief exclusive DDL; erases 23 populated values observed | Backup/credential recovery plan required; forward fix or isolated restore |
| 13 | `20260921150000` | Candidate private documents | Additive table/index/RLS | Brief DDL | Transaction rollback before commit |
| 14 | `20260922100000` | Enrollment decision audit-role repair | RPC replacement only | No enrollment rewrite | Reapply prior RPC / forward fix |
| 15 | `20260922110000` | Enrollment activation audit-role repair | RPC replacement only | No payment/enrollment mutation until invoked | Reapply prior RPC / forward fix |
| 16 | `20260922120000` | Parent notification category repair | Constraint/taxonomy adjustment | Brief catalog lock | Transaction retry / forward fix |

## Rehearsal evidence

A schema-only dump of the linked Production `public`, `auth`, and `storage` schemas was restored into an isolated Postgres database. All 16 migrations applied in order with `lock_timeout=5s` and `statement_timeout=120s`; individual runtimes were 90–880 ms on the empty schema clone. Post-state had 817/817 public tables with RLS enabled and 1,155 policies. This measures compatibility, not customer-data lock duration.

Raw replay is not idempotent: replaying migration 1 after application failed on an existing constraint. The canonical migration ledger must prevent replay.

A failure was injected inside migration 8. The transaction rolled back completely; retry of the exact migration then passed. Release execution must use one transaction and ledger update per file, stop at first failure, and never continue with a partially known state.

## Deployment order

The current Production application reads and writes `generated_credentials.temporary_password`, while migration 12 removes it. A simple all-database-first rollout is incompatible. Use a controlled maintenance window:

1. Verify backups, configuration, cost and abort gates.
2. Freeze the exact release candidate and apply migrations 1–11.
3. Deploy the frozen application candidate.
4. Apply migrations 12–16 immediately after the new application is serving.
5. Reconcile the migration ledger and schema, then run health and role smoke.

If any step fails, stop. Do not apply later migrations out of order. Production application rollback after migration 12 requires a compatible forward repair; the old application cannot safely run against the dropped column.

## Production state

No Production migration was applied by GB-M39.
