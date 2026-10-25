# Source permissions, effective permissions and proposed RPCs

No database or provider was contacted for this package. A migration file is
source intent, **not** proof of the live ACL, RLS, schema exposure, function
owner or default privileges. No previous receipt available to this worktree
proves effective privileges for these exact proposed objects. Thus layer B is
`UNKNOWN`, even where layer A contains a `GRANT` or `REVOKE`.

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
