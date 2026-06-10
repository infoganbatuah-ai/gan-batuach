# UX Debt Register

Date: 2026-06-11

Scope: Gan Batuach dashboards, shared shell, reusable dashboard components, camera/observer/admin operational screens, parent/staff/manager/inspector surfaces.

| Area | Issue | Severity | Recommendation |
| --- | --- | --- | --- |
| Admin navigation | Admin sidebar contains too many destinations for a first-level work surface. Grouping exists, but the mental load is still high. | High | Keep the grouped sidebar, then promote only daily operational areas and move diagnostics/readiness pages under a single "operations" section. |
| Mixed language | Several admin and camera screens still mix Hebrew with English operational terms such as Push Production, Replay, Provider, Gateway, Token, Mock and Session. | High | Complete a localization pass with Hebrew labels for user-facing text and reserve English only for provider names or developer-only diagnostics. |
| Technical camera language | Camera readiness screens still expose infrastructure wording in admin-facing UI. Parent-facing UI is cleaner, but admin screens need more business language. | High | Use "חיבור וידאו", "מקור שידור", "צפייה מאובטחת" and "בדיקה" instead of infrastructure names in visible labels. |
| Dashboard density | Some dashboards still open with oversized hero sections and too many cards above the fold. | High | Apply the executive dashboard pattern: attention first, 3-5 KPIs second, recent activity third. |
| Empty states | Empty states are more polished visually, but many are generic and do not always offer a next action. | Medium | Add a clear explanation and one primary action to every empty state. |
| Mobile navigation | Bottom navigation exists, but complex admin/manager destinations still require too many taps. | Medium | Keep the mobile bottom nav focused on daily actions and use the floating action center for role-specific creation flows. |
| Card styling | Historical CSS layers create inconsistent card radius, shadows and spacing across older modules. | Medium | Continue migrating screens to the shared token layer and reusable dashboard components. |
| Accessibility | Focus states and reduced motion are now defined globally, but keyboard testing needs a live browser pass. | Medium | Run manual keyboard navigation and screen reader checks once local browser binding is available. |
| Tables and lists | Large list pages still look operational and dense in places, especially admin lists. | Medium | Prefer compact list cards on mobile and tighter table/list hierarchy on desktop. |
| Localization readiness | Text strings are embedded across many components and pages. | Medium | Move dashboard copy toward a localization dictionary before public pilot expansion. |
| Scrolling QA | CSS now avoids scroll traps at the shell level, but manual browser QA could not be completed in this environment if local server binding is blocked. | High | Verify desktop, tablet and 360-414px mobile scroll behavior in a running browser before release. |
| Visual hierarchy | Parent and manager dashboards are improved by prior phases but not every secondary screen has equal polish. | Medium | Prioritize finance, children, parents, staff, cameras and observer-intelligence for a final page-by-page visual pass. |
