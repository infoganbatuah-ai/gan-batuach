# Gan Batuach Design System Rules

## Official Design System

`components/gan-batuach-design-system.tsx` is the official Gan Batuach Design System for all new or upgraded screens.

All new or upgraded screens must use the shared `gb-*` design tokens defined in `app/globals.css` for colors, radius, shadows, surfaces, spacing, and app layout behavior.

## Legacy Components

`components/premium-dashboard.tsx` is legacy.

Do not use `premium-dashboard.tsx` for new screens. Do not add new features to it. Existing screens that already depend on it may remain until they are migrated screen by screen with explicit approval.

Do not add new `premium-*` class usage in new or upgraded screens.

## Approved Baselines

The general login screen is the Auth / Brand Baseline.

The main Ganenet dashboard is the Dashboard Baseline.

Every new or upgraded screen must feel like it belongs to those approved baselines:

- Gan Batuach logo colors.
- Brand navy headings.
- Purple/blue action color.
- White and soft lavender background.
- Soft white cards.
- Large radius.
- Subtle blue/purple shadows.
- Full Hebrew RTL.
- Clean Hebrew typography.
- Premium mobile app spacing.

## Implementation Rules

Do not invent a new visual language.

Do not return to old desktop/admin UI.

Do not use generic tables as the primary experience when a card/list component can be used.

Do not create one-off CSS when an existing shared component or `gb-*` token can support the screen.

Do not refactor the entire system at once. Migrate existing screens gradually, one screen at a time.

## Visual Matching

Every new or upgraded screen must be visually matched against its approved reference image before being considered complete.

Mobile must match the reference composition as closely as practical without copying phone mockup elements such as status bar, Wi-Fi, battery, browser chrome, or device frame.

Desktop must preserve the same design language while expanding into a wider layout with app-like cards, grids, and navigation.

## Safety

UI work must not weaken or change authentication, routing, roles, Supabase access, RLS, payment logic, sensitive documents, medical data access, camera access, or AI access.
