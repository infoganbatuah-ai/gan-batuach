# GB-M25 — Complaints, SLA and Escalation Closure

## Before State
`complaints` already existed, with enum status (`new`, `assigned`, `in_progress`, `waiting_garden`, `closed`), child/parent/Garden fields, free-form internal notes, legacy attachments and a response-due field. Parent submission inserted directly and authorized Garden and Child independently. The generic complaints CRUD route could write without a case transition guard. Admin report actions used Service Role patches and a free-form status. Inspector and Garden dashboards listed cases but did not share a formal action service. A GB-M24 source-task RPC existed but did not own complaint state.

## Canonical Complaint Model
The existing `complaints` table remains authoritative. GB-M25 adds reporter identity, retry key, visibility, routing state, three SLA deadlines, policy reference, acknowledgement/resolution/escalation times and a revision. `complaint_events` preserves state-change history separately; historical complaints and messages are retained. No new generic task or message entity is created.

## Message vs Complaint Boundary
Messages remain conversations. Only the formal complaint endpoint creates a case; viewing or sending a chat message does not.

## Reporter Authorization
Submission is bound to the authenticated active Parent inside `submit_management_complaint`. The database verifies an active Garden and an active Child enrollment in that *same* Garden, plus the canonical Parent/Guardian Child relationship. A Garden-only path requires an active Parent–Garden link or Child enrollment. A supplied `parent_id`, a legacy profile Garden preference, or another Child's Garden does not authorize submission. Retry keys are scoped to the reporter. The browser keeps only a hash of the pending payload and a random retry key across refreshes; complaint text is not stored in browser storage.

## Child / Garden Context
The Parent page now offers active Child/Garden enrollment contexts and Garden-level active links rather than silently using the first Garden. The server repeats the authority check regardless of the selected UI context. Preliminary Gardens fail the active-Garden guard.

## Categories / Severity
The existing category taxonomy is reused. `reported_urgency` is stored as an indication; canonical severity starts at medium and an authorized reviewer may mark the case urgent. Sensitive categories and critical reporter signals default to restricted visibility. This is a product privacy routing rule, not a legal classification.

## Status Lifecycle
The existing enum is extended with `waiting_reporter`, `escalated`, `resolved`, and `reopened`. `transition_management_complaint` locks the row and checks actor, Garden assignment/visibility, current state and action. It supports acknowledgement, review, information request/reply, Garden response, escalation, resolution, closure and reopening. Resolved and closed remain distinct. Internal and reporter-facing notes are separate in `complaint_events`.

## Routing / Inspector Assignment
Ordinary Garden-visible cases route to an active canonical Garden Owner/Manager, with Inspector/Admin fallback. Sensitive cases route to an approved current Garden Inspector, or the Admin queue when none is eligible. The hourly reconciler follows current Inspector assignment; suspension or reassignment removes the old Inspector task assignee and routes to the new Inspector or Admin. Historic events retain the prior actor. No Inspector role flag alone grants access.

## SLA Model / SLA Clock
`complaint_sla_policies` is versioned and scoped by optional category/severity and effective dates. Admin can create draft, activate an approved version and retire it through locked RPCs. Activation rejects overlapping same-scope active periods. Multiple applicable policies fail closed at submission. A selected policy snapshots computed acknowledgement, response and resolution deadlines on the complaint. The clock starts at submission and does not silently pause for `waiting_reporter`. Reopen restarts the resolution deadline using the linked policy. **No SLA duration is seeded or represented as law.** Until an authorized product target is approved and activated, cases honestly have no configured SLA deadlines.

## Overdue / Escalation
`complaint_sla_state` distinguishes acknowledgement, response and resolution lateness. A secret-protected Vercel cron calls a Service Role-only, row-locked batch function. Due cases transition once to `escalated`, enter the Admin queue, retain case/event history and update the linked task. The same scan repairs current Inspector routing. No arbitrary client can run the scan.

## Task Integration
Submission creates exactly one GB-M24 `tasks` source link (`source_entity_type='complaint'`). A unique source constraint from GB-M24 and reporter retry lock prevent duplicate case tasks. Completing the task cannot transition or close the complaint. An explicit complaint resolution completes its linked execution task; an explicit complaint reopen reopens it, with complaint events retaining the case history. Restricted complaints are excluded from Garden Manager task-source visibility; assignment is never a tenant grant.

