# Consolidated blocking facts — 2026-10-25, Development catalog qualification

The original table below records source-only blockers. A later authorized,
bounded, read-only inspection of the original Development database was run;
its observations follow. No migration, role change, application RPC,
Production read or Home service action occurred.

## Resolved target and catalog facts (2026-10-25; qualification began 11:50 UTC)

- The earlier port 56422 belongs to the separate push38t profile and was
  not used. The original Kingston gbi profile and its Docker Unix socket
  are running. supabase_db_gan-batuach-integration is healthy, has the
  gan-batuach-integration project label, the original named database volume,
  and loopback-only PostgreSQL port 55422. The canonical environment
  configuration forbids Production access. SQL was executed only inside
  this verified container in explicit read-only transactions with 10-second
  statement and 1-second lock limits. No Production endpoint or credential
  was used.
- Fourteen relevant existing tables have RLS enabled (none FORCE RLS).
  Three proposed ownership tables, two proposed Incident generation
  columns and all seven proposed risk-ownership RPCs are absent.
  Deployed relationships remain independent/nullable as detailed in
  HOME-MAPPING.md; no Tenant/Site/Signal/Incident/Risk composite chain is
  enforced.
- The deployed watch-rule recording function has effective EXECUTE for
  anon, authenticated and service_role, despite source-only service-use
  language. Its body starts with a service-role check; no unauthorized
  write was demonstrated. Default function ACLs in public also grant new
  function EXECUTE to these roles. Exact future REVOKEs and role-boundary
  tests are required; no ACL was changed.
- Current Development aggregates: two Home Sites, zero missing organization
  references, zero Home Gateway enrollments/sources/validated real Signals.
  Historical Home ownership remains ambiguous. Zero observed mismatches
  in an empty Home Risk set is not a consistency proof.
- PostgREST exposes public,graphql_public and uses anon as its anonymous
  role. Effective PostgreSQL grants are in PERMISSIONS-AND-RPCS.md; external
  Data API reachability and actual role-boundary behavior remain untested.

The old endpoint-identity paragraph below is retained as historical evidence,
not the current blocker. APPLY BLOCKED remains the package decision.

## Focused Home-registration read qualification — 2026-10-25 20:35 UTC

The owner authorized a bounded **READ ONLY** inspection of the original gbi
Development database, without clone creation or mutation. The verified
container/socket/project/volume/loopback identity and the 10s/1s explicit
read-only transaction limits are recorded in
`PROSPECTIVE-HOME-REGISTRATION.md` and `OBJECT-INVENTORY.json`. All sessions
closed; no user records, credentials, JSON contents or raw identifiers were
selected. This is new current-state evidence, separate from the earlier
11:50 UTC general catalog review and earlier source-only preflight.

| Question | Classification and observed result | Remaining consequence |
| --- | --- | --- |
| Canonical customer/Home key | **VERIFIED CATALOG/AGGREGATE:** 3 organizations, 2 Home Sites, both currently linked to an organization and matching current organization/Site owners; the inspected constraints do not establish a unique immutable Home customer key or transfer history. Pilot Home tables have no canonical FK and 0 rows. | Current association supports a candidate only. Historical identity and future registration authority remain **UNVERIFIED**. |
| Home Source/Event chain | **VERIFIED CATALOG/AGGREGATE:** Site organization and owner FKs are nullable; Source creator is nullable; Signal and Incident Site links are independent. Current Home Sources, Gateway enrollments, Signals, Incidents and Incident links are all 0. | Empty counts cannot prove historical or future Tenant/Site/Event consistency. No backfill or writer activation. |
| Owner/Platform Admin | **VERIFIED CATALOG/AGGREGATE:** 1 active global profile-admin count, 0 active `platform_admin` memberships, 0 global admins owning current Home organizations/Sites. Four pre-approved auth/session functions exist as SECURITY DEFINER; org-permission function sets `row_security=off`. **SOURCE ONLY:** broad `is_admin()` and enterprise route app-metadata predicate. | No dedicated Home-registration actor or narrow privilege is proven. No Auth user/session/metadata rows were read. A role name or current membership is not authorization to register or transfer. |
| Registration version, acceptance, binding, audit | **ABSENT IN SCOPED CATALOG:** no registration/acceptance/event-binding/risk-claim object relevant to this design. **VERIFIED CATALOG:** enterprise audit exists with RLS but organization FK cascades delete. | No immutable server-acceptance/version receipt or atomic audit target is established; no executable registration DDL/RPC body or four downstream Risk writer bodies may be promoted. |

The exact next gate is a reviewed, independently authorized Home/customer
ownership and actor rule plus retention/audit specification. Only then may a
separately approved isolated clone/migration trial qualify new schema and
concurrency. No SQL writes or clone were authorized by this read.

