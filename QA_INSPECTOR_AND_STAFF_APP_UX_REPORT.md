# QA Inspector And Staff App UX Report

## Scope

- Inspector dashboard routes were checked after the app-style migration.
- Staff dashboard routes were upgraded and checked after the teacher dashboard baseline was accepted.
- Garden camera page was checked for duplicate/broken camera surfaces.
- Global bottom navigation behavior was hardened for teacher, parent, staff and shared app shells.

## Inspector QA Result

- `/dashboard/inspector`
- `/dashboard/inspector/apply`
- `/dashboard/inspector/cameras`
- `/dashboard/inspector/command-center`
- `/dashboard/inspector/compliance`
- `/dashboard/inspector/inspections`
- `/dashboard/inspector/inspections/due`
- `/dashboard/inspector/inspections/history`
- `/dashboard/inspector/notifications`
- `/dashboard/inspector/observer-network`
- `/dashboard/inspector/observer-pilot`
- `/dashboard/inspector/ratings`
- `/dashboard/inspector/reports`
- `/dashboard/inspector/risk`
- `/dashboard/inspector/settings`
- `/dashboard/inspector/tasks`
- `/dashboard/inspector/violations`
- `/dashboard/inspector/ai-events`

Status: passed static UX/code QA.

Findings:
- No remaining `DashboardShell`, `premium-dashboard`, `premium-*`, `dashboard-section`, `procedure-card`, or `dashboard-hero-card` usage in inspector routes.
- Inspector routes use the new app-like inspector shell and shared design system patterns.
- No RLS, auth, payment, camera gateway, AI core or sensitive permission logic was changed.

## Staff Upgrade And QA Result

Routes upgraded:

- `/dashboard/staff`
- `/dashboard/staff/attendance`
- `/dashboard/staff/background`
- `/dashboard/staff/cameras`
- `/dashboard/staff/certificates`
- `/dashboard/staff/child-journal`
- `/dashboard/staff/daily-journal`
- `/dashboard/staff/documents`
- `/dashboard/staff/incidents`
- `/dashboard/staff/job-market`
- `/dashboard/staff/messages`
- `/dashboard/staff/notifications`
- `/dashboard/staff/operations`
- `/dashboard/staff/settings`
- `/dashboard/staff/shifts`
- `/dashboard/staff/tasks`

Status: passed static UX/code QA.

Safe fixes made:
- Removed legacy `DashboardShell` usage from staff routes.
- Removed `premium-dashboard` usage from staff routes.
- Reconnected staff screens to the official `gan-batuach-design-system.tsx` via staff app wrappers.
- Kept existing data loading, Supabase calls, forms and business flows.
- Added consistent app header, bottom navigation, cards, status chips, metric cards and section structure.
- Improved staff camera route to use app-like cards and not expose internal camera secrets.

## Garden Camera Fix

Route:

- `/dashboard/garden/cameras`

Status: fixed.

Fixes:
- The upper camera gallery now uses the real `CameraPlaybackCard` playback surface instead of a static fake preview.
- The lower camera manager no longer duplicates the health/playback center on the garden camera page.
- Camera management, add camera flow and Gateway actions remain available in the management details area.

## Bottom Navigation Fix

Status: fixed for shared app shells.

Fixes:
- Bottom navigation is forced to fixed positioning for app dashboards.
- Content wrappers now receive enough bottom clearance so cards can scroll above the nav.
- This targets teacher, parent, staff and shared `gb-app-shell` based pages.

## Verification

- `npm run typecheck`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

## Not Touched

- RLS.
- Auth architecture.
- Payment/subscription logic.
- Sensitive documents and medical access.
- Camera gateway logic.
- AI core logic.

## Remaining Recommendation

- Run a manual browser QA pass for staff and inspector routes with real demo users.
- Keep admin UX and admin QA as the next isolated phase, as requested.
