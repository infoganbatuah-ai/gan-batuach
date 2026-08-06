# UX/UI RESCUE 3 - Visual Evidence Or Manual Screenshot Plan

Date: 2026-08-06

## Evidence Status

Partial automated screenshot evidence was captured after starting the local preview server with approval because the sandbox blocked the first server attempt with `EPERM`.

Evidence folder:

- `qa-evidence/ux-ui-rescue-3/`

Captured screens:

- `home-mobile-390x844.png`
- `app-gateway-mobile-390x844.png`
- `register-mobile-390x844.png`
- `digital-observer-mobile-390x844.png`
- `home-desktop-1440x900.png`
- `app-gateway-desktop-1440x900.png`
- `register-desktop-1440x900.png`
- `digital-observer-desktop-1440x900.png`
- `app-gateway-mobile-after-wait-390x844.png`

Automated metrics for these public/auth screens showed no horizontal overflow at the tested widths. The first screenshot batch caught the branded splash before it fully cleared, so `components/app-motion-shell.tsx` was updated to unmount the splash after the fade-out completes.

This evidence is useful but not enough for final acceptance because authenticated role dashboards were not tested with signed-in pilot accounts in this phase.

## Manual Screenshot Plan

UX/UI QA 3 should still capture screenshots for:

Viewports:

- 390 x 844
- 430 x 932
- 768 x 1024
- 820 x 1180
- 1024 x 768
- 1366 x 768
- 1440 x 900
- 1920 x 1080

Screens:

- public home
- app gateway
- login/register
- parent dashboard
- manager dashboard
- staff dashboard
- inspector dashboard
- admin dashboard
- Digital Observer dashboard
- one long form
- one table/list
- one modal/drawer
- camera readiness state
- AI readiness state
- payment readiness state

Authenticated role screens remain mandatory because this rescue directly changed app-dashboard shell behavior.

Acceptance:

- no cut-off
- no hidden CTA
- no horizontal overflow
- no header/bottom-nav overlap
- desktop is organized
- mobile feels app-like
- tablet is coherent
- every disabled button explains readiness/blocking reason
