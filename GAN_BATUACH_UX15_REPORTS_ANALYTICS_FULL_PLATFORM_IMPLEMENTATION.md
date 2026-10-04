# Gan Batuach UX-IMPLEMENT-15 — Reports & Analytics Full Platform

## Scope and source of truth

UX-15 refines the canonical GB-M36 reporting experience. It does not create another report engine, materialized ledger, analytics store, or client-side source of financial truth. Every result is requested from the existing role-scoped `/api/reports` endpoint and is calculated from the canonical Management domain tables or existing reporting RPCs.

Visual composition follows:

- Primary: `GB_UX_REF_REPORTS_ANALYTICS_FULL_PLATFORM.png`
  - resolved local source: `/Users/danielderi/Desktop/גן בטוח/עיצוב עדכון גרסה/GB_UX_REF_REPORTS_ANALYTICS_FULL_PLATFORM.png`
  - SHA-256: `479de16dc2684ea4e3c44ab827fd9ef45051ebdfd840f63362c962acdb03e14a`
- Supporting: `GB_UX_REF_OWNER_CORE.png`
  - SHA-256: `ddf4744b5c28da7185c6b7e2a72bf8e0d5e73a17c290bf639d24c118be6c0564`
- Brand: `GAN_BATUACH_BRAND_MARK.png`
  - SHA-256: `4f914d04cf16061b831782d6d53b3f67259f3f88365cb123b641887917eea5ce`

The source Development integration head is `644f57a0e65f2c3b0e0095bb496a73672525c190`, which includes completed UX-14.

## Route map

| Role | Route | Scope |
|---|---|---|
| Owner / Manager | `/dashboard/garden/reports` | Active Garden or the server-authorized Garden portfolio |
| Parent | `/dashboard/parent/reports` | Linked Children and linked Gardens only |
| Staff | `/dashboard/staff/reports` | Active employment and own Staff record only |
| Inspector | `/dashboard/inspector/reports` | Assigned Gardens and inspection portfolio only |
| Admin | `/dashboard/admin/reports` | Canonical platform aggregates and subscription readiness only |
| All authorized roles | `/api/reports` | GB-M36 role catalog, bounded date range, bounded pagination and query-time freshness |

## Report inventory and feature completeness

| Canonical reporting capability | Route / surface | Notes |
|---|---|---|
| Garden overview | Owner/Manager Reports Center → `dashboard` | Query-time summary; no forecast |
| Multi-Garden summary | Owner/Manager → `network_summary` | Only server-resolved authorized Gardens |
| Attendance | Owner/Manager/Parent → `attendance` | Canonical attendance records; no camera inference |
| Pickup / release | Owner/Manager → `pickup` | Canonical release events and authorization status |
| Staff hours | Owner/Manager/Staff → `staff_hours` | Canonical shifts or existing staff-time export RPC |
| Labor cost | Owner/Manager Staff Hours metrics | Displayed only when the authorized RPC returns cost data |
| Parent tuition | Owner/Manager/Parent → `tuition` | Parent → Garden ledger only |
| Platform subscription | Owner/Manager/Admin → `subscription` | Garden → Gan Batuach only |
| Enrollment funnel | Owner/Manager → `enrollment` | Canonical request lifecycle states |
| Capacity | Owner/Manager → `capacity` | Configured capacity, assigned, reserved and available |
| Documents | Owner/Manager/Parent/Inspector → `documents` | Aggregate metadata only; no private content or storage paths |
| Inspections | Owner/Manager/Inspector → `inspections` / `inspector_portfolio` | Submitted server score remains authoritative |
| Corrective actions | Owner/Manager/Inspector → `corrective_actions` | Remains separate from Tasks and Complaints |
| Complaints | Owner/Manager/Inspector → `complaints` | Aggregate status and SLA state; no complaint body |
| Tasks | Owner/Manager/Staff → `tasks` / `staff_summary` | Canonical Task model only |
| Parent summary | Parent → `parent_summary` | Own linked Children only |
| Staff summary | Staff → `staff_summary` | Own assignment only |
| Admin aggregate | Admin → `platform_summary` | Counts and provider readiness; no private domain contents |
| CSV export | Reports with canonical CSV columns | Authorized, audited, formula-safe and bounded to 2,000 rows |

## Filter model

- Presets: today, trailing week, current month, or a custom date range.
- Custom ranges are validated by GB-M36 and cannot exceed 366 days.
- Owner/Manager and Inspector Garden options are produced from canonical server-authorized contexts.
- Parent Garden and Child options come from the canonical family relationship context.
- Status filtering applies only to the rows already returned for the authorized report.
- The UI never broadens a role scope and never treats a client-selected identifier as authorization.

