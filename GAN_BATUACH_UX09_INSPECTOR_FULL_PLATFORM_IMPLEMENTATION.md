# GAN BATUACH UX-09 — Inspector Full Platform

## Source and boundary

- Source Development head: `c66ca26fb3b0ec33a142b634e1b267f2411585a0`
- Feature branch: `codex/ux-implement-09-inspector`
- Primary visual reference: `GB_UX_REF_INSPECTOR_FULL_PLATFORM.png`
- Primary reference SHA-256: `dafaffdf6e556ef6c5b548db0e5d37f4f03121131e0f2ef02bf282819f043ab3`
- Supporting references: `GB_UX_REF_OWNER_CORE.png`, `GAN_BATUACH_BRAND_MARK.png`
- Production: untouched
- Digital Observer core: unchanged
- New fixed monthly commitment: `₪0`

UX-09 uses the existing inspection, corrective-action, complaints, Tasks, signed-invitation, document, and camera-policy contracts. It adds no parallel inspection model and no schema migration.

## Route map

| Canonical capability | Route or surface |
|---|---|
| Inspector state handoff, dashboard, assigned/unassigned command center | `/dashboard/inspector` |
| Application, pending, information-required, blocked/suspended state | `/dashboard/inspector/apply` |
| Assigned Garden portfolio | `/dashboard/inspector/control-center` |
| Inspection-safe Garden detail | `/dashboard/inspector/gardens/[id]` |
| Monthly inspection queue and draft resume | `/dashboard/inspector/inspections`, `/dashboard/inspector/inspections/due` |
| Checklist, evidence, notes, save/resume, submit | `/dashboard/inspector/inspections/[id]` |
| Submitted immutable report | `/dashboard/inspector/inspections/[id]/report` |
| Inspection history | `/dashboard/inspector/inspections/history` |
| Findings | `/dashboard/inspector/violations` |
| Corrective-action queue | `/dashboard/inspector/corrective-actions` |
| Remediation review | `/dashboard/inspector/corrective-actions/[id]` |
| Assigned complaints | `/dashboard/inspector/complaints` |
| Inspector Tasks | `/dashboard/inspector/tasks` |
| Canonical submitted-history trends | `/dashboard/inspector/trends` |
| Report catalog and documentation | `/dashboard/inspector/reports` |
| Preliminary Garden bootstrap and signed Owner/Teacher invitation | `/dashboard/inspector/preliminary-gardens` |
| Policy-scoped camera context | `/dashboard/inspector/cameras` |

## Component map

| Component | Responsibility |
|---|---|
| `RoleAppShell` | Inspector-specific Desktop navigation, Mobile bottom navigation, identity header, RTL shell |
| `InspectorAppFrame` | Shared Inspector page title, identity, badge, back behavior, responsive workspace |
| `InspectorHero` | Reference-aligned image or icon hero with one clear action hierarchy |
| `InspectorMetricGrid` / `InspectorMetricCard` | Differentiated operational metrics without collapsing distinct states |
| `InspectorGardenCard` | Garden identity, location, due state, score, and assignment-safe navigation |
| `InspectorTimeline` | Inspection, corrective-action, and report history |
| `InspectorInspectionWizard` | Canonical inspection draft, questions, evidence, signature, and submission |
| `InspectionReportView` | Submitted score, checklist summary, findings, and authorized export surface |
| `ViolationStatusActions` | Canonical remediation review decisions and status transitions |
| `InspectorPreliminaryGardens` | Preliminary Garden creation and signed invitation handoff |
| `CameraPlaybackCard` | Safe camera context; Inspector playback is disabled while Live is not Production-verified |

## Inspector state and assignment map

| State | Access |
|---|---|
| Applicant / pending | Application status only; no assigned Garden data |
| Information required | Safe missing-information action only |
| Approved, unassigned | Purposeful readiness screen; no fabricated Garden portfolio |
| Approved, assigned | Only Gardens whose canonical assignment resolves to the Inspector |
| Multi-Garden | Portfolio, inspection, finding, complaint, evidence, and Task reads remain Garden-scoped |
| Suspended / blocked | Operational routes fail closed; history remains preserved under canonical policy |

The Inspector role never inherits Owner, Staff, Parent, finance, unrestricted Child, unrestricted Staff, or unrestricted camera privileges.

## Inspection lifecycle

`scheduled/due → draft/in_progress → saved/resumable → validation → canonical submit → immutable submitted report`

- Checklist items come from the canonical inspection form and question records.
- Evidence uses the existing private evidence path and signed retrieval contracts.
- GPS, notes, required items, and signature remain part of the existing submission engine where configured.
- The final score is read from the canonical submitted inspection; the UI does not recompute or rewrite it.
- A submitted report preserves its checklist, findings, evidence references, status, and snapshot.

## Findings, reports, and corrective actions

