# PHASE 190C Existing Feature Preservation Inventory

Date: 2026-06-15

Scope: preserve existing Gan Batuach and Digital Observer product surface while improving the unified app-like entry and shell experience.

## Public Website Routes
- `/` - preserved, unchanged marketing route, needs QA
- `/book-demo` - preserved, unchanged, needs QA
- `/join-kindergarten` - preserved, unchanged, needs QA
- `/parents` - preserved, unchanged, needs QA
- `/parents-demand` - preserved, unchanged, needs QA
- `/kindergarten-directory` - preserved, unchanged, needs QA
- `/safety-standard` - preserved, unchanged, needs QA
- `/why-gan-batuach` - preserved, unchanged, needs QA
- `/case-studies` - preserved, unchanged, needs QA
- `/compliance-trust` - preserved, unchanged, needs QA
- `/parent-portal` - preserved, unchanged, needs QA
- `/ai-observer` - preserved, unchanged, needs QA

## Login / Register / App Entry
- `/login` - preserved, app-like auth surface already present, updated only if safe
- `/register` - preserved, self-service role selection already present, updated only if safe
- `/app` - added as app gateway, wraps existing login/register/browser continuation flow
- Existing invitation-based login/register paths - preserved, manual review required in deeper QA

## Parent Dashboard Routes
- `/dashboard/parent` - preserved, wrapped in existing dashboard shell, self-service unassigned state present
- `/dashboard/parent/discover-kindergartens` - preserved, public-safe discovery, needs QA
- `/dashboard/parent/family-home` - preserved, wrapped in app shell, needs QA
- `/dashboard/parent/children/[id]` - preserved, sensitive child route, manual review required
- `/dashboard/parent/children/[id]/timeline` - preserved, sensitive timeline route, manual review required
- `/dashboard/parent/payments` - preserved, payment-sensitive route, manual review required
- `/dashboard/parent/documents` - preserved, document-sensitive route, manual review required
- `/dashboard/parent/cameras` - preserved, camera-sensitive route, manual review required
- `/dashboard/parent/messages`, `/notifications`, `/settings`, `/pickup`, `/complaints`, `/inspections`, `/trust-center` - preserved, needs QA

## Kindergarten Manager Routes
- `/onboarding/kindergarten` - preserved, manager self-service onboarding, needs QA
- `/dashboard/garden` - preserved, wrapped in app shell, needs QA
- `/dashboard/garden/command-center` - preserved, manager app home, needs QA
- `/dashboard/garden/enrollment-requests` - preserved, sensitive approval route, manual review required
- `/dashboard/garden/staff-applications` - preserved, sensitive approval route, manual review required
- `/dashboard/garden/children`, `/parents`, `/staff`, `/documents`, `/finance`, `/subscription` - preserved, sensitive routes, manual review required
- `/dashboard/garden/cameras`, `/observer-pilot`, `/vision-ai`, `/ai-events` - preserved, camera/AI-sensitive routes, manual review required
- `/dashboard/garden/inspections`, `/compliance`, `/trust-center`, `/settings` - preserved, needs QA

## Staff Routes
- `/dashboard/staff` - preserved, wrapped in app shell, self-service unassigned state present
- `/dashboard/staff/job-market` - preserved, public-safe job discovery, needs QA
- `/dashboard/staff/operations`, `/attendance`, `/child-journal`, `/incidents`, `/tasks` - preserved, sensitive after approval, manual review required
- `/dashboard/staff/documents`, `/background`, `/certificates`, `/settings` - preserved, document-sensitive routes, manual review required
- `/dashboard/staff/messages`, `/notifications`, `/shifts`, `/cameras` - preserved, needs QA/manual review for camera route

## Inspector Routes
- `/dashboard/inspector` - preserved, wrapped in app shell, pending state present
- `/dashboard/inspector/apply` - preserved, candidate application route, needs QA
- `/dashboard/inspector/control-center`, `/command-center`, `/inspections`, `/violations`, `/reports`, `/tasks` - preserved, assignment-sensitive routes, manual review required
- `/dashboard/inspector/cameras`, `/ai-events`, `/observer-pilot`, `/risk` - preserved, camera/AI-sensitive routes, manual review required

## Admin Routes
- `/dashboard/admin` - preserved, wrapped in app shell
- `/dashboard/admin/requests` - preserved, request overview, needs QA
- `/dashboard/admin/kindergarten-applications` - preserved, manager approval/subscription readiness, needs QA
- `/dashboard/admin/inspector-applications` - preserved, inspector approval, needs QA
- `/dashboard/admin/final-production-launch`, `/company-operations`, `/external-validation` - preserved, needs QA
- Broad admin modules under `/dashboard/admin/*` - preserved, unchanged unless explicitly noted, needs QA
- Admin payment, provider, security, document, camera, AI and RLS-adjacent modules - preserved, manual review required

## Digital Observer Routes
- `/digital-observer` - preserved as public product/marketing surface
- `/digital-observer/dashboard` - preserved, should remain generic observer language, needs QA
- `/digital-observer/onboarding` - preserved, needs QA
- `/digital-observer/pricing`, `/request-demo`, `/start`, `/trust`, `/sites`, `/cameras`, `/alerts`, `/billing`, `/settings` - preserved, needs QA

## Payment / Subscription Routes
- `/dashboard/admin/billing`, `/dashboard/admin/subscriptions` - preserved, manual review required
- `/dashboard/garden/finance`, `/dashboard/garden/subscription` - preserved, manual review required
- `/dashboard/parent/payments` - preserved, manual review required
- `/digital-observer/billing` - preserved, manual review required

## Documents / Medical / Sensitive Data
- Parent/garden/staff/admin document routes - preserved, manual review required
- Child profile and medical data routes - preserved, manual review required
- No RLS, encryption, storage or document permission changes are planned in this phase.

## Inspections / Camera / AI
- Inspection routes across admin/garden/inspector/parent - preserved, manual review required
- Camera routes across admin/garden/parent/staff/inspector and Digital Observer - preserved, manual review required
- AI/Observer routes - preserved, manual review required
- No camera gateway or AI core logic changes are planned in this phase.

## QA / Roadmap / 190A / 190B Assets
- `QA_1_CORE_PRODUCT_SMOKE_TEST_REPORT.md` - preserved
- `QA_2_FULL_USER_JOURNEY_QA_REPORT.md` - preserved
- `SELF_SERVICE_USER_REGISTRATION_AFFILIATION_REQUESTS_AND_ROLE_BASED_ACCESS_COMPLETION.md` - preserved
- `KINDERGARTEN_MANAGER_SELF_SERVICE_ONBOARDING_ADMIN_APPROVAL_AND_SUBSCRIPTION_ACTIVATION.md` - preserved

## Phase 190C Change Plan
- Preserve public marketing website.
- Add `/app` gateway.
- Add clear public button: "כניסה למערכת".
- Keep existing auth and invitation logic.
- Improve shared app shell presentation without replacing dashboard content.
- Add documentation/report for QA handoff.
