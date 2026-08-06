# PRODUCT REALITY FIX 1 - Responsive Runtime Root Cause Audit

Date: 2026-08-06

## Scope

Audited the app shell, dashboard shells, global CSS, responsive CSS contract, role dashboard primitives, and mobile preview handling.

## Root Causes Found

| Severity | File | Area | Exact issue | Required fix |
|---|---|---|---|---|
| Critical | `app/layout.tsx` | All app dashboards | `app/styles/app-shell.css` existed but was not imported. Components such as `RoleAppShell` depend on variables and classes from this stylesheet, so layout could render without the intended shell contract on first load. | Import the app-shell stylesheet before responsive rescue overrides. |
| High | `components/app-motion-shell.tsx` | Desktop/mobile switching | `?view=mobile` persisted `gan-batuach-view-mode` in `localStorage`. A previous preview could force normal desktop sessions into mobile-preview behavior until the user changed state, making the UI seem to “wake up” only after resize/manual changes. | Make mobile preview URL-scoped only; do not persist it. |
| High | `app/styles/responsive-contract.css` | Runtime layout variables | The responsive contract did not define default shell variables for `.gb-app-shell` / `.role-app-shell` before media queries. Some shell sizing depended on CSS imported elsewhere or later overrides. | Add first-load shell variable defaults and viewport-specific values. |
| Medium | Global CSS stack | All roles | Multiple historical CSS layers still exist. Some are valid, but this increases override risk. | Do not add a new uncontrolled override block; strengthen a single contract layer and document remaining QA need. |
| Medium | Role dashboard evidence | Manager/staff/inspector/admin/DO | Full authenticated dashboard acceptance is still blocked until all demo sessions are available. | Continue with authenticated QA after this fix. |

## Conclusion

The first-load responsive failure had real root causes, not only visual polish issues. The strongest confirmed causes were a missing stylesheet import and persisted mobile-preview state.
