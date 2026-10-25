# Source permissions, effective permissions and proposed RPCs

The table below preserves the original source-only review. In the read-only
qualification begun 2026-10-25 at 11:50 UTC, the original Kingston gbi /
gan-batuach-integration PostgreSQL
17.6 container was verified by Docker socket, project label, original named
volume and loopback-only port 55422. Catalog and aggregate-only queries ran
in bounded read-only transactions. No application RPC was executed.
Migration text remains source intent; effective ACL UNKNOWN for any object
or caller not listed in the observed section below.

| Object | A — source-defined privileges/security | B — effective | C — unresolved |
| --- | --- | --- | --- |
| `digital_observer_organizations` | RLS and owner/member read, owner insert/update policies; migration revokes anon/authenticated then grants authenticated SELECT/INSERT/UPDATE | UNKNOWN | Current deployed ACL, policy version, function dependencies, and customer cardinality. |
| `observer_sites` | RLS; standalone owner insert/update predicates declared | UNKNOWN | Existing Site-owner and organization-role paths, effective grants, new-write compatibility with proposed non-null Tenant gate. |
| `video_gateway_device_enrollments` | Admin-only RLS policy declared; later nullable `tenant_id`; no matching Tenant FK in inspected migration | UNKNOWN | Effective write roles and legitimate provisioner callers. No broad revoke proposed. |
| Signal, Incident, link, Risk, verification, intent, watch and notification tables | RLS declared in their migrations; risk/verification/intent/watch read and mutation grants/revokes declared in `20260907010000` and watch migration | UNKNOWN | Actual policy/ACL versions, grants through role inheritance, service-role bypass, and affected legitimate callers. |
| `public.correlate_digital_observer_signal(uuid)` | Source declares `SECURITY DEFINER SET search_path=public` and a signal-insert trigger | UNKNOWN | Effective PUBLIC EXECUTE, owner, trigger dependency and shadow-object exposure. No change proposed in this package. |
| `public.record_digital_observer_watch_rule_evaluation(uuid,integer,uuid,uuid,uuid,boolean,jsonb,jsonb,text,timestamptz)` | Source declares `SECURITY DEFINER`, `search_path=public`, row security off; `REVOKE ... FROM public`, `GRANT EXECUTE TO service_role` | UNKNOWN | Verify effective EXECUTE/owner/role inheritance, actual RPC behavior and legitimate callers before changing it. |
| New claim/plan/receipt tables | Guarded proposal enables RLS and revokes new-table rights from PUBLIC/anon/authenticated; no policies or service grants applied | NOT APPLICABLE | Exact service grants, public-schema Data API exposure, role inheritance and default privileges require separate review. |
| New risk ownership RPCs below | Proposed `SECURITY INVOKER`, exact `search_path=pg_catalog,pg_temp`; qualified `public.` object names; proposed immediate `REVOKE EXECUTE FROM PUBLIC,anon,authenticated`, then narrow `service_role` grant only if justified | NOT APPLICABLE | No functions are created. Effective caller and Data API behavior require isolated privilege probes before any migration. |

## Observed deployed Development permissions — not an application access test

- All 14 relevant existing tables are present with RLS enabled and FORCE RLS
  disabled. The three proposed claim/plan/receipt tables and seven proposed
  ownership RPCs are absent. The inspected 27 policies are permissive; many
  target PUBLIC but their predicates restrict rows. Grants plus policies do
  not prove that any particular user can access or mutate a row.
- PostgREST is configured with schemas public,graphql_public and anonymous
  role anon. Actual external Data API reachability, cache state and end-to-end
  authorization remain untested. anon, authenticated and service_role have
  schema USAGE on public.
- Effective table rights, queried with has_table_privilege: anon has
  INSERT/UPDATE/DELETE on camera sources and notification deliveries without
  SELECT, and SELECT/INSERT/UPDATE/DELETE on Sites, Signals, Incidents, links,
  Gateway enrollments and immutable audit events. authenticated has
  SELECT/INSERT on organizations; SELECT on Risk, verification, watch-rule
  evaluations and camera action requests; and SELECT/INSERT/UPDATE/DELETE on
  Sites, Signals, Incidents, links, Gateway enrollments and immutable audit
  events. RLS or mutation guards may narrow these rights; no unauthorized
  row-level effect was tested or claimed. service_role has all four rights
  on all 14 inspected tables and BYPASSRLS.
