# CSS Conflict And Deprecation Map

RESCUE 1 audit date: 2026-06-23

## Current CSS Architecture

`app/globals.css` is a large accumulated stylesheet with many phase-era blocks. RESCUE 1 does not delete those blocks. Instead it introduces deterministic imports at the top:

- `app/styles/tokens.css`
- `app/styles/app-shell.css`
- `app/styles/public.css`
- `app/styles/auth.css`

These files are intentionally small and controlled. They do not replace all existing CSS yet.

## Block Classification

| CSS area | Classification | Notes |
| --- | --- | --- |
| `:root` base tokens | active foundation | Existing app tokens and `gb-*` tokens are the current visual source of truth. |
| `gb-*` component classes | active foundation | Official design system surface. New/upgraded screens should use these. |
| login/auth baseline classes | active auth | Approved login baseline must remain stable. |
| public marketing classes | active public | Public website remains website-like. |
| ganenet main dashboard classes | active manager | Approved dashboard baseline. Must not be broken. |
| `parent-*` classes | active parent / migration pending | Works for current parent UI but is a separate design family. |
| `staff-*` classes | active staff / migration pending | Mostly app-like but separate frame. |
| `inspector-*` classes | active inspector / migration pending | Mostly app-like but separate frame. |
| `admin-*` classes | active admin / migration pending | Used by current admin app frame. |
| `.premium-*` classes | legacy | Still used by many deep/admin/public forms. Do not use for new screens. |
| `.dashboard-layout`, `.dashboard-section`, `.procedure-*` | legacy/compatibility | Required by old dashboards and admin details. Migrate later. |
| repeated phase override blocks near the end of `globals.css` | duplicated | High risk for unexpected overrides. Do not append more large blocks. |
| one-off page-specific blocks for camera/AI/security/commercial pages | active legacy | Preserve function. Migrate visually later. |

## Deprecation Strategy

1. New screens use `components/gan-batuach-design-system.tsx` and `gb-*` tokens only.
2. Screen migrations replace one legacy shell at a time with `RoleAppShell`.
3. Only after a page no longer imports `premium-dashboard.tsx`, remove its local dependency on `premium-*`.
4. Delete legacy CSS only after route-level visual QA confirms no dependent page remains.

## RESCUE 1 CSS Changes

- Added shell variables for safe-area, bottom nav height and content width.
- Added `role-app-shell` primitives for the future unified internal shell.
- Added small public/auth marker files to formalize separate surfaces.
- No broad `!important` override layer was added.