## Role and permission matrix

| Domain | Owner/Manager | Parent | Staff | Inspector | Admin |
|---|---:|---:|---:|---:|---:|
| Garden overview | Authorized Gardens | — | — | — | Aggregate only |
| Attendance | Yes | Own linked Children | — | — | — |
| Pickup | Yes | — | — | — | — |
| Staff hours | Yes | — | Own Staff record | — | — |
| Tuition | Yes | Own linked Children | — | — | — |
| Subscription | Own Gardens | — | — | — | Platform aggregate |
| Documents | Metadata in own Gardens | Own linked Children | — | Assigned Gardens metadata | — |
| Inspections/remediation | Own Gardens | — | — | Assigned Gardens | — |
| Complaints | Own Gardens aggregate | — | — | Assigned Gardens aggregate | Platform summary only |
| Tasks | Own Gardens | — | Own assignments | — | — |

Authorization is enforced again inside `/api/reports` with Management Garden context, Parent family context, active Staff employment, Inspector assignments, and the Admin report catalog. Cross-Garden and cross-Child identifiers return denial responses.

## Finance boundary

Parent tuition and Garden platform subscription remain separate report types, queries, labels, metrics, tables and exports:

- Tuition reads `tuition_billing_periods` and labels the relationship Parent → Garden.
- Subscription reads `kindergarten_subscriptions` and labels the relationship Garden → Gan Batuach.
- No generic balance, shared payment state, or frontend-only financial total was introduced.
- Money aggregation retains the existing minor-unit GB-M36 handling.

## Export model

- CSV is active only for report types with a canonical server column contract.
- Exports are limited to 2,000 rows.
- Each CSV export requires an `audit_logs` write; a failed audit blocks download.
- UTF-8 BOM preserves Hebrew text.
- Values beginning with spreadsheet formula operators are neutralized.
- Response caching is `private, no-store`.
- PDF, Excel and Print are shown as unavailable because GB-M36 does not implement them.
- Saved and scheduled reports were not invented.

## Performance constraints

- Standard JSON pages are capped at 200 rows.
- Export pages are capped at 2,000 rows.
- Date range is capped at 366 days.
- Queries select bounded field lists and use canonical tenant filters.
- Dashboard aggregates use bounded server queries; the browser does not load every domain globally.
- Results are marked as query-time calculations. They are not presented as streaming or predictive analytics.

## Desktop and Mobile mapping

Desktop (`1440 × 1024`) uses a Reports command center with a report library, configuration workspace, metric/chart/table detail, and an explicit export panel. Mobile (`390 × 844`) uses a horizontal report library, single-column filters, sticky generate action, metric cards, chart view, data cards in place of compressed tables, and the canonical app bottom navigation.

Both compositions include loading, empty, failure and unavailable states. Empty responses remain distinct from query failures, and a failed request never becomes a zero-value report.

## Accessibility and RTL

- Semantic tables with captions and scoped headings.
- Accessible chart description plus an equivalent text/value list.
- Fieldsets and labels for filters and display controls.
- Keyboard focus rings and standard button/select navigation.
- Status meaning is provided with text in addition to color.
- Reduced-motion behavior is respected.
- The canonical app shell remains RTL-first; currency, dates, percentages and mixed numeric values use locale-aware formatters.

## QA evidence

- Focused UX-15 source contract: `npm run qa:ux15-focused`.
- GB-M36 regression: `npm run qa:management-reporting`.
- Role and isolation HTTP matrix: `scripts/qa/run-management-reporting-role-e2e.mjs`.
- Scale and bounded-query proof: `scripts/qa/run-management-reporting-scale-e2e.mjs`.
- Visual automation: `npm run qa:ux15-visual`.
- Evidence root: `qa-evidence/ux-implement-15/`.
- Visual set: 20 concepts × Desktop/Mobile = 40 captures.
- Required classification: 40 `OWNER_REVIEW_READY`, 0 `NEEDS_POLISH`, 0 `VISUAL_DRIFT`, 0 `BROKEN`.

The exact final commit, PR, integration merge head, required-check results, post-merge QA receipt and regenerated merged-head evidence are recorded after the Development workflow completes.

## Deviations and constraints

- The supplied Downloads path for the primary reference was absent; the exact filename was found in the user-provided design directory and verified by SHA-256 before implementation.
- Charts use only values returned in the current report response. No decorative, projected or AI-generated analytics were added.
- Labor cost remains unavailable when the canonical Staff Hours response does not contain authorized cost data.
- No new schema, migration, paid provider, analytics vendor, fixed monthly commitment or Digital Observer core change is part of UX-15.
- Production and `main` remain untouched.
