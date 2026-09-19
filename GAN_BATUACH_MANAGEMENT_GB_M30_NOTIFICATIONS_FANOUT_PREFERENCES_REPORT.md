# GB-M30 — Management notifications, fan-out and preferences

## Before State

Management domains already wrote `notifications`, while `communication_preferences`, `push_category_preferences`, `communication_logs`, push logs and legacy Admin/Parent routes used different delivery semantics. GB-M29 writes one notification per participant in the message transaction. GB-M24/25 write task and complaint notifications in their domain transitions. Production is still at the owner-controlled release boundary; GB-M29 is integrated in development only.

## Notification Inventory

`notifications` is the in-app record. `communication_preferences` and `push_category_preferences` contain existing user choices. `communication_logs` is reused for disabled external-delivery intentions. `push_notification_logs` and Admin communication test routes are legacy/provider-specific; they are not proof of delivered notifications. Parent notification POST was a client-writable duplicate and is now disabled. Role-only historical notifications are left intact without inventing recipients.

## Domain Boundaries

Message, Task, Complaint, inspection, corrective action, invitation, platform subscription and tuition remain their own authoritative entities. Notification records carry bounded source labels and never complete a task, close a case, settle a payment or grant resource access. GB-M29 message notifications store a generic Hebrew title/body and only a message identifier in metadata.

## Canonical Notification Model

The existing table gains `source_domain`, `notification_type`, `preference_category`, `dedupe_key` and `archived_at`; existing `recipient_id`, Garden/Child, source entity, action URL and read time remain. A unique recipient/dedupe index and unread index support retry and bounded inbox queries. Existing historical rows are not guessed or rewritten.

## Recipient Resolution

Existing domain transactions choose recipients. The insert boundary rechecks active profile, thread participation and current Garden relationship for messaging, and active employment for Staff task notifications. It drops stale or shadow events. This is not yet a universal source-specific resolver for every legacy producer; see Remaining Debt.

## Fan-Out

The transactional notification trigger normalizes the event and queues at most four channel intentions from a saved category preference. Bulk GB-M29 broadcasts retain their snapshot audience. There is no sequential provider call for every recipient. In-app rows remain if external delivery is unavailable.

## Preferences

The existing own-profile settings endpoint stores category/channel choices and quiet hours; authenticated users may read/write only their own preference rows. A preference is not evidence that a channel works. The API reports external capabilities as `not_configured` and the Parent UI says external delivery is unavailable.

## Quiet Hours

An optional time pair and explicit Asia/Jerusalem or UTC timezone controls non-urgent external intentions. Equal start/end disables the quiet interval. In-app remains available. No client-provided urgent flag bypasses quiet hours. Urgent policy and deferred scheduling require a product rule and GB-M31 provider implementation.

## Deduplication

Message notifications use `(recipient, message_id)` and an advisory transaction lock. Initial Task and Complaint alerts have source-keyed dedupe where their existing emission can be identified. Delivery intentions have per-notification/channel unique keys. Other legacy transitions without stable event IDs cannot yet claim universal replay deduplication.

## Read State

The self-scoped `mark_management_notifications_read` RPC handles up to 100 specified IDs or all own unread rows. The inbox lists 30 recent rows; server-side count covers all own unread rows. Admin no longer has blanket ordinary notification read/update access. Read state is never a Task or message read state.

## Deep Links

The notification component accepts only same-origin `/dashboard/` paths. Destination routes remain responsible for authorization. Invalid or unrelated URLs fall back to the user's dashboard.

## Delivery Intents

`communication_logs` gets a notification reference, bounded attempt metadata and truthful `unavailable`, `unverified_contact`, `suppressed_quiet_hours` or preference-suppressed state. New intents store neither destination nor message preview, do not call a provider and never set `sent_at`. A legacy mock adapter used by enrollment flows now records external `unavailable` rather than `sent_mock` and omits external preview. Notification-linked operational logs are hidden from ordinary tenant reads.

## Provider Boundary

No SMS, email, push or WhatsApp provider was activated. Contact verification is checked before eligibility; delivery remains unavailable even for verified contacts. The actual provider, retries, delivery receipts and recipient-side consent policy belong to GB-M31.

## Messaging

GB-M29 participant events are sanitized, checked against current Parent Guardian/active enrollment, active Staff employment or active Manager membership, and deduplicated by canonical message ID. Inspector and ordinary Admin do not receive operational thread notifications by their role alone.

## Tasks

