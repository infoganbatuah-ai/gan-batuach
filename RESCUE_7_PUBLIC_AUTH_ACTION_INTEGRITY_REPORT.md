# RESCUE 7 - Public/Auth Action Integrity Report

Date: 2026-06-26

Scope: public website, app gateway, login, registration role selection, public role explanation pages, public kindergarten directory and public kindergarten detail.

No push. No RLS, authentication architecture, invitation-token logic, payment logic, camera gateway, AI core or private-data access rules were changed.

## Actions Audited And Updated

| Area | Visible action | Classification | Result |
|---|---|---|---|
| Public header | ראשי | Fully functional route | `/` |
| Public header | הורים | Fully functional route | `/parents` |
| Public header | גני ילדים | Fully functional route | `/join-kindergarten` |
| Public header | צוות גן | Fully functional route | `/staff` added in RESCUE 7 |
| Public header | מפקחים | Fully functional route | `/join-inspector` |
| Public header | התצפיתן הדיגיטלי | Fully functional route | `/digital-observer` |
| Public header | רשימת גנים | Fully functional route | `/kindergarten-directory` redirects to `/gardens` |
| Public header | התחברות / כניסה למערכת | Fully functional route | `/app/login` and `/app` |
| Public header | הרשמה | Fully functional route | `/app/register` |
| Homepage hero | רישום למערכת | Fully functional route | `/app/register` |
| Homepage hero | כניסה למערכת | Fully functional route | `/app/login` |
| Homepage hero | קביעת הדגמה | Fully functional route | `/book-demo` |
| Homepage hero | רשימת גני הילדים | Fully functional route | `/kindergarten-directory` |
| App gateway | הורדת אפליקציה | Safely disabled | Honest copy: app will be available soon; no fake app-store links |
| App gateway | המשך בדפדפן | Fully functional route | `/app/login` |
| App gateway | משתמש קיים | Fully functional route | `/app/login` |
| App gateway | משתמש חדש | Fully functional route | `/app/register` |
| App gateway | Digital Observer | Fully functional public route | `/digital-observer`; no direct internal dashboard shortcut |
| Login | Login submit | Functional with existing auth backend | Existing `signIn` action preserved |
| Login | Forgot password | Fully functional route | `/forgot-password` |
| Login | Registration link | Fully functional route | `/app/register` |
| Role selection | Parent | Fully functional route | `/app/register/parent` |
| Role selection | Kindergarten manager | Fully functional route | `/app/register/kindergarten` |
| Role selection | Staff | Fully functional route | `/app/register/staff` |
| Role selection | Inspector | Fully functional route | `/app/register/inspector` |
| Public directory | Filters | Functional with existing query params | `/gardens` search/filter form preserved |
| Public directory | View details / request enrollment | Fully functional route | `/gardens/[id]` |
| Public garden detail | Parent registration journey | Functional with existing component | Existing `ParentRegistrationJourney` preserved |
| Parent public page | Parent demand form | Functional with existing backend | `createParentDemandLead` preserved |
| Kindergarten manager public page | Garden lead form | Functional with existing backend | `createGardenLead` preserved |
| Inspector public page | Inspector lead form | Functional with existing backend | `createInspectorLead` preserved |
| Staff public page | Register as staff | Fully functional route | `/app/register/staff` |
| Staff public page | Hiring gardens | Route exists; auth-context dependent | `/dashboard/staff/job-market`; unauthenticated users will enter protected flow |

## Safety And Unsupported Claims

- Google login was not added.
- Apple login was not added.
- Face ID was not added.
- App Store / Google Play links were not faked.
- Public pages do not expose private children, parents, staff records, inspector assignments, private documents, camera credentials or raw AI data.
- Camera copy remains conditional on kindergarten approval, policy and permissions.
- Digital Observer copy was not changed to claim live production AI readiness.

## Remaining Classifications

- `manual_visual_review_required`: public/auth reference PNGs are outside the repo, so screenshots should be copied into `docs/ux-references/public-auth/` for repeatable matching.
- `provider_required`: demo requests, external delivery and Digital Observer live provider behavior depend on configured providers.
- `auth_context_required`: staff job-market route exists but is an internal route and may require login.

## UXQA 7A Update - 2026-06-26

Additional QA fixes made:

| Area | Previous state | UXQA 7A result |
|---|---|---|
| Staff public CTA | “חיפוש גנים שמגייסים” linked directly to `/dashboard/staff/job-market`, an internal route | Now routes to `/app/register/staff` with copy “חיפוש גנים לאחר הרשמה” |
| Digital Observer public hero | Key CTAs and explanations were in English | Main hero, camera connection and final CTA copy translated to Hebrew |
| Public technical camera wording | Homepage mentioned RTSP directly | Reworded to “כתובות חיבור או סודות מצלמה” |

Static action audit after fixes:

- No audited public/auth route imports `DashboardShell`, role frames or internal bottom navigation.
- No Google, Apple or fake Face ID login action was found.
- App download remains safely disabled with honest placeholder copy.
- `/safe-kindergartens` does not exist; current public directory path is `/kindergarten-directory` -> `/gardens`.
- Digital Observer still has advanced product routes that require provider/live setup; they remain `provider_required`.
