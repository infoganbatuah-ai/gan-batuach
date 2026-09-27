# Gan Batuach UX-IMPLEMENT-08 — Staff Recruitment and Candidate Experience

## Delivery identity

- Source branch: `origin/integration/development`
- Source integration SHA: `a59f254fe375cf0fab2490cc2d3ec29df81c8c98`
- Feature branch: `codex/ux-implement-08-staff-recruitment`
- Runtime used: GPT-6 (GPT-5.6 Sol was requested but was not the active selectable runtime)
- Environment used for QA: isolated `DEVELOPMENT / INTEGRATION`
- Production access, deployment, data mutation, and migrations: none

## Visual references

The implementation was compared directly with:

1. `GB_UX_REF_STAFF_CANDIDATE_RECRUITMENT.png` — primary composition, candidate cards, recruitment hub, candidate review, form progression, mobile density, offer/success treatment.
2. `GB_UX_REF_STAFF_FULL_PLATFORM.png` — active-Staff shell continuity and the post-activation handoff.
3. `GB_UX_REF_OWNER_CORE.png` — Owner/Manager navigation, metrics, workspace hierarchy, card elevation, and responsive shell.
4. `GAN_BATUACH_BRAND_MARK.png` — official brand mark.

The warm recruitment hero and candidate portrait in `public/assets/` are project-owned generated assets. The hero prompt requested a welcoming Israeli kindergarten recruitment scene with a teacher and children, natural daylight, no text or logos, and safe neutral framing. The portrait prompt requested a friendly professional kindergarten candidate portrait with natural light, neutral background, no text or logos.

## Route map

| Capability | Route / surface | Audience |
| --- | --- | --- |
| Candidate command center, discovery, matching, applications | `/dashboard/staff/job-market` | Candidate only |
| Job detail and application CTA | `/dashboard/staff/job-market/[id]` | Candidate only |
| Application detail, timeline, request-info, rejection, activation | `/dashboard/staff/job-market/applications/[id]` | Owning candidate only |
| Professional profile and completeness | `/dashboard/staff/settings` | Candidate only before employment; own Staff settings after employment |
| Candidate documents and certificates | `/dashboard/staff/documents` | Candidate only before employment; canonical Staff documents after employment |
| Recruitment notifications | `/dashboard/staff/recruitment-notifications` | Candidate only |
| Signed invitation acceptance | `/invite/accept?token=…` | Bound recipient only |
| Manager recruitment hub, filters, openings, candidate list | `/dashboard/garden/staff-applications` | Owner/Manager for the active Garden |
| Manager candidate review | `/dashboard/garden/staff-applications/[id]` | Owner/Manager for the application Garden |
| Job post creation | `/dashboard/garden/staff-applications/new` | Owner/Manager for the active Garden |
| Active Staff platform after activation | `/dashboard/staff` and UX-07 routes | Active employment only |

## Component map

| Component | Purpose |
| --- | --- |
| `RecruitmentHero` | Reference-aligned identity/hero composition for candidate and manager surfaces |
| `RecruitmentMetric` | Differentiated open-role, application, invitation, and action-required metrics |
| `CandidateIdentity` | Avatar, professional role, city, and candidate state |
| `CompletenessRing` | Canonical completeness percentage, without decorative scoring |
| `RecruitmentTabs` | Candidate route hierarchy for home, profile, jobs, applications, and documents |
| `RecruitmentJobCard` | Public-safe Garden/job summary and canonical relevance reasons |
| `ApplicationTimeline` | Submitted → review → invitation → activation lifecycle |
| `ApplicationCard` | Candidate-facing application state and next action |
| `CandidateRow` | Manager-safe list density, completeness, documents, role, location, and status |
| `StaffCandidateProfileForm` | Canonical professional-profile update and matching pause state |
| `StaffCandidateDocumentUpload` | Canonical document upload/status surface |
| `StaffApplicationActions` | Apply, request-info response, accept, and withdraw actions against existing APIs |

## Candidate state map

| State | UX behavior | Operational Garden access |
| --- | --- | --- |
| Incomplete profile | Completeness blockers and focused next actions | Blocked |
| Ready / matching | Relevant openings and discovery filters | Blocked |
| Application submitted / reviewing | Application timeline and status | Blocked |
| Information required | Missing-information request, update/upload, resubmit | Blocked |
| Rejected | Respectful safe reason and preserved history | Blocked |
| Withdrawn / cancelled | Confirmation-backed terminal state and history | Blocked |
| Invited / offer ready | Signed/transactional activation action | Blocked until activation succeeds |
| Employed | Candidate-only CTAs are removed and UX-07 becomes available | Scoped by canonical employment |

