# RESCUE 2 Kindergarten Manager Screen Matrix

Status date: 2026-06-23

Reference source: `docs/ux-references/kindergarten-manager/` was not populated in the repository. The supplied/attached kindergarten-manager references were available locally under `/Users/danielderi/Desktop/עיצוב גן בטוח/גננת/` and were used as the visual target.

Implementation rule: preserve existing routes, data loading, server actions, RLS/auth/payment/camera/AI security boundaries, and apply the approved Gan Batuach manager app language.

UXQA 2A update: this matrix was rechecked after the manager UX implementation. The QA pass found that the route set is preserved, the approved main dashboard and attendance baseline remain intact, and several hardcoded/demo presentation values were corrected so manager screens show real data or designed empty states instead of screenshot sample data.

| Reference area | Reference screenshot filename | Existing route | Current page/component | Data source | Existing actions | Missing UI / functionality | Security constraints | Implementation status |
|---|---|---|---|---|---|---|---|---|
| Kindergarten manager main dashboard | `דשבורד ראשי גננת.png` | `/dashboard/garden` | `app/dashboard/garden/page.tsx` | Supabase counts for children, attendance, staff, messages, requests | links to attendance, messages, children, daily journal, cameras, finance, reports | none critical; truthful empty states still depend on available records | no sensitive data lists on home | preserved baseline |
| Messages and communication | `הודעות ותקשורת דשבורד גננת.png` | `/dashboard/garden/messages`, `/dashboard/garden/communication` | `messages/page.tsx`, `communication/page.tsx`, `InternalMessagingCenter` | `messages`, parents/staff profiles, `parent_child_requests` | compose, view open requests, response actions | provider delivery depends on configured messaging backend | no broad user search beyond scoped garden data | upgraded app shell, management workbench preserved |
| Staff and payroll management | `ניהול צוות דשבורד גננת.png` | `/dashboard/garden/staff`, `/dashboard/garden/staff-applications` | `staff/page.tsx`, staff cards | `staff`, `documents`, `staff_shifts`, scores/certificates | staff list, applications route, document readiness | export/payroll exact totals only where backend data exists | sensitive staff docs are not shown in overview | upgraded app shell, full management retained |
| Reports and reporting | `דיווחים ודוחות דשבורד גננת.png` | `/dashboard/garden/reports` | `reports/page.tsx`, `ReportsCenter` | attendance, incident, messages, inspections counts | open attendance/incidents/messages, reports workbench | export files depend on existing ReportsCenter support | no fake downloadable files added | upgraded app shell, management workbench retained |
| Child attendance | `נוכחות דשבורד גננת.png` | `/dashboard/garden/attendance` | `attendance/page.tsx`, `GardenAttendanceActionButton` | `children`, `attendance` | check-in/check-out, filters, reports/message links | none critical; depends on existing attendance API | no child outside garden scope | approved baseline-like implementation |
| Daily schedule and activities | `לוח יום ופעילות דשבורד גננת.png` | `/dashboard/garden/daily-journal` | `daily-journal/page.tsx`, `DailyTaskJournal` | `daily_operational_tasks`, `daily_task_completions` | workbench, task completion, attendance link | activity reorder only if existing component supports it | scoped to garden | UXQA fixed: screenshot sample rows removed; now uses real task data or an empty state |
| Kindergarten financial management | `ניהול כספים דשבורד גננת.png` | `/dashboard/garden/finance` | `finance/page.tsx`, `GardenPayoutConfigurationForm` | `loadGardenFinanceData`, payout/payment tables | payout setup, filters, subscription link | external payment provider readiness may be required | parent tuition separated from Gan Batuach subscription | upgraded app shell, separation preserved |
| Full child profile | `כרטיס ילד דשבורד גננת.png` | `/dashboard/garden/children/[id]` | `children/[id]/page.tsx` | child record, attendance, docs/medical fields already loaded by page | profile sections, finance/timeline links | depends on existing data availability | medical/identity data stays behind existing auth/RLS | UXQA fixed: fake stats/contact/document rows removed; profile uses real counts/details or empty labels |
| Children list | `רשימת ילדים דשבורד גננת.png` | `/dashboard/garden/children` | `children/page.tsx`, `GardenChildCreatePanel` | children, attendance, journals, incidents, fee groups, parent requests, garden name | add child, profile links, filters, management details | none critical; full legacy cards retained in details | list avoids unnecessary sensitive detail | UXQA fixed: hardcoded garden subtitle removed; add child anchor connected |
| Camera management | `עמוד מצלמות דשבורד גננת.png` | `/dashboard/garden/cameras`, `/dashboard/garden/camera-health` | `cameras/page.tsx`, `CameraAdminManager` | `camera_streams`, `gardens`, provider env readiness | add camera, health, manage/view, gateway checks | live stream depends on real gateway | RTSP/IP/user/password/token not exposed | top gallery now safe status cards; full manager retained |
| Kindergarten enrollment requests | `בקשות הצטרפות לגן דשבורד גננת.png` | `/dashboard/garden/enrollment-requests`, `/dashboard/garden/leads` | `enrollment-requests/page.tsx`, request action forms | `kindergarten_enrollment_requests`, child files, profiles, garden name | approve/reject/request info through existing forms | approval depends on existing business rules | no bypass of child/payment/activation rules | UXQA fixed: hardcoded garden subtitle removed; management retained |
| Inviting children and parents | `הזמנת ילדים ברישום גננת.png` | `/dashboard/garden/onboarding`, `/dashboard/garden/children?new=1#new-child` | `onboarding/page.tsx`, `GardenChildCreatePanel` | invitation/children logic already in existing components | add child, invite/onboarding links | provider not configured states must be verified manually | invite tokens unchanged | app shell retained; no token logic changed |
| Initial registration before admin approval | `רישום גננת שלב ראשון ושני לאישור האדמין.png` | `/app/register/kindergarten`, `/register`, onboarding routes | registration components from auth/onboarding flow | existing Supabase auth/profile/garden application flow | submit application, pending state | visual QA still needed against exact auth refs | auth/RLS unchanged | not rewritten in RESCUE 2 |
| Post-admin-approval onboarding | `המשך רישום גננת לאחר אישור האדמין.png` | `/dashboard/garden/onboarding`, onboarding form routes | `kindergarten-onboarding-form.tsx`, `onboarding/page.tsx` | existing garden onboarding records | save/continue, children/staff/document links | manual QA needed for all steps | activation lifecycle unchanged | UXQA fixed payment summary honesty; retained, styled by existing teacher/payment classes |
| Subscription summary and payment | `סיכום רישום גננת ותשלום.png` | `/dashboard/garden/subscription` | `subscription/page.tsx`, `GardenSubscriptionActions` | `loadGardenSubscriptionData`, provider safety modes | subscription actions, payment history | live provider setup required for live payment | no card data stored; no fake Apple/Google Pay | UXQA confirmed provider-dependent; business rules preserved |
| Existing features not in refs | n/a | all `/dashboard/garden/*` routes | Teacher app frame or DashboardShell | existing page loaders | existing route/action set | some deep pages still use management details/embedded modules | existing guards retained | retained; requires QA pass per route |

