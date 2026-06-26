# RESCUE 7 - Public/Auth Screenshot-To-Route Matrix

Date: 2026-06-26

## Reference Availability

Requested canonical repository folder:

- `docs/ux-references/public-auth/`

Status: not present or empty during this pass.

External public/auth references found and used for manual mapping:

- `/Users/danielderi/Desktop/עיצוב גן בטוח/עמוד ראשי/עמוד ראשי של האתר.png`
- `/Users/danielderi/Desktop/עיצוב גן בטוח/עמוד ראשי/לחיצה על רישום למערכת יעבי לעמוד זה של רישום ומכאן עוברים כל אחד לרישום שלו.png`
- `/Users/danielderi/Desktop/עיצוב גן בטוח/עמוד ראשי/רשימת גני הילדים באתר.png`
- `/Users/danielderi/Desktop/עיצוב גן בטוח/עמוד ראשי/לחיצה על דשבורד הורים יעביר לעמוד דשבורד הורים.png`
- `/Users/danielderi/Desktop/עיצוב גן בטוח/עמוד ראשי/לחיצה על דשבורד גננת באתר יעביר לעמוד הזה של הסבר דשבורד גננת.png`
- `/Users/danielderi/Desktop/עיצוב גן בטוח/עמוד ראשי/לחיצה על דשבורד צוות באתר יעביר לעמוד הזה.png`
- `/Users/danielderi/Desktop/עיצוב גן בטוח/עמוד ראשי/לחיצה על דשבורד מפקח באתר יעביר לעמוד הזה.png`

Because the screenshots are outside the repository, final pixel-level validation remains `manual_visual_review_required`.

## Matrix

| Reference area | Screenshot filename | Existing route | Current component | Data source | Actions/routes used | Privacy/security constraints | Implementation status |
|---|---|---|---|---|---|---|---|
| Main public homepage | `עמוד ראשי של האתר.png` | `/` | `app/page.tsx`, `BrandHeader`, gb design-system cards | Public-enabled `gardens` preview, public metadata | `/app/login`, `/app/register`, `/book-demo`, `/kindergarten-directory`, role pages | Public content only; no private garden/child/user data | Upgraded navigation and CTAs; needs browser visual review |
| General login page | Approved login baseline / app auth reference | `/app/login`, `/login` | `AppLoginScreen` | Auth session/profile and existing sign-in action | `signIn`, `/forgot-password`, `/app/register` | Existing auth logic preserved; no Google/Apple/Face ID added | Existing approved baseline preserved |
| App entry / continue in browser | App gateway reference | `/app` | `app/app/page.tsx` | Static public/auth entry | `/app/login`, `/app/register`, `/digital-observer` | No fake app-store links; download button is disabled with honest copy | Upgraded to focused auth/app entry |
| General registration / role selection | `לחיצה על רישום למערכת...png` | `/app/register`, `/register` | `AppRegisterEntryScreen` | Static role cards | `/app/register/parent`, `/app/register/kindergarten`, `/app/register/staff`, `/app/register/inspector` | No irrelevant fields before role choice | Existing app-style role selection preserved |
| Role-specific registration entry points | Role registration refs | `/app/register/parent`, `/app/register/kindergarten`, `/app/register/staff`, `/app/register/inspector` | `AppRoleRegisterScreen`, `SelfServiceRegisterForm` | Existing self-service registration backend | Existing self-service APIs/actions | Invitation/auth models preserved; no duplicate profile model | Routes verified by typecheck/build |
| Public kindergarten directory | `רשימת גני הילדים באתר.png` | `/kindergarten-directory` -> `/gardens`, `/gardens` | `app/gardens/page.tsx` | Public-enabled `gardens`, approved trust/profile fields | Filters, `/gardens/[id]`, `/app/register/parent`, `/app` | Only public-safe data; no children/parents/private docs/camera URLs | Existing upgraded route preserved |
| Public kindergarten detail | Directory detail requirement | `/gardens/[id]` | Public garden profile page | Public-enabled garden profile, approved trust fields | Parent registration journey, login with garden context | Hidden if public profile is not enabled; no private reports/camera credentials | Existing public detail preserved |
| Parent dashboard explanation page | `לחיצה על דשבורד הורים...png` | `/parents` | `app/parents/page.tsx`, `BrandHeader` | Parent demand lead form | Parent demand CTA, `/parent-portal`, form action | Public explanation only; no private child data | Header aligned; page content preserved |
| Kindergarten manager explanation page | `לחיצה על דשבורד גננת...png` | `/join-kindergarten` | `app/join-kindergarten/page.tsx`, `BrandHeader` | Garden lead form, controlled city/street data | Garden registration lead, `/book-demo`, `/service-charter` | No automatic approval/certification claim; activation still admin/payment gated | Header aligned; page content preserved |
| Staff dashboard explanation page | `לחיצה על דשבורד צוות...png` | `/staff` | New `app/staff/page.tsx`, gb public cards | Static public explanation | `/app/register/staff`, `/dashboard/staff/job-market`, `/app/login` | No internal staff/kindergarten data exposed | Added in RESCUE 7 |
| Inspector dashboard explanation page | `לחיצה על דשבורד מפקח...png` | `/join-inspector` | `app/join-inspector/page.tsx`, `BrandHeader` | Inspector lead form | Existing inspector lead action | Inspector sees assigned gardens only after approval | Header aligned; content preserved |
| Digital Observer public page | Existing Digital Observer public target | `/digital-observer` | Existing public Digital Observer page | Static/product data and existing routes | `/digital-observer/start`, `/digital-observer/request-demo`, pricing/trust | No Gan Batuach Israel Mode audio/face-recognition claims added | Preserved; app gateway now links to public product page |

## RESCUE 7 Status Labels

- `upgraded`: route received shell/navigation/content alignment in RESCUE 7.
- `preserved`: route already matched the app/auth direction and was left functionally intact.
- `manual_visual_review_required`: external reference PNG must be reviewed manually or copied into the repo for repeatable screenshot QA.
- `provider_required`: external live provider behavior cannot be claimed until configured.