Later offline follow-up: the owner-approved Model A direction is reflected in
the disconnected Home-type Site scope and a strict owner-only predicate. The
redundant logical `homeId` is removed. The OWNER predicate checks only
trusted-reader outputs; it has **no deployed session reader or transactional
store**, so authenticated-owner proof and actual role/RLS behavior are still
unqualified. Cross-owner/Tenant transfer and Platform Admin remain denied.
This narrows the implementation gap without resolving immutable acceptance,
audit/retention, historical authority or the four blocked Risk writers.

## Prospective Home Event authority options — source inventory, no selection

The active `cloud-events/route.ts:35-45,68-85` authenticates a Gateway,
checks one Site and camera Source, and writes a Site-scoped canonical Signal.
It does **not** read an authoritative event-time Tenant association:
its Site projection omits `digital_observer_organization_id`. The candidate
Site organization FK is nullable (`HOME-MAPPING.md`), and enrollment
`tenant_id` is nullable and not a proved Tenant/Site pair. The disconnected
`AuthoritativeEventOwnershipReader.authoritativeTenantForEvent` is an
interface, not an implemented source. A test fixture returning
`verifiedForEvent: true` or an `evidenceRef` is not external attestation.

| Option for **new** Home Events | What source supports / does not support | Missing mandate and evidence |
| --- | --- | --- |
| A. Prospective server-authorized Site→Tenant association before Event acceptance | Existing Source/Site/Gateway checks can bind the incoming Event to a Site, and `digital_observer_organizations.id` is a candidate Tenant. Current nullable, mutable Site membership does not prove ownership at the Event time. | An authorized Digital Observer data owner must approve the authoritative association producer and attester; specify effective-time validity, immutable Event reference, change/conflict/revocation handling and audit. Candidate future default only after those facts are verified. |
| B. Governed manual attestation | The existing reader interface can describe exact Tenant/Site/Event evidence, but no deployed producer or attester authorization exists. | Name a designated owner empowered to attest exact Event or bounded valid interval, with independent dated evidence, audit, revocation and conflict process. No blanket approval, email inference or automatic backfill. |
| C. Fail closed | The disconnected validator rejects missing, ambiguous or conflicting event-time evidence. | Current fallback: do not activate the new risk-ownership path while authority is unresolved; preserve accepted canonical records and existing lawful access. This does not certify existing processing as migrated. |

**Historical Home rows are separate.** Each ambiguous row/Event needs
row-specific adjudication from independent dated ownership evidence. A
prospective association cannot authorize a retrospective backfill. Do not
infer historical Tenant from current Site, email, labels, billing role,
Gateway enrollment or the empty Development Home Risk set. The owner decision
must name issuer, authorized attester, exact Tenant/Site/Event/time scope,
conflict/revocation/change handling and audit evidence. No legal conclusion,
retention duration or database access is supplied by this inventory.

## Offline implementation blockers after this task

Prospective Home ownership decision is now captured in
`PROSPECTIVE-HOME-REGISTRATION.md` and exercised by the disconnected
`home-registration-ownership.ts` reader/transition contract. This **does not**
resolve the deployed event-time reader or historical ambiguity blocker below:
there is no trusted server acceptance/version ledger, no verified owner/Platform
Admin resolver, and no atomic PostgreSQL adapter. Four downstream writer SQL
bodies remain BLOCKED. No active ingestion route or notification recipient
logic changed.