- Findings retain category, canonical severity/status, opened date, evidence relation, and correction deadline.
- Corrective actions retain the original finding and original inspection score.
- Owner evidence and response are shown separately from the Inspector decision.
- Accept, reject, reopen, and request-more-evidence actions use the existing transition API and event history.
- Complaint access requires both Inspector assignment and Garden scope.
- Tasks remain separate records linked to their canonical source where present.
- Trends use submitted historical inspections only; no AI prediction or invented score is displayed.

## Preliminary Garden and invitation flow

The preliminary Garden surface uses the existing GB-M21 bootstrap and signed invitation behavior. It collects initial Garden identity, preserves preliminary status, creates no operational activation, and hands accepted Owner/Teacher invitations to canonical onboarding. Plaintext temporary credentials are not created.

## Camera policy

Inspector camera context is assignment- and policy-scoped. The current Management capability has no canonical signal proving Inspector Live View as `production_verified`, so UX-09 deliberately shows the truthful unavailable/evidence-only state and disables playback. Camera rows, gateway state, face matching, and AI events do not change inspection, attendance, employment, or release authority.

## Role and data visibility matrix

| Data/action | Assigned Inspector | Approved unassigned | Suspended | Owner/Manager |
|---|---:|---:|---:|---:|
| Assigned Garden portfolio | Yes | No | No | Canonical management surface |
| Inspection draft/submit | Assigned Gardens only | No | No | Role-specific read/action only |
| Private evidence | Assigned inspection only | No | No | Canonical role policy |
| Findings/corrective review | Assigned Gardens only | No | No | Owner response surface |
| Assigned complaint | Explicit assignment and Garden scope | No | No | Canonical Garden scope |
| Preliminary Garden/invite | Canonical Inspector permission | No | No | Onboarding handoff |
| Camera Live | Disabled: not Production-verified | No | No | Separate role policy |
| Finance / unrestricted Children / unrestricted Staff | No | No | No | Canonical management permissions |

## Desktop and Mobile behavior

Desktop uses the approved deep-navy shell, royal-blue actions, spacious card grids, portfolio imagery, inspection workspace hierarchy, metric differentiation, and report/corrective-action compositions at `1440×1024`.

Mobile uses a separate `390×844` composition with a condensed identity header, focused hero cards, two-column metrics, stacked portfolio and workflow cards, bottom navigation, visible touch targets, and no horizontal overflow. It does not compress Desktop tables.

## Visual reference mapping

| Reference area | Implemented surface |
|---|---|
| 01 Inspector Dashboard / 07 Mobile Dashboard | Dashboard and approved-unassigned state |
| 02 Gardens List / 08 Mobile Gardens List | Assigned Garden portfolio and Garden detail |
| 03 Inspection Details / 09 Mobile Inspection | Monthly inspection, draft/resume, checklist, evidence |
| 04 Findings & Violations / 10 Mobile Findings | Findings and complaint-safe action states |
| 05 Corrective Actions / 11 Mobile Corrective Actions | Queue and distinct remediation review |
| 06 Reports & Documentation / 12 Mobile Reports | Submitted report, history, trends, and documentation |

## Visual QA evidence

- Fresh capture time: `2026-09-28T12:28:19.767Z`
- Environment: `DEVELOPMENT / INTEGRATION`
- Viewports: `1440×1024` and `390×844`
- Concepts: `19`
- Screenshots: `38`
- `OWNER_REVIEW_READY`: `38`
- `NEEDS_POLISH`: `0`
- `VISUAL_DRIFT`: `0`
- `BROKEN`: `0`
- Evidence index: `qa-evidence/ux-implement-09/visual-report.md`
- Desktop board: `qa-evidence/ux-implement-09/contact-sheet-desktop.webp`
- Mobile board: `qa-evidence/ux-implement-09/contact-sheet-mobile.webp`
- Reference comparison: `qa-evidence/ux-implement-09/reference-comparison-board.webp`
- Evidence checksums: `qa-evidence/ux-implement-09/SHA256SUMS.txt`

The 19 concepts are dashboard, approved-unassigned, portfolio, Garden detail, monthly inspection, checklist, draft/resume, evidence, findings, report, corrective actions, remediation review, complaints, Tasks, trends/history, preliminary Garden, Owner/Teacher invite, Safety/Cameras, and suspended state.

## Functional QA and deviations

Validated contracts cover approval versus assignment, assigned-Garden isolation, multi-Garden scoping, monthly draft/resume and submission, evidence privacy, canonical score/history, corrective-action event history, assigned complaints, Tasks, preliminary Garden invitation handoff, signed-invitation boundaries, and truthful camera policy.

Material visual deviations: none. The reference’s Live-camera concept is rendered as the truthful unavailable/evidence-only state because Inspector Live View is not currently both Production-verified and policy-permitted. Accessibility semantics, focus visibility, readable contrast, reduced motion, touch targets, and RTL take precedence over purely decorative reference details.

All QA personas remain present. The visual fixture only upserts bounded, clearly marked synthetic Development records and never touches Production.
