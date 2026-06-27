# RESPONSIVE 1 - CSS Layout Cleanup Report

Date: 2026-06-27

## Issues Found

- Multiple app surfaces use floating bottom navigation.
- Several legacy/mobile-specific sections use fixed or constrained dimensions.
- Admin and report pages still contain wide tables.
- Some grids could keep multi-column layouts at mobile widths.
- Dialogs, drawers and management sections need internal scrolling on small screens.
- Desktop app pages need width constraints to avoid stretching into data walls.

## Fixes Made

- Added centralized safe-area variables.
- Standardized bottom navigation clearance.
- Added global mobile grid collapse rules.
- Added tablet two-column guard rules.
- Added table safe-scroll wrappers for common table classes and direct table containers.
- Added dialog/drawer max-height and internal scrolling rules.
- Added text and button wrapping guards.
- Added image/media max-width guards.
- Added desktop max-width constraints for app-like surfaces.
- Added optional mobile-preview canvas mode.

## What Was Not Changed

- No product redesign.
- No route removal.
- No auth, RLS, payment, camera gateway or AI core changes.
- No sensitive document or medical permission changes.

## Remaining Risks

- Some legacy pages may still contain page-specific `overflow: hidden` or `width: 100vw` rules that need visual QA.
- Complex charts may need component-level responsive containers in a later pass.
- Some admin tables may still be better converted to mobile cards after visual inspection.
- Real keyboard behavior needs device/browser validation, especially iOS Safari.
