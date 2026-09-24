# Gan Batuach UX-IMPLEMENT-04 — Children, Classrooms, Child Profile and Enrollment

Date: 2026-09-24
Environment: Development / Integration only
Primary visual reference: `GB_UX_REF_CHILDREN_CLASSROOMS_PROFILE_ENROLLMENT.png`
Supporting references: `GB_UX_REF_OWNER_CORE.png`, `GAN_BATUACH_BRAND_MARK.png`

## Route map

| Canonical route | Surface | Main implementation |
| --- | --- | --- |
| `/dashboard/garden/children` | Children workspace, search, filters, attendance and enrollment state | `app/dashboard/garden/children/page.tsx` |
| `/dashboard/garden/children?section=classrooms` | Classroom workspace | `app/dashboard/garden/children/page.tsx` |
| `/dashboard/garden/children?section=classrooms&classroom=:id` | Classroom detail, capacity, Children and edit | `app/dashboard/garden/children/page.tsx` |
| `/dashboard/garden/children/:id` | Child profile overview | `app/dashboard/garden/children/[id]/page.tsx` |
| `/dashboard/garden/children/:id?tab=attendance` | Attendance and history | same canonical Child route |
| `/dashboard/garden/children/:id?tab=guardians` | Parent/Guardian links | same canonical Child route |
| `/dashboard/garden/children/:id?tab=pickup` | Authorized pickup and release history | same canonical Child route |
| `/dashboard/garden/children/:id?tab=documents` | Child documents | same canonical Child route |
| `/dashboard/garden/children/:id?tab=tuition` | Parent tuition for the Child | same canonical Child route |
| `/dashboard/garden/children/:id?tab=communication` | Canonical messaging entry | same canonical Child route |
| `/dashboard/garden/children/:id?tab=history` | Classroom, enrollment and timeline history | same canonical Child route |
| `/dashboard/garden/enrollment-requests` | Enrollment request lifecycle and activation | `app/dashboard/garden/enrollment-requests/page.tsx` |

No duplicate route or domain model was introduced.

## Component map

- `ClassroomManagementForm`: create/edit a canonical Classroom.
- `ClassroomAssignmentForm`: calls the existing atomic Classroom assignment API and preserves assignment history.
- `ChildProfileEditForm`: updates only canonical basic Child fields through a Garden-scoped API.
- Existing `GardenChildCreatePanel`, `ChildOperationsPanel`, `ChildPhotoUpload`, `ApplicationDecisionForm`, `ManualEnrollmentActivationForm`, `StatusChip`, `TeacherAppFrame`, and shared Owner shell remain shared.
- UX-04 styles extend the current shared runtime stylesheet. No parallel design system exists.

## Domain map and behavior

- Children are read through the server-authorized active Garden context; legacy `profiles.garden_id` is not an authority.
- Attendance displays exact canonical states and timestamps. Failed sources are shown as unavailable rather than zero.
- Classrooms remain distinct entities from age groups. Multiple Classrooms can share the same age group.
- Capacity shows assigned, reserved, available, full and over-capacity states from canonical records. No statutory capacity or ratio is invented.
- Reassignment uses `assign_child_to_classroom`, which preserves the canonical assignment ledger.
- Parent/Guardian links and authorized pickup contacts remain separate concepts.
- Pickup release requires staff confirmation. Face/camera results are never release authority.
- Documents retain missing/uploaded/pending/verified/rejected/expired semantics; uploaded is not presented as verified.
- Parent tuition is labeled Parent → Garden and remains separate from Garden platform subscription.
- Enrollment preserves submitted, information-required, resubmitted, awaiting-payment, waitlist, rejected, cancelled, reconciliation and activated states.
- Applicant identity enrichment is server-only and narrow: the authenticated request query first limits records to the active Garden; elevated reads select only the related IDs already present in that scoped result.
- Manual enrollment activation continues through the existing atomic evidence-backed API.

## Role visibility matrix

| Role | Visibility/action boundary |
| --- | --- |
| Owner / Manager | Full active-Garden Child, Classroom and enrollment management according to canonical permissions |
| Owner-as-Teacher | Owner access plus separately authorized teaching workflows; no implicit permission shortcut was added |
| Delegated Teacher / Staff | Existing Staff routes and employment/Classroom scope remain authoritative; no new management access |
| Parent | Existing Parent Child relationship and Parent routes remain authoritative; no management route access |
| Inspector | Existing assigned-Garden inspection-safe projection; no Child management access |
| Platform Admin | Existing Admin authorization remains unchanged |

Cross-Garden and Parent-child isolation were rechecked with synthetic identities.

## Responsive behavior

Desktop at 1440×1024 uses the approved navy shell, clear page workspace, data tables, Classroom card grid, profile panels and a list/detail enrollment layout. Mobile at 390×844 uses full-width cards, horizontal tab rails, filter controls, single-column details and the shared bottom navigation. Desktop tables are hidden on mobile instead of being squeezed.

## Canonical states

Designed and implemented states include populated, filtered-empty, empty, loading via the existing route shell, localized source error, permission/not-found boundary, active/pending/warning/danger chips, unavailable data, capacity warning, document action states, enrollment lifecycle, and payment reconciliation.

## Feature completeness map

| Canonical capability | Route/surface |
| --- | --- |
| Child list/search/filter/sort context | `/dashboard/garden/children` |
| Child create/edit/photo | Children workspace and Child overview |
| Child profile and medical notes | Child overview, permission-scoped |
| Parent/Guardian relationship | Child `guardians` tab |
| Authorized pickup and release history | Child `pickup` tab |
| Attendance | Child `attendance` tab and Children list |
| Classroom create/edit/capacity | Classroom workspace/detail |
| Classroom assignment/history | Child overview and `history` tab |
| Documents | Child `documents` tab |
| Parent tuition | Child `tuition` tab |
| Communication | Child `communication` tab → canonical messages |
| Enrollment requests and details | `/dashboard/garden/enrollment-requests` |
| Capacity reservation | Enrollment detail and Classroom truth |
| Manual payment evidence and atomic activation | Awaiting-payment request detail |
| Multi-Garden context | Shared server-validated Garden switcher/context |

## Visual QA and evidence

- Viewports: 1440×1024 and 390×844.
- 26 screenshots cover Children, filtered list, Classrooms, Classroom detail, seven Child profile states, enrollment list and enrollment detail on both viewports.
- Evidence: `qa-evidence/ux-implement-04/` with `results.json`, `SHA256SUMS`, and screenshots.
- Console errors: 0. HTTP 5xx responses: 0. Horizontal overflow: 0.
- Local Development navigation sample: p50 2694 ms, p95 4265 ms; this is not a Production SLA.

## Test scenarios

Focused UX-04 contract, canonical capacity, enrollment lifecycle, atomic activation, tuition separation, documents, attendance/pickup E2E, multi-role API isolation, and role browser smoke passed. Typecheck, lint regression, Production build, domain, security/isolation, migration and release-contract gates are required before merge.

## Deviations

No material design deviation. Operational data density and canonical actions add controls beyond the concept image while keeping its hierarchy, color, card, spacing, RTL and responsive language. The Development-only environment banner is evidence tooling and is not a Product visual surface.

## Boundaries

No schema migration. No paid dependency. No Production change. No Digital Observer core change. QA personas and synthetic QA data are preserved.
