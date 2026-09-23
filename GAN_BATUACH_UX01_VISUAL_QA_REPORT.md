# Gan Batuach UX-IMPLEMENT-01 Visual QA

Date: 2026-09-24  
Branch: `codex/ux-implement-01`  
Baseline: `origin/integration/development@4a677205bd60551dc8b690adedcca7c509e787da`  
Environment: isolated local Next.js runtime with a non-production loopback Auth responder; synthetic/public state only.

## Reference

The comparison used the approved UX-00 brief and the owner-supplied mandatory visual direction: official Gan Batuach logo, deep brand blue, white/light-blue surfaces, restrained gradients and elevation, RTL-first composition, split branded/form desktop layouts, and true single-column mobile layouts. No separate bitmap reference package was present in the task attachments, so the evidence establishes conformance to that approved direction rather than pixel-diff parity with an external image file.

## P0 visual matrix

| Screen | Route | Viewport | Evidence captured | Status | Material deviation |
|---|---|---:|---|---|---|
| Login | `/app/login` | 1280×720 | Interactive implementation screenshot in task evidence | VISUAL_PASS | None |
| Login | `/app/login` | 390×844 | Interactive implementation screenshot in task evidence | VISUAL_PASS | None; no horizontal overflow |
| Role selection | `/app/register` | 1280×1000/1400 | Interactive implementation screenshot in task evidence | VISUAL_PASS | Long content continues below the first viewport |
| Role selection | `/app/register` | 390×844 | Interactive implementation screenshot in task evidence | VISUAL_PASS | Remaining roles continue by normal vertical scroll |
| Owner registration | `/app/register/kindergarten` | 1280×1000 | Interactive implementation screenshot in task evidence | VISUAL_PASS | Form continues below the first viewport |
| Owner registration | `/app/register/kindergarten` | 390×844 | Interactive implementation screenshot in task evidence | VISUAL_PASS | Form continues by vertical scroll |
| Parent registration | `/app/register/parent` | 1280×1000 | Interactive implementation screenshot in task evidence | VISUAL_PASS | Form continues below the first viewport |
| Parent registration | `/app/register/parent` | 390×844 | Header and scrolled form screenshots in task evidence | VISUAL_PASS | None |
| Staff registration | `/app/register/staff` | 1280×1000 | Interactive implementation screenshot in task evidence | VISUAL_PASS | Form continues below the first viewport |
| Staff registration | `/app/register/staff` | 390×844 | Interactive implementation screenshot in task evidence | VISUAL_PASS | None |
| Inspector registration | `/app/register/inspector` | 1280×1000 | Interactive implementation screenshot in task evidence | VISUAL_PASS | Form continues below the first viewport |
| Inspector registration | `/app/register/inspector` | 390×844 | Interactive implementation screenshot in task evidence | VISUAL_PASS | None |
| Email verification | `/app/verify-contact` | 1280×900 | Interactive implementation screenshot in task evidence | VISUAL_PASS | None |
| Email verification | `/app/verify-contact` | 390×844 | Interactive implementation screenshot in task evidence | VISUAL_PASS | Supporting trust card continues by scroll |
| Forgot password | `/forgot-password` | 1280×900 | Interactive implementation screenshot in task evidence | VISUAL_PASS | None |
| Forgot password | `/forgot-password` | 390×844 | Interactive implementation screenshot in task evidence | VISUAL_PASS | None |
| Reset password | `/reset-password` | 1280×900 | Recovery-check state screenshot in task evidence | VISUAL_PARTIAL | A valid recovery session was unavailable in the isolated responder, so the editable password form was not rendered |
| Reset password | `/reset-password` | 390×844 | Recovery-check state screenshot in task evidence | VISUAL_PARTIAL | Same environment limitation |
| Invitation entry | `/invite/accept?token=…` | 1280×900 | Secure loading state screenshot in task evidence | VISUAL_PARTIAL | Signed valid, expired, and recipient-mismatch states require a canonical invitation fixture |
| Invitation entry | `/invite/accept?token=…` | 390×844 | Secure loading state screenshot in task evidence | VISUAL_PARTIAL | Same environment limitation |
| Registration success | role registration routes | desktop/mobile | Component implementation inspected | VISUAL_PARTIAL | Successful signup was not submitted against a healthy isolated Supabase Auth instance in this visual pass |

## Findings resolved during visual QA

- Replaced the decorative password-eye glyph with an operable, labelled show/hide control.
- Corrected the hidden login field label to describe Email accurately.
- Removed inherited fixed-height/scale behavior that could squeeze the Auth page or trap a mobile keyboard.
- Added a CSS fallback that clears the Management Auth splash even when client hydration is delayed.
- Removed the public marketing navigation from focused verification, recovery, and invitation screens.
- Added the official logo to focused Auth-flow pages and normalized primary CTA color to the brand-blue gradient.
- Reduced oversized Auth-flow headings and preserved a single-column mobile layout.

## Runtime observations

- Login mobile geometry: 390px viewport, 390px document width, 390px Auth content width.
- No horizontal overflow was observed on the captured mobile P0 routes.
- The isolated browser did not hydrate client-only Auth state reliably against the minimal loopback responder. Static/server-rendered visual states were reviewable; success, valid reset, and signed invitation terminal states remain unqualified.
- The exact external approved reference image files were not present in the supplied attachment, so screenshot-to-bitmap pixel comparison was not possible.

## Decision

`APPROVED GAN BATUACH VISUAL LANGUAGE PRESERVED: NO`

The implemented, captured screens preserve the approved language, but the mandatory batch-level answer remains `NO` until registration success, valid reset, and signed invitation terminal states are captured and marked `VISUAL_PASS` in a healthy isolated Auth environment. PR merge remains blocked by this visual gate.

