# RESPONSIVE FIX 2 – Root Cause Layout Audit

Date: 2026-06-28

## Summary

The remaining responsive failures were architectural, not isolated page bugs. The app had multiple shell systems, multiple bottom-navigation implementations, and late global CSS blocks competing for control of the same dashboard surfaces.

## Root Causes

| Root cause | Files | Affected routes | Severity | Fix strategy |
|---|---|---|---|---|
| Multiple active shell systems | `components/dashboard-shell.tsx`, `components/role-app-shell.tsx`, `components/gan-batuach-design-system.tsx`, `components/staff-app-ui.tsx`, `components/admin-app-ui.tsx`, `components/inspector-app-ui.tsx` | Role dashboards, admin, staff, inspector, Digital Observer | High | Added shared `responsive-*` shell/page/stage classes and a final layout contract imported after global CSS. |
| Desktop/mobile navigation conflicts | `app/globals.css`, `app/styles/app-shell.css` | All role dashboards | High | Desktop now hides mobile bottom navs; mobile/tablet reserve bottom safe space; mobile-preview mode explicitly shows mobile nav inside the preview canvas. |
| Old app-home dashboard CSS still overriding newer layouts | `app/globals.css`, `components/dashboard-shell.tsx` | Parent, manager, staff, inspector app-like pages | High | Added deterministic selectors for `responsive-dashboard-shell`, `responsive-dashboard-main`, and `responsive-content-stage`. |
| Desktop canvas/max-width rules were inconsistent | `app/globals.css`, `app/styles/tokens.css`, `app/styles/app-shell.css` | Desktop dashboards at 1366, 1440, 1920 widths | High | Introduced one desktop canvas contract with centered content and max-width rules. |
| Tablet was treated inconsistently as phone or desktop | `app/globals.css` | 768-1024px layouts | Medium | Added tablet-specific 1-2 column grid behavior and safe bottom spacing. |
| Page-wide horizontal overflow risks | `app/globals.css` | Tables, long forms, cards, logs, admin lists | High | Added final overflow containment for shells, grids, media, tables, dialogs, and long text. |
| Mobile preview mode existed but was not fully isolated | `components/app-motion-shell.tsx`, `app/globals.css` | Desktop QA/demo with `?view=mobile` | Medium | Final CSS constrains the preview canvas and navs without changing data, roles, or server behavior. |
| Bottom nav safe-area was defined in several places | `app/globals.css`, `app/styles/tokens.css`, `app/styles/app-shell.css` | Mobile/tablet role dashboards | High | Centralized final nav clearance variables in the post-global responsive contract. |

## Files Changed

- `app/layout.tsx`
- `app/styles/responsive-contract.css`
- `components/dashboard-shell.tsx`
- `components/gan-batuach-design-system.tsx`

## Risk Notes

No business logic, RLS, auth, payments, camera gateway, AI core or legal/privacy content was changed.