- The deployed public.correlate_digital_observer_signal(uuid) is owned by
  postgres, SECURITY DEFINER, search_path=public; only service_role has
  effective EXECUTE among the three API roles. No PUBLIC grant exists.
  The deployed
  public.record_digital_observer_watch_rule_evaluation(uuid,integer,uuid,uuid,uuid,boolean,jsonb,jsonb,text,timestamptz)
  is also owned by postgres, SECURITY DEFINER, with
  search_path=public,row_security=off. It has explicit effective EXECUTE
  for anon, authenticated and service_role (not PUBLIC). The source
  migration revokes only PUBLIC; its body starts with an auth.role()
  service_role guard. This is a least-privilege mismatch, not proof of an
  ordinary-user RLS bypass. An exact-function privilege change and
  legitimate-caller test require separate review; none was applied.
- anon and authenticated do not have BYPASSRLS. service_role and postgres
  do. postgres inherits anon, authenticated and service_role; authenticator
  membership in those roles has inherit_option=false. No role was granted.
  Default privileges for both postgres and supabase_admin in public grant
  new-function EXECUTE to anon, authenticated and service_role. A future
  risk RPC must explicitly revoke exact-function EXECUTE from anon,
  authenticated and PUBLIC in its creation transaction; a PUBLIC-only revoke
  is insufficient. Do not alter shared default privileges merely for this
  review package.

Source: deployed pg_namespace, pg_class, pg_policy, pg_proc, pg_roles,
pg_auth_members, pg_default_acl, information_schema.routine_privileges and
has_*_privilege; non-secret PostgREST container configuration. Observation
is limited to this Development database, not Production.

## Exact proposed signatures — bodies BLOCKED

These names and argument types are the proposed transport contract; they are
not executable SQL implementations. The current Data API route uses a server
admin client, but no new privileged function is exposed or called. All seven
would require fresh canonical Tenant/Site lookup and `current_user`/trusted
server-role authorization, not an unsigned header or client-supplied Tenant.
`SECURITY INVOKER` avoids silently inheriting a broad definer role; it does
not make a `service_role` caller narrow. A public-schema RPC can still be
discoverable in the Data API, so grants and exposed-schema settings must be
verified independently. No `SECURITY DEFINER` workaround is approved.

| Signature (returns) | Caller / validation / durable transaction | Error and audit requirement |
| --- | --- | --- |
| `public.claim_event_risk_v1(uuid,text,uuid,integer) RETURNS jsonb` | Server-only; validates signal/link/Incident/Site/Tenant, locks canonical rows, creates `(signal,version)` claim or returns BUSY/COMPLETED/NOT_APPLICABLE; lease ≤300s | Scope/ambiguous Tenant fail closed; bounded sanitized claim audit. |
| `public.renew_event_risk_lease_v1(uuid,text,uuid,bigint,integer) RETURNS jsonb` | Server-only; exact nonce+epoch, live lease, canonical scope; atomic deadline change | Stale/expired rejected; no lease extension on failure. |
| `public.persist_event_risk_v1(uuid,text,uuid,bigint,jsonb) RETURNS uuid` | Server-only; validates all result fields and fingerprint, locks claim, inserts immutable Risk and marks RISK_PERSISTED together | 23505 requires full semantic reread; conflict aborts; no partial marker. |
| `public.start_event_risk_effects_v1(uuid,text,uuid,bigint,jsonb) RETURNS jsonb` | Server-only; atomically freezes expected effects, recipient/settings snapshot and fingerprints before effects | Changed snapshot/conflict rejected; no mutable recipient refetch on replay. |
| `public.record_event_risk_effect_v1(uuid,text,uuid,bigint,text,text,text) RETURNS jsonb` | Server-only; locks claim/plan, checks current epoch, required key, Site/Tenant/Risk and semantic fingerprint; one receipt/key | Missing mandatory audit is an error, not success. Existing physical Guard dispatch is excluded. |
| `public.complete_event_risk_v1(uuid,text,uuid,bigint) RETURNS jsonb` | Server-only; locks claim/plan/receipts and Incident, checks every mandatory effect, recipient set and Incident-wide projection CAS; marks COMPLETED | Incomplete/changed/stale aborts; COMPLETED is Risk/Incident only, never blanket Gateway ACK. |
| `public.recover_expired_event_risk_v1(uuid,text,uuid,integer) RETURNS jsonb` | Server-only; same atomic claim path as acquire with new nonce, strictly increasing epoch; preserves Risk/plan/receipts | Busy remains BUSY; expired owner fenced; no recalculation if Risk exists. |

All signatures: intended `EXECUTE` role is only a reviewed server role; no
`anon` or `authenticated` execution. `PUBLIC` default EXECUTE must be revoked
in the same future migration transaction as function creation. Do not grant a
new login or assume `REVOKE FROM anon` alone removes privileges inherited
from `PUBLIC`. Exact direct table grants and function owners are **BLOCKED**
until the restricted effective-permission and dependent-caller review. No
SQL grant/revoke beyond the guarded new-table sketch has been run.
