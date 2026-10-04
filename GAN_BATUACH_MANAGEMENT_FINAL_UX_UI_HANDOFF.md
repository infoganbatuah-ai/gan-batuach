# Gan Batuach Management final UX/UI handoff

## Product design principles

Design only canonical surviving Management surfaces. Preserve role scope, Garden/Child context, private-data minimization and the existing design system. A state must be truthful before it is attractive: uploaded is not verified, scheduled is not present, manual settlement is not provider-confirmed, readiness is not live monitoring, and camera detection is not Child identity or release authority.

## Canonical roles

- Garden Owner/Manager: business and operational command center.
- Owner-as-Teacher: one Garden context with Owner and permitted teaching capabilities, without duplicate identity/navigation.
- Delegated Teacher: Classroom, attendance, communication and Tasks; no Owner finance, wages or membership administration.
- Parent: Child-centric experience with a prominent canonical Child selector.
- Staff: clearly separated candidate and active-employment states; active Garden controls all operational data.
- Inspector: application, approved-unassigned, assigned portfolio and suspended states.
- Platform Admin: aggregate-safe platform operation through the canonical 12-destination IA, without default private Child/message content.

## Canonical navigation

Use the existing AppShell, ResponsivePage, MobileAppShell, DesktopDashboardShell, AppHeader, BottomNav and SidebarNav. Mobile navigation contains only frequent actions. Desktop navigation groups domains by user goal. Garden and Child switchers are context preferences and never authorization.

## Screen inventory

The authoritative route-level inventory is `GAN_BATUACH_MANAGEMENT_CANONICAL_UX_SURFACE_MAP.md`. Design groups are:

- Owner/Manager: registration, Email verification, Garden onboarding/profile, dashboard, Classrooms, Children/detail, Guardians, enrollment, attendance/pickup, Staff recruitment/employment, time/shifts, Tasks, communication, notifications, documents, tuition, subscription, inspections/actions, complaints, reports, Management-facing safety/cameras, settings and multi-Garden switch.
- Parent: signup/verification/profile/family, Child creation/profile/switch, discovery/Garden detail, request/info-required/resubmit/invitation, tuition, dashboard, attendance/pickup authorization/request, messages, notifications, documents, Garden and inspection-safe information, safety policy state and settings.
- Staff candidate: profile, qualifications, discovery/detail, application/invitation/status. Employed: dashboard, Garden/Classroom context, clock, shifts/hours/correction, Tasks, permitted Children/attendance, messages, notifications, documents and permitted safety state.
- Inspector: application/status, unassigned, dashboard, assigned Gardens/detail, monthly inspection, evidence, report/findings, corrective actions, complaints, Tasks, trends, preliminary Garden/bootstrap and suspended state.
- Admin: overview; Gardens; users/roles; Inspectors; subscriptions; complaints/escalations; providers/system; audit/support; reports; configuration, with specialist pages nested under these destinations.

## Screen states

Every high-priority screen needs populated, empty, loading, error, unavailable, permission-denied, mobile and desktop states. Transactional screens also need action-required, pending, success, validation-error and destructive-confirmation states. A source failure must end in error/retry rather than a false zero or endless skeleton.

## Mobile

Prioritize Parent, Staff and Garden daily work. Use cards and bounded lists rather than squeezed desktop tables. Preserve 44px-class touch targets, visible context, safe fixed navigation, keyboard behavior and no horizontal overflow.

## Desktop

Use summary cards, filters, tables and detail panels where the data density warrants them. Preserve active navigation and back/forward behavior. Do not preload private data merely to populate a dashboard.

## RTL

Hebrew is primary. Validate arrow direction, sidebar/bottom nav, modal alignment, date/time/currency, mixed Hebrew/number strings and validation messages. Use logical CSS properties and bidi-safe formatting.

## Accessibility

Every interactive control needs a programmatic name; inputs need associated labels or an equally valid accessible name. Define keyboard order, visible focus, dialog focus/return, error association and status announcements. This handoff is not a WCAG certification. Recount the prior 81 unlabeled-input occurrences against surviving routes.

## Terminology

Preferred Hebrew domain terms: גן, כיתה, ילד/ה, הורה/אפוטרופוס, מורשה איסוף, צוות, גננת, בעלים/מנהל, מפקח, נוכחות, בקשת רישום, הרשמה פעילה, הסדר תשלום ידני, משימה, תלונה, ביקורת, ליקוי, פעולה מתקנת, מסמך, מצלמה, אירוע, תקרית and ראיה. Product/legal review is required before wording capacity, ratios, document duties, payroll, camera rights or retention as law.

## Safety truthfulness

Design explicit unavailable, setup-required, readiness, degraded, verified-operational, incident-available, evidence-available and policy-no-recording states. Mock/shadow output and Track IDs cannot appear as verified incidents, Child identity, attendance or pickup authority.

## Finance truthfulness

Separate Parent tuition from platform subscription. Distinguish manual settlement, provider-confirmed payment, pending reconciliation, outstanding and provider unavailable. Operational labor cost is an estimate; never label it salary, payroll or statutory calculation.

## Empty / loading / error

Empty states provide a real authorized next action. Loading terminates. Section errors should preserve unrelated dashboard areas where feasible. Unavailable optional-provider actions are explained and disabled rather than simulated.

## Design system components

Reuse PremiumCard, MetricCard, StatusChip, ActionCard, DashboardGrid and EmptyState with the canonical shells. Extend them only when the approved reference requires a missing state; do not introduce a parallel component language.

## Screens requiring new visual reference

All P0/P1 design-priority families in the canonical surface map require approved mobile and desktop references. Safety/camera state families and Admin IA require additional state maps. Edge-state-only screens can share a reference system after the main role flows are approved.

## Suggested visual design batches

1. UX-01 Design system/global shell
2. UX-02 Owner onboarding
3. UX-03 Owner dashboard
4. UX-04 Children/detail/attendance/pickup
5. UX-05 Parent experience
6. UX-06 Staff candidate/employed experience
7. UX-07 Inspector experience
8. UX-08 Finance/subscription
9. UX-09 Messaging/notifications
10. UX-10 Documents
11. UX-11 Inspections/actions/complaints/Tasks
12. UX-12 Reports
13. UX-13 Safety/cameras
14. UX-14 Admin
15. UX-15 Settings/edge/empty/error states
16. UX-16 Mobile closure
17. UX-17 Accessibility/RTL/visual QA closure

## Implementation acceptance process

For each approved reference provide exact route, role, state, viewport, copy, component mapping, interactions and acceptance criteria. Implement on a scoped branch, validate authorization and domain regressions, then compare rendered output against the reference for layout, spacing, hierarchy, typography, icons, state truth, RTL, responsiveness and interaction. Visual completion requires rendered comparison, not source review alone.
