# Gan Batuach UX-IMPLEMENT-13 — Tasks, Complaints and Corrective Actions

## Scope and source

- Batch: `UX-IMPLEMENT-13`
- Source Development head: `a4e727f26908591080fea275b028b18ed5c7300f` (to be reconciled again immediately before integration)
- Runtime: GPT-6; GPT-5.6 Sol was requested but was not the active selectable runtime in this task.
- Primary visual reference: `GB_UX_REF_TASKS_COMPLAINTS_CORRECTIVE_ACTIONS.png`
  - SHA-256: `e9a868b94aedc5560788fd81d0be88126b78c9fe6aef27da48d113e48665c019`
- Supporting references:
  - `GB_UX_REF_OWNER_CORE.png` — `ddf4744b5c28da7185c6b7e2a72bf8e0d5e73a17c290bf639d24c118be6c0564`
  - `GB_UX_REF_INSPECTOR_FULL_PLATFORM.png` — `dafaffdf6e556ef6c5b548db0e5d37f4f03121131e0f2ef02bf282819f043ab3`
  - `GAN_BATUACH_BRAND_MARK.png` — `4f914d04cf16061b831782d6d53b3f67259f3f88365cb123b641887917eea5ce`

The primary reference was unavailable at its original Downloads path but was verified byte-for-byte at the supplied Gan Batuach design folder before implementation began.

## Domain separation

Tasks, Complaints and Corrective Actions remain three canonical domains:

| Domain | Authority | UX-13 behavior |
|---|---|---|
| Tasks | Canonical Task APIs and transition rules | Operational assignment, due dates, status, assignee, audit timeline and approved actions |
| Complaints | GB-M25 complaint submission, routing, SLA and transition APIs | Reporter-safe submission, role-scoped list/detail, deadlines, escalation and public response |
| Corrective Actions | GB-M23 violations/corrective-action APIs linked to inspection findings | Owner remediation, private evidence, Inspector review and immutable submitted inspection score |

No table, migration, alternate ledger, duplicate storage system or frontend-derived lifecycle was added. Cross-domain links are references only.

## Route and capability map

| Canonical capability | Route / surface |
|---|---|
| Owner/Manager work summary | `/dashboard/garden/work-center` |
| Owner/Manager Tasks | `/dashboard/garden/tasks` |
| Staff assigned Tasks | `/dashboard/staff/tasks` |
| Inspector inspection-linked Tasks | `/dashboard/inspector/tasks` |
| Parent own complaints | `/dashboard/parent/complaints` |
| Owner/Manager Garden-visible complaints | `/dashboard/garden/complaints` |
| Inspector assigned-Garden complaints | `/dashboard/inspector/complaints` |
| Admin complaint oversight | `/dashboard/admin/complaints` |
| Owner/Manager corrective actions | `/dashboard/garden/corrective-actions` |
| Inspector corrective-action review | `/dashboard/inspector/corrective-actions` |
| Task create/update | `/api/tasks`, `/api/tasks/[id]` |
| Task lifecycle | `/api/tasks/[id]/status`, `/api/tasks/[id]/notes` |
| Parent complaint submission/list | `/api/parent/complaints` |
| Complaint lifecycle | `/api/complaints/[id]/actions` |
| Corrective-action list | `/api/violations` |
| Remediation evidence | `/api/violations/[id]/evidence` |
| Corrective-action lifecycle | `/api/violations/[id]/status` |

## Components

- `TaskWorkbench`: metric filters, responsive list/detail, canonical create/edit fields, timeline and action controls.
- `ComplaintWorkspace`: role-aware list/detail, deadlines, escalation, reporter submission and canonical transition actions.
- `CorrectiveActionWorkspace`: finding linkage, immutable score notice, remediation evidence, timeline and Inspector/Owner actions.
- `WorkOperationsOverview`: counts-only operational summary with separate destinations for each domain.
- `ux-implement-13.css`: shared Gan Batuach visual system, Desktop split workspaces, Mobile full-height detail screens, focus states and reduced-motion handling.

## State maps

### Tasks

| Canonical value | Presented state |
|---|---|
| `open` | פתוחה |
| `in_progress` | בביצוע |
| `waiting_approval` | ממתינה לאישור |
| `done` | הושלמה |
| `overdue` | באיחור |
| `cancelled` | בוטלה |
| `blocked` | חסומה |

Only server-supported transitions are offered. Create/edit submits canonical fields; title and description are not silently rewritten through the restricted update contract.

### Complaints

| Canonical value | Presented state |
|---|---|
| `new` | התקבלה |
| `assigned` | שויכה לטיפול |
| `in_progress` | בבדיקה |
| `waiting_garden` | ממתינה לתגובת הגן |
| `waiting_reporter` | נדרש מידע מהפונה |
| `escalated` | הוסלמה |
| `resolved` | טופלה |
| `closed` | נסגרה |
| `reopened` | נפתחה מחדש |

Deadlines come from canonical acknowledgement/response/resolution fields. The UI calculates presentation such as “deadline passed” from those stored values and never creates an SLA policy.

### Corrective Actions

