# DEMO AUTH SETUP 1 - Role Dashboard Route Verification

Build output confirms all listed dashboard routes exist.

| Role | Login route | Post-login redirect logic | Dashboard route | Secondary QA routes | Unauthenticated behavior | Wrong-role behavior | Route exists | Blocker |
|---|---|---|---|---|---|---|---|---|
| Parent | `/app/login` or `/login` | `dashboardPathForProfile` | `/dashboard/parent` or `/dashboard/parent/family-home` | children, messages, payments, cameras, schedule | redirect to login | route guard / data scope | yes | credentials/session switching only |
| Manager | `/app/login` or `/login` | manager with `garden_id` -> `/dashboard/garden`; without -> onboarding | `/dashboard/garden` | children, staff, finance, cameras, enrollment | redirect to login | requireRole manager/owner | yes | credentials/session switching |
| Staff | `/app/login` or `/login` | staff -> `/dashboard/staff` or `/onboarding/staff` if incomplete | `/dashboard/staff` | attendance, shifts, tasks, documents | redirect to login | requireRole staff | yes | unassigned user missing until setup |
| Inspector | `/app/login` or `/login` | inspector -> `/dashboard/inspector`; unapproved/no inspector -> `/dashboard/inspector/apply` | `/dashboard/inspector` | apply, inspections, reports, tasks | redirect to login | requireRole inspector | yes | unassigned user missing until setup |
| Admin | `/app/login` or `/login` | admin -> `/dashboard/admin` | `/dashboard/admin` | users, approvals, provider health, camera/AI ops | redirect to login | requireRole/admin policies | yes | credentials/session switching |
| Digital Observer | `/app/login` or `/login` | normal auth; direct route is `/digital-observer/dashboard` | `/digital-observer/dashboard` | onboarding, sites, billing | redirect to login | site membership/data scope | yes | DO user/site missing until setup |

Small route fix applied: `/api/auth/logout` now supports safe GET redirect logout for browser-based session switching.
