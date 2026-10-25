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

## Subsequent exact engine-version binding — 2026-10-25 19:54 UTC

Started from clean local `41e71f58080aea3dadbc6aeaf34866932af8c24a`
on `codex/event-ingest-replay-identity-20261025`; prior ancestry is preserved.
The final SHA is reported after commit. No active route, SQL, migration,
database connection, provider, PR or remote branch was touched.

The source migration declares `digital_observer_risk_evaluations.risk_engine_version
text NOT NULL`, and `risk-decision-service.ts` writes it independently of
`factor_version` and `decision_version`. The disconnected `CanonicalRiskDecision`
reader contract now requires `riskEngineVersion`. `resolveModelAChain` rejects
a Risk lookup without a nonempty explicit expected version and rejects a
reader row with a missing or different version. The post-read binding and
strict compatibility wrapper require that version, and completion/source-row
comparison reject reuse under another processing version. The expected value
must be supplied by a trusted server-side claim/processing context; an HTTP
version parameter is not authority. No deployed reader or end-to-end context
provenance is claimed.

Bounded source audit: the pre-stage still carries no Risk ID; the post-stage
checks stage, ID, Event/Incident/Site, unchanged event-time evidence and exact
engine version; client Tenant/Site overrides remain denied. The same-ID Risk
semantic comparator still rejects differing content. No further pure-code
defect was established in this boundary. Independent re-reads remain
non-atomic and cannot authenticate an arbitrary evidence string or prove
snapshot isolation. Tenant is derived from the separately qualified chain,
not a fictional Risk Tenant column. `BLOCKING-FACTS.md` records three
source-supported prospective authority options and separate historical
adjudication; none is selected or activated.

Focused local validation for this increment: ownership snapshot tests 8/8,
source-row tests 4/4, fenced-write tests 5/5, Model A tests 5/5 (22/22
groups total); strict focused TypeScript, focused ESLint, review-package
containment and staged diff checks passed. These are synthetic/source tests,
not PostgreSQL concurrency, committed-row, RLS or restore proof. The earlier
21/21 result belongs to the prior increment and is not reused here.

Open external gates remain: owner selection and authorization of event-time
Home Tenant/Site provenance (historical rows adjudicated separately), deployed
trusted reader and processing-version provenance, atomic fenced writers and
mandatory row/receipt/audit coupling, Incident-wide CAS, immutable recipient
state, retention/legal holds, role/RLS/Data API qualification, restore and
lossless rollback. Any isolated DB read or apply requires its own explicit
scope and approval. Guard OFF; no Product readiness promotion.

## Prospective Home registration authority contract — 2026-10-25

Owner selected server-verified Home/Source/Site/Tenant registration for **new**
Home Events. The disconnected contract and local tests are in
`home-registration-ownership.ts`, `check-home-registration-ownership-local.mjs`
and `PROSPECTIVE-HOME-REGISTRATION.md`. It separates installer from authorized
owner/platform actor, checks versioned registration and server acceptance,
preserves old Event binding across reassignment, and fails closed on missing
or contradictory history. The existing event-time Model A reader now checks
Source ID in the trusted evidence and can retain the original Tenant/Site/Source
scope when current Site or Source membership changes. The active event route,
recipient service and SQL files remain unchanged; the four downstream SQL
write bodies remain BLOCKED. No operational cutoff, historical backfill,
recipient expansion, database operation, remote publication or activation.

Handoff: this local branch owns only the two domain contracts, their focused
tests and this guarded review-only package. Next owner is the future
Development migration/transaction reviewer, **not** the runtime adapter.
Before any application work, qualify the actual owner/Platform Admin authority
source and an atomic server acceptance + immutable registration-version ledger
in an authorized isolated database; include concurrency, replay, transfer,
RLS/ACL, retention and rollback evidence. No PostgreSQL behavior is claimed
from the synthetic store.

## Source-only qualification preflight — 2026-10-25

This increment adds a candidate-target/identity and two-permission gate to
`PROSPECTIVE-HOME-REGISTRATION.md`, a blocked 14-case synthetic-only future
PostgreSQL matrix, and a five-group **static-only** containment checker. No
clone was identified or created. Existing gbi/55422 identity is local config
plus historical evidence, not a fresh health check; push38t/56422 is excluded.
The then-present logical `homeId` and narrow Platform Admin predicate lacked
deployed proof; the redundant `homeId` has since been removed locally, but no
registration DDL/RPC body is presented as ready to apply. Risk SQL abort guard,
four blocked downstream writers, active route and notifications are unchanged.

Handoff owner: future independently authorized Development catalog reviewer,
then separate isolated-clone migration/test owner. First gate is bounded
read-only source catalog/aggregate verification of customer/Home key and actor
authority; it does not authorize clone creation or SQL writes. The local branch
is not remotely preserved under this task's explicit no-push boundary. No
database, VM, supplier, Production, Home service or physical Guard operation
was performed. Static tests do not establish PostgreSQL/RLS/crash/restore
behavior. Retention, cost and lossless rollback remain unqualified.

