# RESPONSIVE FIX 2 – Global CSS Conflict Cleanup Report

Date: 2026-06-28

## Findings

The app had several responsive conflict classes inside `app/globals.css`:

- repeated bottom-nav rules
- repeated `dashboard-layout` and `app-home-layout` overrides
- fixed and semi-fixed max-width rules
- route-specific frame classes for parent, staff, inspector and manager screens
- several late-stage `!important` layout patches
- mobile preview rules embedded in the main global CSS file

## Cleanup Strategy Used

Instead of deleting large historical blocks, this phase added a small final contract layer:

`app/styles/responsive-contract.css`

This avoids risky removal of old route-specific styling while providing one final source of truth for:

- shell width
- content max-width
- desktop sidebar behavior
- mobile/tablet bottom nav clearance
- table/list overflow
- modal/drawer viewport fit
- mobile preview isolation

## Why Not Delete Old CSS Now

The old CSS contains many page-specific visual treatments. Removing it in this phase would risk redesigning screens or breaking role-specific modules. The safer path was to stabilize layout behavior with a post-global contract and document future cleanup.

## Future Cleanup Recommendation

After Responsive QA 2 passes, split `app/globals.css` into:

- public site styles
- auth/app-entry styles
- dashboard shell styles
- role module styles
- table/form/dialog utilities
- mobile/native app styles