Preserved feature count: all discovered `/dashboard/garden` route files remain present. No route was deleted.

## UXQA 2A Reference Coverage Classification

| Reference | QA classification | Notes |
|---|---|---|
| דשבורד ראשי גננת | implemented accurately | Approved dashboard baseline remained in place. |
| הודעות ותקשורת | implemented partially | Route and workbench exist; external delivery/provider behavior requires configuration QA. |
| ניהול צוות ושכר | implemented partially | Staff UI exists; payroll totals depend on real staff/hour data. |
| דיווחים ודוחות | implemented partially | Reports route/workbench exists; exports depend on existing generation support. |
| נוכחות | implemented accurately | Uses the approved manager design language and existing attendance actions. |
| לוח יום ופעילות | fixed | Removed screenshot sample rows; now uses real operational tasks or empty state. |
| ניהול כספים | implemented partially | Tuition/subscription separation preserved; provider setup required for live operations. |
| כרטיס ילד | fixed | Removed fake profile stats/contact/document placeholders. |
| רשימת ילדים | fixed | Hardcoded garden copy removed; real garden context is used where available. |
| עמוד מצלמות | implemented partially | Safe camera status cards exist; live stream requires real gateway. |
| בקשות הצטרפות לגן | fixed | Hardcoded garden copy removed; existing approval actions retained. |
| הזמנת ילדים והורים | implemented partially | Add-child/invite routes exist; provider delivery and token lifecycle require manual QA. |
| רישום גננת לפני אישור אדמין | requires_manual_review | Existing route retained; exact visual parity was not browser-captured in this run. |
| המשך רישום לאחר אישור אדמין | fixed | Fake payment wallet/card UI removed from onboarding summary. |
| סיכום רישום ותשלום | provider_required | UI must remain in readiness/provider mode until live payment provider is configured. |
