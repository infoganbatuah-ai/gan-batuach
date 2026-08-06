# AUTH ACCESS FIX 1 - Role Dashboard Route Map

## Login Routes

- Public login: `/login`
- App login: `/app/login`
- Logout: visible `התנתקות` button, backed by POST `/api/auth/logout`

## Role Routes

| Role | Expected post-login redirect | Primary dashboard | Secondary QA routes | Guard behavior |
|---|---|---|---|---|
| Parent | `/dashboard/parent/family-home` if onboarding active | `/dashboard/parent` | `/dashboard/parent/messages`, `/dashboard/parent/payments`, `/dashboard/parent/cameras`, `/dashboard/parent/discover-kindergartens`, `/dashboard/parent/schedule` | unauthenticated redirects to login; non-parent should redirect/deny |
| Manager | `/dashboard/garden` or `/onboarding/kindergarten` depending approval/onboarding | `/dashboard/garden` | `/dashboard/garden/children`, `/dashboard/garden/enrollment-requests`, `/dashboard/garden/staff`, `/dashboard/garden/finance`, `/dashboard/garden/cameras` | manager/owner only |
| Staff | `/dashboard/staff` or `/onboarding/staff` depending approval | `/dashboard/staff` | `/dashboard/staff/attendance`, `/dashboard/staff/shifts`, `/dashboard/staff/tasks`, `/dashboard/staff/messages`, `/dashboard/staff/documents` | staff only |
| Inspector | `/dashboard/inspector` or `/dashboard/inspector/apply` | `/dashboard/inspector` | `/dashboard/inspector/control-center`, `/dashboard/inspector/inspections`, `/dashboard/inspector/reports`, `/dashboard/inspector/cameras` | inspector only |
| Admin | `/dashboard/admin` | `/dashboard/admin` | `/dashboard/admin/users`, `/dashboard/admin/provider-readiness`, `/dashboard/admin/cameras`, `/dashboard/admin/ai-events`, `/dashboard/admin/pilot-readiness` | admin only |
| Digital Observer | product route; auth status must be confirmed | `/digital-observer/dashboard` | `/digital-observer/onboarding`, `/digital-observer/sites`, `/digital-observer/cameras`, `/digital-observer/billing` | account/scoping not confirmed |

## Known Blockers

- Dedicated unassigned staff/inspector accounts need confirmation or creation.
- Digital Observer authenticated account needs confirmation.
- QA 2 must use isolated sessions or manual logout/login per role.

