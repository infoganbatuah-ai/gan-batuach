# GB-M23 — Corrective actions from inspection findings

## Before State
GB-M22 produced immutable inspection answers, score and report, plus one `violations` row and a linked general `tasks` row for each failed scored question. The violation status endpoint accepted arbitrary status values and used legacy `profiles.garden_id` as a manager check. Garden had no complete remediation submission surface. The Inspector page counted closed rows as open.

## Finding vs Corrective Action / Canonical Model
The submitted `inspection_answers` row is the factual finding. Existing `violations` rows are canonical corrective actions linked by inspection and question; the linked `tasks` row remains a compatibility hook for GB-M24. No new general task engine was introduced. `violations` gained acknowledgement, submission, reopening, responsible profile and review metadata. Historical inspection answers and scores are never changed by remediation transitions.

## Status Lifecycle
The existing `task_status` values remain authoritative: `open` → `in_progress` → `waiting_approval` → `done`, with `rejected` → `in_progress` for rework and explicit `done` → `in_progress` reopening. `overdue` is projected from the due date rather than mutating prior status. The single `transition_corrective_action` RPC locks the action row, validates the current status and actor, applies one transition and appends an event in the same transaction. Repeated acceptance of an already closed action returns an idempotent result.

## Auto-Creation Policy
GB-M22's scorer creates actions only for questions at or below each template item's `violation_threshold`. The inspection submission transaction and retry guard prevent replay from creating another set. Informational or passing answers do not create actions. Existing scorer-created general tasks are retained, not duplicated. Existing seven-day due dates are legacy product defaults, not legal deadlines.

## Garden Attention State
Open, resolved and overdue counts derive from current action rows. Closure does not erase the original low score. The configured GB-M22 score threshold remains a separate product signal, not a legal claim. The Garden view now exposes current open/closed counts; Parent projection provides counts only.

## Responsibility / Due Dates / Overdue
The responsible profile is optional. Assignment is constrained to the acting manager or an approved Staff member of the same Garden; cross-Garden arbitrary assignees are rejected. The current due date stays on the action. Only the assigned Inspector or Platform Admin can explicitly extend it, with an event; the Garden cannot silently move it. Overdue is computed as unresolved plus past due.

## Remediation Evidence
Garden management may upload bounded JPEG/PNG/WebP/PDF files into the existing private `inspection-reports` bucket under an action-specific prefix. The transition validates that supplied paths match that prefix. Evidence retrieval requires operational authorization, verifies the path is linked to the action, and returns a short-lived signed URL. Parent summary contains no paths, notes, GPS, documents or Staff identities. An upload followed by a failed transition can leave an unlinked private object for GB-M32 cleanup; it is not publicly accessible.

## Inspector Verification / Rejection / Reopen
Only a currently approved and Garden-assigned Inspector or Platform Admin may accept, reject, reopen or extend. A Garden can acknowledge, save progress and submit remediation, but cannot self-close. Rejection and reopening require reasons and preserve the prior closure in the append-only event stream. If an Inspector is suspended or Garden assignment changes, the old Inspector fails the live authority check; the new assigned Inspector can continue.

## Recurrence / Timeline / Audit
A later inspection creates new findings/actions rather than rewriting prior records. Automated recurrence linking remains GB-M24/inspection reporting debt. Material transitions are recorded in `corrective_action_events` with actor, before/after state, note, evidence paths and due date. The original scorer's `incident_timeline` creation event is preserved. External notification delivery is not claimed; a verified provider workflow remains GB-M30/31.

## Inspector, Garden and Admin UX
The existing Inspector list now shows true open and overdue counts, review actions and linked private evidence. The existing Garden inspection page links to a focused corrective-action page for acknowledgement, progress, private evidence and submission. Platform Admin uses the existing scoped violations API and may review through the same RPC; a dedicated oversight redesign is deferred. The new action events endpoint serves the authorized timeline.

## Parent-Safe Projection
`parent_corrective_action_summary` requires canonical Parent–Garden access and returns only Garden ID, open/resolved/overdue counts and last update. It does not expose raw findings, notes, assignees, private evidence or GPS. A Parent cannot directly read `violations` or action events under the new row policies.

## Original Score Immutability / Task-System Boundary
The transition RPC writes only `violations` and append-only corrective events. It never updates `inspections`, `inspection_answers` or `weighted_score`. The existing task link remains for GB-M24 consolidation without a second general workflow.

## RLS / Security
Direct client insert/update/delete on `violations` is revoked. Read policies allow only Platform Admin, canonical Garden management membership, or an approved Inspector currently assigned to the Garden. The event stream is read-only to these actors. The elevated evidence route checks operational role and scoped action before using Storage service role. The Parent API uses a narrow Security Definer aggregate with Parent authorization.

## Tests / Live QA
Migration health passes. A rollback-only controlled QA database probe covers acknowledgement, submission, manager self-close denial, Inspector rejection, resubmission, acceptance, idempotent retry, event count, cross-Inspector and cross-Garden manager denial, Parent projection denial for a non-Parent, and direct-table privilege denial. It leaves no records. Typecheck, build, lint and Management/domain/security regression results are recorded in the release/PR checks. `LIVE CORRECTIVE ACTION QA: BLOCKED BY ENVIRONMENT` for browser Garden/Inspector role journey, actual private evidence retrieval and independent-connection concurrent decisions. The database `FOR UPDATE` lock provides serialization; a true two-connection race remains live QA debt.

## GB-M22 Carried QA Debt
1. Full browser journey with Inspector, Garden and Parent identities.
2. Private inspection evidence retrieval in a live role flow.
3. True simultaneous inspection submission from separate connections.

These remain for GB-M35/GB-M40; this push does not reopen GB-M22.

## Remaining Debt / Inputs For GB-M24
Consolidate linked general tasks with corrective-action lifecycle and avoid duplicate notifications or conflicting task status. Add optional recurrence linkage and Admin oversight refinements. GB-M32 should clean unlinked private uploads and decide historical URL migration. Complete controlled live role/evidence/concurrency QA in GB-M35/40. Digital Observer mock/shadow signals are not inputs.

`DIGITAL OBSERVER CORE DIFF: 0`
