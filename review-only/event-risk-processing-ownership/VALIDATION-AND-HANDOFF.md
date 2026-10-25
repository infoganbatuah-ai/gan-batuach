# Offline validation and handoff — 2026-10-25 16:22 UTC

Scope: local review-only increment on
`codex/event-ingest-replay-identity-20261025`, starting at
`790c6e6cb6abbaddf5c3efb041a3ca4b80e095ac`. The worktree was clean at
start. All changes are confined to
`review-only/event-risk-processing-ownership/`; no migration directory,
runtime adapter, database, role, service or supplier was changed. The final
local commit/HEAD and worktree state are reported by the executing task after
commit, not predicted in this file. No remote push or PR is authorized.

## Checks performed against the local files

| Check | Result | Scope and limitation |
| --- | --- | --- |
| `node review-only/event-risk-processing-ownership/validate-review-package.mjs` | PASS | Reads local files only; checked abort guards, exactly three proposed SQL bodies, four absent SQL bodies, seven signatures, exact watch-rule ACL scope, proposed object inventory, review boundaries and no active route import. Not SQL parsing/execution. |
| `node scripts/qa/check-event-risk-model-a-local.mjs` | PASS, 5/5 | Synthetic Model A chain, one-owner transition, lease recovery, effect requirements, intent/projection contract. In-memory only. |
| `node scripts/qa/check-event-risk-fenced-writes-local.mjs` | PASS, 5/5 | Synthetic fenced writes, crash-window/restart model, stale owner, semantic conflict, audit and scope denial. In-memory transactional double, not PostgreSQL. |
| `node scripts/qa/check-event-risk-ownership-snapshot-local.mjs` | PASS, 4/4 | Synthetic event-time authority, immutable recipient snapshot and completion plan. Does not verify persistence serialization. |
| `node --check review-only/event-risk-processing-ownership/validate-review-package.mjs` | PASS | JavaScript syntax only. |
| JSON parse of `OBJECT-INVENTORY.json` | PASS | File syntax only. |
| `git diff --check` | PASS | Whitespace/conflict check; no SQL execution. |

TypeScript and lint were not rerun: no TypeScript or application code changed
in this increment, and the existing local TypeScript dependency issue is
documented in `SEVEN-RPC-IMPLEMENTATION.md`. Remote CI was not invoked by
this task's execution boundary. No fresh provider docs or Supabase changelog
were fetched because external service access was outside this local-only
authorization; version-sensitive application decisions remain open.

## Explicitly not verified

- No database connection or SQL of any kind, including read-only preflight.
- No PostgreSQL parser, concurrency, crash/restart, RLS, Data API, actual role,
  migration, restore or lossless rollback test.
- No current deployed catalog or historical Home owner verification; prior
  Development catalog evidence is reused with its original timestamp.
- No recipient-provenance authority, cross-language canonical hash,
  immutable plan writer/reader or retention/legal decision.
- No Guard, camera, provider delivery or physical effect.

Result: **local design package ready for review; database application and
runtime activation BLOCKED**. The exact outstanding facts and future gates
are in `FINAL-MIGRATION-REVIEW.md`, `BLOCKING-FACTS.md` and
`FORWARD-AND-ROLLBACK.md`. Keep all prior commits; this increment must remain
local and must not be mistaken for a remotely preserved development unit.

## Subsequent four-writer source-map increment — 2026-10-25 18:41 UTC

The later local task started from clean `17e7e2cdd0c9afc6c179b75a7e9bd7f0b1971283`
on the same branch. Unlike the preceding review-only increment, it adds one
**disconnected** TypeScript source-row comparator, one local synthetic test,
`FOUR-WRITER-SOURCE-TRANSACTION-MAP.md`, and narrow package-documentation and
static-containment updates. The final local SHA is reported after commit. No
database connection, SQL execution (even SELECT), service start, migration,
active route change, provider action, remote push or PR update was performed.

Fresh checks for this increment:

| Check | Result | Boundary |
| --- | --- | --- |
| `node scripts/qa/check-event-risk-source-row-map-local.mjs` | PASS, 4/4 groups | Supplied synthetic Risk-shaped rows only; each mapped field is changed/removed in a negative case. No committed-row proof. |
| `node scripts/qa/check-event-risk-fenced-writes-local.mjs` | PASS, 5/5 | Existing disconnected fence/claim synthetic regression; no PostgreSQL transaction proof. |
| Focused `tsc --ignoreConfig --noEmit --strict ... event-risk-source-row-map.ts` | PASS | Changed TypeScript and imported local types only; not whole-project typecheck. |
| Focused ESLint of comparator, its test and package validator | PASS | Changed executable local files only. |
| `node review-only/event-risk-processing-ownership/validate-review-package.mjs` | PASS | Static abort guards, three proposed/four absent RPC bodies, exact ACL scope and route disconnection. It never parses or executes SQL. |
| `git diff --cached --check` and explicit staged-file review | PASS | Text integrity and scope only; no runtime or database proof. |

