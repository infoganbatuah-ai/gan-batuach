# Gan Batuach — UX-IMPLEMENT-02 Owner/Garden onboarding

Date: 2026-09-24

## Scope

UX-IMPLEMENT-02 applies the approved Gan Batuach visual system to the canonical Owner/Garden onboarding journey after Email verification. It preserves the GB-M10 atomic onboarding model, canonical multi-Garden authority, Classroom and subscription contracts, signed Parent invitations, private document boundaries and truthful Safety readiness. It does not introduce a second onboarding table, a second Garden authority model or a separate visual system.

## Approved references

- `/Users/danielderi/Downloads/GAN_BATUACH_BRAND_MARK.png`
- `/Users/danielderi/Downloads/GB_UX_REF_AUTH_MASTER.png`
- `/Users/danielderi/Downloads/GB_UX_REF_OWNER_ONBOARDING.png`
- `/Users/danielderi/Downloads/GB_UX_REF_OWNER_CORE.png`

The onboarding reference controls visual language and composition. Canonical implementation controls fields, authorization, persistence and activation.

## Route map

| Stage | Canonical route | Result |
|---|---|---|
| Verified Owner handoff | `/app/register/kindergarten` | Account registration from UX-IMPLEMENT-01; no Garden fields are duplicated. |
| New Garden entry | `/onboarding/kindergarten?new=1` | Owner-only or Owner+Teacher mode, personal details and initial Garden identity. |
| Saved draft | `/onboarding/kindergarten?gardenId=:gardenId` | Five resumable server-backed stages. |
| Activation success | Same onboarding route | Branded success state after the atomic activation RPC and active-context selection both succeed. |
| Operational handoff | `/dashboard/garden` | Canonical Owner command center in the newly selected Garden context. |

Relevant server contracts are `/api/garden/manager-application`, `/api/kindergarten-onboarding`, `/api/garden/parent-invitations` and `/api/management/gardens`.

## Component map

- `app/onboarding/kindergarten/page.tsx`: authenticated shell, current Garden draft authorization and entry/resume routing.
- `components/kindergarten-onboarding-form.tsx`: Owner mode entry, five-stage wizard, save/resume, review, atomic activation and success.
- `components/manager-parent-invitation-panel.tsx`: signed Parent invitation in the current server-authorized Garden.
- `components/upload-image-field.tsx`: existing private image upload boundary for logo/profile imagery.
- `components/gan-batuach-brand.tsx`: official brand mark inherited from UX-IMPLEMENT-01.
- `app/styles/manager-onboarding-live.css`: onboarding composition built on the existing Gan Batuach tokens and shared button/form primitives.

No parallel component library was created.

## Canonical stages and states

1. **Garden details** — canonical Garden identity, structured contact/address fields, public profile imagery, document declarations and a truthful handoff to the private Document Center. An onboarding declaration is never displayed as verified.
2. **Classrooms, Staff and Safety readiness** — multiple canonical Classrooms per age category, per-Classroom operational capacity, Staff invitation/readiness state and camera setup readiness. Age category is not Classroom identity; capacity is not described as legal capacity.
3. **Platform subscription readiness** — backend-provided plan amount, 14-day trial, zero charge today, provider-unavailable state and manual/later selection. Parent tuition is not mixed into this stage.
4. **Children and Parents** — canonical signed Parent invitation with no plaintext credential. Child and Staff creation remain explicit post-activation canonical workspaces because the existing onboarding contract does not create shadow Child or employment records.
5. **Review and activation** — live snapshot of the just-saved Garden data, Classroom count limited to selected age groups, document declarations, Safety readiness, subscription truth and role mode. Activation remains one server transaction.

The success state appears only after activation and active Garden selection both complete. A context-selection failure returns an actionable error instead of client-side pseudo-success.

## Owner modes and multi-Garden

- `owner_only` activates administrative ownership without fabricating a teaching assignment.
- `owner_teacher` activates both canonical Owner and teaching capabilities.
- A new Garden is created through canonical membership. `profiles.garden_id` is not used as the authority for invitation writes.
- Parent invitations now use `access.gardenId`, the server-authorized current Garden, for the Garden lookup, fee-group check, legacy compatibility record, signed invitation, delivery log and audit log. This closes a multi-Garden context defect found by the browser regression.

## Responsive behavior

Desktop uses a bounded premium workspace, brand hero, stable horizontal progress navigator, two-column form/card layouts and focused section summaries. Mobile uses one column, compact horizontal step progress, full-width cards, 44 px or larger controls and a sticky action area. Tables are not introduced. Both layouts use the same canonical actions and data.

## RTL and accessibility

All touched content is RTL-first. Email remains LTR inside RTL labels; currency and numbers use readable mixed-direction treatment. Role and readiness cards expose native radio controls across the entire card with visible keyboard focus. Progress uses `aria-current`; save/error output uses a polite live region; activation success is announced. Labels, validation association, touch targets and reduced-motion behavior were verified on the captured surfaces. This is a touched-surface baseline, not a WCAG certification.

## Visual references and evidence

Desktop viewport: `1440×1024`. Mobile viewport: `390×844`. The 22 synthetic captures, results manifest and checksums are stored under `qa-evidence/ux-implement-02/`. The detailed decision is recorded in `GAN_BATUACH_UX02_VISUAL_QA_REPORT.md`.

## Test scenarios

- Owner-only entry and persistence.
- Owner+Teacher entry and activation.
- Existing multi-Garden Owner creates and selects another authorized Garden.
- Draft save, reload and resume through all five steps.
- Multiple Classrooms, including more than one Classroom in the same age category.
- Staff invitation/readiness without automatic employment.
- Signed Parent invitation scoped to the displayed draft Garden.
- Cross-Garden and mismatched invitation requests denied.
- Document missing/declared states without false verification.
- Camera unavailable/setup-ready truth; no fake Live or AI incident.
- Provider unavailable/manual subscription state; no false electronic payment.
- Review reflects the current saved form values.
- Atomic activation and role-specific dashboard handoff.

## Known deviations from the concept reference

- The concept condenses setup into eight illustrative panels. The product keeps the canonical five server stages and adds all required business, privacy and readiness states inside those stages.
- Document files are uploaded and verified through the canonical private Document Center after activation; onboarding records bounded declarations and a summary only.
- Staff employment and Child records are created in their canonical operational workspaces after activation. Onboarding does not create parallel pre-activation records.
- Camera setup is represented as readiness because Digital Observer Production capability is not asserted by this batch.
- Electronic payment methods remain visibly unavailable until provider readiness is verified.

These deviations preserve implemented product truth and authorization while matching the approved visual language.

## Boundaries

- Product migration: none.
- Production change: none.
- New paid provider or fixed commitment: none.
- Digital Observer core diff: `0`.

## Development integration closure

PR #132 passed all required repository checks on exact head
`6a8aaedc6df02a003d1c365d90869fbfd4c58cae` and merged to
`integration/development` at `fd3fd866dc13f2f81f12a14b1be21afd0ce7d00e`.
Post-merge verification from a clean integration-closure branch passed the
focused Owner onboarding, Parent/Manager, role, multi-Garden, Classroom,
capacity, document, invitation, subscription, typecheck, domain, security,
migration and release-contract suites. Production and `main` remain unchanged.
