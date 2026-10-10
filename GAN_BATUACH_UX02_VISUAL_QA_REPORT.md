# Gan Batuach UX-IMPLEMENT-02 Visual QA

Date: 2026-09-24

Environment: isolated `DEVELOPMENT / INTEGRATION` application at `http://127.0.0.1:3001`, local Supabase at `127.0.0.1:55421`, synthetic QA identities and data only.

## Capture protocol

- Desktop: `1440×1024`.
- Mobile: `390×844`.
- Locale/direction: `he-IL`, RTL.
- Motion: reduced during deterministic capture.
- Persona: synthetic Owner+Teacher already authorized for multiple Gardens.
- Evidence: 22 WebP screenshots, `results.json` and `SHA256SUMS` under `qa-evidence/ux-implement-02/`.
- Browser assertions: no horizontal overflow, uncaught exception, console error or unexpected 500 response.

## Approved sources

- `GAN_BATUACH_BRAND_MARK.png` — official identity and blue family.
- `GB_UX_REF_AUTH_MASTER.png` — shared Auth-to-onboarding transition language.
- `GB_UX_REF_OWNER_ONBOARDING.png` — primary onboarding composition, stepper, cards, upload and success reference.
- `GB_UX_REF_OWNER_CORE.png` — authenticated shell, hierarchy and action language.

## Visual matrix

| Surface | Route/state | Screenshot pair | Status | Material deviation |
|---|---|---|---|---|
| Entry/welcome | `/onboarding/kindergarten?new=1` | `entry-desktop.webp`, `entry-mobile.webp` | VISUAL_PASS | Keeps the existing authenticated utility header and adds the full canonical entry form below the brand moment. |
| Owner role mode | Entry | `role-mode-desktop.webp`, `role-mode-mobile.webp` | VISUAL_PASS | Two canonical Owner choices replace the broader public role selector. |
| Garden details | Step 1 | `garden-details-desktop.webp`, `garden-details-mobile.webp` | VISUAL_PASS | Additional canonical business/contact fields extend the same form/card pattern. |
| Documents | Step 1 | `documents-desktop.webp`, `documents-mobile.webp` | VISUAL_PASS | Shows declarations and Document Center handoff; it does not falsely depict upload as verification. |
| Classrooms/capacity | Step 2 | `classrooms-desktop.webp`, `classrooms-mobile.webp` | VISUAL_PASS | Supports multiple Classrooms per age range and operational capacity rather than the concept's single count. |
| Staff readiness | Step 2 | `staff-desktop.webp`, `staff-mobile.webp` | VISUAL_PASS | Canonical invitation/employment truth replaces automatic Staff activation. |
| Safety/cameras | Step 2 | `safety-desktop.webp`, `safety-mobile.webp` | VISUAL_PASS | Readiness-only state; no fake Live, monitored state or AI incident. |
| Platform subscription | Step 3 | `subscription-desktop.webp`, `subscription-mobile.webp` | VISUAL_PASS | Provider-disabled/manual state is visibly truthful; Parent tuition is absent. |
| Children/Parent invitations | Step 4 | `children-parent-invitations-desktop.webp`, `children-parent-invitations-mobile.webp` | VISUAL_PASS | Signed invitation stays in the displayed authorized Garden; Child creation remains canonical post-activation. |
| Review | Step 5 | `review-desktop.webp`, `review-mobile.webp` | VISUAL_PASS | Summary reflects the just-saved draft rather than stale server props. |
| Activation success | Activated | `success-desktop.webp`, `success-mobile.webp` | VISUAL_PASS | Rendered only after atomic activation and context selection succeed. |

## Fidelity findings

- Official Gan Batuach brand component, deep navy-to-royal-blue hero, blue primary actions, light-blue background, white elevated surfaces, rounded cards and restrained shadows match the approved family.
- A legacy global `!important` rule initially recolored onboarding CTAs teal. The onboarding shell now explicitly preserves the canonical royal-blue action gradient and light-blue secondary controls. All evidence was recaptured after the correction.
- Desktop is a purpose-built wide workspace with a stable progress row and two-column content where useful. Mobile reflows to a single task column and sticky actions; it is not scaled desktop.
- The design stays calm under real canonical density by separating details, documents, Classrooms, Staff, Safety, subscription, invitations and review rather than placing everything on one page.
- No P0 screen retains legacy form styling. Empty, unavailable, pending, blocked, saving, error and success states share the UX-IMPLEMENT-01 language.

## Functional observations coupled to visual QA

- Owner-only and Owner+Teacher modes persist independently.
- Autosave/save-resume survives navigation and reload.
- Review uses the payload accepted by the server, including Garden name, address, phone and camera readiness.
- Classroom count ignores unselected age categories.
- Signed Parent invitation uses the server-authorized Garden context and rejects Garden substitution.
- Activation failure remains actionable; success is not optimistic.
- QA personas were retained. No customer or Production data appears in evidence.

## RTL and accessibility

- RTL reading order, back/continue arrows, cards, step progress, labels, mixed Hebrew/Email/numbers and currency were reviewed at both viewports.
- Radio cards have full-card pointer targets and visible keyboard focus.
- Progress, loading, save and success states have programmatic status semantics.
- Focus, visible labels, touch sizes, validation association and reduced motion meet the touched-surface baseline. No WCAG certification is claimed.

## Decision

`APPROVED GAN BATUACH VISUAL LANGUAGE PRESERVED: YES`

All required UX-IMPLEMENT-02 Desktop and Mobile targets are `VISUAL_PASS`. `VISUAL_PARTIAL: 0`; `VISUAL_FAIL: 0`.
