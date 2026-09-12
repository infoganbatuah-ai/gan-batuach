# GB-M22 — Monthly inspection scheduling, submission and reporting

## Before State

The repository already had monthly tasks, inspections, a roughly ten-item form, a weighted score engine, violations, GPS capture, signatures, and role dashboards. Submission first called the scoring RPC, then wrote signatures, GPS, monthly-cycle completion and audit rows separately. A failed later write could leave a scored inspection without a complete report. The wizard did not save drafts. The shared Parent report rendered private answers, evidence and GPS. The monthly task index named `idx_tasks_monthly_unique` is not unique in the linked database.

## Scheduling Model and Inspection Period

`schedule_management_monthly_inspections` creates one inspection for each active Garden with an approved assigned Inspector, keyed by `(garden_id, period_month)`. The period is the first day of the calendar month and the due date is its last second. An advisory transaction lock serializes task creation for a Garden and month; the existing unique inspection index prevents duplicate inspections. Repeat scheduling keeps the original inspection and does not rewrite a started or completed form. The cron uses the new service-role-only scheduler. Existing cycles remain; new cycles are created only for operational Gardens.

## Status Lifecycle, Draft and Resume

The existing `open`, `in_progress` and `done` states remain canonical for inspection rows; overdue is derived from due date where the existing dashboard does so. A private `inspection_drafts` row stores answers server-side. Only the approved, currently assigned Inspector can save or load it. Draft saving moves `open` to `in_progress` and records `started_at`; the wizard restores answers after returning. A completed inspection cannot be saved as a draft.

## Template and Versioning

Each new inspection stores the form ID and a JSON snapshot of its questions. Edits, deletions and additions to a form's questions are blocked after the form has been used, so later policy edits require a new form row. Existing historical scores are neither backfilled nor recalculated.

## Required Evidence and GPS

New photos and documents upload to the existing private `inspection-reports` bucket. The answer stores a bucket path, never a public URL. The evidence endpoint signs a one-minute URL only after checking the inspection and actor. New submissions reject public evidence URLs. The browser-captured GPS and capture time are stored as evidence; if the Garden has no trusted coordinates, verification remains pending rather than claiming location proof. PNG signatures are bounded and stored with the report under scoped row policies.

## Scoring, Findings and Product Threshold

The existing server-side weighted scoring and violation generation remain in place. The former fixed 8/10 attention threshold is now a product setting in `inspection_product_settings`, defaulting to 8 and changeable by Platform Admin. It is not described as a legal requirement. The scorer still creates existing corrective tasks for failed items; GB-M23 will consolidate their remediation lifecycle.

## Submission Transaction and Immutability

`complete_monthly_inspection` locks the inspection, checks the approved/current Garden assignment, Garden active state, period, answers, private evidence, signature and GPS, then calls the existing scorer and writes signature, GPS record, document number, frozen template/report metadata, cycle completion and audit event in one database transaction. On retry, a completed inspection returns its stored result without creating duplicate findings. Direct Inspector writes to inspection and answer rows are removed; the RPC is the only operational submission path. Admin maintenance remains separately authorized.

## Inspector Dashboard, Garden View and Admin Oversight

Existing due/history, Garden inspection, and Admin oversight surfaces are reused. The wizard adds Save Draft and private evidence upload. Existing Garden views continue showing own reports. The Admin view remains the existing inspection module, without a second system.

## Parent-Safe Projection

Parent report UI now returns only approved inspection date, Garden public name/city, score and violation count for Gardens in canonical family context. Parent list/trust surfaces fetch the same explicit safe columns server-side after family authorization. Direct Parent row-level access to full inspections and answers is denied. HTML report and evidence endpoints do not accept Parent role. Exact GPS, signatures, question answers, document links, Inspector contact data and internal findings are absent from the Parent projection.

## Reassignment, Suspension and Preliminary Gardens

Every draft save and submission rechecks current Inspector approval and Garden assignment, so suspension or reassignment denies further operational work while preserving the draft. The scheduler requires active Gardens; preliminary Gardens are excluded. Explicit Admin draft reassignment UX is deferred.

## APIs, RLS and Security

- `POST /api/cron/monthly-inspections`: service-role scheduler behind cron secret.
- `GET|PUT /api/inspections/[id]/draft`: current assigned Inspector only.
- `POST /api/inspections/[id]/submit`: one transactional submission RPC.
- `POST|GET /api/inspections/[id]/evidence`: private upload and short-lived authorized download.
- `GET /api/inspections/[id]/report`: Admin, authorized Garden manager/owner or assigned Inspector; no Parent/private report access.

The prior generic inspection POST endpoint is removed. The legacy public scoring RPC is revoked from anonymous and authenticated roles. Row policies limit inspection and answer reads to Admin, authorized Garden management, or the current assigned Inspector; direct Inspector mutations are removed.

## Notifications and Audit

The existing scorer writes incident timeline events and corrective tasks. The transaction adds one regulatory audit event. External notification delivery is not claimed as verified; existing reminder cron remains separate.

## Validation and Live QA

TypeScript, production build, domain/security suites, migration audit and lint baseline passed locally. The SQL migration was executed against the linked Supabase schema inside a rollback-only transaction. A controlled QA Inspector/Garden pair was found; within a second rollback-only transaction, a synthetic inspection was created, saved, resumed, submitted, retried, checked for one signature, and denied to a different Inspector. The reusable probe is `scripts/qa/gb-m22-rollback-probe.sql`. No QA inspection was left in Production. Browser-based role QA, two-connection concurrent submit and real private-evidence retrieval were not exercised; `LIVE MONTHLY INSPECTION QA: PARTIAL (ROLLBACK DATABASE PROBE ONLY)`.

## Production Verification — 2026-09-13

PR #43 merged to `main` at `4cf6d1f898ad9d5c552ab41d3a6d15db7ed4d3b8`; its GB-M22 commit is an ancestor of `main`. Both PR workflows passed. The `main` Digital Observer CI domain job initially hit an existing timing-sensitive horizontal-scale assertion (121 instead of 120); that job and the aggregate quality gate passed on the second attempt without code changes. Vercel deployment `dpl_BZLnWXsofmDN2Hn9eCo5RH4kpsBn` reached `READY` for production. `https://ganbatuach.com/api/health` returned HTTP 200 with `supabase: ok`. Migration `20260913040000` is registered as applied; production has the draft table, submission and scheduler RPCs, product threshold row, and required-inspection read policy. The legacy direct scoring RPC is not executable by `authenticated`. The rollback QA probe passed again on the applied schema. Anonymous submit, draft mutation, evidence upload and private report requests each returned HTTP 401. Controlled browser sessions for Inspector/Garden/Parent roles, real evidence retrieval and simultaneous two-connection submission remain unverified.

## Remaining Debt and Inputs for GB-M23

The existing scorer generates corrective tasks directly; GB-M23 must consolidate their lifecycle and avoid duplicating them. The old `sync_monthly_inspection_cycles` function may still be used by older internal jobs and should be retired when all callers are inventoried. Historical evidence URLs remain readable in authorized reports for compatibility and need a private-storage migration decision. Video evidence is not accepted in the new private uploader. Explicit Admin reassignment of an in-progress draft and controlled concurrency/live-role QA remain pending. GB-M21 live bootstrap QA remains carried to GB-M35/GB-M40 as directed.

`DIGITAL OBSERVER CORE DIFF: 0`
