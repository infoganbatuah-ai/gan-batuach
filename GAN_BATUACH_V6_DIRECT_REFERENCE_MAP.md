# Gan Batuach: direct reference-to-screen map

Source Development SHA: `0f923277fe1391323f3bacb469ef6b8aa6965600`.
The approved images are visual blueprints. An existing feature on another route is not evidence that the primary route matches its primary reference panel. Names, counts, and capability states may differ when driven by authorized data, but composition must be compared directly at 1440 × 1024 and 390 × 844.

This map is a preparation artifact, **not a visual pass report**. The V5 collage-level candidate labels are not inherited. Fresh running-product captures, aligned overlays, annotations, role/data probes, and review of the exact final Development SHA are still required. No owner approval is implied.

## Five owner-blocking primary screens

| Domain | Primary reference panel | Primary actual route/state | Reference element → actual element → required change | Evidence state |
| --- | --- | --- | --- | --- |
| Settings / Account / Permissions | `GB_UX_REF_SETTINGS_ACCOUNT_PERMISSIONS_FULL_PLATFORM.png`, upper desktop workspace; mobile Settings/Profile/Security/Garden panels | `/dashboard/garden/settings` (Owner); role-specific Settings routes are regression targets | Four simultaneous columns: navigation, editable profile, security/preferences, Garden/subscription → `.ux18-settings-layout`/`.ux18-settings-content` had the columns but the profile was read-only and its form was hidden in Garden details → render a compact, working profile form in the primary profile column, preserve the full Garden editor, and tune proportions | Source-level correction pending fresh Desktop/Mobile comparison and save-path QA |
| Platform Admin | `GB_UX_REF_PLATFORM_ADMIN_FULL_PLATFORM.png`, upper control center; lower mobile Admin panels | `/dashboard/admin` | Navy sidebar, KPI strip, two charts, service status, activity rail, three bottom tables → `.admin-literal-dashboard` contains these regions but their first-viewport sizes differ → calibrate chart/table/rail geometry and density in the same dashboard | Source-level correction pending fresh Desktop/Mobile comparison |
| Owner Dashboard | `GB_UX_REF_OWNER_CORE.png`, upper left desktop dashboard and upper right mobile dashboard | `/dashboard/garden` | Hero/image, compact KPI strip, three unequal daily panels, quick-action strip, operational cards → `.manager-reference-dashboard` had quick actions after operational cards → move quick actions directly after daily panels, then calibrate sizes | Source-level correction pending fresh Desktop/Mobile comparison |
| Parent Assigned | `GB_UX_REF_PARENT_FULL_PLATFORM.png`, middle-left assigned-parent dashboard and bottom-row mobile dashboard | `/dashboard/parent` with one authorized active child | Child identity, Garden context, attendance/camera/activity panels, operational actions → `parent-dashboard-home` contains these but the child and daily panels were too short/sparse → increase primary identity, panel, and action proportions while retaining truthful camera state | Source-level correction pending fresh Desktop/Mobile comparison |
| Parent Multi-Child | `GB_UX_REF_PARENT_FULL_PLATFORM.png`, middle-left Parent dashboard's visible child selector; bottom-row mobile dashboard is the closest available mobile panel. The collage has no separately labeled multi-child primary screen. | `/dashboard/parent` with two or more *authorized* children, switching via `?child=` | Multiple visible child cards, selected state, Garden association, child-scoped content → `.parent-child-card-selector` exists but lacks the reference's prominence; its status previously only said “selected/display” → enlarge the cards and show the actual enrollment state alongside selection, then verify immediate authorized context switching. Never add fictitious children to a live account. | Source-level correction pending fresh two-child persona capture; reference limitation documented |

The source collages are 1536 × 1024. Panel extraction must preserve labels and full screen boundaries; the crop itself is not an implementation screenshot. Parent assigned and multi-child share the closest approved dashboard panel, so their distinct states must be captured from separate actual authorized sessions and compared against the same visual blueprint without claiming a nonexistent dedicated multi-child reference.

The five Desktop and five corresponding Mobile reference crops were extracted without altering pixels and kept in the local owner-evidence folder `gan-batuach-v6-reference-prep/v6-primary-reference-crops/` under this task's visualization workspace. They are source references only. They are intentionally outside the public Git repository; fresh actual captures must be stored and labeled separately.

