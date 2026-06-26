# RESCUE 6 - Admin Screenshot-To-Route Matrix

Date: 2026-06-26

## Reference Availability

Requested canonical repository folder:

- `docs/ux-references/admin/`

Status: not present in the repository during this pass.

External admin references found and used for manual mapping:

- `/Users/danielderi/Desktop/עיצוב גן בטוח/אדמין ראשי/דשבורד אדמין ראשי.png`
- `/Users/danielderi/Desktop/עיצוב גן בטוח/אדמין ראשי/אישור גנים חדשים אדמין ראשי.png`
- `/Users/danielderi/Desktop/עיצוב גן בטוח/אדמין ראשי/ניהול משתמשים אדמין ראשי.png`
- `/Users/danielderi/Desktop/עיצוב גן בטוח/אדמין ראשי/מנויים ותשלומים אדמין ראשי.png`
- `/Users/danielderi/Desktop/עיצוב גן בטוח/אדמין ראשי/ניטור והתראות אדמון ראשי.png`
- `/Users/danielderi/Desktop/עיצוב גן בטוח/אדמין ראשי/דוחות וניתוח נתונים אדמין ראשי.png`

Because the screenshots are outside the repository, final pixel-level validation is classified as `manual_visual_review_required`.

## Matrix

| Reference area | Screenshot filename | Existing route | Current page/component | Data source | Actions/API routes | Access guard | Security constraints | Implementation status |
|---|---|---|---|---|---|---|---|---|
| Main admin dashboard | `דשבורד אדמין ראשי.png` | `/dashboard/admin` | `app/dashboard/admin/page.tsx`, `AdminAppFrame`, gb design-system cards | `gardens`, `profiles`, `subscriptions`, `required_inspections`, `inspections`, `violations`, `complaints`, `incident_reports`, `ai_events`, `camera_streams`, launch/security tables | Links to users, gardens, inspectors, subscriptions, alerts, reports, launch/security modules | `requireRole(["admin"])` | No RLS/auth/provider logic changed; no fake counts added | Implemented; raw status labels normalized in visible rows |
| New-kindergarten approvals | `אישור גנים חדשים אדמין ראשי.png` | `/dashboard/admin/kindergarten-applications` | `AdminAppFrame`, `KindergartenApplicationAdminActions`, gb cards | `gardens`, onboarding records, fee groups, age-group setups, documents, profiles, kindergarten subscriptions | Existing approve/reject/request-more-info action component | `requireRole(["admin"])` | Does not bypass document, approval, payment or activation lifecycle | Upgraded to admin app shell and gb cards |
| User management | `ניהול משתמשים אדמין ראשי.png` | `/dashboard/admin/users` | `AdminAppFrame`, `AdminUsersManagement` | `profiles`, `generated_credentials`, `audit_logs` | `/api/admin/users`, new user routes | `requireRole(["admin"])`; service role readiness shown | Does not broaden role escalation or auth; temporary credential display remains existing admin-only behavior | Upgraded shell/hero; component preserved |
| Subscriptions and payments | `מנויים ותשלומים אדמין ראשי.png` | `/dashboard/admin/subscriptions` | `AdminAppFrame`, `SubscriptionAdminManager`, gb KPI cards | `kindergarten_subscriptions`, `subscription_plans`, `gardens`, `subscription_payments` | `/api/admin/subscription-plans`, `/api/admin/subscriptions` | `requireRole(["admin"])` | Gan Batuach subscription stays separate from parent tuition and Digital Observer billing | Upgraded shell and summary cards; existing manager preserved |
| Monitoring and alerts | `ניטור והתראות אדמון ראשי.png` | `/dashboard/admin/notifications`, `/dashboard/admin/system-health`, `/dashboard/admin/security-center`, `/dashboard/admin/provider-production` | `AdminAppFrame` on notifications/provider production; existing monitoring pages preserved | `notifications`, provider readiness tables, system/security tables | notification center, provider test panel where configured | `requireRole(["admin"])` | No external delivery faked; provider secrets not shown | Core notification/provider screens upgraded; advanced monitoring routes preserved |
| Reports and data analysis | `דוחות וניתוח נתונים אדמין ראשי.png` | `/dashboard/admin/reports`, `/dashboard/admin/analytics-center` | `AdminAppFrame`, `ReportsCenter`; analytics center preserved | `report_exports`, analytics/reporting tables | Report center and existing export routes | `requireRole(["admin"])` | No fake export generated | Reports route upgraded; analytics center retained as advanced module |
| Camera / AI operations | No dedicated admin screenshot beyond ops requirement | `/dashboard/admin/cameras`, `/dashboard/admin/camera-ai`, `/dashboard/admin/ai-events`, `/dashboard/admin/observer-network`, `/dashboard/admin/observer-calibration` | `AdminAppFrame` on cameras; existing camera/AI modules preserved | `camera_streams`, gateway registry, validations, health history, sessions, audit, observer queue | camera stream APIs, gateway actions, observer routes | `requireRole(["admin"])` | No RTSP/IP/credential/provider-secret display added; live state remains provider-dependent | Camera operations upgraded to admin app shell; advanced AI routes preserved |
| Inspector management | No dedicated admin screenshot in folder | `/dashboard/admin/inspectors`, `/dashboard/admin/inspector-applications`, `/dashboard/admin/inspection-workforce` | `AdminAppFrame` on inspectors; applications/workforce preserved | `inspectors`, `gardens`, `inspections`, `tasks`, application tables | new inspector route, profile/tasks/forms links | `requireRole(["admin"])` | No private child/parent data expansion | Inspector directory upgraded to gb list/metrics |
| Provider health | No dedicated screenshot in folder | `/dashboard/admin/provider-production`, `/dashboard/admin/integrations`, `/dashboard/admin/video-gateway` | `AdminAppFrame` on provider production; integration panels preserved | provider readiness, health, webhook, cost, alert, rollback/runbook/test tables | test panel, integrations routes | `requireRole(["admin"])` | No secrets/API keys rendered; live activation not changed | Provider production shell upgraded; labels normalized |
| Security / QA / production readiness | No dedicated screenshot in folder | `/dashboard/admin/security-center`, `/dashboard/admin/qa-checklist`, `/dashboard/admin/launch-readiness`, `/dashboard/admin/final-production-launch`, `/dashboard/admin/database-integrity` | Advanced admin modules preserved | security, QA, launch, migration/readiness tables | Existing admin links/actions | `requireRole(["admin"])` | No blocker closure without evidence added | Preserved; marked for UXQA 6A visual consistency |
| City and district analytics | Included in data-analysis requirement | `/dashboard/admin/analytics-center`, `/dashboard/admin/kindergarten-analytics` | Existing analytics components | `gardens`, rating/risk/inspection/engagement tables | filter/report routes where existing | `requireRole(["admin"])` | Uses existing data; district gaps should show truthfully in advanced QA | Preserved; not fully redesigned in this pass |
| Digital Observer product operations | Product ops requirement | `/dashboard/admin/digital-observer`, `/dashboard/admin/observer-billing`, `/dashboard/admin/digital-observer-*`, `/dashboard/admin/observer-*` | Existing admin product modules | Digital Observer site, billing, package, observer tables | existing observer/admin actions | `requireRole(["admin"])` | Product separation preserved; no revenue mixing added | Preserved; advanced modules documented for UXQA 6A |