## Parent Flow
The existing complaint page uses a Child/Garden selector, a formal submission endpoint, limited reporter-safe fields and a response action when more information is required. Status labels distinguish review, escalation, resolution and closure. Resolution text shown to the reporter is explicitly public-facing.

## Garden Flow
The Garden operations screen lists only RLS-allowed Garden-visible complaints and supports acknowledgement/response through the domain transition RPC. Restricted cases are hidden from Garden management until product policy permits a separate redacted handoff.

## Inspector Flow
The existing Inspector reports list gains review, information request, escalation, resolution, close and reopen controls. Each transition checks current approved Inspector Garden assignment in the database. Suspended/unassigned Inspectors lose access.

## Admin Oversight
The existing Admin reports center continues to show full authorized case details and now uses the locked complaint transition RPC. It supports status and overdue filtering. A separate Admin backend endpoint manages SLA drafts and activation. The old incident-report handling remains separate.

## Attachments / Privacy
New arbitrary `attachment_urls` submission is rejected. Existing raw evidence path and internal-note columns are excluded from direct authenticated column grants; only explicitly authorized Admin server surfaces use Service Role after Admin verification. `complaint_events` with internal notes is Inspector/Admin scoped. No public attachment URL or unverified Digital Observer shadow event is made formal evidence. Secure new attachment upload/retrieval and review is remaining GB-M32 debt.

## Resolution / Reopen / Closure
Resolution requires a reporter-facing summary; closure is a separate authorized transition. Reopening requires a reason, preserves the previous resolution event and clears the current resolution display. The complaint row is never deleted. Reporter withdrawal and serious-case continuation policy are not enabled without a product decision.

## Notifications / Audit
Submission, case transitions, routing repair and escalation write metadata-only audit events. Pending in-app notifications have generic bodies and do not include complaint descriptions or Child medical details. No external SMS/email delivery is claimed.

## RLS / Service Role
Direct authenticated insert/update/delete on `complaints` is revoked. Row reads require Admin, own reporter identity, current assigned Inspector Garden, or Garden management on Garden-visible cases. Authenticated column reads exclude internal notes, raw attachment fields and internal resolution. The Service Role cron is secret-protected and its RPC requires Service Role JWT context. Parent, Garden and Inspector action routes return narrow projections.

## Tests
204 Management tests, including five focused GB-M25 contract tests, passed. A linked-Supabase rollback-only probe used a controlled QA Parent and synthetic cases/policy to verify active Child/Garden binding, wrong-Garden denial, retry idempotency, one source Task, SLA deadline calculation and acknowledgement. The probe rolled back all writes. Typecheck, domain QA, security QA and migration audit passed. Post-migration status/reopen/column-privilege probe is provided in `scripts/qa/gb-m25-complaint-rollback-probe.sql` for the release gate. True separate-connection decision races remain unverified in live QA.

## Live QA
`LIVE COMPLAINT SLA QA: BLOCKED BY ENVIRONMENT` — no controlled Parent, Garden, Inspector and Admin browser journey was performed; no customer complaint was changed for testing.

## Carried QA Debt
GB-M21: Inspector-to-Owner bootstrap browser journey. GB-M22: role browser journey, private evidence retrieval and separate-connection submission race. GB-M23: corrective-action browser journey, remediation evidence retrieval and separate-connection review race. GB-M24: Manager/Staff/Inspector task journey and separate-connection completion race. Carry all to GB-M35/40.

## Remaining Debt
Product-approved SLA targets must be activated through Admin policy management; no deadline is fabricated. New private complaint attachment upload/download, Inspector/Admin detailed timeline presentation, full Garden response handoff for restricted cases, reporter withdrawal policy and separate-connection concurrency QA remain open. The generic `complaints` route is read-only compatibility until GB-M38.

## Inputs For GB-M26
GB-M26 should not treat Parent tuition/platform subscription conversations as formal complaint status, and should keep payment evidence separate from complaint priority. A payment complaint can link to the financial domain later without exposing private payment details through general task or notification payloads.
