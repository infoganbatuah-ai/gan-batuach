# Gan Batuach Management — UX-00 design reference index

This index is the ordered image/reference backlog for a designer or ChatGPT. `D` means desktop, `M` means mobile and `S` means a state/edge reference. Shared patterns may be reused only when the listed role scope and source-truth rules remain unchanged.

| Design ref ID | Priority | Role | Screen / route | View | State | Must be visible | Implementation target / shared components |
|---|---|---|---|---|---|---|---|
| GB-UX-REF-001 | P0 | Shared | App shell | D+M | populated | header, context, active nav, badge, account menu | role frames, `DashboardShell`, `AppHeader`, `SidebarNav`, `BottomNav` |
| GB-UX-REF-002 | P0 | Shared | cards/lists/status | D+M | populated | metric, action, list row, chip, safe count | `MetricCard`, `ActionCard`, `ListRowCard`, `StatusChip` |
| GB-UX-REF-003 | STATE | Shared | forms/dialogs | D+M | validation/pending/confirm | labels, helper, focus, error, pending, destructive confirm | existing forms and dialogs |
| GB-UX-REF-004 | STATE | Shared | system states | D+M | empty/loading/error/unavailable/denied | next action, retry, no false zero | `EmptyState`, `DashboardLoadingState`, `DashboardErrorState` |
| GB-UX-REF-005 | P0 | Owner | signup/Email verification | D+M | sent/verified/invalid | Auth path; no phone-verification claim | auth pages |
| GB-UX-REF-006 | P0 | Owner | registration | D+M | form | identity, Garden detail, Owner/Teacher choice | `/onboarding/kindergarten`, `KindergartenOnboardingForm` |
| GB-UX-REF-007 | P0 | Owner | onboarding wizard | D | step 1/2 | rail, fields, document truth, Classrooms/capacity/pricing | `/dashboard/garden/onboarding` |
| GB-UX-REF-008 | P0 | Owner | onboarding wizard | M | step 3/4/5 | subscription truth, invitations, review, sticky actions | same wizard |
| GB-UX-REF-009 | P0 | Owner | operations dashboard | D | populated | Today, Staff, finance, operations, inspection, Safety, quick actions | `/dashboard/garden/operations`, `ManagerOverviewDashboard` |
| GB-UX-REF-010 | P0 | Owner | operations dashboard | M | populated/empty | daily cards, Garden switcher, short action list | same |
| GB-UX-REF-011 | P0 | Owner | Children/Classrooms | D+M | populated | Child list, Classroom capacity, assignment and filters | `/children`, canonical child panels |
| GB-UX-REF-012 | P0 | Owner | Child detail/add | D+M | detail/form | Guardian, enrollment, sensitive field scope, timeline | `/children/[id]`, `GardenChildCreatePanel` |
| GB-UX-REF-013 | P0 | Owner | attendance | D+M | daily operational | expected/present/absent/departed, filter, arrival action | `/attendance`, `GardenAttendanceActionButton` |
| GB-UX-REF-014 | P0 | Owner | pickup/release | D+M | permitted/revoked | authorized person, temporary validity, Staff confirmation | `/pickup`, `GardenPickupVerificationPanel` |
| GB-UX-REF-015 | P0 | Owner | Staff/time | D+M | populated/missing-out | Staff list, shift/actual, correction, no wages to Teacher | `/staff*`, `/staff-time` |
| GB-UX-REF-016 | P0 | Owner | finance/tuition | D+M | partial/manual | ledgers, settlement drawer, distinct subscription state | `/finance`, `/tuition-ledger`, `/subscription` |
| GB-UX-REF-017 | P1 | Owner | documents | D+M | action-required | status counts, upload, review, expiry/replacement | `/documents`, `GardenDocumentUploadPanel` |
| GB-UX-REF-018 | P1 | Owner | inspection/corrective action | D+M | due/open | score, finding, due date, remediation | `/inspections`, `/corrective-actions` |
| GB-UX-REF-019 | P0 | Parent | Dashboard/Child switch | D+M | active Child | Child selector updates all cards, safe timeline | `/dashboard/parent` |
| GB-UX-REF-020 | P0 | Parent | no active Garden | D+M | empty/pending | Child card, discovery, invite/request actions | parent dashboard |
| GB-UX-REF-021 | P0 | Parent | discovery/Garden detail | D+M | availability/request | Garden cards, operational capacity, request status | `/discover-kindergartens` |
| GB-UX-REF-022 | P0 | Parent | schedule/pickup | D+M | present/release | attendance, pickup request, authorization validity | `/schedule`, `/pickup` |
| GB-UX-REF-023 | P0 | Parent | tuition/documents | D+M | partial/action-required | own-Child scope, manual settlement and private docs | `/payments`, `/documents` |
| GB-UX-REF-024 | P1 | Parent | trust/inspection/complaint | D+M | safe projection | Parent-safe inspection, complaint status, Safety policy | trust/inspection/complaint routes |
| GB-UX-REF-025 | P1 | Staff candidate | profile/jobs/application | D+M | pending/accepted | qualification, job detail, invitation/status, no ops access | `/job-market`, `/access-pending` |
| GB-UX-REF-026 | P0 | Active Staff | dashboard/Garden switch | D+M | employed | clock, shift, Tasks, permitted Children/messages | `/dashboard/staff` |
| GB-UX-REF-027 | P0 | Active Staff | time/shifts | D+M | clocked/missing out | clock action, actual vs shift, correction state | `/attendance`, `/shifts` |
| GB-UX-REF-028 | P0 | Active Staff | Tasks/messages | D+M | unread/open | Garden-scoped work, safe message context | `/tasks`, `/messages` |
| GB-UX-REF-029 | P1 | Inspector | application/status | D+M | pending/suspended | approved vs unassigned vs suspended | `/apply`, account states |
| GB-UX-REF-030 | P0 | Inspector | dashboard/portfolio | D+M | assigned | due/completed/overdue, findings, Tasks | `/dashboard/inspector` |
| GB-UX-REF-031 | P0 | Inspector | unassigned | D+M | approved-unassigned | blocked data, helpful next state | inspector dashboard |
| GB-UX-REF-032 | P0 | Inspector | inspection wizard | D+M | draft/submit | question types, private evidence, signature, save/resume | inspection wizard |
| GB-UX-REF-033 | P0 | Inspector | corrective actions | D+M | reject/resubmit/accept | history, evidence, decision | `/violations` |
| GB-UX-REF-034 | P1 | Shared | messaging thread/broadcast | D+M | unread/attachment | participant context, safe preview, attachment privacy | role `/messages` |
| GB-UX-REF-035 | P0 | Shared | notification center | D+M | unread/read | source, safe summary, preferences/quiet hours | role `/notifications` |
| GB-UX-REF-036 | P1 | Shared | document detail/upload | D+M | uploaded/review/verified/expired/replaced | private document lifecycle | document routes/components |
| GB-UX-REF-037 | P1 | Shared | Tasks/complaints | D+M | assigned/SLA/resolved | lifecycle language and safe internal/external boundary | Tasks and complaints routes |
| GB-UX-REF-038 | P1 | Authorized role | reports center | D | filtered/populated | filters, table, summary, freshness, CSV feedback | `ReportsCenter`, role reports |
| GB-UX-REF-039 | P1 | Authorized role | reports center | M | summary/drill-down | cards, filter sheet, bounded list | role reports |
| GB-UX-REF-040 | P1 | Owner | camera list/setup | D+M | readiness/degraded | cards, area, test, role policy, no secrets | `/cameras`, capability panel |
| GB-UX-REF-041 | P1 | Shared | Safety/trust | D+M | unavailable/verified | readiness distinction, verified incident only, no-recording policy | trust-center routes |
| GB-UX-REF-042 | P0 | Admin | overview | D | populated/error | aggregate-safe metrics, queues, quick actions, system warning | `/dashboard/admin` |
| GB-UX-REF-043 | P1 | Admin | canonical destination pattern | D | table/detail/filter | Gardens, Users/Roles, Inspectors, Subscriptions, Complaints | admin page families |
| GB-UX-REF-044 | P1 | Admin | providers/system/audit/configuration | D | unavailable/degraded | no secrets, internal boundaries, policy state | provider, health, audit, settings |
| GB-UX-REF-045 | STATE | Shared | RTL/bidi verification | D+M | mixed content | arrows, dates, currency, Hebrew/English/numbers | all reusable patterns |
| GB-UX-REF-046 | STATE | Shared | accessibility overlay spec | D+M | focused/error/dialog | focus, names, labels, error association | all P0/P1 targets |

## Counts

- Desktop references: 38 (the 46 rows include shared mobile/state companions).
- Mobile references: 27.
- Dedicated state/edge references: 18.
- Total requested visual references: 83, with remaining variations inherited from the specified shared patterns.

The actual final implementation mapping must be reconfirmed against the approved image before UX-01 begins.
