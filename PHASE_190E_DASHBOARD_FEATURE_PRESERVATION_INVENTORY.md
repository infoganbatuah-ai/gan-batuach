# PHASE 190E - Dashboard Feature Preservation Inventory

Status: completed for app-shell/dashboard organization pass.

Scope: preserve all existing Gan Batuach and Digital Observer dashboard modules while improving the shared app-like dashboard shell. This phase did not change RLS, authentication, payment logic, camera gateway logic, AI logic, medical data access or sensitive document access.

## Shared App Shell

| Area | Status | Notes |
| --- | --- | --- |
| DashboardShell | preserved + wrapped in app shell | Role-aware title, role status, notifications, logout, back/home behavior and mobile bottom navigation remain. Added explicit Home/Profile quick links and a unified content stage. |
| Mobile navigation | preserved | Existing role-specific mobile tabbar remains active for parent, manager, staff, inspector, admin and network manager roles. |
| Desktop sidebar | preserved | Existing grouped role navigation remains. Detailed modules stay reachable from sidebar links. |
| Notifications/messages entry | preserved | NotificationBell remains in the shared header. |
| Profile/settings entry | moved into quick action | Added role-aware profile link to the shared header. |
| Logout | preserved | Existing LogoutButton remains in sidebar and header. |
| AI assistant / feedback widgets | preserved | Existing role-aware panels remain after page content. |

## Parent Dashboard Modules

| Module | Status | Notes |
| --- | --- | --- |
| Parent home `/dashboard/parent` | preserved | Self-registered/unassigned state remains app-like with child profile, kindergarten discovery and request status. |
| Family home `/dashboard/parent/family-home` | preserved | Existing active-family home remains the main parent app home when linked. |
| Child profile cards | preserved | Child detail and timeline routes remain accessible. |
| Kindergarten discovery | preserved | `/dashboard/parent/discover-kindergartens` remains the public-safe discovery route. |
| Enrollment/request status | preserved | Parent request surfaces remain connected through parent and garden request routes. |
| Messages/notifications | preserved | Parent message and notification routes remain in navigation. |
| Documents/payments/pickup/gallery | preserved | Detailed routes remain reachable as secondary app sections. |
| Cameras / AI safety updates | preserved | Existing routes remain; no camera or AI permission logic was changed. |

## Kindergarten Manager Dashboard Modules

| Module | Status | Notes |
| --- | --- | --- |
| Garden landing `/dashboard/garden` | preserved | Continues redirecting to the command center or onboarding according to existing lifecycle. |
| Command center | preserved | App-like home with metrics, daily focus, quick actions, alerts, workflow queue and module cards. |
| Children | preserved | Full children list and child detail pages remain accessible. |
| Parent requests | preserved | Enrollment requests remain in `/dashboard/garden/enrollment-requests`. |
| Staff and staff applications | preserved | Staff management and candidate review routes remain accessible. |
| Documents/compliance | preserved | Compliance and document routes remain as detailed secondary sections. |
| Inspections | preserved | Inspection status, reports and detailed inspection routes remain accessible. |
| Payments/subscription/finance | preserved | Finance/subscription routes remain untouched; no payment logic changed. |
| Cameras / observer intelligence | preserved | Camera, observer pilot, observer intelligence and risk routes remain accessible. |
| Messages/notifications/tasks | preserved | Operational communication and task routes remain accessible. |

## Staff Dashboard Modules

| Module | Status | Notes |
| --- | --- | --- |
| Staff home `/dashboard/staff` | preserved | Unassigned candidate and assigned staff states remain. |
| Staff operations | preserved | `/dashboard/staff/operations` remains the shift/task-oriented home. |
| Job market | preserved | Candidate job discovery remains in `/dashboard/staff/job-market`. |
| Attendance/shifts | preserved | Shift and attendance routes remain accessible. |
| Child journal/incidents | preserved | Daily child update and incident reporting routes remain accessible after approval. |
| Documents/settings/background/certificates | preserved | Staff private document/profile surfaces remain untouched. |
| Messages/notifications/tasks | preserved | Staff communication and task routes remain available. |
| Cameras | preserved | Existing staff camera route remains; no access logic changed. |

## Inspector Dashboard Modules

| Module | Status | Notes |
| --- | --- | --- |
| Inspector home `/dashboard/inspector` | preserved | Pending application and approved inspector states remain app-like. |
| Application `/dashboard/inspector/apply` | preserved | Candidate application route remains. |
| Control/command center | preserved | Inspection workforce command routes remain accessible. |
| Assigned gardens and inspections | preserved | Inspection routes, due/history pages and reports remain accessible. |
| Violations/compliance/risk | preserved | Detailed safety and risk routes remain accessible. |
| Cameras / observer pilot / AI events | preserved | Existing routes remain; no camera or AI permissions changed. |
| Tasks/notifications/settings | preserved | Inspector operational routes remain reachable. |

## Admin Dashboard Modules

| Module | Status | Notes |
| --- | --- | --- |
| Admin home `/dashboard/admin` | preserved | App-like operations home remains structured into approvals, metrics, health and quick actions. |
| Requests and applications | preserved | `/dashboard/admin/requests`, kindergarten applications and inspector applications remain accessible. |
| Kindergarten operations | preserved | Kindergarten activation, analytics, city/status and full kindergarten pages remain. |
| Billing/subscriptions/providers | preserved | Payment/provider dashboards remain untouched. |
| Security, QA and external validation | preserved | Security center, QA, external validation and final launch dashboards remain. |
| Camera/AI/observer admin | preserved | Camera gateway, observer core, AI governance and Digital Observer admin dashboards remain. |
| Mobile/app-store dashboards | preserved | Mobile release/submission/audit pages remain. |
| Company operations | preserved | Final production launch and company operations dashboards remain. |
| Detailed tables | preserved | Large admin tables remain available as secondary/detail views. |

## Digital Observer Dashboard Modules

| Module | Status | Notes |
| --- | --- | --- |
| Public product page `/digital-observer` | unchanged | Public Digital Observer surface remains marketing/product style. |
| Dashboard `/digital-observer/dashboard` | preserved | Standalone observer owner dashboard remains product-specific and app-like. |
| Onboarding `/digital-observer/onboarding` | preserved | Setup/onboarding route remains. |
| Sites/cameras/alerts/settings/billing | preserved | Existing standalone routes remain. |
| Gan Batuach separation | preserved | Dashboard copy continues to separate standalone observer sites from Gan Batuach kindergarten data. |

## Payments, Documents, Children, Inspections, Camera, AI

| Area | Status | Notes |
| --- | --- | --- |
| Payment/subscription modules | not touched | Routes remain reachable; no payment/subscription business rules changed. |
| Parent tuition separation | not touched | No billing stream logic changed. |
| Sensitive documents | not touched | No document permissions, storage or signed URL logic changed. |
| Medical/child data | not touched | No child, medical note or parent-child access logic changed. |
| Inspections | preserved | Inspector, manager and admin inspection routes remain accessible. |
| Camera gateway | not touched | No camera credential/token/gateway logic changed. |
| AI observer | not touched | No AI capability, review or visibility logic changed. |

## QA Notes

- Needs QA: visual route check for `/dashboard/parent`, `/dashboard/garden`, `/dashboard/staff`, `/dashboard/inspector`, `/dashboard/admin`, `/digital-observer/dashboard`.
- Needs QA: mobile shell spacing after adding Home/Profile quick links.
- Manual review required: none introduced by this phase.