## Core Routes Upgraded In RESCUE 6

- `/dashboard/admin`
- `/dashboard/admin/kindergarten-applications`
- `/dashboard/admin/users`
- `/dashboard/admin/subscriptions`
- `/dashboard/admin/notifications`
- `/dashboard/admin/reports`
- `/dashboard/admin/inspectors`
- `/dashboard/admin/cameras`
- `/dashboard/admin/provider-production`

## Advanced Routes Preserved

The admin area contains many advanced modules that remain available. They are intentionally not deleted or replaced in this phase. Several still use the legacy `DashboardShell` and `premium-dashboard` components and are classified as `preserved_legacy_advanced_module` for staged migration:

- security, QA, ISO, legal, launch, mobile release, commercial launch, provider operations, Digital Observer operations, camera infrastructure, AI governance, reports, communications, workflows, migrations, customer success and company operations routes under `/dashboard/admin/*`.

## RESCUE 6 Status Labels

- `implemented`: route upgraded to `AdminAppFrame` or already using gb design-system shell.
- `preserved`: feature retained with existing logic and route.
- `preserved_legacy_advanced_module`: feature retained, not redesigned in this pass.
- `provider_required`: requires configured external provider to prove live behavior.
- `manual_visual_review_required`: requires screenshot review against external PNGs.