## Remaining 16 direct comparisons

Each row requires a specific reference panel crop and one actual route/state per Desktop and Mobile. A full collage against a route is insufficient. The listed routes are primary sampling points; extra P0 states remain in the existing product inventory.

| Domain | Approved reference | Primary actual route/state | Current direct-review state |
| --- | --- | --- | --- |
| Auth / Registration | `GB_UX_REF_AUTH_MASTER.png` | `/login` and registration role states | Not reverified on new SHA |
| Owner Onboarding | `GB_UX_REF_OWNER_ONBOARDING.png` | `/dashboard/garden/onboarding` | Not reverified on new SHA |
| Children / Classrooms / Child Profile / Enrollment | `GB_UX_REF_CHILDREN_CLASSROOMS_PROFILE_ENROLLMENT.png` | `/dashboard/garden/children`, `/dashboard/garden/children/[id]`, `/dashboard/garden/enrollment-requests`; classroom route from canonical inventory | Not reverified on new SHA |
| Parent Unassigned | `GB_UX_REF_PARENT_FULL_PLATFORM.png` | `/dashboard/parent` with no active Garden | Not reverified on new SHA |
| Attendance / Pickup | `GB_UX_REF_ATTENDANCE_PICKUP_OPERATIONS.png` | `/dashboard/garden/attendance`, `/dashboard/garden/pickup` | Not reverified on new SHA |
| Staff | `GB_UX_REF_STAFF_FULL_PLATFORM.png` | `/dashboard/staff` | Not reverified on new SHA |
| Candidate / Recruitment | `GB_UX_REF_STAFF_CANDIDATE_RECRUITMENT.png` | `/dashboard/staff/job-market` and candidate states | Not reverified on new SHA |
| Inspector | `GB_UX_REF_INSPECTOR_FULL_PLATFORM.png` | `/dashboard/inspector` | Not reverified on new SHA |
| Finance | `GB_UX_REF_FINANCE_FULL_PLATFORM.png` | `/dashboard/garden/finance`, `/dashboard/parent/payments` | Not reverified on new SHA |
| Messaging / Notifications | ` GB_UX_REF_MESSAGING_NOTIFICATIONS_FULL_PLATFORM.png` (filename begins with one space) | `/dashboard/garden/messages`, `/dashboard/garden/notifications` | Not reverified on new SHA |
| Documents | `GB_UX_REF_DOCUMENTS_FULL_PLATFORM.png` | `/dashboard/garden/documents` | Not reverified on new SHA |
| Tasks / Complaints / Corrective Actions | `GB_UX_REF_TASKS_COMPLAINTS_CORRECTIVE_ACTIONS.png` | `/dashboard/garden/tasks`, `/dashboard/garden/complaints`, `/dashboard/garden/corrective-actions` | Not reverified on new SHA |
| Inspections | `GB_UX_REF_INSPECTOR_FULL_PLATFORM.png` (inspection panel; no separately named inspection reference found) | `/dashboard/inspector/inspections` | Not reverified on new SHA |
| Reports / Analytics | `GB_UX_REF_REPORTS_ANALYTICS_FULL_PLATFORM.png` | `/dashboard/garden/reports` | Not reverified on new SHA |
| Safety / Cameras | `GB_UX_REF_SAFETY_CAMERAS_FULL_PLATFORM.png` | `/dashboard/garden/cameras` | Not reverified on new SHA; no unverified Live/AI claims |
| Global States / RTL / Accessibility | `GB_UX_REF_GLOBAL_STATES_RTL_ACCESSIBILITY_RESPONSIVE.png` | Representative loading, empty, denied, error, form, and mobile states | Not reverified on new SHA |

The approved folder contains 18 `GB_UX_REF_*.png` files, including the full-product overview, and the official brand mark. The inspection journey uses the inspection panel in the Inspector reference because no separate inspection-named image is present. Mark a state `NEEDS_VISUAL_CORRECTION` whenever the primary route's macro-composition or mobile composition differs materially; do not aggregate screenshots from secondary routes to pass a primary screen.
