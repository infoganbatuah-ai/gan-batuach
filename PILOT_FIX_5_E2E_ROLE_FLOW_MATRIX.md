# PILOT FIX 5 - E2E Role Flow Matrix

Date: 2026-07-03

Scope: synthetic/demo/pilot-safe validation only. No real child, parent, document, payment, camera or AI data was created.

## Baseline

| Check | Result |
|---|---|
| Branch | `main` |
| Latest commit | `cf1c197 PILOT FIX 4 - Real Pilot Environment Separation, Seed/Test Accounts & Access Control` |
| Working tree before changes | clean |
| Typecheck baseline | PASS |
| Build baseline | PASS |
| `git diff --check` baseline | PASS |
| Capacitor note | `capacitor_sync_required_before_native_mobile_validation` remains true because responsive/layout work changed the web bundle before this phase |

## Status Legend

- `READY_BY_ROUTE`: route/API exists and builds.
- `PARTIAL`: route/API exists but requires real synthetic A/B data to prove behavior.
- `MANUAL_REQUIRED`: must be verified in Supabase/browser with the PILOT FIX 4 synthetic dataset.
- `BLOCKED_FOR_REAL_PILOT`: cannot be used for real users until RLS/legal/environment gates pass.
- `READY_FOR_SYNTHETIC_E2E`: safe to test with synthetic accounts only.

## Admin

| Flow | Route/API | Expected user | Required data | Expected result | Forbidden result | Status | Blocker |
|---|---|---|---|---|---|---|---|
| Login | `/login`, `/app/login` | `demo_admin` | admin profile | admin reaches dashboard | anonymous access to admin | READY_BY_ROUTE | manual account required |
| View pending managers | `/dashboard/admin/kindergarten-applications`, `/api/admin/kindergarten-approval` | admin | synthetic manager applications | approve/reject manager | exposing secrets | PARTIAL | synthetic application required |
| Approve inspector | `/dashboard/admin/inspector-applications`, `/api/admin/inspector-applications/[id]` | admin | synthetic inspector application | approve/reject inspector | unscoped client-only approval | PARTIAL | synthetic application required |
| Assign inspector | `/dashboard/admin/inspectors`, `/api/inspection-form-assignments` | admin | Kindergarten A + inspector A | assignment created | inspector sees unrelated garden | MANUAL_REQUIRED | RLS/browser test required |
| View pilot environment | `/dashboard/admin/pilot-center`, `/dashboard/admin/pilot-readiness`, `/dashboard/admin/demo-control` | admin | environment markers | demo/pilot labels visible | real environment ambiguity | PARTIAL | single pilot panel not confirmed |
| View provider modes | `/dashboard/admin/integrations`, `/dashboard/admin/provider-production`, `/api/admin/provider-readiness` | admin | env names only | readiness without secret values | secret display | READY_BY_ROUTE | credentials not configured |
| View support/incident status | `/dashboard/admin/incident-center`, `/dashboard/admin/system-health` | admin | synthetic support items | incident/support status visible | hidden critical blocker | PARTIAL | support owner manual setup |

## Kindergarten Manager

| Flow | Route/API | Expected user | Required data | Expected result | Forbidden result | Status | Blocker |
|---|---|---|---|---|---|---|---|
| Register | `/register`, `/app/register/kindergarten`, `/api/garden/manager-application` | `demo_manager_a` | synthetic account | pending state created | immediate full access before approval | PARTIAL | manual account/application |
| Pending approval | `/onboarding/kindergarten`, `/dashboard/garden` | manager A | pending garden/profile | clear waiting state | active management before approval | MANUAL_REQUIRED | status fixtures required |
| Complete kindergarten card | `/onboarding/kindergarten`, `/dashboard/garden/settings` | approved manager A | Kindergarten A | profile/onboarding updates | updates Kindergarten B | MANUAL_REQUIRED | A/B dataset required |
| Define city/classes/pricing | `/dashboard/garden/onboarding`, `/dashboard/garden/finance`, `/api/garden/fee-groups` | manager A | Kindergarten A | settings stored for A | cross-garden pricing change | MANUAL_REQUIRED | A/B dataset required |
| Subscription state | `/dashboard/garden/subscription`, `/api/garden/subscription` | manager A | subscription readiness | manual/sandbox/demo/freeze visible | fake live success | READY_BY_ROUTE | provider credentials absent |
| Invite staff/parents | `/api/garden/create-staff`, `/api/garden/create-parent` | manager A | synthetic contacts | scoped invites | production external send | PARTIAL | provider mode must stay mock/test |
| Approve enrollments | `/dashboard/garden/enrollment-requests`, `/api/garden/enrollment-requests/[id]` | manager A | Parent A request | approve Child A only | approve Child B/Garden B | MANUAL_REQUIRED | A/B request required |
| Manage children/attendance/messages/docs | `/dashboard/garden/children`, `/dashboard/garden/attendance`, `/dashboard/garden/messages`, `/dashboard/garden/documents` | manager A | Garden A records | Garden A only | Garden B records | MANUAL_REQUIRED | RLS/browser test required |
| Camera/AI readiness | `/dashboard/garden/cameras`, `/dashboard/garden/ai-events` | manager A | Garden A readiness | no raw secrets; internal readiness | parent viewing activation | PARTIAL | camera/AI policy gates |

## Parent

