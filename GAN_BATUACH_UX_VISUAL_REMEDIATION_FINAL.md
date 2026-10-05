# GAN BATUACH UX VISUAL REMEDIATION FINAL

## Scope

- Source Development SHA: `eae08df1600ab7f2fb3049c765fa566edc66e8a0`
- Branch: `codex/ux-visual-remediation-final`
- Environment: DEVELOPMENT / INTEGRATION only
- Production access: NO
- Schema migrations: none
- New paid capability or provider: none
- Digital Observer core changes: none

This unit corrects the eight material mismatches from the independent owner visual verification while preserving the canonical role, authorization, tenant, Garden, provider-readiness, and domain models.

## Corrected domains

| Domain | Reference | Desktop | Mobile | Material correction | Remaining material deviation |
|---|---|---|---|---|---|
| Owner Onboarding | `GB_UX_REF_OWNER_ONBOARDING.png` | OWNER_APPROVED_CANDIDATE | OWNER_APPROVED_CANDIDATE | Added a guided navy rail, denser progress hierarchy, contextual cards, and stronger step composition. | None |
| Owner Dashboard | `GB_UX_REF_OWNER_CORE.png` | OWNER_APPROVED_CANDIDATE | OWNER_APPROVED_CANDIDATE | Restored a compact hero, six-metric row, operational cards, action center, and mobile hierarchy. | None |
| Children / Classrooms | `GB_UX_REF_CHILDREN_CLASSROOMS_PROFILE_ENROLLMENT.png` | OWNER_APPROVED_CANDIDATE | OWNER_APPROVED_CANDIDATE | Added real local Child portrait treatment, Classroom imagery, stronger capacity cards, tabs, and list density. | None |
| Parent — Assigned | `GB_UX_REF_PARENT_FULL_PLATFORM.png` | OWNER_APPROVED_CANDIDATE | OWNER_APPROVED_CANDIDATE | Strengthened Child and Garden identity, overview metrics, camera state, and action hierarchy. | None |
| Parent — Multi-Child | `GB_UX_REF_PARENT_FULL_PLATFORM.png` | OWNER_APPROVED_CANDIDATE | OWNER_APPROVED_CANDIDATE | Replaced the primary dropdown composition with visible Child cards, avatars, selected state, Garden association, and scoped links. | None |
| Safety / Cameras | `GB_UX_REF_SAFETY_CAMERAS_FULL_PLATFORM.png` | OWNER_APPROVED_CANDIDATE | OWNER_APPROVED_CANDIDATE | Added a rich camera-card grid with area imagery and truthful online, offline, degraded, setup, permission, and readiness states. | None; Live, recording, and AI remain explicitly unavailable unless proven. |
| Platform Admin | `GB_UX_REF_PLATFORM_ADMIN_FULL_PLATFORM.png` | OWNER_APPROVED_CANDIDATE | OWNER_APPROVED_CANDIDATE | Restored the navy Admin shell, KPI density, service health, charts, recent activity, approvals, complaints, subscriptions, and action center. | None |
| Settings / Account / Permissions | `GB_UX_REF_SETTINGS_ACCOUNT_PERMISSIONS_FULL_PLATFORM.png` | OWNER_APPROVED_CANDIDATE | OWNER_APPROVED_CANDIDATE | Replaced the oversized Desktop hero stack with compact navigation, profile, security/preferences, and Garden/subscription columns while retaining a purpose-built Mobile list. | None |

## Visual evidence

- [Owner review index](qa-evidence/ux-visual-remediation-final/owner-review-package/index.html)
- [Desktop master contact sheet](qa-evidence/ux-visual-remediation-final/owner-review-package/contact-sheets/desktop-master-contact-sheet.webp)
- [Mobile master contact sheet](qa-evidence/ux-visual-remediation-final/owner-review-package/contact-sheets/mobile-master-contact-sheet.webp)
- [Evidence manifest](qa-evidence/ux-visual-remediation-final/owner-review-package/manifest.json)
- [Screenshot inventory](qa-evidence/ux-visual-remediation-final/owner-review-package/screenshot-inventory.json)

The package contains exactly eight `APPROVED REFERENCE | ACTUAL DESKTOP | ACTUAL MOBILE` comparison boards captured from the running Development implementation at 1440 × 1024 and 390 × 844.

## Functional and security preservation

- Multi-Child selection remains server-scoped through the canonical `child` query context.
- Parent access remains Child- and Garden-scoped.
- Owner, Staff, Inspector, and Platform Admin authorization remains server enforced.
- Garden mutations continue to use the active verified Garden context.
- Camera cards never imply Live video, recording, AI detection, identity recognition, or retained evidence.
- Existing provider-readiness and billing states remain truthful.
- No canonical field, route, action, status distinction, audit behavior, or domain capability was removed.

## Validation

- TypeScript: PASS
- Lint regression baseline: PASS, zero regressions
- Production build: PASS, 541 routes/pages generated
- UX-03 through UX-19 focused suites: PASS
- Parent multi-Child contract: PASS
- Settings authenticated role/mutation checks: PASS against the isolated Development database
- Manager/Parent contract: 23/23 PASS
- Security gate: 11/11 PASS
- Migration health: PASS, 244 migrations, no new migration
- Release contract: PASS, no Production mutation
- Domain gate: 30/30 PASS after materializing the already tracked benchmark documents omitted by the sparse worktree; this UX unit does not modify Digital Observer core or weaken that gate.

## Final merged-head verification

After the PR is merged, `scripts/qa/capture-final-owner-v2-ux01-07.mjs` and `scripts/qa/build-final-owner-visual-verification-v2.mjs` regenerate the 21-domain owner package from the exact merged `origin/integration/development` SHA. The resulting package contains 326 Desktop screenshots, 326 Mobile screenshots, 21 comparison boards, two master contact sheets, checksums, and `GAN_BATUACH_FINAL_OWNER_VISUAL_VERIFICATION_V2.md`.

## Scope boundary

This task does not merge to `main`, deploy Production, run Production migrations, activate a paid provider, or begin RELEASE-GAP-01.
