# DEMO AUTH SETUP 1 - Required Role Matrix

No real users, real child data, real parent data, live payments, parent camera viewing, live AI or production SMS/WhatsApp are allowed for these accounts.

| Account | Role | Purpose | Required account/profile status | Assignment state | Expected dashboard route | Required synthetic data | Forbidden data/features | Feature flags |
|---|---|---|---|---|---|---|---|---|
| demo_parent | parent | Parent dashboard, child card, enrollment, messages, payments/camera readiness | active profile; parent onboarding active | linked only to Child A / Kindergarten A | `/dashboard/parent` or `/dashboard/parent/family-home` | Child A, parent-child link, request/payment/camera/AI readiness | other children, raw AI, live camera, live payment | live-risk flags off |
| demo_manager | manager | Kindergarten manager dashboard and operations | active approved manager profile | assigned to Kindergarten A | `/dashboard/garden` | Kindergarten A, children, staff, enrollment, attendance, readiness states | Kindergarten B data, provider secrets, live charges | live-risk flags off |
| demo_staff_unassigned | staff | Staff unassigned/candidate state | active staff profile | no garden assignment | `/dashboard/staff` | profile only, optional job applications | child/parent data, garden internals | live-risk flags off |
| demo_staff_assigned | staff | Staff assigned dashboard | active staff profile and staff record | assigned to Kindergarten A | `/dashboard/staff` | shifts/tasks/messages/doc readiness | Kindergarten B, manager/admin UI | live-risk flags off |
| demo_inspector_unassigned | inspector | Inspector pending/unassigned state | inspector profile, no approved inspector record or inactive profile | no garden assignment | `/dashboard/inspector/apply` or `/dashboard/inspector` pending state | profile only | garden data, children, camera/AI details | live-risk flags off |
| demo_inspector_assigned | inspector | Assigned inspector dashboard | active inspector profile and inspector record | assigned to Kindergarten A | `/dashboard/inspector` | assigned garden, required inspection, history/readiness | unassigned gardens, provider secrets | live-risk flags off |
| demo_admin | admin | Admin dashboard and readiness/control center | active admin profile | platform admin | `/dashboard/admin` | users, approvals, providers, readiness states | provider secrets in UI, live activation | live-risk flags off |
| demo_digital_observer_admin | network_manager or authenticated observer owner | Digital Observer authenticated dashboard | active auth/profile | owner/member of synthetic observer site | `/digital-observer/dashboard` | standalone observer site, readiness camera/AI/billing states | Gan Batuach child data, live observer billing, live camera/AI | live-risk flags off |

All accounts are synthetic QA accounts only. Real data allowed: no. Live-risk features allowed: no.
