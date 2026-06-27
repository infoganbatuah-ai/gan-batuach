# RESPONSIVE 1 - Surface Inventory

Date: 2026-06-27

Breakpoints used for QA:

- Mobile: up to 480px
- Large mobile: 481-640px
- Tablet: 641-1024px
- Desktop: 1025px+
- Wide desktop: 1440px+

## Public Surfaces

| Surface | Route | Shell | Mobile | Tablet | Desktop | Risk | Priority |
|---|---|---|---|---|---|---|---|
| Homepage | `/` | Public marketing | Needs screenshot QA | Needs screenshot QA | Needs screenshot QA | CTA rows, hero width, mobile public tabs | High |
| App gateway | `/app` | Auth/app | Stabilized by global safe-area | Stabilized | Stabilized | buttons under public tabs | High |
| Login | `/login`, `/app/login` | Auth/app | Stabilized by form/dialog rules | Stabilized | Stabilized | keyboard, submit visibility | High |
| Register | `/register`, `/app/register` | Auth/app | Stabilized by single-column mobile grids | Stabilized | Stabilized | role cards wrapping | High |
| Role pages | `/parents`, `/staff`, `/join-kindergarten`, `/join-inspector` | Public | Needs screenshot QA | Needs screenshot QA | Needs screenshot QA | card grids and CTAs | Medium |
| Kindergarten directory | `/kindergarten-directory`, `/gardens` | Public | Stabilized by responsive tables/cards guard | Stabilized | Stabilized | filters and cards | High |
| Digital Observer public | `/digital-observer` | Public | Needs screenshot QA | Needs screenshot QA | Needs screenshot QA | product CTAs and wide sections | Medium |

## Authenticated Main Surfaces

| Surface | Route | Shell | Mobile | Tablet | Desktop | Risk | Priority |
|---|---|---|---|---|---|---|---|
| Parent dashboard | `/dashboard/parent` | DashboardShell + ParentAppFrame | Bottom-nav padding stabilized | 2-column tablet guard | centered desktop guard | bottom nav overlap, child selector | High |
| Kindergarten manager dashboard | `/dashboard/garden` | DashboardShell/Teacher frame | Bottom-nav padding stabilized | 2-column tablet guard | max-width guard | card grids, fixed module screens | High |
| Staff dashboard | `/dashboard/staff` | StaffAppFrame | Bottom-nav padding stabilized | 2-column tablet guard | centered frame | candidate state, attendance buttons | High |
| Inspector dashboard | `/dashboard/inspector` | InspectorAppFrame | Bottom-nav padding stabilized | 2-column tablet guard | max-width guard | metric grids, long cards | High |
| Admin dashboard | `/dashboard/admin` | Admin app/shell variants | Table/dialog guard added | table scroll/card guard | max-width guard | tables, drawers, data walls | High |
| Digital Observer dashboard | `/digital-observer/dashboard` | Digital Observer dashboard | responsive guard added | guard added | guard added | site/camera cards, billing panels | Medium |

## Critical Modules

| Module | Routes | Current responsive handling | Known risk | Priority |
|---|---|---|---|---|
| Children list/profile | `/dashboard/garden/children`, `/dashboard/garden/children/[id]` | global grid/table/form guard | dense child cards and profile forms | High |
| Add child / parent onboarding | `/parent-onboarding`, parent registration routes | mobile form guard | keyboard and submit area | High |
| Enrollment requests | `/dashboard/garden/enrollment-requests`, `/dashboard/parent/discover-kindergartens` | list/card guard | long action rows | High |
| Attendance | `/dashboard/garden/attendance`, `/dashboard/staff/attendance` | bottom-nav and button wrapping guard | wide attendance controls | High |
| Schedule/daily journal | `/dashboard/parent/schedule`, `/dashboard/garden/daily-journal` | grid and overflow guard | calendar rows | Medium |
| Messages | role message routes | table/list and form guard | compose form under nav | High |
| Payments/subscriptions | `/dashboard/parent/payments`, `/dashboard/garden/subscription`, admin billing | table and action guard | provider tables and CTA rows | High |
| Documents/uploads | role document routes | dialog/upload guard | upload dialogs and file rows | High |
| Staff management | `/dashboard/garden/staff`, `/dashboard/garden/staff-applications` | table/card guard | staff rows and filters | High |
| Inspection form/report | inspector/admin/garden inspection routes | form/action/report guard | long form and signature area | High |
| Camera pages | role camera routes | playback grids and bottom safe-area guard | token action under nav | High |
| AI/review queue | AI event/review routes | table/card/dialog guard | review action columns | High |
| Admin approvals | admin application/requests routes | table/dialog guard | approve/reject rows | High |
| Provider health | admin integrations/provider routes | table/dialog guard | wide provider status tables | Medium |
| Reports/analytics | report routes | table/chart container guard | charts and tables overflow | High |

## Summary

The most urgent responsive risks were global rather than single-route problems:

- floating bottom navigation covering long content
- fixed-width tables/cards overflowing mobile
- dialogs/drawers trapping content under headers or bottom nav
- desktop app pages stretching too wide
- no way to preview mobile layout from desktop

RESPONSIVE 1 added centralized CSS and a local mobile-preview mode to address these without changing business logic.
