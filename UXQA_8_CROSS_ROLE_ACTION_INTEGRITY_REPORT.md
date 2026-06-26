# UXQA 8 - Cross-Role Action Integrity Report

Date: 2026-06-27

Scope: cross-role static audit after RESCUE 1-7 and UXQA 2A-7A. No push. No RLS, authentication architecture, payment-provider logic, camera gateway, AI core or sensitive privacy rules were changed.

## Verification Context

Baseline verification before this report:

- `npm run typecheck`: passed, 18.369s
- `npm run build`: passed, 55.924s, 428 routes/pages
- `git diff --check`: passed

No dedicated public/auth/role E2E test suite exists in `package.json`. Browser screenshot execution was not available in this run.

## Cross-Role Static Surface Counts

| Surface | Page files | `DashboardShell` files | `premium-dashboard` imports | `premium-*` class files | Role/app frame files | Design-system imports |
|---|---:|---:|---:|---:|---:|---:|
| Kindergarten manager | 47 | 36 | 0 | 0 | 44 | 0 |
| Parent | 21 | 21 | 0 | 0 | 20 | 0 |
| Staff | 16 | 0 | 0 | 0 | 16 | 16 |
| Inspector | 19 | 0 | 0 | 0 | 18 | 2 |
| Admin | 140 | 130 | 65 | 65 | 10 | 8 |
| Digital Observer app | 14 | 0 | 1 | 1 | 0 | 0 |

Interpretation:

- Staff is the cleanest role shell-wise.
- Inspector uses its role frame consistently, but fewer shared design-system imports are visible at page level.
- Parent and manager still commonly combine `DashboardShell` with role-specific frames. This is functional but not a clean single-shell architecture.
- Admin advanced modules remain the biggest action/UX consistency risk.
- Digital Observer still has a separate product UI and one `premium-dashboard` dependency.

## Action Integrity Summary

| Area | Classification | Notes |
|---|---|---|
| Public website CTAs | `fully_functional` | Public header, homepage CTAs, `/app`, `/app/login`, `/app/register`, `/kindergarten-directory`, role explanation routes and `/digital-observer` are connected. |
| Auth and registration | `functional_with_existing_backend` | Login and self-service registration routes remain wired to existing auth/actions. Successful auth redirects require real credentials. |
| Parent role | `functional_with_existing_backend` / `manual_review_required` | Parent routes are accessible and build-clean, but all parent pages still use `DashboardShell` plus `ParentAppFrame`, so shell/action behavior needs browser review. |
| Kindergarten manager role | `functional_with_existing_backend` / `manual_review_required` | Manager routes are accessible and build-clean. Several actions connect to existing APIs; shell cleanup remains staged. |
| Staff role | `functional_with_existing_backend` | Staff pages consistently use `StaffAppFrame`; candidate and assigned flows are routed. Provider/location-sensitive attendance still needs real-device QA. |
| Inspector role | `functional_with_existing_backend` | Inspector routes use role frames. Inspection/GPS/evidence/signature actions remain backend/provider dependent and require field-flow QA. |
| Admin core | `functional_with_existing_backend` | Core RESCUE 6 routes are connected. Advanced admin modules remain preserved legacy modules. |
| Admin advanced modules | `high` | 130 admin page files still use `DashboardShell`, and 65 import `premium-dashboard`. No broad migration was attempted in UXQA 8. |
| Digital Observer | `provider_required` / `manual_review_required` | Public/product routes exist, but several pages still include English/technical product wording and RTSP/readiness language. Live camera/AI behavior remains provider dependent. |

## Functional Classifications

### Fully Functional Routes / Links

- Public navigation and CTAs.
- `/app`, `/app/login`, `/app/register`.
- Role-specific registration entries.
- Public directory `/kindergarten-directory` -> `/gardens`.
- Public role explanation routes: `/parents`, `/join-kindergarten`, `/staff`, `/join-inspector`.
- Core role dashboard routes are build-visible and routed.

### Functional With Existing Backend

- Login submit.
- Self-service registration submit.
- Garden manager children, attendance, finance, messages, cameras and subscription pages.
- Parent messages, payments, pickup, schedule, cameras and documents pages.
- Staff attendance, shifts, tasks, messages, documents and job-market pages.
- Inspector inspections, reports, violations, tasks and settings pages.
- Admin approvals, users, subscriptions, reports, cameras, providers and notifications.

### Provider-Dependent

- Payments and invoices.
- Email/SMS/WhatsApp/push delivery.
- Camera Gateway health, stream playback and parent/inspector viewing.
- AI/Digital Observer event processing and review queues.
- PDF/export generation where a backend worker/provider is required.
- Mobile app store links.

### Safely Disabled / Honest Readiness

- `/app` app download button is disabled with honest “האפליקציה תעלה בקרוב” copy.
- Public camera copy is conditional on permissions.
- Several provider/camera/AI surfaces describe readiness rather than claiming live production.

### Broken / Missing / Needs Follow-Up

| Finding | Classification | Follow-up |
|---|---|---|
| `/safe-kindergartens` alias does not exist | `low` | Optional alias to `/gardens` if product wants this route. |
| Parent and manager still use `DashboardShell` heavily | `medium` | Staged shell cleanup before final visual sign-off. |
| Admin advanced modules still use legacy shell and `premium-dashboard` | `high` | Dedicated admin advanced-module migration before production launch. |
| Digital Observer public/product pages contain English and technical camera wording in deeper routes | `medium` | Dedicated Digital Observer public/app copy pass. |
| Browser screenshots were not captured | `manual_visual_review_required` | Run Playwright/in-app browser screenshots in open environment. |

## Privacy And Security Action Review

No UI action change weakened privacy in this audit.

Static concerns requiring follow-up:

- Admin user-management still has generated credential flows and must be reviewed before production.
- Camera setup/playback components must continue to avoid exposing credentials, RTSP URLs or provider tokens.
- Public garden profiles must be tested with production-like data to confirm only public-approved fields are shown.
- Role isolation still needs real account testing, not only static route review.

## Recommended TECHQA Carryover

Before production readiness, create TECHQA items for:

1. Role-guard and route-isolation tests.
2. Public data exposure tests for garden directory/detail.
3. Provider readiness tests for payment, invoice, communications, camera and AI.
4. Admin advanced module shell migration plan.
5. Visual screenshot matrix with reference PNGs inside `docs/ux-references/*`.
