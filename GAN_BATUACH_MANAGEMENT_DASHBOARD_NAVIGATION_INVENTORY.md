# Gan Batuach Management Dashboard and Navigation Inventory

Date: 2026-09-22
Baseline: `integration/development` at `fc2032cf835a385994672d36dd89f20469ab10c5`

## Canonical role entry points

| Route | Role | Shell | Source domains | Actions | Decision for GB-M38 |
|---|---|---|---|---|---|
| `/dashboard/garden/operations` | Owner / Manager | `DashboardShell` + `TeacherAppFrame` | enrollments, Classrooms, GB-M33 attendance, GB-M34 time, GB-M27 tuition, GB-M26 subscription, GB-M22/23 inspections, GB-M24 Tasks, GB-M25 complaints, GB-M30 notifications, GB-M32 documents | Children, Staff, attendance, messages, Tasks, finance, documents, reports | Canonical home; `/dashboard/garden` remains a compatibility redirect |
| `/dashboard/parent` | Parent | `DashboardShell` + `ParentAppFrame` | Guardian links, enrollment, GB-M33 attendance, GB-M27 tuition, GB-M29 messages, GB-M30 notifications, GB-M32 documents | Child switch, discovery, messages, payment, documents, pickup | Canonical Child-scoped home; review `/family-home` as redirect candidate |
| `/dashboard/staff` | active Staff / candidate | `StaffAppFrame` | GB-M18/19 employment, Classroom assignments, GB-M24 Tasks, GB-M29 messages, GB-M30 notifications, GB-M34 shifts | clock, shifts, Tasks, messages, Classroom journal | Canonical operational home; candidate state remains distinct |
| `/dashboard/inspector` | Inspector | `InspectorAppFrame` | assignments, GB-M22 inspections, GB-M23 corrective actions, GB-M24 Tasks, GB-M25 complaints, GB-M36 reports | inspections, assigned Gardens, reports, Tasks | Canonical home; preserve unassigned empty state and suspended denial |
| `/dashboard/admin` | Platform Admin | `AdminAppFrame` | aggregate Gardens/users/roles/subscriptions/complaints/provider readiness/system state | Gardens, users, inspectors, subscriptions, reports, notifications | Canonical platform home; does not preload Child/message content |

## Canonical top-level navigation

| Role | Mobile/desktop top level | Context control |
|---|---|---|
| Owner / Manager | Home, Children, Staff, Communication, More | authorized Garden switcher |
| Parent | Home, Schedule, Messages, Notifications, More | Guardian-linked Child selector on the dashboard |
| Staff | Home, Shifts, Tasks, Messages, More | active employment Garden switcher |
| Inspector | Home, Inspections, Gardens, Reports, Notifications | assignment scope from the server |
| Admin | Home, Gardens, Inspectors, Reports, More | platform role; no Garden impersonation |

The switchers select presentation context only. Every destination and mutation performs its own authorization.

## Reusable domain destinations

These routes remain canonical destinations rather than duplicate dashboards:

- Garden: `/children`, `/staff`, `/attendance`, `/messages`, `/notifications`, `/tasks`, `/documents`, `/finance`, `/tuition-ledger`, `/subscription`, `/inspections`, `/corrective-actions`, `/reports`, `/settings`.
- Parent: `/children/[id]`, `/discover-kindergartens`, `/messages`, `/notifications`, `/payments`, `/documents`, `/pickup`, `/inspections`, `/reports`, `/settings`.
- Staff: `/shifts`, `/attendance`, `/tasks`, `/messages`, `/notifications`, `/child-journal`, `/documents`, `/reports`, `/settings`; `/job-market` is candidate-only.
- Inspector: `/control-center`, `/inspections`, `/violations`, `/tasks`, `/reports`, `/notifications`, `/preliminary-gardens`, `/settings`.
- Admin: `/kindergartens`, `/users`, `/inspectors`, `/subscriptions`, `/complaints`, `/provider-production`, `/system-health`, `/reports`, `/audit-logs`, `/settings`.

## Legacy and consolidation candidates

| Route family | Current classification | Canonical destination / reason | GB-M38 recommendation |
|---|---|---|---|
| Garden `/command-center` | reusable secondary operations index | canonical home is `/operations` | keep as More/index; remove duplicate metrics |
| Garden `/communication` | duplicate naming | `/messages` | redirect candidate |
| Garden `/inspection-status` | duplicate summary | `/inspections` or `/reports` | redirect candidate |
| Garden `/pickup-face` | legacy/mock review path | `/pickup`; face match is never release authority | Production-block or retire |
| Garden `/ai-events`, `/audio-events`, `/correlated-events`, `/vision-ai`, `/observer-*` | readiness/pilot/legacy | `/cameras`, `/trust-center`; verified incidents only | separate Management readiness from Digital Observer core; retire duplicates |
| Parent `/family-home` | duplicate home | `/dashboard/parent` | redirect after link audit |
| Parent `/trust` | duplicate naming | `/trust-center` | redirect candidate |
| Parent `/ai-events` | readiness/legacy | `/trust-center` | Production-block unless verified contract exists |
| Staff `/operations` | duplicate summary | `/dashboard/staff` | redirect candidate |
| Staff `/daily-journal` | duplicate naming | `/child-journal` | redirect candidate after route contract review |
| Inspector `/command-center` | duplicate summary | `/dashboard/inspector` | redirect candidate |
| Inspector `/ratings` | partial/legacy | `/reports` | consolidate |
| Inspector `/ai-events`, `/observer-*` | readiness/pilot | assigned-Garden safe reports only | Production-block mock/shadow results |
| Admin AI/Observer/camera families | internal/readiness/legacy mix | `/provider-production`, `/system-health`, `/reports` | classify individually before redirects; do not delete blindly |
| Admin launch/pilot/scale/mobile/ISO families | internal QA/readiness | not core role home navigation | mark internal-only or archive after owner review |
| Admin `/gardens` and `/kindergartens` | duplicate naming | `/kindergartens` is canonical list; `/gardens/[id]` remains detail compatibility | consolidate links and redirect safely |
| `components/dashboard-command-center.tsx` + `/api/dashboard/interaction-summary` | disconnected legacy read model | role dashboards and GB-M36 reports | remove in GB-M38 after reference audit; it uses legacy financial and date semantics |

## Privacy and truth findings

- Garden tuition is sourced from `tuition_billing_periods`; platform subscription is shown separately from `kindergarten_subscriptions`.
- Parent cards are bound to one authorized Child at a time. The selected Child controls Garden, attendance, tuition, documents, schedule and request context.
- Staff dashboard Children come from active Staff/Classroom assignments. It does not preload medical fields or message bodies.
- Inspector dashboard scope comes from assigned Gardens and provides a safe unassigned state.
- Admin AI cards do not consume unverified `ai_events` as real incidents. Shadow/readiness state remains explicit.
- Camera existence alone is not represented as live monitoring.

## Route inventory counts

At audit time the repository contained 48 Garden, 22 Parent, 19 Staff, 20 Inspector and 139 Admin dashboard page routes. This inventory preserves them for GB-M38 classification; GB-M37 changes the canonical entry points and navigation without deleting historical routes.