The first test run needed a local `.js`→`.ts` resolver for existing Node TS
imports; after that correction it passed. An initial focused TypeScript
invocation omitted `--ignoreConfig`, and a second used incompatible NodeNext
module settings; the final focused command above passed. These local command
configuration failures did not touch product/runtime state.

Result: **four downstream operations are source-mapped, but all four SQL
bodies remain BLOCKED and the migration is NOT READY TO APPLY**. Next facts:
trusted event-time Home Tenant authority, generated Risk ID/pre-write scope,
full PostgreSQL row-equivalence, immutable decision-time plan producer,
composite Tenant/Site keys, atomic target-row/receipt/audit writes, Incident-wide
CAS, retention/legal-hold decisions, and an approved isolated PostgreSQL
qualification. A local comparison cannot establish committed database state.

## Subsequent pre/post Risk ownership-contract increment — 2026-10-25 19:39 UTC

Baseline was the clean local commit `5f6489737f23cb180e5b78a255f9dde3e0e506c2`
on `codex/event-ingest-replay-identity-20261025`. The worktree had no
concurrent or unexplained changes. The final local commit is reported after
validation; no remote publication is authorized.

Before: `validateAuthoritativeEventRiskOwnership` required a Risk ID to
validate event-time ownership, while the active Risk writer lets PostgreSQL
generate that ID. After: `validatePrePersistEventOwnership` checks the full
Event chain and event-time attestation with no Risk ID or Risk read;
`bindPostReadRiskOwnership` revalidates those inputs through the abstract
trusted reader, then binds the reader-reported Risk row's ID/Site/Event/Incident. The
strict legacy post-persist function delegates to both stages. Pre and post
types have incompatible stage markers; the pre result cannot qualify
completion or recipient snapshot. The comparison helper also requires the
post stage. All new tests use synthetic readers only. No deployed reader was
created, and no arbitrary evidence string is independently authenticated.

The Risk reader contract does not expose engine version or a Tenant column;
it is only a source-level scope check. Repeated independent reads are not one
database transaction and cannot prove atomicity, commit, snapshot isolation,
durability or historical Home ownership. The four downstream SQL bodies remain
BLOCKED and their abort guard remains intact. No SQL (including SELECT),
database connection, service, route, schema, ACL/RLS, supplier, remote Git or
physical Guard operation occurred. No retention duration was inferred.

Focused local checks for this increment (not database or external proof):

| Check | Result |
| --- | --- |
| `node scripts/qa/check-event-risk-ownership-snapshot-local.mjs` | PASS, 7/7 groups, including pre/post binding and completed-snapshot negatives. |
| `node scripts/qa/check-event-risk-source-row-map-local.mjs` | PASS, 4/4 groups; same-ID semantic conflicts still fail. |
| `node scripts/qa/check-event-risk-fenced-writes-local.mjs` | PASS, 5/5 groups; existing stale-owner/completion negatives. |
| `node scripts/qa/check-event-risk-model-a-local.mjs` | PASS, 5/5 groups; existing canonical-chain/claim regression. |
| Focused strict `tsc --ignoreConfig --noEmit` of two changed contracts and `check-event-risk-ownership-stages-types.ts` | PASS; incompatible pre/post types checked. |
| Focused ESLint of changed executable files | PASS. |
| `node review-only/event-risk-processing-ownership/validate-review-package.mjs` | PASS; abort guard, absent four SQL bodies and route isolation retained. |
| `git diff --check` | PASS; staged diff and final status inspected separately before local commit. |

The first source-row test run failed because its older fixture lacked the new
post-read stage marker; the fixture was corrected and reran PASS. No runtime
or database state changed. Remaining gates:
approved event-time Home Tenant/Site provenance and historical adjudication;
deployed trusted reader and Risk engine-version binding; atomic fenced writers,
mandatory audit, Incident CAS, retention, RLS/roles/Data API, restore and
lossless rollback. Separately authorized isolated PostgreSQL tests are needed
before any application claim. Guard OFF; no Product-readiness promotion.

Smallest external evidence decision: the authorized Digital Observer data
owner must identify the trustworthy event-time Tenant/Site/Event provenance
for *new* Home Events, name who may attest it, and separately adjudicate each
ambiguous historical Home record from independent ownership evidence. Current
Site membership or an email string is not that proof. No historical Tenant is
inferred here. Any later database observation needs a separate instruction
naming the isolated target, read scope, sanitized outputs and limits; it is
not authorized by this local contract task.