## Recruitment state map

Canonical application states remain distinct. `submitted`, `reviewing`, `information_required`, `offer_sent`/invited, `rejected`, `withdrawn`/cancelled, and `employed` use separate labels, tones, timelines, and actions. The UI does not collapse them into a generic pending state.

Manager review reads candidate details only when a canonical application connects that candidate to a Garden the current user can manage. Migration `20260928010000_management_staff_candidate_manager_review.sql` adds that bounded read policy; it does not grant Garden-wide candidate browsing and does not use the broader Staff-access helper.

## Role and permission matrix

| Capability | Candidate | Active Staff | Owner/Manager | Parent / Inspector / Admin |
| --- | --- | --- | --- | --- |
| Own candidate profile and completeness | Own only | Historical handoff only | Only via scoped application review | Admin remains canonical; others denied |
| Discover published openings | Canonical matching RPC | Candidate mode unavailable | Own Garden openings | Denied unless canonical Admin capability |
| Apply / withdraw / respond | Own applications | Candidate mode unavailable | Review only | Denied |
| View candidate documents | Own only | Own Staff documents | Scoped application review where canonical | Denied except canonical Admin |
| Create opening / review candidates | Denied | Denied | Active Garden only | Denied except canonical Admin |
| Activate employment | Accept only when eligible | Already active | Canonical manager decision path | Denied except canonical Admin |
| Children, attendance, pickup, shifts, clock, Safety/Cameras | Denied before activation | UX-07 scoped permissions | Existing manager permissions | Existing role rules |

## Matching and discovery map

- Uses canonical `find_relevant_staff_jobs` output and its canonical relevance reasons.
- Filters use published dimensions such as role, city, qualification, age-group context, employment type, and candidate preferences.
- No distance is fabricated.
- No AI score, confidence, or “best match” claim is shown.
- Garden details remain public-safe; private operations, children, staff, and financial data are absent.

## Invitation and activation handoff

- The existing signed invitation route preserves the token through authentication and verifies recipient, expiry, revocation, and Garden context.
- Invitation acceptance alone does not grant operational access.
- Employment activation remains the canonical atomic transaction that creates/activates employment, sets the validated Garden/role/Classroom scope, preserves candidate and application history, and then routes the user into UX-07.
- Candidate and Staff identities are not duplicated.

## Responsive behavior

Desktop uses a spacious navy-shell workspace, strong image-led hero, differentiated metrics, candidate/job cards, dense but readable review rows, and focused detail panels. Mobile uses a dedicated app composition: image-led headers, full-width cards, compact tabs, large touch actions, bottom navigation, and no horizontal overflow. It does not render a reduced desktop table.

## Reference mapping

| Approved reference area | Implemented surface |
| --- | --- |
| 01 Recruitment Hub | Manager recruitment hub and candidate command center |
| 02 Job Post Creation | Manager four-step job creation surface |
| 03 Candidates List | Manager filtered candidate list with rich rows/cards |
| 04 Candidate Profile | Manager candidate detail and candidate own profile |
| 05 Interview Scheduling | Canonical review/request-information state; no unsupported interview scheduler was invented |
| 06 Offer & Hiring | Offer/activation-ready state and canonical employment activation |
| 07 Mobile Recruitment Hub | Purpose-built candidate/manager mobile hero and metrics |
| 08 Mobile Job Creation | Focused mobile step composition |
| 09 Mobile Candidates List | Full-width candidate cards with state and document chips |
| 10 Mobile Candidate Profile | Identity-first profile and progressive sections |
| 11 Mobile Interview Scheduling | Mobile review/request-information composition using supported workflow |
| 12 Mobile Success | Activation-ready/success composition linked to real activation |

## Feature completeness map