| Missing fact | Inspected source and consequence | Exact future verification |
| --- | --- | --- |
| Authoritative Home customer Tenant cardinality/history | `observer_sites.digital_observer_organization_id` is nullable; current two Home Site references do not prove historic ownership. Claim creation could bind the wrong customer. | Separately authorized historical owner review and new-write mapping/constraint qualification; no inferred backfill. |
| Event-time ownership evidence reader | `model-a-ownership.ts` checks the canonical chain and `event-risk-ownership-snapshot.ts` now requires a trusted event-time Tenant attestation; no deployed reader or historical adjudication source implements it. Current Site organization membership is not authoritative for old Home Events. | Define and independently review a trusted event-time source with exact Tenant/Site/Event provenance, then qualify historical and new-write coverage without inferred backfill. |
| Fenced Risk/verification/watch/intent/journal/audit writers | `risk-decision-service.ts`, `incident-verification-service.ts`, notification and audit helpers issue separate writes. The disconnected `event-risk-fenced-writes.ts` tests desired fence and evidence rules but is not called by them. A claim receipt cannot prove actual rows. | Verify exact row/payload mappings and implement epoch-fenced writers in reviewed PostgreSQL transactions; isolate and crash-test. |
| Risk identity and complete semantic duplicate check | `risk-decision-service.ts:287-317` lets PostgreSQL generate the Risk UUID and, on 23505, rereads only `id`. The disconnected pre/post contract now binds Risk only after a reader-reported row with exact `risk_engine_version`, Event, Incident and Site; it does not certify a committed database row. `event-risk-source-row-map.ts` compares supplied source-shaped fields locally. | Implement an authoritative event-time reader and atomic generated-ID insert/read/fence; qualify full stored-row equality, trusted processing-version provenance and PostgreSQL normalization in an approved isolated clone. `persist_event_risk_v1` body remains BLOCKED. |
| Four downstream write transaction boundaries | `FOUR-WRITER-SOURCE-TRANSACTION-MAP.md` maps each target and current independent service request; receipt rows alone cannot certify linked Risk, watch, verification, intent, journal or mandatory audit rows. No atomic claim/target/receipt/audit writer exists. | Review authoritative row inputs and composite scope keys, then implement and test each target write plus receipt/audit under current nonce/epoch and Incident-wide CAS in an authorized isolated clone. All four downstream SQL bodies remain BLOCKED. |
| Incident-wide projection generation | Two proposed generation columns are absent. A delayed Event worker could replace newer Incident state. | Add only after approval, then test atomic generation/reference CAS under competing Events. |
| Immutable recipient/settings plan | Current notification path rereads mutable recipients; the proposed plan table is absent. Replays could widen delivery. | Approve bounded snapshot schema and retention; test settings changes across crash/replay. |
| Snapshot persistence and canonical hash | The disconnected schema-v1 snapshot now includes protected references, channel settings, policy version, capture time and content fingerprint. The guarded plan table is absent; PostgreSQL jsonb serialization has not been qualified against the Node canonical hash. | Review recipient authority/retention, first-write immutability and a cross-language canonical hash; then implement and test a fenced transactional writer in an isolated clone. |
| No compatible existing snapshot store | `SNAPSHOT-PERSISTENCE-COMPATIBILITY.md` rejects Risk, decision intent, PUSH 39 action Outbox, per-recipient delivery, verification, Incident projection and immutable audit against exact keys, consumers and transaction boundaries. The guarded plan sketch now has proposed evidence-reference fields, but the table is absent and their provenance, canonical form, scope and retention are unqualified. | Review the minimum proposed plan-table delta, authoritative Event-time ownership, recipient provenance, retention and atomic writer/recovery reader before an isolated migration trial. |
| Retention and legal-hold authority | `AGENTS.md` requires retention and recovery coverage; the reviewed migrations and snapshot compatibility report contain no approved period or disposal rule for processing plans, recipient reconstruction, evidence/audit references or identity. Inventing TTL or indefinite retention could destroy recovery evidence or violate privacy duties. | Obtain separate product/privacy/legal decisions for each category, then qualify preservation and cleanup against active claims and legal holds; no TTL/cleanup is proposed here. |
| Legitimate external watch-rule callers and role probes | Source shows one service-role application caller and no other direct references, but deployed anon/authenticated EXECUTE remains. Blind revocation could break an unknown caller. | Isolated role-boundary and caller inventory before exact-signature forward ACL; review rollback alternative. |
| Shared default function ACL impact | `pg_default_acl` for postgres and supabase_admin grants public-schema function EXECUTE to API roles. Broad change could affect unrelated future functions. | Explicit future-function dependency and creator-role review; use exact-function REVOKEs meanwhile. |
| PostgreSQL race, crash and rollback behavior | Three offline SQL bodies are unexecuted proposals; four write operations have only disconnected local bodies. The transactional in-memory test store is non-durable. | Separately authorized isolated clone tests, including two workers, lease expiry during lock wait, semantic 23505, audit failure, in-flight rollback and restore. |

## Local endpoint identity check (2026-10-25)

Read-only host inspection observed an `ssh` process (PID 44976) listening on
`*:56422`; its established connection leads to `127.0.0.1:64084`, where a
`limactl` user-network process (PID 44950) listens. `supabase/config.toml`
declares 56422 as the `gan-batuach-push38t` DB port; that declaration alone
does not identify a running database. After owner approval for process
inspection, the SSH process's open Unix sockets were observed under
`.colima/_lima/colima-push38t/` and `.colima/push38t/`. The distinct original
`.colima/_lima/colima-gbi/` and `.colima/gbi/` profile directories also exist.
Thus this forwarding process belongs to **push38t, not the original gbi
profile**. The inner SSH forward destination/database identity was not
exposed by the available sanitized process metadata; Production exclusion
for that port was **NOT PROVEN AT THAT TIME**. The first unrestricted `ps`
request was denied; the owner-approved restricted metadata check did not
reveal a forwarding target.
No database connection or SQL was attempted. Do not use `56422` for the
original-gbi catalog inspection. The verified gbi Docker-socket chain above
supersedes this old target blocker without relying on the 56422 forward.

