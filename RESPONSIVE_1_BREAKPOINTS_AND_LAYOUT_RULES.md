# RESPONSIVE 1 - Breakpoints And Layout Rules

Date: 2026-06-27

## Breakpoints

- Mobile: `max-width: 480px`
- Large mobile: `481px-640px`
- Tablet: `641px-1024px`
- Desktop: `1025px+`
- Wide desktop: `1440px+`

## CSS Variables

Central responsive variables are defined in `app/globals.css`:

- `--app-safe-top`
- `--app-safe-bottom`
- `--app-safe-left`
- `--app-safe-right`
- `--app-header-height`
- `--app-bottom-nav-height`
- `--app-bottom-nav-gap`
- `--app-bottom-nav-clearance`
- `--app-mobile-padding`
- `--app-tablet-padding`
- `--app-desktop-padding`
- `--app-content-max-width`
- `--app-mobile-preview-width`

## Layout Rules

1. Floating bottom navigation must always reserve bottom clearance on scrollable content.
2. Mobile grids collapse to one column at 480px and below.
3. Large mobile and tablet can use two-column grids where content remains readable.
4. Tables must not force page-wide overflow. Use contained horizontal scroll or card layouts.
5. Dialogs, drawers, filters and upload panels must fit inside `100dvh` and scroll internally.
6. Desktop app pages should be centered and constrained instead of stretching to full viewport width.
7. Public marketing pages may use full-width bands, but inner content and CTAs must remain responsive.
8. Forms must leave enough bottom space for keyboard plus bottom navigation.
9. Text and buttons must wrap rather than clip.
10. `100vw` should be avoided for inner app surfaces because it can create horizontal overflow.

## Implementation Notes

RESPONSIVE 1 intentionally keeps the new rules centralized at the end of `app/globals.css`.

The rules are defensive and scoped to existing app shell, frame, grid, table, drawer and bottom-nav classes. They do not alter data fetching, permissions, payment, camera or AI behavior.
