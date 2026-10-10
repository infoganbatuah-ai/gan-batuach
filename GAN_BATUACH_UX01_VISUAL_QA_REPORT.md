# Gan Batuach UX-IMPLEMENT-01 Visual QA

Date: 2026-09-24

Branch: `codex/ux-implement-01-reference-closure`

Baseline: `origin/integration/development@5c44c8b4177c9ea34b00620665030391f4bd44fd` after PR #128 and its integration-closure PR #129 had already merged. PR #128 is therefore immutable; this evidence refresh and visual correction are carried by a scoped follow-up PR.

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
- Evidence: 38 WebP captures plus `SHA256SUMS` under `qa-evidence/ux-implement-01/`.
- Re-review scope: all original P0 Auth targets plus login error, verification unavailable, invalid recovery, invitation loading and wrong-recipient states.

## Core visual matrix

| Screen | Route | Viewports | Reference | Screenshot evidence | Status | Deviations |
|---|---|---|---|---|---|---|
| Welcome | `/app` | 1440×1024; 390×844 | Auth master welcome | `welcome-desktop.webp`, `welcome-mobile.webp` | VISUAL_PASS | Desktop keeps a separate sign-in CTA required by the canonical route; mobile places actions before secondary copy. |
| Login | `/app/login` | 1440×1024; 390×844 | Auth master account entry | `login-desktop.webp`, `login-mobile.webp` | VISUAL_PASS | Canonical Email/password login replaces the concept registration fields. |
| Login — safe error | `/app/login?error=…` | 1440×1024; 390×844 | Auth master error language | `login-error-desktop.webp`, `login-error-mobile.webp` | VISUAL_PASS | A friendly actionable message is shown inside the form; no raw provider payload is exposed. |
| Role selection | `/app/register` | 1440×1024; 390×844 | Auth master role selector | `roles-desktop.webp`, `roles-mobile.webp` | VISUAL_PASS | Only four public paths appear: Owner/Garden, Parent, Staff and Inspector. Platform Admin is intentionally absent. |
| Owner registration | `/app/register/kindergarten` | 1440×1024; 390×844 | Auth master registration | `owner-desktop.webp`, `owner-mobile.webp` | VISUAL_PASS | Canonical account fields and Owner onboarding handoff are preserved. |
| Parent registration | `/app/register/parent` | 1440×1024; 390×844 | Auth master registration | `parent-desktop.webp`, `parent-mobile.webp` | VISUAL_PASS | Canonical family-profile handoff is preserved. |
| Staff registration | `/app/register/staff` | 1440×1024; 390×844 | Auth master registration | `staff-desktop.webp`, `staff-mobile.webp` | VISUAL_PASS | Candidate state is explicit; no Garden access is implied. |
| Inspector registration | `/app/register/inspector` | 1440×1024; 390×844 | Auth master registration | `inspector-desktop.webp`, `inspector-mobile.webp` | VISUAL_PASS | Application handoff is explicit; no approval or assignment is implied. |
| Email verification | `/app/verify-contact` | 1440×1024; 390×844 | Auth master envelope state | `verify-desktop.webp`, `verify-mobile.webp` | VISUAL_PASS | Backend truth controls completion; phone verification is not shown as required. |
| Email verification — unavailable | `/app/verify-contact` | 1440×1024; 390×844 | Auth master unavailable/error language | `verification-unavailable-desktop.webp`, `verification-unavailable-mobile.webp` | VISUAL_PASS | Provider failure terminates in a retryable, truthful state rather than an indefinite spinner. |
| Registration success | role registration routes | 1440×1024; 390×844 | Auth master success state | `success-desktop.webp`, `success-mobile.webp` | VISUAL_PASS | Captured through an intercepted synthetic registration response; no Production or customer account was created. |
| Forgot password | `/forgot-password` | 1440×1024; 390×844 | Auth master state language | `forgot-desktop.webp`, `forgot-mobile.webp` | VISUAL_PASS | Privacy-safe acknowledgement does not disclose whether an account exists. |
| Reset password — valid | `/reset-password` | 1440×1024; 390×844 | Auth master form/state language | `reset-valid-desktop.webp`, `reset-valid-mobile.webp` | VISUAL_PASS | Captured with an isolated synthetic recovery session. |
| Reset password — success | `/reset-password` | 1440×1024; 390×844 | Auth master success state | `reset-success-desktop.webp`, `reset-success-mobile.webp` | VISUAL_PASS | Synthetic Auth endpoints verified update/sign-out state transitions; no plaintext password path was introduced. |
| Reset password — invalid/expired | `/reset-password` | 1440×1024; 390×844 | Auth master invalid state | `reset-invalid-desktop.webp`, `reset-invalid-mobile.webp` | VISUAL_PASS | The expired or absent recovery session provides a safe request-new-link action. |
| Invitation — valid | `/invite/accept?token=…` | 1440×1024; 390×844 | Auth master entry/state language | `invitation-valid-desktop.webp`, `invitation-valid-mobile.webp` | VISUAL_PASS | Garden and recipient are safely summarized; the new-account link was asserted to retain the invitation token. |
| Invitation — expired | `/invite/accept?token=…` | 1440×1024; 390×844 | Auth master error state | `invitation-expired-desktop.webp`, `invitation-expired-mobile.webp` | VISUAL_PASS | Dedicated safe recovery state replaces generic 404/500 output. |
| Invitation — loading | `/invite/accept?token=…` | 1440×1024; 390×844 | Auth master loading state | `invitation-loading-desktop.webp`, `invitation-loading-mobile.webp` | VISUAL_PASS | The pending request has an explicit labelled progress state. |
| Invitation — wrong recipient/role | `/invite/accept?token=…` | 1440×1024; 390×844 | Auth master blocked state | `invitation-wrong-recipient-desktop.webp`, `invitation-wrong-recipient-mobile.webp` | VISUAL_PASS | The signed-in Parent receives a secure role-mismatch state without disclosure of full recipient details. |

## Visual acceptance findings

- The official mark is used through one shared brand component. The exact owner-supplied source is retained in `public/assets/gan-batuach-brand-mark-official.png`; the normalized runtime asset preserves its shape while avoiding transparent source padding.
- The hero uses one optimized 126 KB WebP, a warm kindergarten image created specifically for this Auth shell without text, logo, cameras or identifying adults.
- Desktop uses a genuine split brand/form composition. Re-review found that long registration forms stretched the story column and cropped the Child out of the visible viewport. The story panel is now viewport-height and sticky with an 84% focal position, so the approved Child/Garden brand moment remains visible while the canonical form scrolls independently. Mobile remains a focused single-column flow rather than shrinking desktop.
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
- Loading and wrong-recipient invitation states are now captured at both required viewports; the mismatch state does not offer an acceptance action.
- Provider-unavailable Email resend and invalid recovery states resolve to explicit retry paths.
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

Every required UX-IMPLEMENT-01 desktop and mobile target is `VISUAL_PASS`; `VISUAL_PARTIAL: 0` and `VISUAL_FAIL: 0`. The implementation is suitable for follow-up PR qualification; this decision does not authorize Production or UX-IMPLEMENT-02.
