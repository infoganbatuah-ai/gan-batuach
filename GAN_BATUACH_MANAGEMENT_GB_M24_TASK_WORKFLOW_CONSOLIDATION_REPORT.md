# GB-M24 — Canonical task/workflow consolidation

## Before State
`tasks` and enterprise `workflow_tasks` both represented work. The generic task API accepted a client-selected Garden and assignee; its status endpoint updated `tasks` and then `workflow_tasks` separately. The original RLS treated `assigned_to` as an independent access grant. Staff and Inspector task screens also filtered by legacy pointers or after retrieving broad rows. GB-M22 created linked task rows for inspection findings, and GB-M23 deliberately kept `violations` as the corrective-action authority.

## Existing Task Systems Inventory
`public.tasks` is the canonical-capable cross-domain execution table and is now the authoritative write surface. `workflow_tasks`/`workflows` remain an enterprise compatibility read model; new manual task creation no longer creates a duplicate workflow row. `violations` are domain-specific corrective actions, `inspections` are immutable reports, `daily_task_completions` are checklist facts, and customer-success/commercial follow-ups remain separate domain records. The Admin workflow UI is legacy compatibility pending GB-M38; it is not the authority for new task transitions.

## Canonical Task Model
Existing `tasks` stores Garden scope, assignee, creator, status, priority, due date and explicit `source_entity_type`/`source_entity_id`. GB-M24 adds cancellation and blocking metadata plus indexes. No business entity is replaced by a generic task. Manual tasks have no source; generated complaint/incident follow-ups use a source-keyed RPC and inspection corrective tasks retain their source link.

## Status Lifecycle
The existing `task_status` is extended with `blocked` and `cancelled`. The locked `transition_management_task` RPC accepts named actions rather than arbitrary status patches. It validates transitions, returns an unchanged result on a repeated same-state action, and records material changes in `audit_logs`. Overdue is calculated from an open status plus `due_at`; it does not erase prior state. Reopening retains the prior completion in audit history.

## Scope / Tenant Model
Selected Garden is a view preference. Read policy independently requires Admin, current Garden management membership, active Staff employment plus task assignment, or current Inspector approval/assignment. Platform tasks are Admin-only. Parent cannot read internal task rows. The old `assigned_to = auth.uid()` tenant bypass is removed from both task tables. Workflow compatibility rows linked to a task also require visibility of the underlying task.

## Assignee Model
`create_management_task` and `update_management_task` check Garden management authority and that the selected assignee has a current eligible Garden relationship. Candidate/former Staff and unassigned Inspectors are rejected. The creator and assignee remain distinct columns. Assignment does not create Garden, Child, camera or source-domain access. Reassignment, priority and due-date changes are atomic and audited.

## Staff Integration / Multi-Garden Staff
The Staff task screen now uses the selected, server-resolved employment Garden and the actual Staff user ID. RLS requires active employment for that same Garden on every read and transition. A second employment is independent; revocation of A removes A task access without removing B. Role-wide legacy tasks remain visible only when no personal assignee exists and the Staff employment is active, while the primary Staff list shows personally assigned tasks.

## Corrective Action Integration
Deterministic `violations.task_id` links are backfilled to `source_entity_type='corrective_action'` and `source_entity_id=violation.id`. A trigger maintains that link for future GB-M22 submissions; a partial unique index prevents two canonical task links to one corrective action. Task completion never calls `transition_corrective_action`; Inspector verification remains the only domain closure path. The source inspection score and answers are untouched.

## Inspection Integration / Inspector Integration
Monthly inspection tasks retain their inspection source links. Inspector task reads require current approval and Garden assignment; the screen no longer treats a bare assignee ID as enough to include a different Garden. The legacy escalation RPC now checks current Inspector assignment/Admin authority and ignores its caller-supplied actor ID.

## Admin Integration
Admin manual task creation uses the same RPC as Garden management. The Admin form no longer offers Parent task assignment or role-wide/group broadcast, which would not be a safe operational assignment. Platform tasks are limited to Admin scope. Existing workflow oversight remains available for historical rows.

## Due / Overdue
`due_at` is indexed and overdue is a projection of an unfinished task with a past due date. Completed and cancelled tasks are excluded. No daily destructive status rewrite is required.

## Notifications
New assignment and material status changes create pending in-app `notifications` rows in the same transaction as the task/audit change. A repeated transition returns before notification creation. This push does not claim verified SMS/email delivery. GB-M30/31 own reminder fan-out/provider closure; an outbox-backed external task event remains future work.

## Legacy Compatibility
Existing `workflow_tasks` rows remain readable under narrower RLS; direct user writes are closed. Old task rows are preserved. Deterministic corrective-action links are normalized; ambiguous legacy `source_entity_id` values and role-wide/group tasks are not guessed or rewritten. GB-M38 can retire the duplicate Admin workflow screen after a data-specific migration audit.

## RLS / Service Role
Direct authenticated task/workflow-table writes are revoked; the task RPCs check `auth.uid()`, active role and target Garden even though they run with elevated database privileges. The `task_view_logs` insert policy requires the viewer to be able to read the task. Existing Service Role domain routes remain subject to explicit route authority review; the AI-event task route is a legacy exception and its mock/shadow output is not promoted into verified Management workflow truth.

## Audit
Creation, named status transitions and escalation write `audit_logs` with actor, Garden, task, action and before/after state. No read audit noise or private media payloads are added.

## Tests
Pre-merge checks: all 199 Management regression/focused tests pass, including six GB-M24 contract/security tests; typecheck, production build, domain QA (29), security QA (7), migration audit and lint-baseline with zero new regressions pass. A rollback-only migration execution against the linked database passed. After migration commit, a rollback-only behavioral probe passed for eligible/ineligible assignees, Garden isolation, candidate denial, Staff submission vs Manager approval, idempotent completion, reopen/cancel, direct-write privilege removal, corrective-source linking and source-state preservation. A true independent-connection completion race requires controlled live identities; row-level `FOR UPDATE` is the database serialization boundary.

## Production Migration Verification
Migration `20260913160000` was applied to linked Supabase production and recorded in migration history. Read-only checks confirmed the new task column, canonical RPCs, source RPC and scoped task/workflow policies. No synthetic QA task or violation was committed. Application deployment and unauthenticated HTTP smoke checks are verified after merge.

## Live QA
`LIVE TASK WORKFLOW QA: BLOCKED BY ENVIRONMENT` until controlled Manager, Staff and Inspector identities and non-customer task data are available. Do not mutate customer tasks as QA.

## Carried QA Debt
GB-M21: full Inspector → Owner preliminary-Garden browser journey. GB-M22: role browser journey, private inspection evidence retrieval, separate-connection concurrent submission. GB-M23: Garden → Inspector corrective-action browser journey, private remediation evidence retrieval, separate-connection concurrent review. Carry to GB-M35/40; none is closed by static tests.

## Remaining Debt
The historical Admin enterprise workflow table and role/group broadcasts need a deliberate GB-M38 migration/retirement path. Report follow-ups now use a source-keyed helper; the explicit AI-event task route remains a legacy exception and must not be treated as verified Safety provenance. An outbox for fan-out remains future work. Existing checklist and commercial task domains remain separate facts. True live multi-role and separate-connection races remain environment-gated.

## Inputs For GB-M25
Consume `tasks` for operational execution and respect `source_entity_type`/`source_entity_id`; never let task assignment grant domain authority. Use the named transition RPC and source-domain transitions separately. Preserve private evidence and notification delivery status.

`DIGITAL OBSERVER CORE DIFF: 0` (Management-only changes; no Observer core edits).
