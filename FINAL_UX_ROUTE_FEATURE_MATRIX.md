# Final UX Route Feature Matrix

RESCUE 1 inventory date: 2026-06-23  
Scope: public, auth, internal dashboards, Digital Observer and API/action surfaces.  
Rule: preserve all existing routes, features, data sources and actions. This matrix records the current state before final visual migration.

## Route Counts

| Area | Count |
| --- | ---: |
| Public/core app pages | 9 |
| `/app` auth/app gateway pages | 7 |
| Kindergarten manager dashboard pages | 47 |
| Parent dashboard pages | 21 |
| Staff dashboard pages | 16 |
| Inspector dashboard pages | 19 |
| Admin dashboard pages | 140 |
| Digital Observer pages | 14 |
| API routes | 170 |

## Public Website

| Route | Role | Current shell/wrapper | Current data source | Actions/API used | Final reference category | Current visual state | Functional status | Migration status | Preserved features |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | public | public marketing page | static/public content | public CTAs | 01-public-site | informational website | preserved | keep public surface | brand, CTAs, public copy |
| `/parents` | public | public marketing page | static/public content | public CTAs | 01-public-site | informational | preserved | keep public surface | parent value proposition |
| `/parents-demand` | public | public form + `premium-step-form` legacy class | lead action | lead submission | 01-public-site | public form, legacy auth/card styling | preserved | migrate later to auth/public DS | parent demand lead |
| `/kindergarten-directory` | public/parent | public directory | public-safe garden data | `/api/gardens` where used | 01-public-site | website-like directory | preserved | keep public-safe, later align cards | public-safe garden listing |
| `/safety-standard` | public | public content | static/public content | CTAs | 01-public-site | informational | preserved | keep public surface | safety copy |
| `/book-demo` | public | public form + legacy premium step form | server action | demo booking | 01-public-site | works, legacy form style | preserved | migrate later | demo booking |
| `/join-kindergarten` | public/manager lead | public lead form | server action | create garden lead | 01-public-site / onboarding | works, legacy form style | preserved | migrate later | manager lead intake |
| `/digital-observer` | public Digital Observer | public product page | static/product content | CTAs | Digital Observer public | marketing/product | preserved | keep separate product style | Digital Observer offer |
| `/service-charter`, `/case-studies`, `/compliance-trust`, `/ai-observer` | public/support | public pages | static content | CTAs | public/support | mixed legacy cards | preserved | later visual pass | informational support pages |

## Auth And App Gateway

