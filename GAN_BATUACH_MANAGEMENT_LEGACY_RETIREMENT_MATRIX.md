# Gan Batuach Management Legacy Retirement Matrix

Date: 2026-09-23
Baseline: `integration/development` at `f35b53577d9263300899602074dfe399f5267c3b`
Scope: Management only. Digital Observer core is excluded.

## Decision rules

`REMOVE` requires no UI/server/test/template caller and no unique behavior. `REDIRECT` retains a stable bookmark while the destination repeats authorization. Ambiguous or historically significant data remains compatibility or historical-only. Historical migrations and storage objects are unchanged.

| Artifact / family | Domain | Evidence / current callers | Canonical replacement | Action | Compatibility / data impact | Security impact / test | Final state |
|---|---|---|---|---|---|---|---|
| `/dashboard/garden` | Owner | Auth and existing links use it as entry | `/dashboard/garden/operations` | REDIRECT (existing) | Stable home bookmark | Destination re-authorizes role/Garden | REDIRECTED |
| `/dashboard/garden/inspection-status` | Inspection | One link from inspection list; duplicates canonical inspection state | `/dashboard/garden/inspections` | REDIRECT | Fixed destination; no ID/query forwarding | Redirect contract + destination authorization | REDIRECTED |
| `/dashboard/garden/pickup-face` | Pickup | No current caller; review-only face result UI | `/dashboard/garden/pickup` | REDIRECT | Historical URL remains usable; no face result transferred | Prevents face-match from becoming release authority | REDIRECTED |
| `/dashboard/parent/trust` | Parent trust | No current caller; older, smaller duplicate | `/dashboard/parent/trust-center` | REDIRECT | Parent bookmark preserved | Destination recomputes Guardian/Garden projection | REDIRECTED |
| `components/dashboard-command-center.tsx` | Dashboard | Zero imports; only self-contained fetch | GB-M37 role dashboards | REMOVE | No stored or transactional data | Static reference test | REMOVED |
| `/api/dashboard/interaction-summary` | Dashboard | Digital Observer portable-deployment CI reads every tracked runtime file and operational-role regression inventories this endpoint | GB-M37 dashboards + GB-M36 reports | INTERNAL_ONLY | Retained to preserve required cross-project CI; no user-facing caller | Operational-role guard retained | INTERNAL_ONLY |
| `/dashboard/garden/communication` | Notifications | Floating actions, command center, Admin link; provider logs/settings are unique | `/messages` plus GB-M30/31 delivery operations | KEEP | Not equivalent to private messaging | Manager/Owner guard retained | RETAINED_CANONICAL |
| `/dashboard/garden/command-center` | Garden operations | Current secondary operations index | `/operations` home | CONSOLIDATE LATER | Unique shortcuts remain | No weaker authorization observed | DEFERRED_WITH_REASON |
| `/dashboard/parent/family-home` | Parent | Auth default, navigation and timeline links actively use it | Parent dashboard/family timeline | KEEP | Active canonical family-day surface | Guardian context helper | RETAINED_CANONICAL |
| `/dashboard/staff/operations` | Staff | Active navigation and task return links | Staff command center | KEEP | Canonical active-employment home | Operational-role guard | RETAINED_CANONICAL |
| `/dashboard/staff/daily-journal` | Staff | Active navigation; Garden operational tasks | `/child-journal` is a different Child journal | KEEP | Semantics are not duplicates | Active employment guard | RETAINED_CANONICAL |
| `/dashboard/inspector/command-center` | Inspector | Active nav/tests; field-work view | Inspector dashboard portfolio | KEEP | Distinct today/field workspace | Approved/assigned Inspector guard | RETAINED_CANONICAL |
| `/dashboard/inspector/ratings` | Inspector | Dashboard metric links; unique rating projections | Reports do not replace rating priority | KEEP | Unique read model retained | Assigned Gardens only | RETAINED_CANONICAL |
| `/dashboard/admin/gardens` + `/kindergartens` | Admin | Detail links rely on `/gardens/[id]`; lists differ in density/actions | `/kindergartens` list + `/gardens/[id]` detail | DEPRECATE list alias later | Detail compatibility required | Admin role guard | DEPRECATED_COMPATIBILITY |
| Admin launch/pilot/ISO/mobile/scale/readiness families | Internal operations | Not in canonical Admin navigation; some tests/support callers | `/provider-production`, `/system-health`, `/reports` | INTERNAL_ONLY | Retain until provider/release evidence is migrated | Admin/internal guard remains | INTERNAL_ONLY |
| Admin demo/QA/test-center routes | QA | QA tooling and synthetic workflows | No user-product replacement | QA_ONLY | Environment guards remain mandatory | Production-facing navigation absent | QA_ONLY |
| Management AI/Observer readiness pages | Safety integration | Some active readiness/support links; not canonical incident truth | Cameras, trust center, verified integration contract | DEPRECATE/INTERNAL | Do not delete shared Observer code | Mock/shadow truth checks | DEFERRED_WITH_REASON |
| `/api/messages`, `/api/parent/messages` | Messaging | Compatibility callers may remain | `/api/communication/threads*` | DEPRECATE | Preserve while callers migrate | Must not weaken participant/Garden authorization | DEPRECATED_COMPATIBILITY |
| `/api/attendance` | Attendance | Historical compatibility surface | `/api/garden/attendance-action` and Parent projection | DEPRECATE | Preserve old caller behavior | Canonical attendance authorization required | DEPRECATED_COMPATIBILITY |
| `/api/webhooks/payment(s)`, `/invoice(s)` | Provider compatibility | Provider aliases call one signed handler | Provider-specific GB-M28 contract later | DEPRECATE COMPATIBILITY | Records verified event only; no financial side effect | Signature, provider binding, replay guard | DEPRECATED_COMPATIBILITY |
| `generated_credentials` reads/deletes | Identity history | Conflict checks, cleanup and Admin historical status | Supabase signed invitation/recovery | HISTORICAL_DATA_ONLY | No new plaintext writes; table not dropped | Credential retirement test | HISTORICAL_DATA_ONLY |
| `profiles.garden_id` | Identity preference | Widely used as selected/default context | Membership, employment, Guardian, assignment relations | KEEP COMPATIBILITY | Not removed until all selection callers migrate | Cannot independently grant access | DEPRECATED_COMPATIBILITY |
| Legacy Parent link fields | Parent/Child | Historical rows and deterministic compatibility | `parent_child_relationships` / Guardian context | FREEZE NEW AUTHORITY | Historical data retained | Parent-family helper and IDOR suite | HISTORICAL_DATA_ONLY |
| Legacy Staff Garden/profile fields | Employment | Context defaults and historical rows | Active Staff employment | FREEZE NEW AUTHORITY | Historical data retained | Operational-role employment RPC | HISTORICAL_DATA_ONLY |
| Legacy Inspector association fields | Inspection | Historical Garden association exists | Approved Inspector + current assignment | FREEZE NEW AUTHORITY | Retain inspection history | Approval/assignment regression | HISTORICAL_DATA_ONLY |
| Legacy age/group fields | Classroom | Historical/display compatibility | Canonical Classroom ID | KEEP HISTORY | No table drop/backfill in GB-M38 | Operational flows use Classroom | HISTORICAL_DATA_ONLY |
| Legacy Garden capacity totals | Capacity | Summary/display compatibility | GB-M12 Classroom capacity | KEEP HISTORY | No destructive rewrite | Capacity QA remains authority | HISTORICAL_DATA_ONLY |
| Hard-coded staffing ratios | Staffing | No active legal truth accepted | GB-M13 versioned policy | DEPRECATE | UI says `policy_not_configured` when absent | Policy regression | DEPRECATED_COMPATIBILITY |
| Direct enrollment status mutations | Enrollment | Older compatibility APIs require review | GB-M15/16 lifecycle | DEPRECATE | No deletion without caller proof | Activation and audit-role tests | DEFERRED_WITH_REASON |
| Old fixed payment prices | Finance | Text/constants audit only | GB-M26/27 configured plans and snapshots | DEPRECATE | Historical snapshots retained | Payment truth tests | DEPRECATED_COMPATIBILITY |
| Old chat surfaces | Messaging | Potential bookmarks and source-domain records | GB-M29 threads | DEPRECATE | Complaint/Task records remain distinct | Participant RLS and attachment privacy | DEFERRED_WITH_REASON |
| Direct provider send helpers | Notifications | Provider/internal tooling still exists | GB-M30 intents + GB-M31 adapters | INTERNAL_ONLY | No provider activation | Policy/readiness tests | INTERNAL_ONLY |
| Legacy document tables/routes | Documents | Historical/domain-specific attachments/evidence | GB-M32 documents where deterministic | KEEP HISTORY | No blind conversion or storage deletion | Private signed retrieval | HISTORICAL_DATA_ONLY |
| Face-match result table/API | Pickup QA/history | Review data may exist; never release authority | GB-M33 pickup authorization | QA/HISTORY ONLY | UI route redirects; table retained | Camera/face negative test | QA_ONLY |
| Legacy Staff attendance fields | Staff time | Historical operational records | GB-M34 ledger | KEEP HISTORY | No table drop | Employment/time race tests | HISTORICAL_DATA_ONLY |
| Legacy report/Admin analytics pages | Reporting | Unique readiness/config panels may remain | GB-M36 report catalog | DEPRECATE/INTERNAL | Keep until unique actions mapped | Role-aware report API | DEFERRED_WITH_REASON |
| Historical migration files | Database | Production/development ledgers depend on them | Forward-only migrations | KEEP | Immutable | Migration audit | HISTORICAL_DATA_ONLY |
| Unknown Storage objects/buckets | Storage | Ownership/retention not safely inferred | GB-M32 private storage contract | KEEP | No deletion in GB-M38 | Storage privacy regression | DEFERRED_WITH_REASON |

## Exit summary

Every candidate identified by GB-M01/32/35/36/37 or this audit has a final classification above. No candidate remains `UNKNOWN`. Deferred entries state the missing proof required before removal: caller migration, deterministic data mapping, provider/release evidence migration, or retention confirmation.