Local checks for this **preflight only**: new static containment tests 5/5;
existing review-package abort guard PASS; focused ESLint and strict TypeScript
PASS; `git diff --check` PASS. The 14 PostgreSQL cases are **NOT RUN** and
remain blocked. The earlier 29/29 synthetic contract result belongs to the
prior commit, not to this preflight or any database qualification.

## Owner-authorized gbi READ ONLY qualification — 2026-10-25 20:35 UTC

This later increment supersedes only the previous statement that a fresh
Home-registration catalog/aggregate read had not yet run. Original
`colima-gbi`/`gan-batuach-integration`/named database volume and loopback
port 55422 were freshly verified. The `postgres` database reported
PostgreSQL 17.6 and `transaction_read_only=on`. Catalog and bounded aggregate
SELECTs ran in explicit read-only transactions with 10s statement and 1s
lock limits; all sessions closed. No clone, SQL write, service change,
Production access, app RPC, raw user row or credential output occurred.
Detailed sanitized observations and evidence classes are in
`PROSPECTIVE-HOME-REGISTRATION.md`, `BLOCKING-FACTS.md` and
`OBJECT-INVENTORY.json`.

Result: Authorization A **COMPLETE** for its narrow read scope, not for
PostgreSQL implementation qualification. Current two Home Sites have coherent
organization/owner links, but there are no Home camera Sources or Events and
no immutable registration/acceptance ledger. Historical customer authority,
dedicated owner/Platform Admin registration rights, retention and atomic
acceptance remain **UNVERIFIED/BLOCKED**. The four downstream Risk writers
remain blocked; no registration SQL is ready to apply. The 14-case future
PostgreSQL matrix is still **NOT RUN**. This local branch is still not
remotely preserved under the task's explicit no-push boundary. Handoff to
the future authorized Home identity/retention decision owner, then a
separately approved isolated-clone implementation reviewer; no runtime
adapter or activation is permitted.

## Offline Home Site/OWNER scope closure — 2026-10-25

Source review of `observer_sites`, the Home onboarding route and the bounded
gbi receipt establishes the **current canonical Home location** as
`observer_sites.id` with `site_type='home'`; no distinct approved Home entity
was found. The duplicate logical `homeId` was removed from the disconnected
contract. Tenant, Site, owner profile and Source remain separately bound;
multiple Sites per Tenant are allowed. This does not turn two current Home
rows into historical proof or a unique customer rule.

The new `ownerOnlyHomeActorResolver` is a **local predicate** over a
server-trusted session-reader port and exact canonical ownership facts.
Authenticated/active session, active owner profile, active organization and
Home Site, no Garden link, Source→Site, Site→Tenant and matching organization/
Site/account owners are all required. Installing a Source, an email, role,
billing or recipient label does not authorize registration. Platform Admin
is explicitly denied; cross-owner/Tenant transfer is explicitly denied.
Same-owner version renewal preserves the original Event binding. No real
session reader, immutable registration store, transactional recheck or
active route was implemented, so **DEPLOYED AUTHORITY UNQUALIFIED**.

Fresh local validation for this increment: 25/25 focused domain/static/
Model A test groups PASS; focused strict TypeScript PASS; focused ESLint PASS.
The full-tree TypeScript check is **BLOCKED** by absent Capacitor packages in
unmodified `observer-mobile-runtime.tsx` in this worktree, not reported as
a full PASS. The future 14-case PostgreSQL matrix remains **NOT RUN**; no SQL,
clone, service, provider or runtime action occurred in this increment. Risk
SQL guards and four downstream writer blocks remain unchanged.

Next implementation owner: verify a real server-side current-session reader
and canonical row provenance, plus a reviewed immutable receipt/audit and
retention design. A separate approved isolated PostgreSQL trial is required
for role/RLS, atomic CAS, race, recovery and lossless rollback behavior.
No general Model A/owner policy re-decision is requested. This branch remains
local under the explicit no-push boundary, so remote preservation and
integration are **PENDING**, not PASS.

## Request-bound Home owner session reader — local follow-up

The later local increment adds `home-registration-owner-session.server.ts`,
which reuses the canonical verified Bearer API boundary and produces a fresh,
five-second, request-local session observation. It does not grant registration
authority, write a durable receipt, accept a browser Cookie session, or wire an
active route. The existing owner predicate now rejects expired/future/overlong
observations. A future transactional adapter must recheck the current Auth
session, owner, Tenant, Site and Source inside the acceptance transaction;
no pre-transaction observation alone is sufficient.

Focused adapter tests cover exact identity, missing/malformed credential,
wrong/inactive profile, helper failure, cross-request isolation and the
unchanged Home/Site/Source denial. They use a local stub of the canonical Auth
boundary and do not call Supabase. Focused local results: 28/28 combined
session/Home/ownership test groups PASS; focused strict TypeScript PASS;
focused ESLint PASS; review-package containment PASS; `git diff --check` PASS.
The full-tree TypeScript check was not repeated: its existing missing
Capacitor dependency issue is recorded above, and no affected mobile source
changed here. The owner-authorized bounded READ ONLY
inspection of original gbi is recorded above and was not rerun without a new
catalog discrepancy. No SQL write, clone, migration, service or provider
change was made in this follow-up. The four downstream Risk writers and the
future PostgreSQL qualification remain blocked. The final local SHA is
reported after commit, not predicted here.
