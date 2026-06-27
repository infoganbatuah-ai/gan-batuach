# RESPONSIVE 1 - Mobile Preview Mode

Date: 2026-06-27

## Purpose

Mobile Preview Mode lets QA, demos and desktop users view the app in a mobile-like canvas from a desktop browser.

It is visual-only:

- does not change permissions
- does not change data
- does not change server-side logic
- does not enable or disable product features

## How To Enable

Open any route with:

```text
?view=mobile
```

Example:

```text
/dashboard/parent?view=mobile
```

The preference is stored in local browser storage as:

```text
gan-batuach-view-mode=mobile
```

## How To Disable

Open any route with:

```text
?view=desktop
```

Example:

```text
/dashboard/parent?view=desktop
```

## Behavior

When enabled:

- page content is constrained to a mobile canvas width
- app sidebars are hidden in favor of bottom navigation where the existing UI supports it
- app grids collapse to one column
- bottom navigation is aligned to the mobile preview canvas
- functionality remains unchanged

## Implementation

Implemented in:

- `components/app-motion-shell.tsx`
- `app/globals.css`

The mode is controlled client-side only by the CSS class:

```text
gb-mobile-preview-mode
```
