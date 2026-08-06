# UX/UI RESCUE 3 - Emergency Product Audit

Date: 2026-08-06

Scope: Gan Batuach and Digital Observer product experience rescue after Daniel reported severe visual, responsive and interaction issues.

## Baseline

- Branch checked: main
- Latest commit checked: f21d839 SIGNOFF SIMPLIFIER 1 - Guided Manual Signoff Wizard & One-Page Execution Checklist
- Build baseline: PASS
- Typecheck baseline: PASS
- git diff check baseline: PASS
- Pilot status: do not launch real pilot; UX rescue only.

## Main Root Cause Found

The most serious layout issue found in code was duplicate authenticated app shell behavior on app-home dashboards.

Affected file:

- `components/dashboard-shell.tsx`

Observed issue:

- `DashboardShell` treated parent/manager app dashboards as `appHome`.
- Those app-home pages already render their own app-like headers and bottom navigation.
- `DashboardShell` also rendered `native-app-topbar`, `mobile-tabbar`, and `FloatingActionCenter`.
- Result risk: double headers, double bottom navigation, clipped CTAs, content hidden behind nav and confusing desktop/mobile structure.

Fix strategy applied:

- App-home layouts now skip the extra `DashboardShell` native topbar, mobile tabbar and floating action center.
- Non-app-home dashboards keep the existing workspace header/navigation behavior.

## Area Audit

| Area | Routes | Visual quality | Responsive risk | Dead/clipped action risk | Severity | Required fix |
|---|---|---:|---:|---:|---|---|
| Public | `/`, `/app`, `/login`, `/register`, `/gardens`, `/digital-observer` | partial | medium | medium | medium | manual visual/click QA still required |
| Parent | `/dashboard/parent`, child, discovery, messages, payments, cameras | partial before fix | high | high | high | duplicate app shell removed; manual visual QA required |
| Manager | `/dashboard/garden`, children, attendance, staff, finance, cameras | partial before fix | high | high | high | duplicate app shell removed; manual visual QA required |
| Staff | `/dashboard/staff`, shifts, tasks, messages, documents | partial | medium | medium | medium | global clipping and touch fixes applied |
| Inspector | `/dashboard/inspector`, inspections, forms, evidence | partial | medium | medium | medium | global form/modal/table containment applied |
| Admin | `/dashboard/admin`, approvals, users, providers, camera/AI ops | partial | high | medium | high | global table/list/button containment applied; dense admin QA required |
| Digital Observer | `/digital-observer`, dashboard, onboarding, cameras, billing | partial | medium | medium | medium | readiness wording mostly present; visual QA required |

## Honest Status

This rescue phase found and fixed an architectural shell conflict plus broad clipping/overflow risks. It did not prove every route visually perfect because screenshot automation was not completed in this phase.

Manual or browser-based visual QA remains required before claiming stakeholder demo readiness.

