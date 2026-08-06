# UX/UI RESCUE 3 - Shell Layout Stabilization Report

Date: 2026-08-06

## Files Changed

- `components/dashboard-shell.tsx`
- `app/layout.tsx`
- `app/styles/ux-ui-rescue.css`

## Fixes Applied

1. Removed duplicated `DashboardShell` topbar for app-home pages.
2. Removed duplicated `DashboardShell` mobile tabbar for app-home pages.
3. Removed duplicated `FloatingActionCenter` for app-home pages.
4. Added controlled UX rescue CSS after the responsive contract.
5. Added safer overflow, wrapping, modal and bottom-nav spacing rules.

## Why This Matters

Parent and manager app-like pages already include their own product shell. Rendering an additional shell created the exact symptoms Daniel reported:

- double direction
- cut content
- clipped buttons
- mobile/desktop conflict
- app feeling like a broken demo

## Current Status

| Requirement | Status |
|---|---|
| no double app header on app-home dashboards | fixed statically |
| no double app bottom nav on app-home dashboards | fixed statically |
| no public nav inside authenticated dashboards | unchanged; no new leak found in touched files |
| desktop sidebar not forced on mobile | reinforced by CSS |
| bottom nav should not cover content | improved with safe bottom padding |
| dialogs/drawers scroll | improved with viewport max-height |

Manual visual QA is still required.

