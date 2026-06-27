# RESPONSIVE FIX 2 – Desktop/Mobile Layout Architecture Report

Date: 2026-06-28

## Result

Responsive architecture was rebuilt through a final layout contract imported after global CSS. The fix targets shell behavior, desktop canvas width, mobile/tablet safe areas, bottom navigation conflicts, table/list overflow, modal fit and mobile preview isolation.

## Root Causes Found

- Multiple shell systems were active at once.
- Desktop and mobile nav rules conflicted.
- Desktop max-width rules were inconsistent.
- Tablet layout had no stable contract.
- Historical route-specific CSS overrode newer app-like UI.
- Mobile preview mode existed but was not fully separated from normal desktop.

## Fixes Made

- Added `app/styles/responsive-contract.css`.
- Imported the responsive contract after `globals.css`.
- Added shared shell/page classes to `AppShell`, `ResponsivePage`, and `DashboardShell`.
- Centralized viewport categories and spacing variables.
- Hid mobile navs on desktop unless mobile preview is active.
- Preserved mobile bottom navigation and safe-area clearance on mobile/tablet.
- Centered and capped desktop dashboard content.
- Added table/list overflow containment.
- Added dialog/drawer viewport containment.
- Stabilized optional mobile preview mode.

## Desktop Status

Status: improved and ready for Responsive QA 2.

Expected behavior:

- 1366 x 768: centered canvas, no edge-to-edge stretching.
- 1440 x 900: centered desktop layout with controlled max-width.
- 1920 x 1080: wide screens remain aligned instead of becoming scattered.

## Mobile Status

Status: improved and ready for Responsive QA 2.

Expected behavior:

- 390 x 844 and 430 x 932 use single-column layout.
- Bottom navigation reserves safe-area space.
- Forms and CTAs have bottom clearance.
- Horizontal overflow is contained.

## Tablet Status

Status: improved and ready for Responsive QA 2.

Expected behavior:

- 768 x 1024 and 820 x 1180 use 1-2 column layouts.
- 1024 x 768 avoids desktop side-wall behavior.
- Bottom navigation does not cover content.

## Mobile Preview Mode

Status: implemented and stabilized.

Use `?view=mobile` to enable and `?view=desktop` to reset. The mode is local only and does not affect permissions, data or server logic.

## Tables, Lists And Long Content

Status: improved.

Tables/logs/lists now use safe horizontal containment where they cannot fit mobile width.

## Forms, Modals And Drawers

Status: improved.

Dialogs and drawers now have viewport max-height and internal scroll behavior.

## Screenshots / Evidence

Browser screenshot automation could not be completed in this environment because the local Next.js server could not bind to `127.0.0.1:3030` (`listen EPERM`). This phase does not claim screenshot evidence.

A manual/automated screenshot plan was created:

`RESPONSIVE_FIX_2_VISUAL_EVIDENCE_SCREENSHOT_PLAN.md`

Suggested QA viewports:

- 390 x 844
- 430 x 932
- 768 x 1024
- 1024 x 768
- 1366 x 768
- 1440 x 900

## Remaining Blockers

No blocking build/type errors found at the time of this report.

Remaining responsive risk:

- Some deeply custom route-level modules may still need visual QA-specific tuning.
- The large historical global CSS file remains architectural debt.

## Recommendation

Responsive QA 2 can begin after final verification passes.
