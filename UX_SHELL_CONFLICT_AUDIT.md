# UX Shell Conflict Audit

RESCUE 1 audit date: 2026-06-23

## Executive Finding

The app has the right product modules and route coverage, but it currently contains several UI architectures layered over one another. The main risk is not missing features; it is inconsistent wrapping, duplicated navigation, old desktop pages inside app routes and conflicting CSS blocks.

## Component Findings

| Component / wrapper | Current role | Conflict | Decision in RESCUE 1 |
| --- | --- | --- | --- |
| `components/dashboard-shell.tsx` | legacy authenticated shell with role/sidebar support | Still wraps many garden/admin/security/deep pages. Can create desktop-style inner pages and legacy navigation. | Preserve for compatibility. Do not remove. New `RoleAppShell` contract added for gradual replacement. |
| `components/premium-dashboard.tsx` | older premium card/dashboard helper | Still used by many admin/deep pages and Digital Observer dashboard. Uses `premium-*` CSS classes. | Mark legacy. Do not use in new screens. Migrate screen-by-screen later. |
| `components/gan-batuach-design-system.tsx` | official current design system | Uses `gb-*` tokens and approved baseline language. | Keep as official DS. New shell contract composes it. |
| `components/parent-app-ui.tsx` | parent-specific frame | Has its own bottom nav/header/classes. Some pages combine it with `DashboardShell`. | Preserve. Gradual migration target: `RoleAppShell` adapter. |
| `components/staff-app-ui.tsx` | staff-specific frame using some GB DS | App-like but separate nav/header contract. | Preserve. Gradual migration target: `RoleAppShell`. |
| `components/inspector-app-ui.tsx` | inspector-specific frame using GB DS | App-like but separate nav/header contract. | Preserve. Gradual migration target: `RoleAppShell`. |
| `components/admin-app-ui.tsx` | admin-specific frame using GB DS | App-like but separate nav/header contract. | Preserve. Gradual migration target: `RoleAppShell`. |
| `components/app-motion-shell.tsx` | small animation shell | No major conflict by itself, but should not become a second page shell. | Preserve only as motion wrapper, not layout owner. |
| `components/role-app-shell.tsx` | new RESCUE 1 contract | None yet; not broadly applied. | Establish one future internal app shell contract. |

## Double Shell Risks Found

| Pattern | Current examples | Risk | RESCUE 1 status |
| --- | --- | --- | --- |
| `DashboardShell + ParentAppFrame` | `/dashboard/parent/discover-kindergartens` | Duplicate app chrome, duplicated spacing and desktop/app mismatch. | Documented; defer refactor to screen migration to avoid data-flow break. |
| `DashboardShell + role-specific frame` | possible in parent routes; staff/inspector mostly use one frame | Duplicate bottom nav/header. | New shell contract prevents future duplication. |
| `DashboardShell + premium-dashboard` | many admin/garden deep pages | Desktop admin control pages inside app surface. | Preserved for function; migrate later. |
| Public header/app bottom nav on auth/internal | login baseline previously had bottom nav in history | Must be separated by surface. | New surface rules documented; current approved login must remain auth-only. |

## Duplicated Navigation

- `DashboardShell` owns legacy sidebar/top navigation.
- `ParentAppFrame`, `StaffAppFrame`, `InspectorAppFrame`, `AdminAppFrame` own their own bottom navigation.
- `gan-batuach-design-system.tsx` owns `BottomNav` and `SidebarNav`.
- RESCUE 1 adds `RoleAppShell` with data-driven nav by role, so future pages can use one source.

## Legacy Sidebar Usage

Legacy sidebars remain in many admin pages and deeper garden pages. They are functionally preserved but visually inconsistent with the approved app baseline. These should be migrated after the role shell is adopted screen-by-screen.

## Max Width / Overflow Conflicts

Observed CSS risks:

- Old `.dashboard-layout`, `.dashboard-section`, `.premium-*` blocks may set different max-width, grid and padding behavior.
- Role frames use custom class trees (`parent-*`, `staff-*`, `inspector-*`, `admin-*`) with their own bottom nav calculations.
- Previous phase overrides appended at the end of `app/globals.css` can override approved `gb-*` behavior unpredictably.

RESCUE 1 adds controlled shell CSS in `app/styles/app-shell.css` and leaves legacy CSS untouched.

## Obsolete Or Legacy Wrappers

Legacy, not deleted:

- `premium-dashboard.tsx`
- `DashboardShell` for legacy pages
- role-specific frames until each role page is migrated
- `premium-*` class blocks in `app/globals.css`

Do not delete these until all dependent pages have been migrated and QA has passed.

