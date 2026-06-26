# RESCUE 6 - Admin Action Integrity Report

Date: 2026-06-26

Scope: platform-admin experience. This report covers the core admin routes upgraded during RESCUE 6 plus the preserved advanced modules that remain reachable.

No push. No RLS, admin route guards, authentication, payment-provider logic, provider activation, camera gateway, AI core or secret-handling logic was changed.

## Fixed During RESCUE 6

| Area | Previous state | Current state |
|---|---|---|
| Admin shell notifications | Header notification control was a visual button | Now links to `/dashboard/admin/notifications` |
| Admin shell search | No explicit global-search shortcut in header | Added link to `/dashboard/admin/users` |
| Admin primary navigation | Mixed “גנים / יומן / אדמין” language | Updated to ראשי / אישורים / משתמשים / תשלומים / התראות / עוד |
| Kindergarten approvals | Used legacy `DashboardShell` and premium-dashboard hero | Uses `AdminAppFrame` and gb design-system cards/metrics |
| User management | Used legacy shell and premium hero | Uses `AdminAppFrame`; existing user-management actions preserved |
| Subscriptions | Used legacy shell and old hero | Uses `AdminAppFrame`; keeps existing subscription APIs/actions |
| Notifications | Used legacy shell | Uses `AdminAppFrame` |
| Reports | Used legacy shell | Uses `AdminAppFrame`; keeps existing report center |
| Inspectors | Used legacy shell and old card layout | Uses `AdminAppFrame`, gb metrics and list rows |
| Cameras | Used legacy shell | Uses `AdminAppFrame`; visible statuses translated to Hebrew |
| Provider production | Used legacy shell | Uses `AdminAppFrame`; visible status labels translated where touched |
| Main dashboard | Could show raw severity/status values in visible rows | Visible row status labels normalized to Hebrew |

## Core Action Classification

| Route | Visible action | Classification | Notes |
|---|---|---|---|
| `/dashboard/admin` | Search/users shortcut | Fully functional route | Links to user management |
| `/dashboard/admin` | Garden, inspector, subscription, launch, security and report quick links | Fully functional routes | Existing module routes preserved |
| `/dashboard/admin/kindergarten-applications` | Approve/reject/request more information | Functional with existing backend | `KindergartenApplicationAdminActions` preserved; no lifecycle bypass added |
| `/dashboard/admin/kindergarten-applications` | Billing/document/security quick links | Fully functional routes | Existing admin routes preserved |
| `/dashboard/admin/users` | Create users, reset password, edit profile, activate/deactivate | Functional with existing backend | `AdminUsersManagement` preserved |
| `/dashboard/admin/subscriptions` | Create/update plan and subscription | Functional with existing backend | Existing `/api/admin/subscription-plans` and `/api/admin/subscriptions` preserved |
| `/dashboard/admin/notifications` | Notification center actions | Functional with existing component | Existing `NotificationCenter` preserved |
| `/dashboard/admin/reports` | Export/report listing | Functional if report backend produced exports | No fake export file generation added |
| `/dashboard/admin/inspectors` | Add inspector, open users/tasks/forms | Fully functional routes | Deep assignment operations remain in existing admin modules |
| `/dashboard/admin/cameras` | Camera manager actions | Functional/provider-dependent | Camera gateway readiness and live viewing remain provider-dependent |
| `/dashboard/admin/provider-production` | Provider test panel | Provider-dependent | No live activation changed |

## Provider-Dependent Items

- Email/SMS/WhatsApp/push delivery.
- Payment and invoice providers.
- Camera Gateway live playback and stream health.
- AI provider and Digital Observer processing.
- Report/PDF/export file generation where a provider or backend worker is required.

## Security-Sensitive Items Preserved

- Admin guard remains `requireRole(["admin"])`.
- No RLS policies were edited.
- No auth architecture was edited.
- No payment-provider live mode was enabled.
- No camera gateway or AI core logic was changed.
- No new secret display was added.
- Camera/admin components may accept credentials for setup through forms, but the RESCUE 6 pass did not add any post-save credential display.

## Dead Or Broken Actions Found

No clearly dead action was intentionally left as functional in the upgraded core routes.

Known remaining areas for UXQA 6A:

- Advanced admin routes still using legacy shells should be reviewed one-by-one.
- Some advanced provider/security/launch modules expose English technical labels and should be normalized in staged follow-up passes.
- Real provider tests must be executed only in configured safe/test mode.

## Remaining Classifications

- `fully functional`: core navigation links and existing CRUD/action components.
- `functional_with_existing_backend`: approval/user/subscription/report/camera components that call existing APIs.
- `provider_required`: live providers, gateway, AI, external delivery and file generation.
- `preserved_legacy_advanced_module`: advanced modules not redesigned in RESCUE 6.
- `manual_visual_review_required`: final matching against external admin PNG references.
