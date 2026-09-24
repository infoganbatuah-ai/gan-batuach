# Gan Batuach Management Reporting Inventory

Audit date: 2026-09-22

Baseline: `integration/development` at `caad36d36d3a8ab3f4c005dfea24f0c12b989734`

Scope: Management only. Digital Observer core is outside this change.

| Surface | Role | Canonical source | State before GB-M36 | Export | Privacy scope | GB-M36 decision |
|---|---|---|---|---|---|---|
| `/dashboard/garden/reports` | Owner/Manager | Children, attendance, incidents, messages, inspections | Real headline counts plus links; export workbench was partial | CSV through `/api/reports` | Current managed Garden | Reuse page and attach canonical report catalog |
| `/dashboard/parent/reports` | Parent | Guardian relationships, attendance, tuition, documents | Missing | No household bulk export | Authorized Child or Children only | Add a minimal role-aware report center |
| `/dashboard/staff/reports` | Staff | Employment, shifts/time, Tasks | Missing | Own CSV where supported | Own active employment/Garden | Add a minimal role-aware report center |
| `/dashboard/inspector/reports` | Inspector | Assignments, inspections, violations, complaints, documents | Real navigation, fragmented reporting | CSV through `/api/reports` | Currently assigned Gardens only | Reuse page and attach canonical report center |
| `/dashboard/admin/reports` | Platform Admin | Gardens, profiles, subscriptions, provider readiness | Mixed links and legacy readiness cards | Subscription CSV only | Aggregate/support scope; no Child/message content | Replace misleading workbench links with aggregate-only catalog |
| `/dashboard/admin/analytics-center` | Admin | Historical analytics/readiness configuration | Partial/legacy | Existing only | Admin | Keep for compatibility; do not use as canonical Management report truth |
| `/dashboard/admin/kindergarten-analytics` | Admin | Garden analytics | Partial/legacy | Existing only | Admin | Keep for compatibility pending GB-M38 retirement review |
| `/dashboard/admin/skeleton-analytics` | Admin | Readiness/skeleton records | Mock/readiness | None | Admin | Classify as non-canonical readiness surface |
| `/api/admin/reports` | Admin | Legacy report registry | Legacy/partial | Existing behavior | Admin | Retain compatibility; new canonical data comes from `/api/reports` |
| `/api/admin/report-actions` | Admin | Legacy report actions | Legacy operational action | Existing behavior | Admin | Retain compatibility; do not broaden |
| `/api/inspections/[id]/report` | Garden/Inspector/Parent projection | Submitted inspection | Real domain report | JSON | Per-inspection authorization | Reuse as drill-down; GB-M36 does not duplicate inspection truth |
| `/dashboard/*/inspections/[id]/report` | Garden/Admin/Parent | Submitted inspection and safe projection | Real | Existing | Role-specific | Reuse unchanged |
| `/api/garden/staff-time` | Staff/Manager | GB-M34 Staff time ledger | Real | Existing payroll-ready RPC | Own employment or managed Garden | Reuse source and canonical export RPC |
| `/api/garden/tuition-ledger`, `/api/parent/tuition-ledger` | Manager/Parent | GB-M27 tuition ledger | Real | Existing domain view | Garden or authorized Child | Reuse source; do not mix platform subscription |
| `/api/garden/subscription`, `/api/admin/subscriptions` | Garden/Admin | GB-M26 subscription | Real | Existing domain view | Managed Garden/support | Reuse source separately from tuition |
| `/api/garden/staffing-readiness` | Manager | GB-M13 staffing policy | Real when configured | No new bulk export | Garden/Classroom | Reuse as canonical staffing-policy drill-down; preserve `policy_not_configured` |
| `/api/documents` and private file routes | Scoped roles | GB-M32 documents | Real | Metadata only in report CSV | Current document policy/RLS | Reuse metadata; never export storage paths |
| `/api/reports` | All Management roles | Canonical source-domain tables/RPCs | Missing | Bounded UTF-8 CSV for eligible reports | Re-authorized per request | New canonical read-only aggregation and export endpoint |

## Canonical report catalog

The canonical endpoint exposes only role-appropriate report types:

- Owner/Manager: dashboard, attendance, pickup, Staff hours, tuition, platform subscription, inspections, corrective actions, complaints, Tasks, documents, enrollment funnel, operational capacity, and authorized network summary.
- Parent: own-family summary, own Child attendance, own Child tuition, and permitted Child documents.
- Staff: own summary, own hours, and own assigned Tasks.
- Inspector: assigned-Garden portfolio, inspections, corrective actions, complaints, and inspection-authorized documents.
- Platform Admin: aggregate platform summary and platform subscriptions. Ordinary Child, message, document, Staff wage, and pickup content are excluded.

Children/Staff operational lists and staffing readiness remain on their existing canonical pages/endpoints. GB-M36 links and aggregates their source state rather than introducing duplicate read-model tables.

## Legacy and mock classification

- Admin `skeleton-analytics` and several historical analytics pages are readiness/legacy surfaces, not canonical business totals.
- Digital Observer beta/readiness analytics remain Digital Observer-owned and are not promoted to Management Safety evidence.
- No legacy page was deleted. Final route retirement remains GB-M38 work.
- No report result is materialized into a new editable table.

## Storage and retention

CSV is generated directly after authorization and is not stored. There is no public report object, signed URL, or new retention obligation. The export audit records actor, report type, authorized scope, date range, timestamp, and row count; it does not store report contents.
