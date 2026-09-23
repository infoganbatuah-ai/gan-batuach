# Gan Batuach UX-IMPLEMENT-01 Visual QA

Date: 2026-09-24  
Branch: `codex/ux-implement-01`  
Baseline: `origin/integration/development@4a677205bd60551dc8b690adedcca7c509e787da`  
Environment: isolated local Next.js runtime at `http://localhost:3012` with a non-Production loopback Auth responder and synthetic `example.test` identities only.

## Approved visual sources

- `/Users/danielderi/Downloads/GB_UX_REF_AUTH_MASTER.png` — primary Auth and registration composition.
- `/Users/danielderi/Downloads/GAN_BATUACH_BRAND_MARK.png` — official brand mark and color family.
- `/Users/danielderi/Downloads/GB_UX_REF_OWNER_CORE.png` — authenticated product visual language.
- `/Users/danielderi/Downloads/GB_UX_REF_OWNER_ONBOARDING.png` — stepper, form, upload and completion patterns.

The references define visual language and do not reduce the canonical product scope. UX-IMPLEMENT-01 applies the approved language only to the Global Design System and Auth/registration surfaces; the other canonical domains remain intact for their later visual batches.

## Capture protocol

- Desktop viewport: `1440×1024`.
- Mobile viewport: `390×844`.
- Locale/direction: `he-IL`, RTL.
- Motion: disabled during capture so screenshots are deterministic; reduced-motion support was also verified in CSS.
- Data: synthetic visual fixtures only. No customer or Production data appears in evidence.
- Evidence: 28 WebP captures plus `SHA256SUMS` under `qa-evidence/ux-implement-01/`.

## Core visual matrix

| Screen | Route | Viewports | Reference | Screenshot evidence | Status | Deviations |
|---|---|---|---|---|---|---|
| Welcome | `/app` | 1440×1024; 390×844 | Auth master welcome | `welcome-desktop.webp`, `welcome-mobile.webp` | VISUAL_PASS | Desktop keeps a separate sign-in CTA required by the canonical route; mobile places actions before secondary copy. |
| Login | `/app/login` | 1440×1024; 390×844 | Auth master account entry | `login-desktop.webp`, `login-mobile.webp` | VISUAL_PASS | Canonical Email/password login replaces the concept registration fields. |
| Role selection | `/app/register` | 1440×1024; 390×844 | Auth master role selector | `roles-desktop.webp`, `roles-mobile.webp` | VISUAL_PASS | Only four public paths appear: Owner/Garden, Parent, Staff and Inspector. Platform Admin is intentionally absent. |
| Owner registration | `/app/register/kindergarten` | 1440×1024; 390×844 | Auth master registration | `owner-desktop.webp`, `owner-mobile.webp` | VISUAL_PASS | Canonical account fields and Owner onboarding handoff are preserved. |
| Parent registration | `/app/register/parent` | 1440×1024; 390×844 | Auth master registration | `parent-desktop.webp`, `parent-mobile.webp` | VISUAL_PASS | Canonical family-profile handoff is preserved. |
| Staff registration | `/app/register/staff` | 1440×1024; 390×844 | Auth master registration | `staff-desktop.webp`, `staff-mobile.webp` | VISUAL_PASS | Candidate state is explicit; no Garden access is implied. |
| Inspector registration | `/app/register/inspector` | 1440×1024; 390×844 | Auth master registration | `inspector-desktop.webp`, `inspector-mobile.webp` | VISUAL_PASS | Application handoff is explicit; no approval or assignment is implied. |
| Email verification | `/app/verify-contact` | 1440×1024; 390×844 | Auth master envelope state | `verify-desktop.webp`, `verify-mobile.webp` | VISUAL_PASS | Backend truth controls completion; phone verification is not shown as required. |
| Registration success | role registration routes | 1440×1024; 390×844 | Auth master success state | `success-desktop.webp`, `success-mobile.webp` | VISUAL_PASS | Captured through an intercepted synthetic registration response; no Production or customer account was created. |
| Forgot password | `/forgot-password` | 1440×1024; 390×844 | Auth master state language | `forgot-desktop.webp`, `forgot-mobile.webp` | VISUAL_PASS | Privacy-safe acknowledgement does not disclose whether an account exists. |
| Reset password — valid | `/reset-password` | 1440×1024; 390×844 | Auth master form/state language | `reset-valid-desktop.webp`, `reset-valid-mobile.webp` | VISUAL_PASS | Captured with an isolated synthetic recovery session. |
| Reset password — success | `/reset-password` | 1440×1024; 390×844 | Auth master success state | `reset-success-desktop.webp`, `reset-success-mobile.webp` | VISUAL_PASS | Synthetic Auth endpoints verified update/sign-out state transitions; no plaintext password path was introduced. |
| Invitation — valid | `/invite/accept?token=…` | 1440×1024; 390×844 | Auth master entry/state language | `invitation-valid-desktop.webp`, `invitation-valid-mobile.webp` | VISUAL_PASS | Garden and recipient are safely summarized; the new-account link was asserted to retain the invitation token. |
| Invitation — expired | `/invite/accept?token=…` | 1440×1024; 390×844 | Auth master error state | `invitation-expired-desktop.webp`, `invitation-expired-mobile.webp` | VISUAL_PASS | Dedicated safe recovery state replaces generic 404/500 output. |