| Canonical value | Presented state |
|---|---|
| `open` | פתוחה |
| `in_progress` | בטיפול |
| `waiting_approval` | ממתינה לבדיקת מפקח |
| `rejected` | נדרשות ראיות נוספות |
| `done` | אומתה ונסגרה |
| `overdue` | באיחור |

The original finding, remediation note/evidence, decision and audit events remain linked to the canonical violation. No action changes the submitted inspection score.

## Role and permission matrix

| Role | Tasks | Complaints | Corrective Actions |
|---|---|---|---|
| Owner/Manager | Active Garden tasks; scoped assignment and approval | Only Garden-visible complaints for the active Garden | Garden corrective actions, response and evidence submission |
| Staff | Assigned/role-visible Tasks in active employment scope | No global complaint workspace | Only canonical responsibilities; no Inspector controls |
| Inspector | Assigned inspection-related Tasks | Assigned-Garden complaints only where complaint routing permits | Assigned-Garden review, request-more-evidence and verify controls |
| Parent | No Garden operational Task access | Own submitted/linked complaints and public response only | Safe linked summary only; no private evidence path |
| Admin | Platform oversight where canonical | Authorized complaint oversight | Existing canonical Admin authority only |

Multi-Garden selection remains server-authorized. UI filters cannot expand tenant access. Suspended/unassigned identities receive empty or denied results according to the backend contract.

## Evidence and audit model

- Task attachments, Complaint attachments and inspection remediation evidence remain separate storage contexts.
- Corrective evidence is retrieved through existing authorized/signed routes; raw storage paths are not displayed to Parents.
- Task and complaint mutations use canonical APIs that own transition validation and audit writes.
- Complaint submission uses a UUID idempotency key retained only for a retry of the same payload.
- Existing timelines render canonical timestamps and status facts; the UI does not fabricate events.

## SLA and escalation mapping

- Complaint deadline presentation uses `acknowledgement_due_at`, `response_due_at` and `resolution_due_at`.
- Escalation presentation uses canonical `status` and `routing_state`.
- Garden visibility remains explicit; restricted complaints are not shown to Garden management.
- No legal deadline, priority, predictive score or client-side auto-escalation was added.

## Desktop and Mobile behavior

Desktop at 1440×1024 uses the approved command-center shell, metric row, search/filter bar, split list/detail workspace, timelines and evidence/review panels. Mobile at 390×844 uses native cards, filter controls, bottom navigation, bottom-sheet forms and dedicated full-height detail compositions. Desktop tables are not compressed into Mobile.

RTL order, mixed dates/numbers, touch targets, keyboard focus, semantic list/dialog controls, text labels for color states and reduced motion are covered by the shared implementation.

## Visual QA

- Concepts: 19
- Captures: 38 (19 Desktop + 19 Mobile)
- `OWNER_REVIEW_READY`: 38
- `NEEDS_POLISH`: 0
- `VISUAL_DRIFT`: 0
- `BROKEN`: 0
- Evidence:
  - `qa-evidence/ux-implement-13/contact-sheet-desktop.webp`
  - `qa-evidence/ux-implement-13/contact-sheet-mobile.webp`
  - `qa-evidence/ux-implement-13/reference-comparison-board.webp`
  - `qa-evidence/ux-implement-13/visual-report.json`
  - `qa-evidence/ux-implement-13/visual-report.md`

Captured concepts: Tasks list/detail/create/edit/overdue; Complaints list/detail/escalated/resolved; Corrective Actions list/detail/evidence submitted/awaiting Inspector review/verified; analytics; Parent/Staff/Admin limited states; empty search.

## Functional QA evidence

- UX-13 focused source contract: 6/6 PASS.
- Task/Complaint canonical source suites: 11/11 PASS.
- Synthetic complaint role/lifecycle E2E: 26/26 PASS.
- Synthetic two-session Task completion race: 9/9 PASS.
- Corrective-action read/isolation probe: 8/8 PASS; Parent evidence path absent; submitted inspection snapshot unchanged at `done:86.00`.
- Typecheck: PASS.
- Scoped changed-file ESLint: PASS.
- Lint regression baseline: PASS, zero canonical regressions.
- Production build: PASS, 541 static pages generated.
- Domain gate: PASS, 30/30.
- Security/isolation gate: PASS, 10/10.
- Migration health: PASS, 244 migrations and no new migration.
- Parent/Manager live contract: PASS, 23/23.
- Release-contract preflight: PASS with Production mutation disabled.
- Development migration baseline: PASS, 244/244 accounted for.

## QA personas preserved

Synthetic manager, parent, staff, Inspector, unassigned Inspector, suspended Inspector and Admin identities were reused. Visual rows were uniquely tagged and deleted after capture. No QA identity was deleted or globally reset.

## Deviations and non-goals

- No material visual deviation remains after review. Mobile detail initially retained summary metrics above the selected item; it was corrected to a dedicated full-height detail composition and all evidence was regenerated.
- No new schema or paid dependency was required.
- `DIGITAL OBSERVER CORE DIFF: 0`.
- `NEW FIXED MONTHLY COMMITMENT: ₪0`.
- Production, `main`, Production migrations, camera hardware and external providers were not touched.