| Flow | Route/API | Expected user | Required data | Expected result | Forbidden result | Status | Blocker |
|---|---|---|---|---|---|---|---|
| Register | `/register`, `/app/register/parent` | `demo_parent_a` | synthetic account | parent profile/onboarding | real child data | PARTIAL | manual account required |
| Create child | `/parent-onboarding`, `/api/parent/child-registration`, `/api/parent/child-profiles` | parent A | Child A synthetic | Child A linked to Parent A | Child B visibility | MANUAL_REQUIRED | A/B data required |
| Discover kindergarten | `/dashboard/parent/discover-kindergartens`, `/kindergarten-directory` | parent A | public Garden A/B | public listings only | private garden children | READY_BY_ROUTE | none for synthetic |
| Submit enrollment | `/api/parent/enrollment-requests`, `/api/parent/child-requests` | parent A | Child A + Garden A | pending request | request to unrelated parent | MANUAL_REQUIRED | A/B data required |
| View approved relationship | `/dashboard/parent/family-home`, `/dashboard/parent/schedule`, `/dashboard/parent/messages` | parent A | approved enrollment | parent-facing data only | raw AI/provider/platform records | MANUAL_REQUIRED | RLS/browser test required |
| Camera/payment/readiness states | `/dashboard/parent/cameras`, `/dashboard/parent/payments`, `/dashboard/parent/ai-events` | parent A | readiness records | unavailable/readiness/human-reviewed only | raw camera/AI | MANUAL_REQUIRED | gates not live |

## Child Enrollment

| Flow | Route/API | Expected user | Required data | Expected result | Forbidden result | Status | Blocker |
|---|---|---|---|---|---|---|---|
| Child unassigned | parent child APIs | parent A | Child A | child exists without active garden | visible to Manager B | MANUAL_REQUIRED | synthetic child required |
| Request pending | parent enrollment APIs | parent A + manager A | request A->Garden A | Manager A sees pending | Manager B sees pending | MANUAL_REQUIRED | A/B request required |
| Manager approve/reject | garden enrollment API | manager A | request | Child A state changes | Child B affected | MANUAL_REQUIRED | A/B request required |
| Transfer blocked | child transfer APIs | parent/manager | Child already assigned | no automatic transfer | silent cross-garden transfer | MANUAL_REQUIRED | transfer fixture required |

## Staff

| Flow | Route/API | Expected user | Required data | Expected result | Forbidden result | Status | Blocker |
|---|---|---|---|---|---|---|---|
| Register/unassigned | `/app/register/staff`, `/dashboard/staff`, `/dashboard/staff/job-market` | staff unassigned | staff profile without garden | unassigned/job state | child data before approval | PARTIAL | manual account required |
| Application/invitation | `/api/staff/job-applications`, `/api/garden/staff/[id]/approve` | staff + manager A | staff application | assignment approval | Garden B assignment by Manager A | MANUAL_REQUIRED | A/B application required |
| Assigned dashboard | `/dashboard/staff`, `/dashboard/staff/attendance`, `/dashboard/staff/tasks`, `/dashboard/staff/messages` | staff assigned A | staff.garden_id=A | Garden A work context | Garden B/payment/provider | MANUAL_REQUIRED | RLS/browser test required |
| Documents | `/dashboard/staff/documents`, `/api/staff/certificates` | staff assigned A | synthetic documents | own/staff-allowed docs | child/private docs outside policy | MANUAL_REQUIRED | storage policy test |

## Inspector

| Flow | Route/API | Expected user | Required data | Expected result | Forbidden result | Status | Blocker |
|---|---|---|---|---|---|---|---|
| Register/pending | `/join-inspector`, `/dashboard/inspector/apply`, `/api/inspector/applications` | inspector unassigned | inspector profile | pending/unassigned state | garden data before approval | PARTIAL | manual account required |
| Admin approval + assignment | `/dashboard/admin/inspector-applications`, `/dashboard/admin/inspectors` | admin + inspector A | assignment to Garden A | assigned only to A | Garden B visibility | MANUAL_REQUIRED | A/B data required |
| Inspection flow | `/dashboard/inspector/inspections`, `/api/inspections`, `/api/inspections/[id]/submit` | inspector assigned A | form + Garden A | start/fill/report | unassigned Garden B inspection | MANUAL_REQUIRED | inspection fixture required |
| Evidence/finding/report | `/dashboard/inspector/reports`, `/dashboard/inspector/violations` | inspector assigned A | synthetic evidence | scoped findings | provider/payment/camera secrets | MANUAL_REQUIRED | storage/RLS test |

## Digital Observer

| Flow | Route/API | Expected user | Required data | Expected result | Forbidden result | Status | Blocker |
|---|---|---|---|---|---|---|---|
| Public/onboarding | `/digital-observer`, `/digital-observer/onboarding` | demo DO user | synthetic site | separated product wording | Gan Batuach child data | READY_BY_ROUTE | manual account if gated |
| Dashboard/site/camera status | `/digital-observer/dashboard`, `/digital-observer/sites`, `/digital-observer/cameras` | DO admin | DO test site | DO site/readiness only | kindergarten child data leakage | MANUAL_REQUIRED | DO synthetic site required |
| Billing/readiness | `/digital-observer/billing`, admin DO pages | DO admin/admin | synthetic billing | separate billing stream | Gan Batuach subscription merge | PARTIAL | provider not live |

## Pilot Flow Decision

Static route/build validation is successful. Real role-flow validation against live Supabase data remains manual because the required A/B synthetic dataset and accounts were not created or executed in this phase.

Current flow status: **READY_FOR_SYNTHETIC_E2E / READY_FOR_PILOT_FIX_6_PREP**

Real parent/child onboarding remains blocked.