| Route | Role | Current shell/wrapper | Current data source | Actions/API used | Final reference category | Current visual state | Functional status | Migration status | Preserved features |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/app` | unauthenticated/app gateway | app gateway | static config | links to auth | 00-brand / app gateway | app-like | preserved | baseline-compatible | browser continuation, app placeholder |
| `/app/login` | unauthenticated | approved auth app screen | Supabase auth | login action/API | 02-auth | approved Auth/Brand baseline | preserved | keep as baseline | login, forgot/register links |
| `/app/register` | unauthenticated | role card auth screen | self-service config | role links | 02-auth | app-like | preserved | continue DS migration | role selection |
| `/app/register/parent` | parent candidate | app auth role form | self-service register | `/api/self-service/register` | 02-auth | app-like form | preserved | verify data truth | parent self-service registration |
| `/app/register/kindergarten` | manager candidate | app auth role form | self-service/onboarding | `/api/self-service/register`, onboarding route | 02-auth | app-like form | preserved | verify lifecycle copy | manager registration |
| `/app/register/staff` | staff candidate | app auth role form | self-service register | `/api/self-service/register` | 02-auth | app-like form | preserved | verify staff flow | staff registration |
| `/app/register/inspector` | inspector candidate | app auth role form | self-service register | `/api/self-service/register` | 02-auth | app-like form | preserved | verify inspector flow | inspector registration |
| `/login`, `/register` | compatibility | safe redirects/wrappers where present | auth | auth routes | 02-auth | compatibility | preserved | keep compatible with invite flows | legacy auth entry |
| `/auth/callback` | auth callback | route handler | Supabase | callback route | auth infrastructure | non-visual | preserved | no UX work | auth callback |

## Kindergarten Manager

| Route group | Role | Current shell/wrapper | Current data source | Actions/API used | Final reference category | Current visual state | Functional status | Migration status | Preserved features |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/dashboard/garden` | manager/owner | approved Ganenet dashboard UI | Supabase/profile/garden queries | dashboard links | 03-teacher-dashboard | approved Dashboard baseline | preserved | keep as dashboard baseline | KPI, schedule, updates, quick actions |
| `/dashboard/garden/attendance` | manager/owner | Gan Batuach DS after recent refactor | attendance/children data | `/api/garden/attendance-action`, `/api/attendance` | 03-teacher-dashboard | aligned with baseline | preserved | continue QA | check-in/out, child attendance cards |
| `/dashboard/garden/cameras` | manager/owner | mixed new card UI | camera streams/snapshots | camera stream APIs | 03-teacher-dashboard | mostly new, needs duplicate-camera cleanup | preserved | migrate/QA | camera gallery, add camera, status |
| `/dashboard/garden/schedule`, `/daycare`, `/children`, `/children/*` | manager/owner | mixed DashboardShell/new DS | children/schedule DB | child/schedule APIs | 03-teacher-dashboard | partially migrated | preserved | migrate screen-by-screen | child management, daily schedule |
| `/dashboard/garden/messages`, `/notifications`, `/communication` | manager/owner | mixed app cards/DashboardShell | messages/notifications | message/notification APIs | 03-teacher-dashboard | partially migrated | preserved | migrate later | parent communication |
| `/dashboard/garden/payments`, `/subscription`, `/payout`, `/fee-groups` | manager/owner | mixed DashboardShell | payments/subscription DB | garden payment/subscription APIs | 03-teacher-dashboard | legacy/mixed | preserved | do not alter payment logic | Gan Batuach subscription, tuition readiness |
| `/dashboard/garden/staff`, `/staff-applications`, `/job-openings` | manager/owner | mixed DashboardShell | staff/application DB | staff APIs | 03-teacher-dashboard | legacy/mixed | preserved | migrate later | staff approval and management |
| `/dashboard/garden/documents`, `/reports`, `/inspections`, `/incidents` | manager/owner | DashboardShell or mixed | documents/inspection DB | document/inspection APIs | 03-teacher-dashboard | legacy/mixed | preserved | migrate later | documents, reports, incident flow |

## Parent

| Route group | Role | Current shell/wrapper | Current data source | Actions/API used | Final reference category | Current visual state | Functional status | Migration status | Preserved features |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/dashboard/parent` | parent | parent app frame / mixed DS | parent-child/garden data | parent APIs | 04-parent-dashboard | app-like but still separate frame | preserved | migrate to RoleAppShell later | child cards, requests, discovery |
| `/dashboard/parent/discover-kindergartens` | parent | `DashboardShell + ParentAppFrame` double shell | public-safe garden data | enrollment APIs | 04-parent-dashboard | double wrapped | preserved | remove double wrapper later | discovery, enrollment request |
| `/dashboard/parent/cameras`, `/timeline`, `/daily-journal`, `/gallery` | parent | parent frame/mixed | parent-scoped child data | parent APIs | 04-parent-dashboard | partially migrated | preserved | verify access boundaries | child day, gallery, camera policy |
| `/dashboard/parent/messages`, `/notifications`, `/payments`, `/medical`, `/pickup` | parent | parent frame/mixed | parent-scoped data | parent APIs | 04-parent-dashboard | partially migrated | preserved | migrate later | messages, tuition, medical, pickup |

## Staff

| Route group | Role | Current shell/wrapper | Current data source | Actions/API used | Final reference category | Current visual state | Functional status | Migration status | Preserved features |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/dashboard/staff` | staff | `StaffAppFrame` using Gan Batuach DS | staff/profile/application data | staff APIs | 05-staff-dashboard | app-like, separate frame | preserved | adapt to RoleAppShell later | assigned/unassigned states |
| `/dashboard/staff/attendance`, `/shifts`, `/tasks`, `/operations` | staff | StaffAppFrame | staff/garden data | staff APIs | 05-staff-dashboard | app-like | preserved | QA later | attendance, shifts, daily operations |
| `/dashboard/staff/messages`, `/documents`, `/certificates`, `/job-market` | staff | StaffAppFrame | staff scoped data | staff/message/document APIs | 05-staff-dashboard | app-like | preserved | QA later | communication, docs, applications |