## Visual acceptance findings

- The official mark is used through one shared brand component. The exact owner-supplied source is retained in `public/assets/gan-batuach-brand-mark-official.png`; the normalized runtime asset preserves its shape while avoiding transparent source padding.
- The hero uses one optimized 126 KB WebP, a warm kindergarten image created specifically for this Auth shell without text, logo, cameras or identifying adults.
- Desktop uses a genuine split brand/form composition. Mobile removes the decorative split panel and uses a focused single-column flow rather than shrinking desktop.
- Brand-blue CTA styling is scoped over legacy rescue CSS, preventing teal or generic Bootstrap-like primary actions.
- Cards, fields, role tiles, step progress, status orbs, success/error notices, focus and press states use one token system.
- Registration success scrolls to the start of the state instead of preserving the form's previous scroll position.
- No horizontal overflow was found at 390 px on the P0 routes.

## Functional assertions coupled to visual QA

- Public role selector exposes Owner/Garden, Parent, Staff and Inspector only.
- Every role registration screen keeps its canonical fixed account type and role-specific next destination.
- Email verification remains the normal activation requirement; SMS and WhatsApp actions are absent while unavailable.
- Valid invitation registration keeps the signed token in the next URL.
- Expired invitation gives an explicit recovery path.
- Password reset valid, validation, update-success and local sign-out states render without raw Auth errors.
- Button busy/disabled states prevent visible double submission.
- Evidence contains no customer information or secrets.

## Accessibility and RTL

- Visible labels, programmatic button names, logical RTL spacing, correct back-arrow direction, LTR Email values, 44 px touch targets and focus-visible styling were verified on the captured routes.
- The password visibility control has an accessible name and does not disable password managers.
- Errors use `role="alert"` where the canonical form exposes them; success/error treatments pair text and icon with color.
- Decorative image treatment does not duplicate content to assistive technology.
- This is a touched-surface accessibility baseline, not a WCAG certification.

## Runtime observations

- Browser console contained no runtime exception, hydration error or React warning on the captured screens.
- Chrome emitted one advisory that reset-password forms may include a username field. The existing shared reset component is also used by Digital Observer and was intentionally not changed in this Management-only batch; the actual new-password fields remain labelled and use `autocomplete="new-password"`.
- No unexpected 500 response was observed. Expected mocked Auth and invitation state calls were bounded to the isolated loopback environment.

## Decision

`APPROVED GAN BATUACH VISUAL LANGUAGE PRESERVED: YES`

Every required UX-IMPLEMENT-01 desktop and mobile target is `VISUAL_PASS`. The implementation is suitable for PR qualification; this decision does not authorize Production or UX-IMPLEMENT-02.
