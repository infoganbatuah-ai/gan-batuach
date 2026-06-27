# RESPONSIVE FIX 2 – Visual Evidence Screenshot Plan

Date: 2026-06-28

## Automation Status

Browser automation could not be completed in this environment because the local Next.js server could not bind to `127.0.0.1:3030` (`listen EPERM`). No screenshot evidence is claimed for this phase.

## Required Viewports For Responsive QA 2

- 390 x 844
- 430 x 932
- 768 x 1024
- 1024 x 768
- 1366 x 768
- 1440 x 900

## Required Screenshots

Capture each surface at mobile, tablet and desktop where feasible:

- `/`
- `/app`
- `/login`
- `/register`
- `/dashboard/parent`
- `/dashboard/garden`
- `/dashboard/staff`
- `/dashboard/inspector`
- `/dashboard/admin`
- `/digital-observer/dashboard`
- one long form, preferably manager onboarding or inspection form
- one table/list, preferably admin users/payments/provider logs
- one modal/drawer, preferably admin full-management drawer or approval dialog

## Mobile Preview Checks

Capture at desktop size:

- `/dashboard/parent?view=mobile`
- `/dashboard/garden?view=mobile`
- `/dashboard/admin?view=mobile`
- `/digital-observer/dashboard?view=mobile`

Expected result:

- constrained mobile canvas
- mobile bottom navigation visible inside preview
- desktop sidebars hidden
- no data or permission change

## Pass Criteria

- no horizontal page overflow
- no hidden primary CTA
- no content trapped behind bottom navigation
- no header overlap
- tables/lists contained
- dialogs/drawers scroll internally
- desktop content centered and not stretched edge-to-edge
- tablet uses 1-2 column layout
- mobile remains app-like

