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

## Offline implementation blockers after this task

| Missing fact | Inspected source and consequence | Exact future verification |
| --- | --- | --- |
| Authoritative Home customer Tenant cardinality/history | `observer_sites.digital_observer_organization_id` is nullable; current two Home Site references do not prove historic ownership. Claim creation could bind the wrong customer. | Separately authorized historical owner review and new-write mapping/constraint qualification; no inferred backfill. |
| Fenced Risk/verification/watch/intent/journal/audit writers | `risk-decision-service.ts`, `incident-verification-service.ts`, notification and audit helpers issue separate writes. The disconnected `event-risk-fenced-writes.ts` tests desired fence and evidence rules but is not called by them. A claim receipt cannot prove actual rows. | Verify exact row/payload mappings and implement epoch-fenced writers in reviewed PostgreSQL transactions; isolate and crash-test. |
| Incident-wide projection generation | Two proposed generation columns are absent. A delayed Event worker could replace newer Incident state. | Add only after approval, then test atomic generation/reference CAS under competing Events. |
| Immutable recipient/settings plan | Current notification path rereads mutable recipients; the proposed plan table is absent. Replays could widen delivery. | Approve bounded snapshot schema and retention; test settings changes across crash/replay. |
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
