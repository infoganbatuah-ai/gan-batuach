# UXV12 Parent primary truthful visual closure

Status: **IN PROGRESS — no visual acceptance claim**.

Source Development: `e305b8c749a392b0ff2b7c36b6ee9293d598cab3`.
Primary route: `/dashboard/parent`, single-child and multi-child states.
Reference: `GB_UX_REF_PARENT_FULL_PLATFORM.png` (approved Parent primary Desktop and Mobile panels).

## Direct comparison before edits

The UXV10 direct boards at `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/uxv10-parent-candidate-09967c56/boards/` remain before evidence only. The current exact Development source `e305b8c7` was opened in the canonical local Product with the synthetic two-child Parent. At Desktop width 1280, the sidebar and three-region operational row have comparable placement, but the implemented child selector, section headings and action labels are visibly smaller than the reference. The camera placeholder's two truthful status lines and its illustrative-image label overlap near the bottom. The first-row attendance panel also has less content because the isolated QA record does not contain a current arrival event. At Mobile width 390, DOM bounds show no horizontal overflow and the child selector, attendance and action rail remain in the reference order; the reference uses personal child photos and arrival events that are not authorized or present in the current QA state.

## Scoped correction

The Desktop Parent-primary CSS increases the prominence of child identity and section/action typography, and separates the camera status lines from the illustrative-image label. It changes no routes, data queries, permissions or capability claims. This correction requires a fresh actual Product capture before any visual status can be assigned. The reference's historical house mark cannot replace the current official mark. Missing child photographs, actual attendance timestamps and camera Live cannot be fabricated to imitate the collage.

## Required remaining proof

Local validation on the scoped source: `npm run typecheck` PASS; `npm run lint:ci` PASS with zero regressions against the tracked baseline; production-mode webpack build PASS (557 static pages). The default Turbopack build cannot resolve `next/package.json` through this feature worktree's external-drive `node_modules` symlink. The broad `npm run lint` still reports 4,693 existing errors and 159 warnings, exactly the counts accepted by the regression gate; no TypeScript/TSX source changed here. These results do not establish visual acceptance.

The isolated feature preview at `a3196244` used only the local Development backend and a synthetic two-child Parent. At 1440×1024 the camera status and illustrative-image label no longer visually collide; the key child and action labels are more prominent. The second Child selection changed the attendance context to that Child; at 390px the document width remained 390px with two Child cards. `qa:ux05-focused` passed 7/7, `check-uxv9-parent-context` passed 20 assertions, and `check-uxv6-child-context-contract` passed 9/9. The in-app browser's Mobile screenshot surface was scaled/cropped, so the mobile result is limited to DOM/layout checks and is not a full visual PASS. No actual child photograph, arrival event, or Live camera was inserted.

- Run exact-head PR gates, merge to `integration/development`, and re-capture from the exact merged head.
- Capture a reliable Mobile screenshot and compare both new images side by side with the approved reference, including RTL and focus.
- Record any remaining material reference deviation as `NEEDS_VISUAL_CORRECTION`; external owner approval remains separate.

No `main`, Production, Digital Observer core or paid supplier change is authorized by this unit.
