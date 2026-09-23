# Gan Batuach — UX-IMPLEMENT-01 design-system implementation

## Scope

This batch applies the approved Management visual direction to the shared tokens and to the authenticated-entry journeys only: login, role selection, role-specific account registration, Email verification, password recovery and signed-invitation entry. It does not alter authorization, Auth callbacks, role routing, onboarding domain forms, data models or Production.

## Tokens

The existing `gb-*` token system remains the sole theme system. UX-IMPLEMENT-01 normalizes it around the approved logo-derived deep blue: `--gb-primary` `#1254b8`, `--gb-primary-dark` `#082d6d`, light blue surfaces, restrained semantic state colors, 12/16/22/28/36px radii and soft blue elevation.

## Shared components

Existing `PremiumCard`, `ActionCard`, `DashboardGrid`, `FormField`, `ProgressStepper`, `StatusChip` and button classes are retained. The batch gives their Auth use a consistent focus ring, touch target, primary gradient, motion and reduced-motion behavior. It does not introduce another component library.

## Auth shells

Desktop uses a right-to-left form surface paired with a logo-derived blue Garden story panel using the existing approved project image. Mobile suppresses the decorative panel and keeps logo, headline and task form above the fold. The application shell and authenticated bottom navigation remain absent from Auth screens.

## RTL and accessibility

Layouts use logical CSS properties, visible focus, 44px minimum interactive targets and LTR Email input content inside RTL forms. The login password field now has an operable, labelled show/hide control. Existing labels, `autocomplete` values, password-manager support and server error boundaries are retained. Animations are cosmetic and disabled for reduced-motion users. Management Auth pages also have a CSS splash-exit fallback so delayed hydration cannot leave a blocking splash over the form.

## Functional boundaries

Email remains sufficient for standard account activation. Phone, SMS and WhatsApp are not made mandatory and no provider CTA is introduced. Invitations retain recipient binding and their existing registration/verification resume path. Recovery remains a one-time Supabase Auth flow and no temporary password is introduced.

## Visual acceptance

Review desktop and mobile welcome/login, role selection, a role-specific registration form, Email verification, invalid invitation and recovery/reset states against the approved direction: deep blue brand areas, light surfaces, rounded cards, restrained shadows, Hebrew hierarchy, clear CTA and no legacy dashboard chrome.

The route-by-route visual evidence and remaining terminal-state gaps are recorded in `GAN_BATUACH_UX01_VISUAL_QA_REPORT.md`.
