# RESPONSIVE FIX 2 – Mobile Preview Mode Report

Date: 2026-06-28

## Status

Mobile preview mode exists and was stabilized.

## Activation

- Query param: `?view=mobile`
- Reset to desktop: `?view=desktop`
- The selected mode is stored locally under `gan-batuach-view-mode`.

## Behavior

When mobile preview is active:

- The app is constrained to a `430px` mobile-like canvas on desktop.
- Mobile bottom navigation is shown inside the preview canvas.
- Desktop sidebars are hidden inside preview.
- Major dashboard grids collapse to one column.
- No data, role, permission, auth, RLS or server behavior changes.

## Guardrail

Normal desktop users still receive desktop layout unless they explicitly enable mobile preview.

