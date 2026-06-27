# RESPONSIVE FIX 2 – Shell Consolidation Report

Date: 2026-06-28

## Shells Reviewed

| Shell | Status after fix |
|---|---|
| `DashboardShell` | Kept, marked with `responsive-dashboard-shell`, `responsive-dashboard-main`, and `responsive-content-stage`. |
| `RoleAppShell` | Kept, inherits `responsive-app-shell` and `responsive-app-page` through shared design-system primitives. |
| `AppShell` | Kept as shared primitive, now also carries `responsive-app-shell`. |
| `ResponsivePage` | Kept as shared page primitive, now also carries `responsive-app-page`. |
| Staff/Admin/Inspector app frames | Kept, stabilized through shared `AppShell` and final responsive contract. |
| Public shell/auth pages | Not redesigned. Protected from authenticated shell rules where possible. |
| Mobile preview shell | Kept through `AppMotionShell`; final CSS isolates the preview canvas. |

## Consolidation Performed

- Added shared responsive classes to shell primitives instead of rewriting every route.
- Kept existing route structure intact.
- Desktop now has one centered canvas rule for shell and dashboard content.
- Mobile/tablet now have one safe-area/bottom-nav clearance rule.
- Mobile preview mode is constrained to the preview canvas and does not alter app permissions or server state.

## Remaining Architectural Debt

- The codebase still has multiple historical dashboard component families.
- A future cleanup should migrate older route-specific bottom navs into one shared bottom nav component.
- A future cleanup should split the very large `app/globals.css` into smaller domain files.

