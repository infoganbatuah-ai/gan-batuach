# RESPONSIVE FIX 2 – Layout Contract

Date: 2026-06-28

## Viewport Categories

| Category | Width |
|---|---|
| Mobile | up to 480px |
| Large mobile | 481-640px |
| Tablet | 641-1024px |
| Desktop | 1025-1439px |
| Wide desktop | 1440px+ |

## Layout Modes

| Mode | Rule |
|---|---|
| `mobile_app` | Single-column app layout, mobile bottom nav, safe-area bottom padding, no horizontal overflow. |
| `tablet_app` | 1-2 column layout, mobile-style safe spacing, no desktop sidebar wall. |
| `desktop_app` | Centered desktop canvas, desktop shell/sidebar where available, no mobile bottom nav. |
| `desktop_mobile_preview` | Optional constrained mobile canvas on desktop, activated by `?view=mobile` or local view-mode storage. |

## Global Contract

- Shells must be full-width containers, but content must be centered and capped on desktop.
- Mobile and tablet pages must reserve space for floating bottom navigation.
- Desktop must not show mobile bottom navigation unless mobile preview is enabled.
- Tablet must not inherit broken desktop sidebars.
- Tables and logs must scroll inside their containers instead of overflowing the whole app.
- Dialogs and drawers must fit inside the viewport and scroll internally.
- Mobile preview must not change data, permissions, auth, RLS, provider modes or server behavior.

## Implemented CSS Variables

- `--rfx-mobile-max`
- `--rfx-large-mobile-max`
- `--rfx-tablet-max`
- `--rfx-desktop-max`
- `--rfx-wide-max`
- `--rfx-mobile-preview-width`
- `--rfx-gutter-mobile`
- `--rfx-gutter-tablet`
- `--rfx-gutter-desktop`
- `--rfx-bottom-nav-clearance`

## Implementation Location

The final contract lives in:

`app/styles/responsive-contract.css`

It is imported after `globals.css` from `app/layout.tsx`, so it acts as the final layout stabilizer.