The table below is the original source-only queue. Items 2 and 4 now have
limited Development aggregate/catalog evidence above; item 12 now has
deployed PostgREST schema configuration evidence. Historical ownership,
legitimate callers, external Data API behavior and all implementation
gates remain open.

| # | Missing fact / inspected source | Why source is insufficient; affected contract | Future authorized verification; owner approval? |
| --- | --- | --- | --- |
| 1 | Actual Home/business Site→customer Tenant cardinality. `observer_sites.digital_observer_organization_id` is nullable; `digital_observer_organizations` permits family/business but owner profile is not a unique customer key. | Model A identity and historical backfill ambiguous. A Site label, email or billing key cannot choose Tenant. | Restricted Development row-level ownership reconciliation with owner adjudication for every ambiguous cluster; **yes**, separate read/decision approval. |
| 2 | Existing enrollment `tenant_id` population and Site match. Managed-device migration adds nullable UUID without Tenant FK; legacy Gateway auth reads Site only. | Cannot assume a Gateway claim proves canonical Tenant or that new-write FK is compatible. | Restricted Development counts and exact enrollment/Site join with sanitized exceptions; **yes** for DB read. |
| 3 | Historical Signal/link/Incident/Risk Site consistency. Source FKs are independent; prior privileged synthetic mismatch was accepted. | Composite constraints may fail validation; an ordinary-user RLS bypass was not shown. | Run the provided read-only preflight against an authorized isolated snapshot, classify exceptions without repair; **yes** for DB read. |
| 4 | Effective table ACL, RLS, function owner, `PUBLIC` EXECUTE, role inheritance and Data API exposure. Source migration text lists declarations only. | Service-only RPC and new-table privileges cannot be certified. | Exact Development catalog/role probes and legitimate-caller review before any REVOKE/GRANT; **yes** for DB/security review. |
| 5 | Atomic function bodies and full result validation. Local `event-risk-recovery.ts` is disabled and non-durable; guarded SQL creates no functions. | Claim, renew, persist, recover and complete signatures are exact proposals, but no DB guarantee exists. | Separately approve implementation in isolated clone, then PostgreSQL concurrency/crash tests; **yes** for future schema/implementation. |
| 6 | Fenced downstream writes. Risk, watch-rule, verification, intent and Incident projections are separate current requests; watch-rule RPC is not claim-epoch aware. | Stale owner could write after lease transfer, or different Event overwrite Incident projection. | Reviewed transactional RPC design with Incident-wide CAS, isolated process-race tests; **yes** for future DB/runtime changes. |
| 7 | Durable decision-time recipient/settings state. `notifications.ts` reads mutable recipients/settings during each call. | Retry may produce a different recipient set or miss a partial journal write. | Approve snapshot/version semantics and prove atomically persisted plan plus per-recipient reconciliation; **yes** for schema/runtime. |
| 8 | Semantic equality of duplicate Risk, verification, watch and intent rows. Current 23505 paths may reread only IDs or ignore conflict. | Unique key is not equivalent content; false completion could persist. | Isolated stored-row comparison tests on exact future RPC, conflict injection; **yes** for implementation. |
| 9 | Mandatory audit and Gateway ACK policy. `writeAuditEvent` catches errors and route can return success. | Claim COMPLETED cannot mean full Event-effect completion. | Product/security decision defining mandatory audit and route-level ACK, plus fault-injection; **yes**, separate approval. |
| 10 | Guard dispatch ownership. Existing Guard service can request physical commands after Risk/notifications. | Risk recovery cannot safely replay or suppress an external command. | Separate command idempotency/physical-effect review; **yes** before any route integration, no hardware action now. |
| 11 | Lock duration, volume, retention and rollback compatibility. Existing table sizes and actual Development history were not queried. | Additive indexes/NOT VALID FKs and old/new application coexistence may block writes or lose recovery state. | Authorized isolated clone with current backup, measured migration/restore and mixed-version rehearsal; **yes** before apply. |
| 12 | Supabase version, current exposed-schema settings and provider changelog applicability. No external call was allowed in this static task. | Exact Data API and default-privilege behavior cannot be asserted from a local file. | Future authorized read of official current docs/config plus isolated privilege test; **yes** if provider access is needed. |

Decision for this package: **reviewable but APPLY BLOCKED**. The candidate
Tenant table choice is explicit; its historical truth is not. No new role,
RPC, ACL, migration, worker or runtime flag was activated.