GB-M24 remains the source of task truth. Initial task notifications are generic and source-keyed. Task assignment itself does not grant tenant authority; current active Staff employment is rechecked at notification creation.

## Complaints

GB-M25 case events remain separate, with generic notification content and no complaint description/internal note in the in-app or external-intent metadata.

## Inspections / Corrective Actions

Source-domain labels are normalized for existing inspection and corrective-action notifications. Current assignment/review remains the domain's authority. A full scheduled reminder fan-out is not claimed in this change.

## Subscription / Tuition / Payments

Platform subscription and Parent tuition source labels remain distinct. This layer does not infer a payment from a notification or an unverified webhook. Existing domain event generation remains authoritative.

## Invitations

Existing signed invitation infrastructure remains authoritative. Existing-account notifications can be represented in-app; external recipient delivery is still unavailable pending GB-M31.

## Digital Observer Safety Boundary

Mock/shadow Observer event types are discarded by the notification trigger. No Digital Observer core files changed. Verified production Safety notification policy requires a separately reviewed source/provenance contract.

## Privacy

Message subjects/bodies, complaint text and task titles are excluded from normalized lock-screen-facing messaging/task/complaint notifications. New external intent logs contain no phone, email or content preview. Old communication logs are untouched; their historical retention/access needs GB-M31/32 review.

## RLS / Security

Notification read is recipient-only; read mutation is an authenticated self-scoped RPC. Preferences are owner-only. Notification-linked delivery logs cannot be read by ordinary Garden roles. Direct client self-insert is denied. A Garden Manager can insert only a notification for their own actual sent Message or same-Garden assigned Task with an active eligible recipient; canonical security-definer domain RPCs retain their transactionally generated notifications. A universal source-verified server service remains future consolidation work.

## Performance

Inbox uses a 30-row cap, an indexed recipient/unread count and bounded four-channel intent expansion. Each participating recipient adds one in-app row and up to four small log rows only if they explicitly configured channels. No external request, continuous polling or new infrastructure was added. Before release, measure recipient volume, retention and Supabase write/egress baseline against the project's cost ceiling.

## Tests

The disposable GB-M29 Supabase QA database contains synthetic Parent A/B, Manager A, Staff A/B, Inspector and Admin fixtures. A single rollback-only transaction applies the new migration and `scripts/qa/check-management-notification-pipeline.sql`. It passed deduplication, sanitized content, shadow rejection, wrong Parent/Garden, revoked Staff/Inspector/Admin exclusion, category preference, unverified SMS, quiet hours, direct forged-payment notification denial, Manager legacy-source compatibility, self-only RLS read and read-state mutation. No fixture or migration is persisted. This is a focused upgrade test, not a fresh-install or full live-role journey.

## Validation

Focused GB-M24/25/26/27/29 tests (29/29), operational-role/Parent contract and multi-Garden Staff tests (31/31), domain gate (29/29), security gate (7/7), migration audit and release-contract preflight passed. Typecheck, lint baseline and optimized Next.js production build passed on the isolated feature branch. Exact-head PR checks must be recorded after they complete. The integration worktree has unrelated, owned, uncommitted development ledger and generated-file changes; it must not be overwritten or staged by this feature task.

## Live QA

`LIVE NOTIFICATION QA: BLOCKED BY ENVIRONMENT`. No customer was notified.

## Carried QA Debt

GB-M21–M28 controlled browser/provider and separate-connection gates remain in the development/release ledgers. GB-M29 integration passed at `416125985b0a1cd6b53b0d4ff91aec423e69ec65`; Production release and live Parent/Manager/Staff role journey remain deferred. GB-M30 live preference and fan-out journey is additional debt, not a substitute for the isolated synthetic checks.

## Remaining Debt

Canonical server-only recipient resolution for all legacy domain producers; source-event IDs for all repeatable transitions; full per-role notification projection and archival API; preference-aware broadcast load test; true separate-connection fan-out race; historical provider logs and push/admin mock route retirement; quiet-hour delivery scheduling; verified provider capability; cumulative integration tests and cost/recovery review. These gate final integration/release readiness as applicable.

## Inputs For GB-M31

Consume the existing intent state and notification ID; verify destination, opt-in, provider mode and readiness before sending. Bind provider event and retry idempotently; prove delivery separately from queue/sent. Never pass message or complaint bodies in external payloads or retroactively label legacy `sent_mock` as delivered.

## Development Status

This report describes the isolated feature branch only. No migration applied to Production, no Production deployment, no live provider configured, and no customer notification sent. `DIGITAL OBSERVER CORE DIFF: 0`.
