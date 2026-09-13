# Before State

The repository already had `communication_threads`, participant rows and the legacy `messages` table. Its original read policy allowed any user with Garden access and granted an Admin-wide read path. Garden and Staff message screens also offered Inspector recipients. Parent requests were a separate formal request workflow.

# Existing Messaging Inventory

`communication_threads` and `communication_thread_participants` are canonical-capable. `messages` is retained as the historical message store and now requires a canonical thread for browser reads. Parent child requests, complaints, Tasks, notifications, delivery events and legacy announcement views are separate domain or compatibility surfaces.

# Message / Complaint / Task / Notification Boundary

Message history is human conversation. Complaints retain GB-M25 case and SLA state, Tasks retain GB-M24 execution state, and Notifications are delivery records. The new RPCs do not transition Complaint or Task records.

# Canonical Messaging Model

GB-M29 makes `communication_threads` and `messages.thread_id` the canonical conversational model. A conversation stores Garden, optional Child/Classroom context, participants, timestamps, status and message history. Complaints, Tasks and Notifications remain separate entities; sending or completing a message does not transition any of their states.

# Thread Model

Canonical thread types now include Parent–Garden, Parent–Staff, Staff internal, Garden/Classroom/Staff broadcasts and system-context values, while retaining legacy values for historical compatibility. New indexes cover Garden/Classroom context, participant unread state and thread message ordering.

# Participants / Read State

Participants record membership and `last_read_at`/`last_read_message_id`. Read updates are server-side and per participant. Membership is a delivery record only: it does not grant Garden, Child or Classroom access.

# Participants

The creator and each validated recipient are inserted as explicit participants. A participant who leaves a thread has `left_at` recorded and no longer receives current access through that membership.

# Message Model

Messages have a canonical `thread_id`, sender, server-side timestamp, human/system kind, optional edit/deletion timestamps and a sender/idempotency-key uniqueness constraint. Public attachment URLs are not accepted by canonical message APIs.

# Parent Messaging

A Parent opens a conversation only for a canonically authorized Child with an active enrollment. The server derives the Garden from that enrollment and verifies the chosen Manager/Owner or active Staff recipient. The Parent screen now provides a separate ordinary conversation surface; formal Parent requests remain in their existing workflow.

# Parent / Garden

The browser does not provide the authoritative Parent Garden. A Parent-provided Garden ID is ignored for direct message authorization and the server resolves the active Garden from the authorized Child.

# Garden Messaging

Managers and Owners must have canonical Garden authority. They can message authorized guardians of active enrolled Children or active Staff in their Garden. The Garden recipient picker no longer contains Inspectors or Admins.

# Staff Messaging

Staff requires an active same-Garden employment for every conversation operation. A Staff member may only contact a Parent when the Child is in a Classroom to which the Staff member is actively assigned. Employment revocation therefore blocks future conversation access while leaving history intact.

# Staff / Parent

The same Classroom scope is rechecked when the Staff member reads or replies, so a later Classroom reassignment cannot leave an old Parent thread operational.

# Garden / Staff

Garden Manager and Owner sends to Staff require current active Staff employment in that same Garden. Staff-to-Staff messages require each recipient's active same-Garden employment.

# Multi-Garden Staff

Every communication operation checks `can_staff_access_garden(garden_id)`. The selected active Garden is never used as proof of access, so an employment in Garden A cannot open Garden B threads.

# Broadcasts

Managers and Owners can create a canonical Garden, Classroom or Staff broadcast through a separate server route. It creates one thread and snapshots the authorized active audience into participant records and immutable thread metadata. It never creates a copied thread per Parent, and later enrollments do not change the historic recipient set.

# Broadcasts / Announcements

Classroom broadcasts validate the canonical Classroom Garden before audience calculation. Parent audiences are resolved from active enrollment plus guardian relationship; Staff audiences from active employment. An empty audience fails rather than creating an ambiguous broadcast.

# Read State

Read state is stored per participant, not on the message globally. The read endpoint locks no domain state and only advances the authenticated participant's cursor.

# Attachments

Canonical compose APIs do not accept attachment URLs. This prevents public or arbitrary URLs from entering message history. Private document upload and signed retrieval continue through the existing private-storage boundary; no raw attachment URL is projected by the canonical APIs.

# Realtime

No separate realtime transport was introduced. The canonical API supports bounded thread refresh and per-participant unread state without making a delivery acknowledgement into a message read receipt.

# Employment / Enrollment End

Every later access rechecks active employment or active Child enrollment. Ending either relationship stops operational access while preserving historical thread and message records.

# Inspector / Admin Privacy

Inspector and Platform Admin are not operational-message recipients and have no blanket participant-read policy. Complaints, inspection work and privileged support require their dedicated, audited workflows.

# Legacy Compatibility

Legacy messages and historical thread types are preserved. No ambiguous historical participant backfill or destructive message migration is performed.

# Notifications

Message creation sends a minimal in-app notification that identifies the thread and message, without copying message bodies into notification payloads. Delivery remains distinct from conversation history.

# APIs

`/api/communication/threads` lists the current participant's threads and opens a direct contextual conversation. `/api/communication/threads/[id]` reads or sends a thread message, and `/api/communication/threads/[id]/read` records a participant-specific read state. Mutations require an idempotency key.

# RLS / Service Role

The old broad thread and message policies are replaced by participant plus current relationship checks. Direct writes to threads, participants, delivery events and messages are revoked from browser roles; security-definer RPCs perform the authorization and transaction checks.

# Idempotency / Concurrency

Direct sends and broadcasts require UUID idempotency keys. A unique sender/key index and transaction advisory locks return the original result for retries and prevent duplicate broadcast threads or messages.

# Performance

Indexes support Garden/Classroom list ordering, participant unread queries and message pagination. The APIs use bounded results and avoid per-thread unbounded message scans.

# Tests

`scripts/qa/check-management-messaging-threads.mjs` protects Parent/Child authorization, active-employment scope, IDOR boundaries, per-participant reads, idempotency, Inspector/Admin exclusion and Complaint/Task separation. Existing Management regression suites remain applicable.

# Live QA

LIVE MESSAGING QA: BLOCKED BY ENVIRONMENT. No controlled Parent, Garden Manager, multi-Garden Staff and revoked-Staff browser identities were available in this run.

# Carried QA Debt

GB-M21–M28 controlled browser, private-evidence and separate-connection concurrency QA remains open for GB-M35/GB-M40. This push adds controlled Parent↔Garden, Staff Classroom scope, broadcast audience and live attachment retrieval QA to that list.

# Remaining Debt

Legacy `messages` and older announcement screens remain read-only compatibility surfaces. Attachment upload UX can be connected only to the existing private-document boundary, without altering historical messages or accepting public URLs.

# Inputs For GB-M30

GB-M30 can consume canonical thread IDs, participant read state and bounded notification events without treating a Notification as a Message or granting authority through delivery membership.