| Canonical capability | Route / surface |
| --- | --- |
| Candidate onboarding and professional profile | `/dashboard/staff/settings` |
| Truthful completeness and blockers | `/dashboard/staff/settings`, `/dashboard/staff/job-market` |
| Qualifications, preferences, availability, experience | `/dashboard/staff/settings` |
| Documents and certificates | `/dashboard/staff/documents` |
| Discovery and matching | `/dashboard/staff/job-market` |
| Job details and requirements | `/dashboard/staff/job-market/[id]` |
| Apply and confirmation | Job detail + `StaffApplicationActions` |
| Application state, timeline, next action | `/dashboard/staff/job-market/applications/[id]` |
| Request more information and resubmit | Application detail + canonical action API |
| Rejection, withdrawal, history | Application detail + canonical action API |
| Signed Garden invitation | `/invite/accept` |
| Activation handoff | Application detail / invitation → UX-07 |
| Recruitment notifications | `/dashboard/staff/recruitment-notifications` |
| Manager openings, filters, candidate list | `/dashboard/garden/staff-applications` |
| Manager candidate review | `/dashboard/garden/staff-applications/[id]` |
| Manager job creation | `/dashboard/garden/staff-applications/new` |

Recruitment messaging was not split into a new backend. The canonical application response and notification paths carry recruitment context. A dedicated interview-scheduling data model is not present, so no unsupported scheduling workflow was created; the reference composition is applied to canonical review/request-information states.

## Visual QA evidence

Evidence root: `qa-evidence/ux-implement-08/`

- Exact desktop viewport: `1440 × 1024`
- Exact mobile viewport: `390 × 844`
- Fresh captures: 34 screenshots covering 17 concepts in both viewports
- `OWNER_REVIEW_READY`: 34
- `NEEDS_POLISH`: 0
- `VISUAL_DRIFT`: 0
- `BROKEN`: 0
- Every capture checks HTTP success, browser page errors, and horizontal overflow.
- Inventory and route mapping: `qa-evidence/ux-implement-08/results.json`
- File integrity: `qa-evidence/ux-implement-08/SHA256SUMS`

Concepts captured: candidate dashboard, candidate profile, completeness, documents/certificates, opportunity discovery, job detail, application submit, application detail, information required, invitation, rejected state, activation-ready state, recruitment notifications, manager recruitment hub, manager candidate list, manager candidate detail, and job post creation.

## Accessibility and RTL

- RTL is the document direction on all candidate and manager surfaces.
- Mixed-direction email, phone, date, and time values remain readable.
- Controls use visible labels, focus-visible treatment, semantic buttons/links, status text in addition to color, and minimum mobile touch targets.
- Motion respects reduced-motion settings; visual QA runs with reduced motion.
- Mobile screenshots verify full-width cards and no horizontal overflow.

## QA evidence

Focused UX-08 checks cover route wiring, the candidate/active-Staff boundary, canonical matching, application state preservation, signed invitations, recipient protection, activation handoff, manager Garden scope, document truth, generated asset presence, reference mapping, and Digital Observer isolation. Cumulative validation additionally covers domain, security/tenant boundaries, multi-Garden Staff, documents, Parent/Manager contracts, typecheck, lint regression, build, migration health, release contract, and release preflight.

Final command results, PR, merge SHA, exact integration head, and post-merge evidence are recorded in the Development integration ledgers and the delivery report.

## Boundaries and cost

- Digital Observer core diff: `0`
- New paid dependencies: none
- New fixed monthly commitment: `₪0`
- Production: untouched

## Integration closure

+- Product PR: [#146](https://github.com/infoganbatuah-ai/gan-batuach/pull/146)
+- Exact checked product head: `76383aa27e0122adffd42265ddcb2f598a47209b`
+- Product merge: `590f74ad661b8bc8524eb36ac413f33f16e756f1`
+- Development migration approval: [#147](https://github.com/infoganbatuah-ai/gan-batuach/pull/147), merge `8ce4a818ab3c29d9b85db3bbce4db23c6321f8f9`
+- Development migration receipt: [#148](https://github.com/infoganbatuah-ai/gan-batuach/pull/148), merge `1d426d7b78724fb8105e5bf7ab17a9ddc0f1f78c`
+- Development schema: 244/244 migrations, fingerprint `2e5ac2bf9731f7dde7f5148ff2ae6f2169bc398bf7ea78ebca18e6cd3c8149e6`
+- Post-merge: canonical Development startup PASS; health HTTP 200 with local Supabase OK; role dashboards 8/8; UX-03 through UX-08 focused 42/42; Parent/Manager 23/23.
+- Visual evidence: 34/34 OWNER_REVIEW_READY from the exact checked product tree. The canonical launcher excludes signing secrets by design, so signed-invitation screenshots use a local-only QA signing key.
+- Production and `main`: untouched.
