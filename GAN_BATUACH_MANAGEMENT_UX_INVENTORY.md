# Gan Batuach Management — UX Inventory

## Hard inventory

- Management/non-standalone-Digital-Observer pages: **285**.
- Role dashboard pages: Admin **140**, Garden **47**, Parent **21**, Staff **16**, Inspector **19** (243 total).
- Management components directly imported by page files: **101**.
- Role pages using a recognized role shell: Admin 139/140, Garden 46/47, Parent 21/21, Staff 16/16, Inspector 18/19.
- RTL is global and reinforced in the design system; responsive breakpoints and bottom navigations are extensive. Device/visual QA is not proof by source inspection.

## Role experiences

| Role | Primary shell(s) | Desktop navigation | Mobile navigation | Meaningful route groups | UX maturity | Status |
|---|---|---|---|---|---|---|
| Owner/Teacher | `DashboardShell`, `TeacherAppFrame` | dashboard side/header navigation | teacher bottom nav + global mobile tab bar suppression rules | home, children, parents, staff, attendance, operations, journals, health, pickup, finance, subscription, enrollment, messages, documents, inspections, compliance, reports, settings, cameras/AI | strong visual foundation, duplicated shell layers | COMPLETE_NEEDS_QA |
| Parent | `DashboardShell`, `ParentAppFrame` | parent frame | parent mobile navigation | family home, children/timeline, discovery, schedule, journal, gallery, pickup, payments, messages, complaints, documents, inspections, notifications, trust, settings, cameras/AI | coherent mobile-first set | COMPLETE_NEEDS_QA |
| Staff candidate/assigned | `StaffAppFrame` | compact staff workspace | staff bottom nav/one-hand components | home, job market, onboarding/background, attendance, shifts, tasks, operations, child journal, daily journal, incidents, messages, documents, certificates, notifications, settings, cameras | candidate and worker modes share one role UX | PARTIAL |
| Inspector | `InspectorAppFrame`, some `DashboardShell` | inspector navigation | responsive role navigation | apply, control/command center, inspections/due/history, violations, compliance, reports, ratings, risk, tasks, notifications, settings, cameras/AI | functional inspection workspace | COMPLETE_NEEDS_QA |
| Admin | `DashboardShell`, `AdminAppFrame` | very large categorized sidebar | global mobile tab bar | users, gardens, inspectors, applications, inspections, reports, compliance, billing, providers, security, audit, operations, QA/readiness, camera/observer | broad but highly fragmented | PARTIAL |

## Route classification

| Route family | Classification | Notes |
|---|---|---|
| `/dashboard/{garden,parent,staff,inspector}/...` core daily workflows | FUNCTIONAL + NEEDS_QA | backed by pages and APIs; provider/runtime exceptions documented in truth matrix |
| `/dashboard/admin/...` operational entities | FUNCTIONAL + NEEDS_QA | users, gardens, inspections, subscriptions, providers, audit |
| `/dashboard/admin/...readiness`, `...launch`, `...pilot`, `...scale`, `...qa`, `...review` | DUPLICATE/LEGACY/NEEDS_QA | many overlapping program-status dashboards rather than core Management workflows |
| `/app/register/*` | ACTIVE/FUNCTIONAL/NEEDS_QA | current self-service entry family |
| `/register`, `/join-*`, `/parent-portal`, `/parents*`, `/staff`, `/inspection-platform` | LEGACY or marketing-entry duplicates | must be consolidated after route-usage analytics |
| Digital Observer standalone routes | out of Management UX scope | boundary only |

## Meaningful screen inventory by role

### Garden

`/dashboard/garden`, `/children`, `/children/[id]`, `/children/[id]/timeline`, `/parents`, `/staff`, `/staff-applications`, `/attendance`, `/pickup`, `/daily-journal`, `/child-journal`, `/health`, `/incidents`, `/operations`, `/tasks`, `/finance`, `/subscription`, `/enrollment-requests`, `/leads`, `/messages`, `/communication`, `/notifications`, `/documents`, `/inspections`, `/inspections/[id]/report`, `/inspection-status`, `/compliance`, `/reports`, `/rating`, `/trust-center`, `/settings`, `/onboarding`, `/cameras`, `/camera-health`, `/ai-events`, `/audio-events`, `/vision-ai`, `/risk`, `/insights`, and observer-labelled pages. Core operations are FUNCTIONAL/NEEDS_QA; provider/AI pages are MOCK or EXTERNAL_DEPENDENCY.

### Parent

`/dashboard/parent`, `/family-home`, `/children/[id]`, `/children/[id]/timeline`, `/discover-kindergartens`, `/schedule`, `/daily-journal`, `/gallery`, `/pickup`, `/payments`, `/messages`, `/complaints`, `/documents`, `/inspections`, `/inspections/[id]/report`, `/notifications`, `/trust`, `/trust-center`, `/settings`, `/cameras`, `/ai-events`. All use `ParentAppFrame`; payment provider and AI truth limitations remain.

### Staff

`/dashboard/staff`, `/job-market`, `/background`, `/attendance`, `/shifts`, `/tasks`, `/operations`, `/daily-journal`, `/child-journal`, `/incidents`, `/messages`, `/documents`, `/certificates`, `/notifications`, `/settings`, `/cameras`. All use `StaffAppFrame`; candidate/assigned mode separation is incomplete.

### Inspector

`/dashboard/inspector`, `/apply`, `/control-center`, `/command-center`, `/inspections`, `/inspections/due`, `/inspections/history`, `/violations`, `/compliance`, `/reports`, `/ratings`, `/risk`, `/tasks`, `/notifications`, `/settings`, `/cameras`, `/ai-events`, `/observer-network`, `/observer-pilot`. Inspection core is functional; observer pages are boundary/readiness.

### Admin

Core active groups: `/users*`, `/gardens*`, `/kindergartens`, `/inspectors`, `/inspector-applications`, `/join-requests`, `/onboarding`, `/kindergarten-activation`, `/inspections*`, `/inspection-forms`, `/violations`-related compliance pages, `/complaints`, `/documents`, `/subscriptions`, `/billing`, `/communication*`, `/notifications`, `/integrations`, `/provider-production`, `/security*`, `/audit-logs`, `/reports`, `/settings`, `/tasks`, `/workflows`.

Consolidation candidates: the numerous `commercial-*`, `launch-*`, `pilot-*`, `scale-*`, `readiness-*`, `qa-*`, `review-*`, `observer-*`, `camera-*`, `ai-*` and duplicate analytics/report screens. They remain routable but should not all survive as top-level product navigation.

## Design system truth

Reusable foundations: `gan-batuach-design-system.tsx`, role AppFrames, `DashboardShell`, status/empty/error components, cards, forms and mobile navigations. Legacy/duplicate foundations include parallel `RoleAppShell`, `PremiumDashboard`, `ModuleListPage`, page-specific cards and large accumulated `globals.css` layers. Future UX work should consolidate, not redesign from zero.

## Required visual closure

Status is **COMPLETE_NEEDS_QA** for responsive/RTL foundations and **PARTIAL** for consistency. Required later QA: role-by-role screenshots at 390/768/1024/1440 widths, keyboard/focus, long Hebrew strings, loading/empty/error states, iOS/Android safe areas and duplicate navigation behavior.