## UXQA 6A Update - 2026-06-26

Canonical repository references are still absent from `docs/ux-references/admin/`. The external PNGs under `/Users/danielderi/Desktop/עיצוב גן בטוח/אדמין ראשי/` were found, so this QA can validate route coverage and implementation intent, but not repository-portable pixel matching.

Static route audit found 140 admin `page.tsx` files. The core RESCUE 6 admin routes use `AdminAppFrame`, but many advanced routes still render through `DashboardShell` and `premium-dashboard`. That means the admin core is upgraded, while the full advanced admin surface is not yet a single-shell visual experience.

| Reference / area | UXQA 6A classification | Notes |
|---|---|---|
| דשבורד אדמין ראשי | Implemented with minor visual differences; `manual_visual_review_required` | `/dashboard/admin` uses the admin app shell, gb tokens and truthful metrics/empty states. Final visual match still needs browser/screenshot review against the external PNG. |
| אישור גנים חדשים | Implemented partially | `/dashboard/admin/kindergarten-applications` uses the admin shell and preserves approval actions. Advanced filtering/search requirements should be manually verified and completed if missing in a follow-up. |
| ניהול משתמשים | Implemented partially | `/dashboard/admin/users` is in the admin shell and keeps real user actions. Existing `AdminUsersManagement` still carries complex legacy behavior and requires deeper action/security review. |
| מנויים ותשלומים | Implemented with provider dependencies | `/dashboard/admin/subscriptions` uses the admin shell and keeps subscription/payment separation. Live payment state depends on configured provider mode. |
| ניטור והתראות | Implemented partially | `/dashboard/admin/notifications` and `/dashboard/admin/provider-production` are upgraded. Several monitoring/security/provider advanced routes remain legacy-shell modules. |
| דוחות וניתוח נתונים | Implemented partially | `/dashboard/admin/reports` is upgraded. `/dashboard/admin/analytics-center` and related advanced analytics modules remain preserved legacy modules. |
| Inspector management | Implemented partially | `/dashboard/admin/inspectors` is upgraded. Applications/workforce/deep assignment screens still need staged visual migration. |
| Provider health | Implemented partially; `provider_required` | Provider readiness is visible without exposing secrets in the upgraded route. Real provider tests require configured safe/test providers. |
| Security and QA blockers | Route exists but visual mismatch | Security/QA/launch/database integrity modules remain mostly advanced legacy modules. They preserve functionality but are not fully aligned visually. |
| City and district analytics | Route exists but visual mismatch | Analytics routes exist and are preserved; district/city data normalization and visual polish remain follow-up work. |
| Camera operations | Implemented partially; `security_followup_required` | `/dashboard/admin/cameras` is upgraded. Setup forms accept credentials for server-side configuration; saved/overview display must continue redaction checks. |
| AI / Digital Observer operations | Implemented partially; `security_followup_required` | Product routes are preserved and separated, but several advanced modules still show technical labels/raw operational language and need staged cleanup. |
| Full-management drawer / advanced modules | Implemented partially | Advanced admin capabilities remain reachable, but not all are migrated to the unified admin shell. |

UXQA 6A readiness classification: the core admin experience is build-stable and navigable, but the full admin journey is not yet a 100/100 unified visual system because preserved advanced modules still use the legacy shell.
