# PHASE 190E-FIX – Force App-Like Dashboards After Login

Date: 2026-06-18  
Scope: dashboard home screen UX only  
Do not push.

## Why 190E Did Not Visibly Change Enough

The previous pass improved parts of the shared shell and some copy, but several first-login surfaces still felt desktop/admin-like because:

- `/dashboard/garden` redirected directly to `/dashboard/garden/command-center`, so the manager did not get a true app home route.
- Parent/staff/inspector unassigned states still used older hero/cards and could feel like a dashboard page rather than a focused app state.
- Admin still surfaced a very large action grid too early, creating a wall-of-management feeling.
- Digital Observer dashboard still used the public/product page wrapper and long dashboard sections before a compact app-home layer.
- There was no reusable app-home component layer enforcing a consistent visual language across role home routes.

## Reusable Components Added

Updated `components/premium-dashboard.tsx` with reusable app-home components:

- `AppHomeShell`
- `AppHomeHero`
- `AppHomeSection`
- `AppHomeGrid`
- `AppStatusCard`
- `AppQuickAction`
- `AppEmptyState`

These are presentation-only components. They do not alter permissions, queries, authentication, RLS, payments, camera logic, AI logic, documents, or medical data access.

## Shared Layout / Navigation Updates

Updated `components/dashboard-shell.tsx`:

- Manager/owner home route now points to `/dashboard/garden`.
- Staff home route now points to `/dashboard/staff`.
- Inspector home route now points to `/dashboard/inspector`.
- Parent home route now points to `/dashboard/parent`.
- Mobile manager tab now points to `/dashboard/garden` instead of command-center.

Detailed routes remain accessible:

- `/dashboard/garden/command-center`
- `/dashboard/staff/operations`
- `/dashboard/inspector/control-center`
- `/dashboard/parent/family-home`
- All existing admin and management routes

## Dashboard Pages Updated

### `/dashboard/parent`

Changed first screen to an app-like parent home:

- Welcome/status hero
- Child profile status
- Enrollment request status
- Payment pending status
- Kindergarten access status
- Quick actions:
  - add child
  - discover safe kindergartens
  - view requests
  - notifications
  - profile
- Child profile form remains available lower on the page.
- Parent still sees only own/self-service state before approval.

### `/dashboard/garden`

Changed from redirect-only route to a real manager app home:

- Garden status
- Gan Batuach subscription status
- Active children count
- Enrollment request count
- Staff status
- Document status
- Next inspection
- Quick actions:
  - add child
  - invite parent
  - enrollment requests
  - add staff
  - upload document
  - payments
  - inspections
- Full command center remains available through `/dashboard/garden/command-center`.

### `/dashboard/staff`

Updated unassigned staff state:

- App-style hero for “not assigned yet”
- Application count
- Access blocked card before approval
- Profile/document next action
- Job market and notification actions
- Active staff dashboard remains functional and is wrapped in the app-home shell.

### `/dashboard/inspector`

Updated pending inspector state:

- App-style hero for pending admin approval
- Explicit blocked garden access before approval
- Application action card
- Notification action card

Updated approved inspector home:

- Added compact app status cards for assigned gardens, upcoming inspections, overdue inspections and alerts.
- Existing inspection workflows and assigned-garden lists remain intact.

### `/dashboard/admin`

Kept admin depth but reduced first-screen overload:

- Wrapped admin dashboard in `AppHomeShell`.
- Moved the large all-modules action grid behind a “ניהול מלא” drawer.
- Top-level operational cards, safety panels and executive KPIs remain visible.
- All admin management links remain preserved.

### `/digital-observer/dashboard`

Updated top screen to a Digital Observer app home:

- App-style owner/site hero
- Site/camera/alert/billing/setup/AI status cards
- Quick actions for onboarding, cameras, alerts and billing
- Existing details, readiness sections, camera list, events, analytics and admin overview remain available below.
- No live AI/camera claims were added.

## CSS Added

Updated `app/globals.css` with PHASE 190E-FIX app-home styling:

- `.app-home-shell`
- `.app-home-hero`
- `.app-home-grid`
- `.app-status-card`
- `.app-quick-action`
- `.app-home-section`
- `.app-empty-state`
- `.app-home-list`
- `.app-management-drawer`
- Digital Observer dashboard app constraints

Mobile behavior:

- Single-column cards
- Large tappable actions
- Full-width action buttons in hero areas
- Reduced card radius and spacing on small screens
- No table-first layout on home routes

Desktop behavior:

- Centered max-width app surface
- Clean card grid
- Detailed management still accessible, but no longer dominates the first screen.

## Preserved Features

No dashboard features were removed.

Preserved:

- children
- parents
- staff
- documents
- payments
- subscriptions
- inspections
- messages
- enrollment requests
- staff applications
- inspector workflows
- admin operational dashboards
- provider health routes
- launch dashboards
- Digital Observer details
- detailed management pages

## Sensitive Logic Status

Not touched:

- RLS
- authentication architecture
- payment logic
- subscription activation logic
- camera gateway logic
- AI core logic
- medical data permissions
- sensitive document permissions
- database migrations

## Verification

Commands run:

- `npm run typecheck` ✅
- `npm run build` ✅
- `git diff --check` ✅

Browser/dev-server note:

- Local dev server could not be started in this sandbox because binding to a local port failed with `listen EPERM`.
- Visual browser screenshot QA remains recommended on a machine/session where the dev server can bind to localhost.
- Build-time route generation succeeded for the target dashboard routes.

Build generated all target routes:

- `/dashboard/parent`
- `/dashboard/garden`
- `/dashboard/staff`
- `/dashboard/inspector`
- `/dashboard/admin`
- `/digital-observer/dashboard`

## Remaining UX Blockers

No blocking build or route issues remain from this phase.

Recommended next QA:

- Browser/mobile viewport screenshot pass for:
  - `/dashboard/parent`
  - `/dashboard/garden`
  - `/dashboard/staff`
  - `/dashboard/inspector`
  - `/dashboard/admin`
  - `/digital-observer/dashboard`

This is visual verification only; no security-sensitive follow-up is required from this phase.