## Inspector

| Route group | Role | Current shell/wrapper | Current data source | Actions/API used | Final reference category | Current visual state | Functional status | Migration status | Preserved features |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/dashboard/inspector` | inspector | `InspectorAppFrame` using Gan Batuach DS | inspector assignment data | inspection APIs | 06-inspector-dashboard | app-like, separate frame | preserved | adapt to RoleAppShell later | assigned gardens, pending state |
| `/dashboard/inspector/apply`, `/applications` | inspector candidate | mixed inspector/onboarding UI | application data | `/api/inspector/applications` | 06-inspector-dashboard | partially app-like | preserved | migrate later | application/pending approval |
| `/dashboard/inspector/inspections`, `/monthly-inspection`, `/reports`, `/violations` | inspector | InspectorAppFrame/mixed | inspection/violation DB | inspection APIs | 06-inspector-dashboard | app-like/mixed | preserved | QA later | inspection forms, reports, history |

## Admin

| Route group | Role | Current shell/wrapper | Current data source | Actions/API used | Final reference category | Current visual state | Functional status | Migration status | Preserved features |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/dashboard/admin` | admin | `AdminAppFrame` using Gan Batuach DS | admin operational queries | admin links/actions | 07-admin-dashboard | app-like main page | preserved | migrate deeper pages gradually | approvals, subscriptions, providers, QA |
| `/dashboard/admin/kindergarten-applications`, `/requests`, `/inspector-applications` | admin | DashboardShell/mixed | application tables | admin approval APIs | 07-admin-dashboard | mixed legacy | preserved | migrate later | approval/reject/request-info |
| `/dashboard/admin/users`, `/gardens`, `/inspectors`, `/subscriptions`, `/billing` | admin | mostly DashboardShell / premium-dashboard | admin DB queries | admin APIs | 07-admin-dashboard | desktop/mixed | preserved | migrate later | platform management |
| `/dashboard/admin/camera-*`, `/ai-*`, `/digital-observer-*`, `/security-*` | admin | DashboardShell + premium-dashboard | admin/security/AI/camera tables | admin/provider APIs | 07-admin-dashboard | legacy desktop control pages | preserved | migrate after functional QA | provider, camera, AI, security readiness |
| `/dashboard/admin/docs/[slug]` | admin | new RoleAppShell contract | whitelisted internal Markdown | none | admin documentation | new safe viewer | fixed in RESCUE 1 | active support route | internal readiness docs without direct root-file links |

## Digital Observer

| Route group | Role | Current shell/wrapper | Current data source | Actions/API used | Final reference category | Current visual state | Functional status | Migration status | Preserved features |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/digital-observer` | public | product page | static/product content | lead CTAs | Digital Observer public | product marketing | preserved | keep separate public style | public product offer |
| `/digital-observer/dashboard` | observer user/admin | `premium-dashboard` AppHome components | observer/camera/provider data | observer APIs | Digital Observer dashboard | app-like but legacy DS | preserved | migrate to RoleAppShell/GB DS later | sites, cameras, alerts, billing readiness |
| `/digital-observer/onboarding`, `/billing`, `/settings`, details | observer user | mixed app/legacy | observer setup data | observer APIs | Digital Observer app | mixed | preserved | migrate later | onboarding, billing, account settings |

## API And Actions

All 170 API routes remain preserved. Sensitive groups were not changed in RESCUE 1:

- Auth/session: `/api/auth/logout`, passkeys, profile settings.
- Parent/child: `/api/parent/*`, `/api/children/*`, medical, pickup, timeline.
- Garden manager: `/api/garden/*`, attendance, enrollment, staff, payout, subscription.
- Staff: `/api/staff/*`.
- Inspector: `/api/inspections/*`, `/api/inspector/*`, violations.
- Admin: `/api/admin/*`.
- Camera/AI: `/api/camera-*`, `/api/video-*`, `/api/ai-*`, observer events.
- Storage/documents: `/api/storage/upload`, `/api/documents/*`.

No API route, RLS policy, payment provider, camera gateway or AI logic was intentionally changed in RESCUE 1.

