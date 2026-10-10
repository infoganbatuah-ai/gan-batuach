# Gan Batuach — UX-IMPLEMENT-01 design-system implementation

## Scope

UX-IMPLEMENT-01 applies the owner-approved Management visual language to shared tokens and the canonical Auth/registration surfaces: welcome, login, public role selection, Owner/Parent/Staff/Inspector account registration, Email verification, recovery and signed invitations. Authorization, Auth callbacks, onboarding domain forms, data models, canonical role routing and Production are unchanged.

## Authoritative assets

- The official owner-supplied source is preserved at `public/assets/gan-batuach-brand-mark-official.png`.
- `GanBatuachBrand` is the shared logo/name/tagline component for full and compact use.
- The optimized Auth hero is `public/assets/gan-batuach-auth-hero.webp` (126 KB). It contains no embedded copy, logo, camera or customer data.

Hero generation mode: ImageGen, new image. Final prompt: “Use case: photorealistic-natural; responsive Gan Batuach authentication hero for a premium Hebrew childcare-management product; one smiling preschool-age child in a bright modern kindergarten holding a teddy bear, child on the right with calm negative space on the left, soft morning daylight, pale blue/white/royal-blue and warm wood palette; realistic, safe, calm; no text, logos, UI, watermark, cameras or other identifiable people.”

## Canonical tokens

The existing `gb-*` theme remains the only product theme. The UX-01 stylesheet adds normalized semantic aliases used by the Auth implementation:

- `--brand-primary`, `--brand-primary-hover`, `--brand-navy`
- `--brand-blue-soft`, `--brand-surface-blue`, `--violet-accent`
- `--background`, `--surface`, `--surface-elevated`
- `--text-primary`, `--text-secondary`, `--border`
- `--success`, `--warning`, `--danger`, `--info`

Spacing, radius, elevation and motion reuse the established `--gb-*` token families. Status colors always appear with text or icons.

## Shared components

- `GanBatuachBrand`: official full/compact brand lockup.
- `AppAuthShell`: shared desktop split composition and mobile task-first shell.
- Existing buttons, inputs, role cards, `ProgressStepper`, notices and state patterns are restyled through the canonical CSS layer.
- Existing authenticated `AppShell`, `SidebarNav`, `BottomNav`, `PremiumCard`, `MetricCard`, `StatusChip`, `ActionCard`, `DashboardGrid` and domain components remain the shared foundation; no competing library was added.

## Desktop Auth shell

The desktop layout pairs a bright, bounded form surface with a navy photographic story panel. It retains the official logo, concise trust copy and value indicators without crowding the operational task. The form surface has a stable readable width and routes may scroll vertically without a fixed-height trap. The story panel stays at viewport height on long registration pages and uses the approved Child focal point, preventing canonical extra fields from stretching the image until the Child disappears from view.

## Mobile Auth shell

Mobile is a purpose-built single column. Brand and task come first, the decorative story panel is removed, inputs remain full width, touch targets are at least 44 px and CTA placement survives vertical scrolling and the software keyboard. Auth routes do not render authenticated bottom navigation.

## Auth and registration behavior

- Login remains Email/password with password reveal, recovery and registration links.
- Public registration contains four role paths: Owner/Garden, Parent, Staff candidate and Inspector applicant. Platform Admin is not offered.
- The visual progress model is role → account → Email → role profile; it does not invent a phone verification step.
- Successful registration uses role-specific next-copy while the canonical backend controls verification and handoff.
- Verified Email remains sufficient for ordinary activation. Phone may truthfully remain unverified. SMS and WhatsApp are not shown as active verification capabilities.
- Signed invitations retain valid, expired, existing-account and new-account actions and preserve their token across Auth entry.
- Password recovery remains a one-time Supabase Auth flow; no temporary or recoverable plaintext password was added.

## State system

Auth surfaces share the same visual grammar for loading, success, pending, invalid/expired, unavailable and error states. Technical Supabase/SQL output is never rendered directly. Buttons visibly enter busy/disabled state for submissions.

## RTL and accessibility

The implementation uses logical CSS properties, correct RTL arrow placement, LTR Email values within RTL layouts, visible focus, labelled inputs, accessible icon-button names and reduced-motion behavior. Images are decorative at the shell level and do not replace textual instructions. This is an accessibility baseline for touched screens, not a certification.

## Responsive and performance boundaries

Canonical breakpoints are reused. The single Auth hero is delivered as optimized WebP and no animation, font, UI or analytics dependency was added. No fixed monthly service or vendor was introduced.

## Visual acceptance

The route-by-route matrix, viewports, screenshots, deviations and checksums are recorded in `GAN_BATUACH_UX01_VISUAL_QA_REPORT.md` and `qa-evidence/ux-implement-01/`. The refreshed evidence includes 38 screenshots covering the original core screens plus login error, provider-unavailable Email verification, invalid recovery, invitation loading and wrong-recipient states. Every required desktop and mobile target is `VISUAL_PASS` against the four supplied references.
